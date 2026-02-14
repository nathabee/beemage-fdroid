// src/panel/app/tuning/resolve.ts

import type {
  ComponentConfig,
  ComponentId,
  ComponentRegistry,
  EngineId,
  EnginePolicy,
  ParamValue,
  ResolvedComponent,
  RuntimeEngineAvailability,
} from "./types";

function defaultParamValue(schema: { default: ParamValue }): ParamValue {
  return schema.default;
}

function mergeParams(registryParams: Record<string, any>, override?: Record<string, ParamValue>): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [k, sch] of Object.entries(registryParams)) out[k] = defaultParamValue(sch);
  for (const [k, v] of Object.entries(override ?? {})) out[k] = v;
  return out;
}

function resolvePolicy(
  id: ComponentId,
  registry: ComponentRegistry,
  stored: Record<ComponentId, ComponentConfig>,
): EnginePolicy {
  // Walk up until we hit a non-inherit policy (or root).
  let cur: ComponentId | null = id;

  while (cur) {
    const node = registry.byId.get(cur);
    if (!node) throw new Error(`[tuning] Unknown component: ${cur}`);

    const storedPolicy = stored[cur]?.enginePolicy;
    const policy = storedPolicy ?? node.defaultEnginePolicy;

    if (policy !== "inherit") return policy;

    cur = registry.parentById.get(cur) ?? null;
  }

  // If everything inherits (unlikely), default to native.
  return "native";
}

function pickEngine(
  nodeImplemented: ReadonlyArray<EngineId>,
  policy: EnginePolicy,
  runtime: RuntimeEngineAvailability,
): { engine: EngineId; fallbackReason?: string } {
  const canUseOpenCv = runtime.opencvReady && nodeImplemented.includes("opencv");
  const canUseNative = nodeImplemented.includes("native") || nodeImplemented.length === 0;


  if (policy === "native") return { engine: "native" };

  if (policy === "opencv") {
    if (canUseOpenCv) return { engine: "opencv" };
    return {
      engine: "native",
      fallbackReason: runtime.opencvReady
        ? "Policy=opencv, but component has no OpenCV implementation."
        : "Policy=opencv, but OpenCV is not available at runtime.",
    };
  }

  if (policy === "auto") {
    if (canUseOpenCv) return { engine: "opencv" };
    return { engine: "native" };
  }


  return { engine: "native" };
}

export function resolveComponent(
  id: ComponentId,
  registry: ComponentRegistry,
  stored: Record<ComponentId, ComponentConfig>,
  runtime: RuntimeEngineAvailability,
): ResolvedComponent {
  const node = registry.byId.get(id);
  if (!node) throw new Error(`[tuning] Unknown component: ${id}`);

  const policy = resolvePolicy(id, registry, stored);
  const { engine, fallbackReason } = pickEngine(node.implementedEngines, policy, runtime);

  const params = mergeParams(node.params, stored[id]?.params);

  return { id, policy, engine, fallbackReason, params };
}
