// src/panel/tabs/builder/tab.ts
import type { Dom } from "../../app/dom";
import type { Bus } from "../../app/bus";

import { createBuilderModel } from "./model";
import { createBuilderView } from "./view";

import * as actionLog from "../../../shared/actionLog";
import * as debugTrace from "../../../shared/debugTrace";
import { runtimeGetAssetUrl } from "../../platform/runtime";


function downloadJson(filename: string, jsonText: string): void {
  const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function createBuilderTab(dom: Dom, _bus: Bus) {
  const model = createBuilderModel();

  let mounted = false;
  let cachedRecipesAll: any = {};
  let cachedExamples: Array<{ id: string; title: string; path: string }> = [];


  // Cached VM source
  let statusText = "Idle";
  let cachedPipes = [] as Array<{ id: string; title: string; implemented: boolean; ops: unknown[] }>;
  let cachedOps = model.listOperations();

  async function loadExamplesIndex(): Promise<Array<{ id: string; title: string; path: string }>> {
    const url = runtimeGetAssetUrl("assets/pipelines/index.json");
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Examples index not found: ${res.status}`);
    const json = await res.json().catch(() => null);

    const arr = (json as any)?.examples;
    if (!Array.isArray(arr)) return [];

    return arr
      .map((x: any) => ({
        id: String(x?.id ?? ""),
        title: String(x?.title ?? x?.id ?? x?.path ?? "Example"),
        path: String(x?.path ?? ""),
      }))
      .filter((x: any) => x.id && x.path);
  }

  async function importExampleFromPath(examplePath: string): Promise<void> {
    const url = runtimeGetAssetUrl(examplePath);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Example fetch failed (${res.status}): ${examplePath}`);
    const text = await res.text();
    await model.importFromJsonText(text);
  }


  const view = createBuilderView({
    dom,
    handlers: {
      onImportFile: async (file: File) => {
        try {
          statusText = `Importing: ${file.name}`;
          render();

          const text = await file.text();
          const res = await model.importFromJsonText(text);

          actionLog.append({
            scope: "panel",
            kind: "info",
            message: `Builder import: imported=${res.imported}, skipped=${res.skipped}, total=${res.totalInFile}`,
          });

          statusText = `Imported ${res.imported} pipeline(s) (skipped ${res.skipped}).`;
          await refreshList();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);

          actionLog.append({ scope: "panel", kind: "error", message: `Builder import failed: ${msg}` });
          debugTrace.append({ scope: "panel", kind: "error", message: "Builder import failed", meta: { error: msg } });

          statusText = `Import failed: ${msg}`;
          render();
        }
      },

      onExport: async () => {
        try {
          statusText = "Exporting…";
          render();

          const jsonText = await model.exportToJsonText();
          downloadJson("beemage-user-pipelines.json", jsonText);

          actionLog.append({
            scope: "panel",
            kind: "info",
            message: "Builder export: downloaded beemage-user-pipelines.json",
          });

          statusText = "Exported.";
          render();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);

          actionLog.append({ scope: "panel", kind: "error", message: `Builder export failed: ${msg}` });
          debugTrace.append({ scope: "panel", kind: "error", message: "Builder export failed", meta: { error: msg } });

          statusText = `Export failed: ${msg}`;
          render();
        }
      },

      // NEW: pipeline management
      onDeletePipeline: async (pipelineId: string) => {
        try {
          await model.deleteUserPipelineById(pipelineId);
          await model.deleteAllRecipesForPipeline(pipelineId);

          actionLog.append({
            scope: "panel",
            kind: "info",
            message: `Builder: deleted user pipeline "${pipelineId}" (and its recipes)`,
          });

          statusText = `Deleted pipeline ${pipelineId}.`;
          await refreshList();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          actionLog.append({ scope: "panel", kind: "error", message: `Delete pipeline failed: ${msg}` });
          debugTrace.append({ scope: "panel", kind: "error", message: "Delete pipeline failed", meta: { pipelineId, error: msg } });
          statusText = `Delete failed: ${msg}`;
          render();
        }
      },

      onUpsertPipeline: async (p: any) => {
        try {
          await model.upsertUserPipeline(p);

          actionLog.append({
            scope: "panel",
            kind: "info",
            message: `Builder: saved user pipeline "${String(p?.id ?? "")}"`,
          });

          statusText = `Saved pipeline ${String(p?.id ?? "")}.`;
          await refreshList();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          actionLog.append({ scope: "panel", kind: "error", message: `Save pipeline failed: ${msg}` });
          debugTrace.append({ scope: "panel", kind: "error", message: "Save pipeline failed", meta: { error: msg } });
          statusText = `Save failed: ${msg}`;
          render();
        }
      },

      // NEW: recipe management
      onSelectRecipe: async (pipelineId: string, recipeId: string) => {
        try {
          await model.setSelectedRecipe(pipelineId, recipeId);

          actionLog.append({
            scope: "panel",
            kind: "info",
            message: `Builder: selected recipe "${recipeId}" for pipeline "${pipelineId}"`,
          });

          statusText = `Selected recipe ${recipeId} for ${pipelineId}.`;
          await refreshList();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          actionLog.append({ scope: "panel", kind: "error", message: `Select recipe failed: ${msg}` });
          debugTrace.append({ scope: "panel", kind: "error", message: "Select recipe failed", meta: { pipelineId, recipeId, error: msg } });
          statusText = `Select recipe failed: ${msg}`;
          render();
        }
      },

      onUpsertRecipe: async (pipelineId: string, recipe: any) => {
        try {
          await model.upsertRecipe(pipelineId, recipe);

          actionLog.append({
            scope: "panel",
            kind: "info",
            message: `Builder: saved recipe "${String(recipe?.id ?? "")}" for pipeline "${pipelineId}"`,
          });

          statusText = `Saved recipe ${String(recipe?.id ?? "")} for ${pipelineId}.`;
          await refreshList();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          actionLog.append({ scope: "panel", kind: "error", message: `Save recipe failed: ${msg}` });
          debugTrace.append({ scope: "panel", kind: "error", message: "Save recipe failed", meta: { pipelineId, error: msg } });
          statusText = `Save recipe failed: ${msg}`;
          render();
        }
      },

      onDeleteRecipe: async (pipelineId: string, recipeId: string) => {
        try {
          await model.deleteRecipe(pipelineId, recipeId);

          actionLog.append({
            scope: "panel",
            kind: "info",
            message: `Builder: deleted recipe "${recipeId}" from pipeline "${pipelineId}"`,
          });

          statusText = `Deleted recipe ${recipeId} from ${pipelineId}.`;
          await refreshList();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          actionLog.append({ scope: "panel", kind: "error", message: `Delete recipe failed: ${msg}` });
          debugTrace.append({ scope: "panel", kind: "error", message: "Delete recipe failed", meta: { pipelineId, recipeId, error: msg } });
          statusText = `Delete recipe failed: ${msg}`;
          render();
        }
      },
      onLoadExample: async (examplePath: string) => {
        try {
          statusText = `Loading example: ${examplePath}`;
          render();

          await importExampleFromPath(examplePath);

          actionLog.append({
            scope: "panel",
            kind: "info",
            message: `Builder example loaded: ${examplePath}`,
          });

          statusText = `Loaded example: ${examplePath}`;
          await refreshList();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);

          actionLog.append({ scope: "panel", kind: "error", message: `Load example failed: ${msg}` });
          debugTrace.append({ scope: "panel", kind: "error", message: "Load example failed", meta: { error: msg, examplePath } });

          statusText = `Load example failed: ${msg}`;
          render();
        }
      },

    },
  });


  async function refreshList(): Promise<void> {
    const pipes = await model.listUserPipelines().catch(() => []);
    cachedPipes = pipes as any;

    cachedOps = model.listOperations();

    cachedRecipesAll = await model.listAllRecipes().catch(() => ({} as any));

    cachedExamples = await loadExamplesIndex().catch(() => []);

    statusText = `Ready. User pipelines: ${pipes.length} · Operations: ${cachedOps.length} · Examples: ${cachedExamples.length}`;
    render();
  }




  function getVm() {
    const raw = (cachedPipes ?? []) as any[];

    return {
      statusText,
      pipelines: raw.map((p: any) => ({
        id: String(p.id),
        title: String(p.title),
        implemented: !!p.implemented,
        opCount: Array.isArray(p.ops) ? p.ops.length : 0,
      })),
      userPipelinesRaw: raw,
      ops: cachedOps,
      recipesAll: cachedRecipesAll ?? {},
      examples: cachedExamples ?? [],
    };
  }




  function render(): void {
    view.mount();
    view.render(getVm());
  }

  function bind(): void {
    view.bind();
    dom.builderStatusEl.textContent = "Idle";
  }

  async function mount(): Promise<void> {
    mounted = true;
    statusText = "Loading…";
    render();

    await refreshList();
  }

  async function refresh(): Promise<void> {
    if (!mounted) return;
    statusText = "Refreshing…";
    render();

    await refreshList();
  }

  function unmount(): void {
    mounted = false;
  }

  function dispose(): void {
    view.dispose();
  }

  return { bind, mount, refresh, unmount, dispose };
}
