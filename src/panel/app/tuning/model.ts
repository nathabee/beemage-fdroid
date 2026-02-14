// src/panel/app/tuning/model.ts

import { createComponentRegistry } from "./registry";
import { resolveComponent } from "./resolve";
import {
  loadComponentConfigs,
  setComponentConfig,
  clearComponentConfig,
  type StoredComponentConfigs,
} from "./store";
import type {
  ComponentId,
  ComponentNode,
  ComponentRegistry,
  EngineId,
  EnginePolicy,
  ParamSchema,
  ParamValue,
  ResolvedComponent,
  RuntimeEngineAvailability,
} from "./types";

// Default runtime availability (panel runtime)
import { isOpenCvInjected } from "../engine/engineAvailability";

export type TuningScopeId = ComponentId;

export type TuningNodeVm = {
  id: ComponentId;
  title: string;
  description?: string;

  // Registry metadata
  isGroup: boolean;
  implementedEngines: ReadonlyArray<EngineId>;

  // Stored overrides (user-config)
  storedPolicy?: EnginePolicy;
  storedParams?: Record<string, ParamValue>;

  // Resolved (effective)
  effectivePolicy: EnginePolicy;
  effectiveEngine: EngineId;
  fallbackReason?: string;

  // Parameter schema + values
  paramsSchema: Record<string, ParamSchema>;
  effectiveParams: Record<string, ParamValue>;

  // UI helpers
  canImplementOpenCv: boolean;
  runtimeOpenCvReady: boolean;

  // Children
  children: TuningNodeVm[];
};

export type TuningTreeVm = {
  scopeId: ComponentId;
  runtime: RuntimeEngineAvailability;
  stored: StoredComponentConfigs;
  root: TuningNodeVm;
};

export type TuningModel = {
  getRegistry(): ComponentRegistry;

  loadTree(scopeId?: TuningScopeId): Promise<TuningTreeVm>;

  setEnginePolicy(id: ComponentId, policy: EnginePolicy): Promise<void>;

  setParam(id: ComponentId, key: string, value: ParamValue): Promise<void>;

  resetNode(id: ComponentId): Promise<void>;

  resetParam(id: ComponentId, key: string): Promise<void>;
};

type CreateTuningModelOpts = {
  registry?: ComponentRegistry;

  /**
   * If you want demo-only behavior, pass your own availability function.
   * Default uses isOpenCvInjected() (panel runtime).
   */
  getRuntimeAvailability?: () => RuntimeEngineAvailability;
};

function getDefaultRuntimeAvailability(): RuntimeEngineAvailability {
  return { opencvReady: isOpenCvInjected() };
}

function isGroup(node: ComponentNode): boolean {
  return Array.isArray(node.children) && node.children.length > 0;
}

function buildVmNode(args: {
  id: ComponentId;
  registry: ComponentRegistry;
  stored: StoredComponentConfigs;
  runtime: RuntimeEngineAvailability;
}): TuningNodeVm {
  const { id, registry, stored, runtime } = args;

  const node = registry.byId.get(id);
  if (!node) throw new Error(`[tuning] Unknown component: ${id}`);

  const resolved: ResolvedComponent = resolveComponent(id, registry, stored, runtime);

  const storedCfg = stored[id];
  const storedPolicy = storedCfg?.enginePolicy;
  const storedParams = storedCfg?.params;

  const canImplementOpenCv = node.implementedEngines.includes("opencv");
  const runtimeOpenCvReady = !!runtime.opencvReady;

  const children: TuningNodeVm[] = [];
  for (const ch of node.children ?? []) {
    children.push(
      buildVmNode({
        id: ch.id,
        registry,
        stored,
        runtime,
      }),
    );
  }

  return {
    id: node.id,
    title: node.title,
    description: node.description,

    isGroup: isGroup(node),
    implementedEngines: node.implementedEngines,

    storedPolicy,
    storedParams,

    effectivePolicy: resolved.policy,
    effectiveEngine: resolved.engine,
    fallbackReason: resolved.fallbackReason,

    paramsSchema: node.params,
    effectiveParams: resolved.params,

    canImplementOpenCv,
    runtimeOpenCvReady,

    children,
  };
}

export function createTuningModel(opts: CreateTuningModelOpts = {}): TuningModel {
  const registry = opts.registry ?? createComponentRegistry();
  const getRuntimeAvailability = opts.getRuntimeAvailability ?? getDefaultRuntimeAvailability;

  async function loadTree(scopeId: TuningScopeId = "app"): Promise<TuningTreeVm> {
    const stored = await loadComponentConfigs();
    const runtime = getRuntimeAvailability();

    const node = registry.byId.get(scopeId);
    if (!node) throw new Error(`[tuning] Unknown scope: ${scopeId}`);

    const root = buildVmNode({ id: scopeId, registry, stored, runtime });
    return { scopeId, runtime, stored, root };
  }

  async function setEnginePolicy(id: ComponentId, policy: EnginePolicy): Promise<void> {
    await setComponentConfig(id, { enginePolicy: policy });
  }

  async function setParam(id: ComponentId, key: string, value: ParamValue): Promise<void> {
    await setComponentConfig(id, { params: { [key]: value } });
  }

  async function resetNode(id: ComponentId): Promise<void> {
    await clearComponentConfig(id);
  }

  async function resetParam(id: ComponentId, key: string): Promise<void> {
    const all = await loadComponentConfigs();
    const prev = all[id];
    if (!prev?.params) return;

    const nextParams = { ...(prev.params ?? {}) };
    delete nextParams[key];

    // If nothing left (no policy override + no params), clear entry.
    const hasPolicy = typeof prev.enginePolicy === "string";
    const hasParams = Object.keys(nextParams).length > 0;

    if (!hasPolicy && !hasParams) {
      await clearComponentConfig(id);
      return;
    }

    await setComponentConfig(id, {
      enginePolicy: prev.enginePolicy,
      params: nextParams,
    });
  }

  return {
    getRegistry: () => registry,
    loadTree,
    setEnginePolicy,
    setParam,
    resetNode,
    resetParam,
  };
}
