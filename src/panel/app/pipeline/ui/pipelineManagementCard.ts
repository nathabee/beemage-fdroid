// src/panel/app/pipeline/ui/pipelineManagementCard.ts
import type { PipelineDef, PipelineId, OpSpec } from "../type";
import type { PipelineRecipe, RecipeId } from "../recipeStore";
import { createPipelineCard } from "./pipelineCard";
import { createRecipeManagementCard, type RecipeManagementHandlers } from "./recipeManagementCard";

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

export type PipelineManagementHandlers = RecipeManagementHandlers & {
  onDeletePipeline: (pipelineId: PipelineId) => Promise<void> | void;
  onUpsertPipeline: (pipeline: PipelineDef) => Promise<void> | void;
};

export function createPipelineManagementCard(args: {
  pipeline: PipelineDef;
  opsLibrary: ReadonlyArray<OpSpec>;
  selectedRecipeId?: RecipeId;
  recipes: ReadonlyArray<PipelineRecipe>;
  handlers: PipelineManagementHandlers;
}): HTMLDivElement {
  const { pipeline, opsLibrary, selectedRecipeId, recipes, handlers } = args;

  const root = el("div", { class: "card", style: "padding:10px; margin-top:10px;" }) as HTMLDivElement;

  const header = el("div", { class: "row", style: "justify-content:space-between; align-items:center; gap:10px;" });
  const title = el("div", { class: "cardTitle" }, `${pipeline.title} (${pipeline.id})`);
  header.appendChild(title);

  const btnRow = el("div", { class: "row", style: "gap:8px; align-items:center;" });
  const btnEdit = el("button", { class: "btn", type: "button" }, "Edit") as HTMLButtonElement;
  const btnDel = el("button", { class: "btn", type: "button" }, "Delete") as HTMLButtonElement;
  btnRow.appendChild(btnEdit);
  btnRow.appendChild(btnDel);

  header.appendChild(btnRow);
  root.appendChild(header);

  if (pipeline.description) {
    root.appendChild(el("div", { class: "muted", style: "font-size:12px; margin-top:6px;" }, pipeline.description));
  }

  // Show the pipeline details (existing card)
  const details = el("div", { style: "margin-top:10px;" });
  details.appendChild(
    createPipelineCard(pipeline, opsLibrary, {
      showId: false,
      showDescription: false,
      showImplementationFlag: true,
      showConnectors: true,
      showDisabledOps: true,
      compactOps: true,
    }),
  );
  root.appendChild(details);

  // Recipes panel
  const instanceIds = pipeline.ops.map((x) => x.instanceId);
  root.appendChild(
    createRecipeManagementCard({
      pipelineId: pipeline.id,
      instanceIds,
      selectedRecipeId,
      recipes,
      handlers,
    }),
  );

  function promptEditPipeline(): void {
    const template = {
      id: pipeline.id,
      title: pipeline.title,
      description: pipeline.description ?? "",
      implemented: pipeline.implemented,
      ops: pipeline.ops,
    };

    const text = window.prompt(
      `Edit pipeline JSON.\n\nStructure: { id, title, description?, implemented, ops: [{ instanceId, opId, enabled?, override? }] }\n\n`,
      JSON.stringify(template, null, 2),
    );
    if (!text) return;

    try {
      const edited = safeJsonParse<any>(text);

      if (!edited || typeof edited !== "object") throw new Error("Invalid JSON object");
      if (typeof edited.id !== "string" || !edited.id) throw new Error("Missing pipeline.id");
      if (typeof edited.title !== "string" || !edited.title) throw new Error("Missing pipeline.title");
      if (typeof edited.implemented !== "boolean") throw new Error("Missing pipeline.implemented boolean");
      if (!Array.isArray(edited.ops)) throw new Error("Missing pipeline.ops array");

      for (const op of edited.ops) {
        if (!op || typeof op !== "object") throw new Error("Invalid op entry");
        if (typeof op.instanceId !== "string" || !op.instanceId) throw new Error("Op missing instanceId");
        if (typeof op.opId !== "string" || !op.opId) throw new Error("Op missing opId");
        if (op.enabled !== undefined && typeof op.enabled !== "boolean") throw new Error("Op.enabled must be boolean");
      }

      void handlers.onUpsertPipeline(edited as PipelineDef);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(`Invalid pipeline JSON: ${msg}`);
    }
  }

  function confirmDeletePipeline(): void {
    const ok = window.confirm(`Delete pipeline "${pipeline.id}"? This also deletes its recipes.`);
    if (!ok) return;
    void handlers.onDeletePipeline(pipeline.id);
  }

  btnEdit.addEventListener("click", promptEditPipeline);
  btnDel.addEventListener("click", confirmDeletePipeline);

  return root;
}
