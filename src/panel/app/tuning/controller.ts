// src/panel/app/tuning/controller.ts
import { createTuningModel, type TuningModel, type TuningNodeVm, type TuningTreeVm } from "./model";
import { createTuningView, type TuningView } from "./view";
import type { ComponentId, EnginePolicy, ParamValue, RuntimeEngineAvailability } from "./types";
import type { TuningPreset } from "./presets/types";

type Mount = {
  mountEl: HTMLElement;
  scopeRootId: ComponentId; // "app" for Settings, "image" for image
  view: TuningView;
};

export type TuningControllerDeps = {
  getRuntimeAvailability: () => RuntimeEngineAvailability;

  debugTraceAppend: (line: string) => void;
  actionLogAppend: (line: string) => void;
};

export type TuningController = {
  mount(args: { mountEl: HTMLElement; scopeRootId: ComponentId }): void;
  unmount(mountEl: HTMLElement): void;
  refresh(): Promise<void>;

  // Apply a preset in one batch (one rerender)
  applyPreset(preset: TuningPreset): Promise<void>;

  // NEW: read resolved params for a component (defaults + overrides + inheritance)
  getEffectiveParams(id: ComponentId): Promise<Record<string, ParamValue>>;

  // NEW (optional but recommended): let other tabs change params in a single place
  setParamValue(id: ComponentId, key: string, value: ParamValue): Promise<void>;

  dispose(): void;
};

function pickSubtreeRootVm(root: TuningNodeVm, scopeRootId: ComponentId): TuningNodeVm {
  if (root.id === scopeRootId) return root;

  const stack: TuningNodeVm[] = [...(root.children ?? [])];
  while (stack.length > 0) {
    const n = stack.shift()!;
    if (n.id === scopeRootId) return n;
    for (const ch of n.children ?? []) stack.push(ch);
  }

  throw new Error(`[tuning] scopeRootId not found in VM tree: ${scopeRootId}`);
}

function findVmNode(root: TuningNodeVm, id: ComponentId): TuningNodeVm | null {
  if (root.id === id) return root;
  const stack: TuningNodeVm[] = [...(root.children ?? [])];
  while (stack.length > 0) {
    const n = stack.shift()!;
    if (n.id === id) return n;
    for (const ch of n.children ?? []) stack.push(ch);
  }
  return null;
}

export function createTuningController(deps: TuningControllerDeps): TuningController {
  const model: TuningModel = createTuningModel({
    getRuntimeAvailability: deps.getRuntimeAvailability,
  });

  const mounts: Mount[] = [];
  let disposed = false;

  async function computeAppTree(): Promise<TuningTreeVm> {
    return await model.loadTree("app");
  }

  async function rerenderAll() {
    if (disposed) return;

    const appTree = await computeAppTree();

    for (const m of mounts) {
      if (m.scopeRootId === "app") {
        m.view.render(appTree);
        continue;
      }

      const scopedRoot = pickSubtreeRootVm(appTree.root, m.scopeRootId);

      m.view.render({
        ...appTree,
        scopeId: m.scopeRootId,
        root: scopedRoot,
      });
    }
  }

  async function setPolicy(id: ComponentId, policy: EnginePolicy) {
    await model.setEnginePolicy(id, policy);

    deps.actionLogAppend(`[tuning] policy ${id} = ${policy}`);
    deps.debugTraceAppend(`[tuning] setPolicy id=${id} policy=${policy}`);

    await rerenderAll();
  }

  async function setParam(id: ComponentId, key: string, value: ParamValue) {
    await model.setParam(id, key, value);

    deps.actionLogAppend(`[tuning] param ${id}.${key} = ${String(value)}`);
    deps.debugTraceAppend(`[tuning] setParam id=${id} key=${key} value=${String(value)}`);

    await rerenderAll();
  }

  async function resetNode(id: ComponentId) {
    await model.resetNode(id);

    deps.actionLogAppend(`[tuning] reset node ${id}`);
    deps.debugTraceAppend(`[tuning] resetNode id=${id}`);

    await rerenderAll();
  }

  async function resetParam(id: ComponentId, key: string) {
    await model.resetParam(id, key);

    deps.actionLogAppend(`[tuning] reset param ${id}.${key}`);
    deps.debugTraceAppend(`[tuning] resetParam id=${id} key=${key}`);

    await rerenderAll();
  }

  // NEW
  async function applyPreset(preset: TuningPreset): Promise<void> {
    if (disposed) return;

    // Apply policies first, then params (so algo/engine mismatches are less surprising)
    if (preset.policies) {
      for (const p of preset.policies) {
        await model.setEnginePolicy(p.id, p.policy);
      }
    }

    if (preset.params) {
      for (const it of preset.params) {
        await model.setParam(it.id, it.key, it.value);
      }
    }

    deps.actionLogAppend(`[tuning] preset ${preset.id} (${preset.title})`);
    deps.debugTraceAppend(
      `[tuning] applyPreset id=${preset.id} title=${preset.title} policies=${preset.policies?.length ?? 0} params=${preset.params?.length ?? 0}`,
    );

    await rerenderAll();
  }

    async function getEffectiveParams(id: ComponentId): Promise<Record<string, ParamValue>> {
    const appTree = await computeAppTree();
    const node = findVmNode(appTree.root, id);
    if (!node) throw new Error(`[tuning] getEffectiveParams: unknown component id ${id}`);
    return { ...(node.effectiveParams ?? {}) };
  }

  async function setParamValue(id: ComponentId, key: string, value: ParamValue): Promise<void> {
    await model.setParam(id, key, value);

    deps.actionLogAppend(`[tuning] param ${id}.${key} = ${String(value)}`);
    deps.debugTraceAppend(`[tuning] setParamValue id=${id} key=${key} value=${String(value)}`);

    await rerenderAll();
  }


  function mount(args: { mountEl: HTMLElement; scopeRootId: ComponentId }) {
    if (disposed) return;

    const { mountEl, scopeRootId } = args;

    if (mounts.some((m) => m.mountEl === mountEl)) return;

    const view = createTuningView(mountEl, {
      onSetPolicy: setPolicy,
      onSetParam: setParam,
      onResetNode: resetNode,
      onResetParam: resetParam,
    });

    mounts.push({ mountEl, scopeRootId, view });

    void rerenderAll();
  }

  function unmount(mountEl: HTMLElement) {
    const idx = mounts.findIndex((m) => m.mountEl === mountEl);
    if (idx < 0) return;

    mounts[idx].view.dispose();
    mounts.splice(idx, 1);
  }

  async function refresh() {
    await rerenderAll();
  }

  function dispose() {
    disposed = true;
    for (const m of mounts) m.view.dispose();
    mounts.length = 0;
  }

  return { mount, unmount, refresh, applyPreset, getEffectiveParams, setParamValue, dispose };

}
