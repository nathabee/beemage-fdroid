// src/panel/app/pipeline/ui/recipeManagementCard.ts
import type { PipelineId, OpInstanceId } from "../type";
import type { PipelineRecipe, RecipeId } from "../recipeStore";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (typeof text === "string") e.textContent = text;
  return e;
}

function safeJsonParse<T>(text: string): T {
  const v = JSON.parse(text);
  return v as T;
}

function nowTs(): number {
  return Date.now();
}

export type RecipeManagementHandlers = {
  onSelectRecipe: (pipelineId: PipelineId, recipeId: RecipeId) => Promise<void> | void;
  onUpsertRecipe: (pipelineId: PipelineId, recipe: Omit<PipelineRecipe, "updatedTs">) => Promise<void> | void;
  onDeleteRecipe: (pipelineId: PipelineId, recipeId: RecipeId) => Promise<void> | void;
};

export function createRecipeManagementCard(args: {
  pipelineId: PipelineId;
  instanceIds: ReadonlyArray<OpInstanceId>;
  selectedRecipeId?: RecipeId;
  recipes: ReadonlyArray<PipelineRecipe>;
  handlers: RecipeManagementHandlers;
}): HTMLDivElement {
  const { pipelineId, instanceIds, selectedRecipeId, recipes, handlers } = args;

  const root = el("div", { class: "card", style: "padding:10px; margin-top:8px;" }) as HTMLDivElement;
  root.appendChild(el("div", { class: "cardTitle" }, "Recipes"));

  const row = el("div", { class: "row", style: "gap:10px; align-items:center; flex-wrap:wrap; margin-top:8px;" });
  root.appendChild(row);

  // Select dropdown
  const lblSel = el("label", { class: "fieldInline" });
  lblSel.appendChild(el("span", {}, "Selected"));
  const sel = el("select") as HTMLSelectElement;

  const optNone = el("option") as HTMLOptionElement;
  optNone.value = "";
  optNone.textContent = "None";
  sel.appendChild(optNone);

  for (const r of recipes) {
    const opt = el("option") as HTMLOptionElement;
    opt.value = r.id;
    opt.textContent = `${r.title} (${r.id})`;
    sel.appendChild(opt);
  }

  sel.value = selectedRecipeId ?? "";
  sel.addEventListener("change", () => {
    const id = sel.value;
    if (!id) return;
    void handlers.onSelectRecipe(pipelineId, id);
  });

  lblSel.appendChild(sel);
  row.appendChild(lblSel);

  // Buttons
  const btnNew = el("button", { class: "btn", type: "button" }, "New recipe") as HTMLButtonElement;
  const btnEdit = el("button", { class: "btn", type: "button" }, "Edit recipe") as HTMLButtonElement;
  const btnDel = el("button", { class: "btn", type: "button" }, "Delete recipe") as HTMLButtonElement;

  row.appendChild(btnNew);
  row.appendChild(btnEdit);
  row.appendChild(btnDel);

  const hint = el(
    "div",
    { class: "muted", style: "font-size:12px; margin-top:8px;" },
    `Recipes store only deltas per instanceId. Valid instanceIds: ${instanceIds.join(", ") || "(none)"}`,
  );
  root.appendChild(hint);

  function promptNewRecipe(): void {
    const id = window.prompt("New recipe id (unique within this pipeline):", "new");
    if (!id) return;

    const title = window.prompt("Recipe title:", id);
    if (!title) return;

    // Start empty (no patches)
    void handlers.onUpsertRecipe(pipelineId, { id, title, ops: [] });
  }

  function promptEditRecipe(): void {
    const rid = (selectedRecipeId ?? sel.value) || "";
    if (!rid) {
      window.alert("Select a recipe first.");
      return;
    }

    const r = recipes.find((x) => x.id === rid);
    if (!r) {
      window.alert("Recipe not found.");
      return;
    }

    // Provide a minimal JSON editor. User can edit ops patches safely.
    const template = {
      id: r.id,
      title: r.title,
      ops: r.ops,
    };

    const text = window.prompt(
      `Edit recipe JSON (pipeline=${pipelineId}).\n\nStructure: { id, title, ops: [{ instanceId, enabled?, override?: { enginePolicy?, params? } }] }\n\n`,
      JSON.stringify(template, null, 2),
    );
    if (!text) return;

    try {
      const edited = safeJsonParse<{ id: string; title: string; ops: any[] }>(text);

      if (typeof edited.id !== "string" || !edited.id) throw new Error("Missing recipe.id");
      if (typeof edited.title !== "string" || !edited.title) throw new Error("Missing recipe.title");
      if (!Array.isArray(edited.ops)) throw new Error("Missing recipe.ops array");

      // Light validation: instanceId must exist in pipeline instances (recommended)
      for (const p of edited.ops) {
        if (!p || typeof p !== "object") throw new Error("Invalid patch object in ops");
        if (typeof p.instanceId !== "string" || !p.instanceId) throw new Error("Patch missing instanceId");
        // allow patches even if unknown, but warn in console
        if (instanceIds.length && !instanceIds.includes(p.instanceId)) {
          // eslint-disable-next-line no-console
          console.warn("Recipe patch references unknown instanceId", pipelineId, p.instanceId);
        }
      }

      void handlers.onUpsertRecipe(pipelineId, {
        id: edited.id,
        title: edited.title,
        ops: edited.ops,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(`Invalid recipe JSON: ${msg}`);
    }
  }

  function confirmDeleteRecipe(): void {
    const rid = (selectedRecipeId ?? sel.value) || "";
    if (!rid) {
      window.alert("Select a recipe first.");
      return;
    }
    const ok = window.confirm(`Delete recipe "${rid}" from pipeline "${pipelineId}"?`);
    if (!ok) return;
    void handlers.onDeleteRecipe(pipelineId, rid);
  }

  btnNew.addEventListener("click", promptNewRecipe);
  btnEdit.addEventListener("click", promptEditRecipe);
  btnDel.addEventListener("click", confirmDeleteRecipe);

  // If no recipes, disable edit/delete.
  if (!recipes.length) {
    btnEdit.disabled = true;
    btnDel.disabled = true;
  }

  return root;
}
