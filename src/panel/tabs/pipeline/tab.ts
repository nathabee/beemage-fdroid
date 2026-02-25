// src/panel/tabs/pipeline/tab.ts
import type { Dom } from "../../app/dom";
import type { Bus } from "../../app/bus";
import { createPipelineView } from "./view";
import type { PipelineView } from "./view";
import { createPipelineModel } from "./model";

import * as debugTrace from "../../../shared/debugTrace";
import * as actionLog from "../../../shared/actionLog";
import type { TuningController } from "../../app/tuning/controller";
import type { ParamValue } from "../../app/tuning/types";
import { setLastPipelineOutputFromVm } from "../../app/pipeline/outputStore";
import { onPipelineStorageChanged, type PipelineStorageChange } from "../../app/pipeline/storageSignals";
import type { Artifact, ImageArtifact } from "../../app/pipeline/type";

export function createPipelineTab(dom: Dom, _bus: Bus, tuning: TuningController) {
  const model = createPipelineModel({
    runner: {
      getEffectiveParams: async (tuningId: string) => {
        const p = await tuning.getEffectiveParams(tuningId).catch(() => ({} as Record<string, ParamValue>));
        return p as Record<string, ParamValue>;
      },
      debug: (message, meta) =>
        debugTrace.append({
          scope: "panel",
          kind: "debug",
          message,
          meta,
        }),
    },
  });

  let view: PipelineView | null = null;
  let mounted = false;

  // Track which tuning subtree is currently mounted into the Pipeline tab slot.
  let mountedScopeRootId: string | null = null;
  let lastSurfacedError: string | null = null;
  let unsubscribePipelineSignals: (() => void) | null = null;

  let autoReloadQueued = false;
  const autoReloadReasons: string[] = [];

  function attachPipelineSignals(): void {
    if (unsubscribePipelineSignals) return;

    unsubscribePipelineSignals = onPipelineStorageChanged((change: PipelineStorageChange) => {
      if (!mounted) return;

      autoReloadReasons.push(`${change.kind}:${change.reason}`);
      scheduleAutoReloadFromStorage();
    });

  }

  function detachPipelineSignals(): void {
    unsubscribePipelineSignals?.();
    unsubscribePipelineSignals = null;
  }

  function scheduleAutoReloadFromStorage(): void {
    if (autoReloadQueued) return;
    autoReloadQueued = true;

    queueMicrotask(() => {
      autoReloadQueued = false;
      const reason = autoReloadReasons.splice(0, autoReloadReasons.length).join(",") || "unknown";
      void autoReloadCatalogueNow(reason);
    });
  }

  async function autoReloadCatalogueNow(reason: string): Promise<void> {
    // Keep this out of user-visible log to avoid spam.
    debugTrace.append({
      scope: "panel",
      kind: "info",
      message: "Pipeline tab: auto reload catalogue",
      meta: { reason },
    });

    const before = model.getVm();
    const beforePipeline = String(before.activePipelineId ?? "");
    const beforeRecipe = String(before.activeRecipeId ?? "");

    try {
      await model.reloadCatalogue();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      debugTrace.append({
        scope: "panel",
        kind: "error",
        message: "Pipeline tab: auto reloadCatalogue failed",
        meta: { reason, error: msg },
      });

      actionLog.append({
        scope: "panel",
        kind: "error",
        message: "Pipeline catalogue refresh failed (auto).",
      });

      return;
    }

    const after = model.getVm();
    const afterPipeline = String(after.activePipelineId ?? "");
    const afterRecipe = String(after.activeRecipeId ?? "");

    // If selection got invalidated (deleted pipeline/recipe), tell the user once.
    if (beforePipeline !== afterPipeline || beforeRecipe !== afterRecipe) {
      actionLog.append({
        scope: "panel",
        kind: "info",
        message: `Pipeline selection updated due to storage change: ${beforePipeline}/${beforeRecipe} → ${afterPipeline}/${afterRecipe}`,
      });

      // Keep tuning consistent with model selection.
      void tuning.setParamValue("pipeline", "mode", afterPipeline);
      void tuning.setParamValue("pipeline", "recipe", afterRecipe);
    }

    // Ensure tuning subtree matches potentially changed pipeline
    mountScopedTuningForActivePipeline();

    // Publish vm output snapshot (safe; other tabs read this)
    setLastPipelineOutputFromVm(after);

    render();
  }


  async function resetAndReloadFromStorage(): Promise<void> {
    model.reset();

    const a = readSourceInputArtifact();
    if (a) model.setInputArtifact(a);

    // Publish cleared state for other tabs
    setLastPipelineOutputFromVm(model.getVm());

    actionLog.append({ scope: "panel", kind: "info", message: "Pipeline reset (reseed from source)" });

    // Critical: rehydrate catalogue (built-ins + user pipelines) so combobox reflects storage.
    try {
      await model.reloadCatalogue();
    } catch (e) {
      debugTrace.append({
        scope: "panel",
        kind: "error",
        message: "Pipeline reset: reloadCatalogue() failed",
        meta: { error: e instanceof Error ? e.message : String(e) },
      });

      actionLog.append({
        scope: "panel",
        kind: "error",
        message: "Pipeline reset: failed to reload pipeline catalogue from storage.",
      });
    }

    // Re-apply tuning selection AFTER catalogue refresh, so newly added pipelines can be selected.
    try {
      await syncPipelineFromTuning();
    } catch (e) {
      debugTrace.append({
        scope: "panel",
        kind: "error",
        message: "Pipeline reset: syncPipelineFromTuning() failed",
        meta: { error: e instanceof Error ? e.message : String(e) },
      });

      // Defensive fallback: keep tuning mount sane even if sync fails.
      mountScopedTuningForActivePipeline();
    }

    // Publish final vm after catalogue/sync
    setLastPipelineOutputFromVm(model.getVm());

    render();
  }

  function surfacePipelineErrorsToActionLog(): void {
    const vm = model.getVm();
    const hasError = vm.stages.some((s) => s.state === "error") || String(vm.statusText).toLowerCase().includes("error");

    if (!hasError) {
      lastSurfacedError = null;
      return;
    }

    const msg = String(vm.statusText || "Pipeline error");
    if (msg === lastSurfacedError) return;
    lastSurfacedError = msg;

    actionLog.append({
      scope: "panel",
      kind: "error",
      message: `Pipeline: ${msg}`,
    });
  }

  function clearPipelineTuningMount(): void {
    dom.pipelineTuningMountEl.innerHTML = "";
  }

  function pickScopeCandidates(pipelineId: string): string[] {
    // Universal strategy:
    // 1) Try the pipeline id directly (segmentation, later edge/clean/surface if you make them root nodes).
    // 2) Try "pipeline.<id>" in case you decide to nest under pipeline.* later.
    // 3) Fall back to "pipeline" (UI state node: mode/recipe).
    return [pipelineId, `pipeline.${pipelineId}`, "pipeline"];
  }

  function mountPipelineTuningForPipelineId(pipelineId: string): void {
    const candidates = pickScopeCandidates(pipelineId);

    // If we’re already mounted to the best candidate (first one that works), we’ll keep it.
    // But we don’t know which one works until we try. So:
    // - If current mount matches any candidate, we still attempt the first candidate first,
    //   and short-circuit only if it equals mountedScopeRootId.
    if (mountedScopeRootId === candidates[0]) return;

    clearPipelineTuningMount();

    let mountedOk: string | null = null;
    let lastErr: unknown = null;

    for (const scopeRootId of candidates) {
      try {
        tuning.mount({ mountEl: dom.pipelineTuningMountEl, scopeRootId });
        mountedOk = scopeRootId;
        break;
      } catch (e) {
        lastErr = e;
        // Clear mount slot before next attempt (defensive).
        clearPipelineTuningMount();
      }
    }

    if (!mountedOk) {
      // Absolute fallback: leave it empty, but log what happened.
      mountedScopeRootId = null;

      actionLog.append({
        scope: "panel",
        kind: "info",
        message: `Pipeline tuning mount failed for "${pipelineId}" (no matching scope).`,
      });

      debugTrace.append({
        scope: "panel",
        kind: "error",
        message: "Pipeline tuning mount failed (no candidate scopeRootId worked)",
        meta: {
          pipelineId,
          candidates,
          error: lastErr instanceof Error ? lastErr.message : String(lastErr),
        },
      });

      return;
    }

    mountedScopeRootId = mountedOk;

    actionLog.append({
      scope: "panel",
      kind: "info",
      message: `Pipeline tuning mount: pipelineId=${pipelineId}, scopeRootId=${mountedOk}`,
    });
  }

  function mountScopedTuningForActivePipeline(): void {
    const vm = model.getVm();
    const pipelineId = typeof vm.activePipelineId === "string" ? vm.activePipelineId : "segmentation";
    mountPipelineTuningForPipelineId(pipelineId);
  }

  function makeImageArtifact(img: ImageData): ImageArtifact {
    return { type: "image", width: img.width, height: img.height, image: img };
  }

  /**
   * Phase 3: Source of truth for pipeline input is app__.input__ (Image tab publishes it).
   * Back-compat fallback: if app__.input__ is missing, use srcCanvas as before.
   *
   * Expected placeholder shapes (tolerant):
   * - { kind: "image", image: ImageData }
   * - { kind: "image", data: ImageData }
   * - { kind: "imageList", images: ImageData[] }
   * - { kind: "imageList", items: ImageData[] }
   */
  function readSourceInputArtifact(): Artifact | null {
    const app = (globalThis as any)?.app__;
    const input = app?.input__;

    // 1) Preferred: app__.input__ (multi-image aware)
    if (input && typeof input === "object") {
      const kind = String((input as any).kind ?? "");

      if (kind === "image") {
        const img = (input as any).image ?? (input as any).data;
        if (img && typeof img === "object" && typeof img.width === "number" && typeof img.height === "number") {
          return makeImageArtifact(img as ImageData);
        }
      }

      if (kind === "imageList") {
        const images = (input as any).images ?? (input as any).items;
        if (Array.isArray(images) && images.length > 0) {
          const items = images
            .filter((x: any) => x && typeof x.width === "number" && typeof x.height === "number")
            .map((img: any) => makeImageArtifact(img as ImageData));

          if (items.length > 0) {
            return { type: "imageList", items };
          }
        }
      }

      // If app__.input__ exists but is malformed, fall through to canvas fallback.
      debugTrace.append({
        scope: "panel",
        kind: "info",
        message: "Pipeline tab: app__.input__ present but unsupported/malformed; falling back to srcCanvas",
        meta: { kind },
      });
    }

    // 2) Fallback: srcCanvas (legacy single-image path)
    const src = dom.srcCanvasEl;
    const w = src.width;
    const h = src.height;
    if (!w || !h) return null;

    const ctx = src.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (!ctx) return null;

    const img = ctx.getImageData(0, 0, w, h);
    return makeImageArtifact(img);
  }

  function seedInputOnceIfMissing(): void {
    const vm = model.getVm();
    if (vm.input) return;

    const a = readSourceInputArtifact();
    if (!a) return;

    model.setInputArtifact(a);
  }

  function refreshInputForRun(): void {
    const a = readSourceInputArtifact();
    if (!a) return;

    model.setInputArtifact(a);
  }





  async function syncPipelineFromTuning(): Promise<void> {
    const params = await tuning.getEffectiveParams("pipeline").catch(() => ({} as Record<string, ParamValue>));

    const modeRaw = params?.mode;
    const recipeRaw = params?.recipe;

    const mode = typeof modeRaw === "string" ? modeRaw : "segmentation";
    const recipe = typeof recipeRaw === "string" ? recipeRaw : "default";

    model.setActivePipeline(mode);
    model.setActiveRecipe(recipe);

    // Critical: Pipeline tab tuning must match the selected pipeline
    mountScopedTuningForActivePipeline();
  }


  function ensureView(): PipelineView {
    if (view) return view;

    actionLog.append({ scope: "panel", kind: "info", message: "Pipeline view: create + mount" });

    view = createPipelineView({
      hostEl: dom.pipelineViewMountEl,
      statusEl: dom.pipelineStatusEl,
      handlers: {
        onSelectPipeline: (id) => {
          actionLog.append({ scope: "panel", kind: "info", message: `Pipeline select: ${id}` });

          model.setActivePipeline(id);

          // Persist selection
          void tuning.setParamValue("pipeline", "mode", id);

          // Remount tuning subtree to match selection
          mountScopedTuningForActivePipeline();

          render();
        },

        onSelectRecipe: (id) => {
          actionLog.append({ scope: "panel", kind: "info", message: `Recipe select: ${id}` });

          model.setActiveRecipe(id);

          // Persist selection
          void tuning.setParamValue("pipeline", "recipe", id);

          render();
        },

        onRunAll: () => void runAll(),
        onNext: () => void runNext(),

        // Key change: Reset now reloads catalogue from storage before rendering,
        // so the pipeline combobox reflects newly added/renamed user pipelines.
        onReset: () => {
          void resetAndReloadFromStorage();
        },
      },
    });

    view.mount();

    // Ensure tuning mount exists even if user never touches the select.
    mountScopedTuningForActivePipeline();

    return view;
  }


  function render(): void {
    ensureView().render(model.getVm());
  }

  async function runAll(): Promise<void> {
    actionLog.append({ scope: "panel", kind: "info", message: "Pipeline run: all" });

    refreshInputForRun();

    try {
      await model.runAll();
    } finally {
      // Publish last pipeline output for other tabs (Colors etc.)
      setLastPipelineOutputFromVm(model.getVm());

      render();
      surfacePipelineErrorsToActionLog();
    }
  }

  async function runNext(): Promise<void> {
    actionLog.append({ scope: "panel", kind: "info", message: "Pipeline run: next" });

    seedInputOnceIfMissing();

    try {
      await model.runNext();
    } finally {
      // Publish last pipeline output for other tabs (Colors etc.)
      setLastPipelineOutputFromVm(model.getVm());

      render();
      surfacePipelineErrorsToActionLog();
    }
  }


  function bind(): void {
    // view binds its own internal UI
  }

  async function mount(): Promise<void> {
    mounted = true;

    actionLog.append({ scope: "panel", kind: "info", message: "Pipeline tab: mount()" });

    refreshInputForRun();

    // Load user pipelines + recipes into catalogue (built-ins + user)
    await model.reloadCatalogue().catch(() => null);

    await syncPipelineFromTuning();

    // Start listening for builder changes while this tab is visible.
    attachPipelineSignals();

    actionLog.append({ scope: "panel", kind: "info", message: "Pipeline tab: render()" });
    render();
  }


  async function refresh(): Promise<void> {
    if (!mounted) return;

    actionLog.append({ scope: "panel", kind: "info", message: "Pipeline tab: refresh()" });

    refreshInputForRun();

    // NEW: refresh catalogue from storage (covers builder imports)
    await model.reloadCatalogue().catch(() => null);

    await syncPipelineFromTuning();
    render();
  }


  function unmount(): void {
    mounted = false;

    // Stop listening while hidden; mount() already reloads catalogue anyway.
    detachPipelineSignals();

    actionLog.append({ scope: "panel", kind: "info", message: "Pipeline tab: unmount()" });
  }


  function dispose(): void {
    actionLog.append({ scope: "panel", kind: "info", message: "Pipeline tab: dispose()" });

    detachPipelineSignals();

    view?.dispose();
    view = null;

    mountedScopeRootId = null;
    clearPipelineTuningMount();
  }


  return { bind, mount, unmount, refresh, dispose };
}
