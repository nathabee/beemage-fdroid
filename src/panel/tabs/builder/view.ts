// src/panel/tabs/builder/view.ts 
import type { Dom } from "../../app/dom";
import type { OpSpec, PipelineDef, ArtifactType } from "../../app/pipeline/type";
import { createOperationCard } from "../../app/pipeline/ui/operationCard";
import { createPipelineManagementCard } from "../../app/pipeline/ui/pipelineManagementCard";
import { createPipelinePlayground, type PipelinePlayground } from "./pipelinePlayground";


export type BuilderRowVm = {
  id: string;
  title: string;
  implemented: boolean;
  opCount: number;
};

export type BuilderVm = {
  statusText: string;

  pipelines: BuilderRowVm[];

  ops: ReadonlyArray<OpSpec>;

  userPipelinesRaw: ReadonlyArray<PipelineDef>;

  // all recipes keyed by pipelineId
  recipesAll: Record<string, any>;

  // NEW: example bundles available in assets/pipelines/
  examples: Array<{ id: string; title: string; path: string }>;
};



export type BuilderViewHandlers = {
  onImportFile: (file: File) => Promise<void>;
  onExport: () => Promise<void>;

  // NEW: load example bundle from assets
  onLoadExample: (examplePath: string) => Promise<void>;

  // pipeline management
  onDeletePipeline: (pipelineId: string) => Promise<void>;
  onUpsertPipeline: (p: PipelineDef) => Promise<void>;

  // recipe management
  onSelectRecipe: (pipelineId: string, recipeId: string) => Promise<void>;
  onUpsertRecipe: (pipelineId: string, recipe: any) => Promise<void>;
  onDeleteRecipe: (pipelineId: string, recipeId: string) => Promise<void>;
};



export type BuilderView = {
  bind(): void;
  mount(): void;
  render(vm: BuilderVm): void;
  dispose(): void;
};

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

export function createBuilderView(args: { dom: Dom; handlers: BuilderViewHandlers }): BuilderView {
  const { dom, handlers } = args;

  let mounted = false;
  let bound = false;


  // Filters (default = all)
  let filterInput: ArtifactType | "all" = "all";
  let filterOutput: ArtifactType | "all" = "all";


  // Filter controls
  let selFilterInput: HTMLSelectElement | null = null;
  let selFilterOutput: HTMLSelectElement | null = null;


  // Pipeline name/id filter (stored pipelines board)
  let pipelineQuery = "";
  let inpPipelineQuery: HTMLInputElement | null = null;

  // We render into this mount (created once inside viewBuilder).
  let listMountEl: HTMLDivElement | null = null;
  // Ops grid mount
  let opsMountEl: HTMLDivElement | null = null;


  // Track current selected file.
  let selectedFile: File | null = null;

  // Two-column layout mounts
  let layoutMountEl: HTMLDivElement | null = null;
  let leftColEl: HTMLDivElement | null = null;
  let rightColEl: HTMLDivElement | null = null;

  // Playground mount + component
  let playgroundMountEl: HTMLDivElement | null = null;
  let playground: PipelinePlayground | null = null;



  function ensureListMount(): HTMLDivElement {
    if (listMountEl) return listMountEl;

    // Create a stable mount at the end of the builder view.
    const m = el("div", { "data-role": "builderListMount", style: "margin-top:12px;" }) as HTMLDivElement;
    dom.viewBuilder.appendChild(m);
    listMountEl = m;
    return m;
  }

  function clearListMount(): void {
    if (!listMountEl) return;
    listMountEl.innerHTML = "";
  }




  function ensureOpsMount(): HTMLDivElement {
    ensureLayoutMount();

    if (opsMountEl) return opsMountEl;
    const m = el("div", { "data-role": "builderOpsMount" }) as HTMLDivElement;

    // Ops list belongs in the left column.
    (leftColEl ?? dom.viewBuilder).appendChild(m);

    opsMountEl = m;
    return m;
  }


  function clearOpsMount(): void {
    if (!opsMountEl) return;
    opsMountEl.innerHTML = "";
  }


  function ensureLayoutMount(): void {
    if (layoutMountEl) return;

    layoutMountEl = el("div", {
      "data-role": "builderLayout",
      style: "display:flex; gap:12px; align-items:flex-start; margin-top:12px;",
    }) as HTMLDivElement;

    leftColEl = el("div", {
      "data-role": "builderLeftCol",
      style: "flex:1; min-width:320px;",
    }) as HTMLDivElement;

    rightColEl = el("div", {
      "data-role": "builderRightCol",
      style: "flex:1; min-width:320px;",
    }) as HTMLDivElement;

    layoutMountEl.appendChild(leftColEl);
    layoutMountEl.appendChild(rightColEl);

    dom.viewBuilder.appendChild(layoutMountEl);
  }


  function buildTypeSelect(current: string, onChange: (v: string) => void): HTMLSelectElement {
    const s = el("select") as HTMLSelectElement;

    const options: Array<{ value: string; label: string }> = [
      { value: "all", label: "All" },
      { value: "image", label: "image" },
      { value: "mask", label: "mask" },
      { value: "svg", label: "svg" },
    ];

    for (const o of options) {
      const opt = el("option") as HTMLOptionElement;
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.value === current) opt.selected = true;
      s.appendChild(opt);
    }

    s.addEventListener("change", () => onChange(s.value));
    return s;
  }

  function ensurePlaygroundMount(): HTMLDivElement {
    ensureLayoutMount();

    if (playgroundMountEl) return playgroundMountEl;

    const m = el("div", { "data-role": "builderPlaygroundMount" }) as HTMLDivElement;

    // Playground belongs in the right column.
    (rightColEl ?? dom.viewBuilder).appendChild(m);

    playgroundMountEl = m;

    // Create playground once
    playground = createPipelinePlayground({
      mountEl: playgroundMountEl,
      onSavePipeline: async (p) => {
        await handlers.onUpsertPipeline(p);
      },
    });

    return m;
  }


  function passesFilter(op: OpSpec): boolean {
    const inOk = filterInput === "all" ? true : op.io.input === filterInput;
    const outOk = filterOutput === "all" ? true : op.io.output === filterOutput;
    return inOk && outOk;
  }



  function renderOps(ops: ReadonlyArray<OpSpec>, vm?: BuilderVm): void {
    const m = ensureOpsMount();
    m.innerHTML = "";

    const card = el("div", { class: "card", style: "padding:10px;" });
    card.appendChild(el("div", { class: "cardTitle" }, "All operations"));

    // Controls row: IO filters (ONLY for operations)
    const controls = el("div", {
      class: "row",
      style: "align-items:center; gap:10px; flex-wrap:wrap; margin-top:10px;",
    });

    const lblIn = el("label", { class: "fieldInline" });
    lblIn.appendChild(el("span", {}, "Filter input"));
    selFilterInput = buildTypeSelect(String(filterInput), (v) => {
      filterInput = (v === "all" ? "all" : (v as any));
      // re-render ops only
      renderOps(ops, vm);
    });
    lblIn.appendChild(selFilterInput);

    const lblOut = el("label", { class: "fieldInline" });
    lblOut.appendChild(el("span", {}, "Filter output"));
    selFilterOutput = buildTypeSelect(String(filterOutput), (v) => {
      filterOutput = (v === "all" ? "all" : (v as any));
      // re-render ops only
      renderOps(ops, vm);
    });
    lblOut.appendChild(selFilterOutput);

    controls.appendChild(lblIn);
    controls.appendChild(lblOut);
    card.appendChild(controls);

    const filtered = ops.filter(passesFilter);

    if (!filtered.length) {
      card.appendChild(
        el("div", { class: "muted", style: "font-size:12px; margin-top:10px;" }, "No operations match the filter."),
      );
      m.appendChild(card);
      return;
    }

    const grid = el("div", { class: "opsGrid", style: "margin-top:10px;" }) as HTMLDivElement;

    for (const op of filtered) {
      const cardEl = createOperationCard(op, {
        compact: true,
        showGroup: true,
        showId: true,
        portStyle: "puzzle",
        cardStyle: "plain",
      });

      // Make draggable for the playground
      cardEl.setAttribute("draggable", "true");
      cardEl.addEventListener("dragstart", (ev) => {
        ev.dataTransfer?.setData("application/x-beemage-opid", op.id);
        ev.dataTransfer?.setData("text/plain", op.id);
        if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "copy";
      });

      grid.appendChild(cardEl);
    }


    card.appendChild(grid);
    m.appendChild(card);
  }



  function renderList(_pipelines: BuilderRowVm[], vm: BuilderVm): void {
    const m = ensureListMount();
    m.innerHTML = "";

    const card = el("div", { class: "card", style: "padding:10px;" });
    card.appendChild(el("div", { class: "cardTitle" }, "Stored user pipelines"));

    // Controls row: examples + pipeline filter
    const controls = el("div", {
      class: "row",
      style: "align-items:center; gap:10px; flex-wrap:wrap; margin-top:10px;",
    });

    // --- Examples select + load button ---
    const examples = Array.isArray(vm.examples) ? vm.examples : [];

    const lblExample = el("label", { class: "fieldInline" });
    lblExample.appendChild(el("span", {}, "Load example"));

    const selExample = el("select", { style: "min-width:260px;" }) as HTMLSelectElement;

    // Default option
    {
      const opt = el("option") as HTMLOptionElement;
      opt.value = "";
      opt.textContent = examples.length ? "Select an example…" : "No examples available";
      opt.selected = true;
      selExample.appendChild(opt);
    }

    for (const ex of examples) {
      const opt = el("option") as HTMLOptionElement;
      opt.value = String(ex.path ?? "");
      opt.textContent = String(ex.title ?? ex.id ?? ex.path ?? "Example");
      selExample.appendChild(opt);
    }

    lblExample.appendChild(selExample);

    const btnLoadExample = el(
      "button",
      { type: "button", class: "btn", style: "padding:4px 10px; font-size:12px;" },
      "Load",
    ) as HTMLButtonElement;

    btnLoadExample.disabled = true;

    selExample.addEventListener("change", () => {
      btnLoadExample.disabled = !selExample.value;
    });

    btnLoadExample.addEventListener("click", () => {
      const path = selExample.value;
      if (!path) return;
      void handlers.onLoadExample(path);
      // optional: reset UI to default
      selExample.value = "";
      btnLoadExample.disabled = true;
    });

    // --- Pipeline name/id filter ---
    const lblQuery = el("label", { class: "fieldInline" });
    lblQuery.appendChild(el("span", {}, "Filter pipelines"));

    inpPipelineQuery = el("input", {
      type: "text",
      value: pipelineQuery,
      placeholder: "Search by id or title…",
      style: "min-width:260px;",
    }) as HTMLInputElement;

    inpPipelineQuery.addEventListener("input", () => {
      pipelineQuery = inpPipelineQuery ? inpPipelineQuery.value : "";
      renderList(vm.pipelines, vm);
    });

    lblQuery.appendChild(inpPipelineQuery);

    const btnClear = el(
      "button",
      { type: "button", class: "btn", style: "padding:4px 10px; font-size:12px;" },
      "Clear",
    );
    btnClear.addEventListener("click", () => {
      pipelineQuery = "";
      if (inpPipelineQuery) inpPipelineQuery.value = "";
      renderList(vm.pipelines, vm);
    });

    controls.appendChild(lblExample);
    controls.appendChild(btnLoadExample);
    controls.appendChild(lblQuery);
    controls.appendChild(btnClear);

    card.appendChild(controls);

    // Management board
    const rawPipes = Array.isArray(vm.userPipelinesRaw) ? vm.userPipelinesRaw : [];
    if (!rawPipes.length) {
      card.appendChild(
        el("div", { class: "muted", style: "font-size:12px; margin-top:10px;" }, "No user pipelines stored."),
      );
      m.appendChild(card);
      return;
    }

    const q = pipelineQuery.trim().toLowerCase();
    const filteredPipes =
      q.length === 0
        ? rawPipes
        : rawPipes.filter((p) => {
          const id = String(p.id ?? "").toLowerCase();
          const title = String(p.title ?? "").toLowerCase();
          return id.includes(q) || title.includes(q);
        });

    if (!filteredPipes.length) {
      card.appendChild(
        el("div", { class: "muted", style: "font-size:12px; margin-top:10px;" }, "No pipelines match the search."),
      );
      m.appendChild(card);
      return;
    }

    const board = el("div", {
      style: "margin-top:10px; display:flex; flex-direction:column; gap:10px;",
    }) as HTMLDivElement;

    const allRecipes = (vm.recipesAll ?? {}) as any;

    for (const pDef of filteredPipes) {
      const st = allRecipes?.[pDef.id] ?? { recipesById: {}, selectedRecipeId: undefined };
      const recipesById = st?.recipesById ?? {};
      const recipes = Object.values(recipesById) as any[];
      const selectedRecipeId = st?.selectedRecipeId as string | undefined;

      board.appendChild(
        createPipelineManagementCard({
          pipeline: pDef,
          opsLibrary: vm.ops ?? [],
          selectedRecipeId,
          recipes,
          handlers: {
            onDeletePipeline: handlers.onDeletePipeline,
            onUpsertPipeline: handlers.onUpsertPipeline,
            onSelectRecipe: handlers.onSelectRecipe,
            onUpsertRecipe: handlers.onUpsertRecipe,
            onDeleteRecipe: handlers.onDeleteRecipe,
          },
        }),
      );
    }

    card.appendChild(board);
    m.appendChild(card);
  }



  function bind(): void {
    if (bound) return;
    bound = true;

    // Import file picker
    dom.builderImportFileEl.addEventListener("change", () => {
      selectedFile = dom.builderImportFileEl.files?.[0] ?? null;
    });

    // Export button
    dom.btnBuilderExportEl.addEventListener("click", () => {
      void handlers.onExport();
    });

    // Optional: import immediately on file select (simple UX, zero extra button)
    dom.builderImportFileEl.addEventListener("change", () => {
      const f = dom.builderImportFileEl.files?.[0] ?? null;
      if (!f) return;
      void handlers.onImportFile(f);
      // reset picker to allow re-importing same file without reloading page
      dom.builderImportFileEl.value = "";
      selectedFile = null;
    });
  }
  function mount(): void {
    if (mounted) return;
    mounted = true;

    // Create 2-col layout + mounts
    ensureLayoutMount();
    ensureOpsMount();
    ensurePlaygroundMount();

    // Stored pipelines list stays below the 2 columns
    ensureListMount();
  }



  function render(vm: BuilderVm): void {
    dom.builderStatusEl.textContent = vm.statusText || "Idle";

    // Ensure mounts exist
    ensureLayoutMount();
    ensureOpsMount();
    ensurePlaygroundMount();
    ensureListMount();

    // Right column: playground
    playground?.render({ opsLibrary: vm.ops ?? [] });

    // Left column: ops library
    renderOps(vm.ops ?? [], vm);

    // Below: stored pipelines management board
    renderList(vm.pipelines, vm);
  }



  function dispose(): void {
    mounted = false;
    bound = false;
    selectedFile = null;

    filterInput = "all";
    filterOutput = "all";
    pipelineQuery = "";
    inpPipelineQuery = null;

    selFilterInput = null;
    selFilterOutput = null;

    if (listMountEl) {
      listMountEl.innerHTML = "";
      listMountEl.remove();
      listMountEl = null;
    }

    if (opsMountEl) {
      opsMountEl.innerHTML = "";
      opsMountEl.remove();
      opsMountEl = null;
    }

    playground?.dispose();
    playground = null;

    if (playgroundMountEl) {
      playgroundMountEl.innerHTML = "";
      playgroundMountEl.remove();
      playgroundMountEl = null;
    }

    if (layoutMountEl) {
      layoutMountEl.innerHTML = "";
      layoutMountEl.remove();
      layoutMountEl = null;
      leftColEl = null;
      rightColEl = null;
    }

  }




  return { bind, mount, render, dispose };
}
