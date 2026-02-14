// src/panel/platform/opsDispatchCore.ts
import { resolveComponent } from "../app/tuning/resolve";
import { createComponentRegistry } from "../app/tuning/registry";
import { loadComponentConfigs } from "../app/tuning/store";
import { isOpenCvInjected } from "../app/engine/engineAvailability";
import { logWarn } from "../app/log";
import type { EnginePolicy } from "../app/tuning/types";

export type EngineId = "native" | "opencv";

// -----------------------------
// Universal op typing
// -----------------------------
export type MaskOpInputs = {
  mask: Uint8Array;
  width: number;
  height: number;
};

export type ImageOpInputs = {
  image: ImageData;
  width: number;
  height: number;
};

// -----------------------------
// Dispatch op ids (must match opImpls keys and pipeline dispatchId)
// -----------------------------
export type OpId =
  | "mage.clean.removeSmallComponents"
  | "segmentation.resize"
  | "segmentation.denoise"
  | "segmentation.color"
  | "segmentation.threshold"
  | "segmentation.morphology"
  | "edge.resize"
  | "edge.threshold"
  | "edge.morphology"
  | "edge.extract"
  | "svg.create";

export type OpInputsByOp = {
  "mage.clean.removeSmallComponents": MaskOpInputs;

  "segmentation.resize": ImageOpInputs;
  "segmentation.denoise": ImageOpInputs;
  "segmentation.color": ImageOpInputs;
  "segmentation.threshold": ImageOpInputs;
  "segmentation.morphology": MaskOpInputs;

  "edge.resize": ImageOpInputs;
  "edge.threshold": ImageOpInputs;
  "edge.morphology": MaskOpInputs;
  "edge.extract": MaskOpInputs;

  "svg.create": MaskOpInputs;
};

export type OpOutputsByOp = {
  "mage.clean.removeSmallComponents": Uint8Array;

  "segmentation.resize": ImageData;
  "segmentation.denoise": ImageData;
  "segmentation.color": ImageData;
  "segmentation.threshold": Uint8Array;
  "segmentation.morphology": Uint8Array;

  "edge.resize": ImageData;
  "edge.threshold": Uint8Array;
  "edge.morphology": Uint8Array;
  "edge.extract": Uint8Array;

  "svg.create": string;
};

export type OpParamsByOp = {
  "mage.clean.removeSmallComponents": { cleanMinArea: number };

  "segmentation.resize": { resizeAlgo: number; targetMaxW: number };
  "segmentation.denoise": { denoiseAlgo: number; blurK: number; bilateralSigma: number };
  "segmentation.color": { colorMode: number; hsvChannel: number };
  "segmentation.threshold": { thresholdAlgo: number; manualT: number; adaptBlock: number; adaptC: number };
  "segmentation.morphology": { morphAlgo: number; morphK: number; morphIters: number };

  "edge.resize": { resizeAlgo: number; targetMaxW: number };
  "edge.threshold": { manualT: number };
  "edge.morphology": { morphAlgo: number; morphK: number; morphIters: number };
  "edge.extract": {};

  "svg.create": { scale: number; transparentBg: number; color: string };
};

export type OpImpls = {
  [K in OpId]: {
    native: (input: OpInputsByOp[K], params: OpParamsByOp[K]) => OpOutputsByOp[K] | Promise<OpOutputsByOp[K]>;
    opencv: (input: OpInputsByOp[K], params: OpParamsByOp[K]) => OpOutputsByOp[K] | Promise<OpOutputsByOp[K]>;
  };
};

// -----------------------------
// NEW: per-run override (used by pipeline op instances)
// -----------------------------
export type RunOpOverride<K extends OpId = OpId> = {
  enginePolicy?: EnginePolicy;
  params?: Partial<OpParamsByOp[K]>;
};

// -----------------------------
// Back-compat alias (mage code unchanged)
// -----------------------------
export type MaskOpId = "mage.clean.removeSmallComponents";

const registry = createComponentRegistry();

function getRuntime() {
  return { opencvReady: isOpenCvInjected() };
}

function pickEngineForPolicy(args: {
  implemented: ReadonlyArray<EngineId>;
  policy: EnginePolicy;
  runtimeOpenCvReady: boolean;
}): { engine: EngineId; fallbackReason?: string } {
  const { implemented, policy, runtimeOpenCvReady } = args;

  const canUseOpenCv = runtimeOpenCvReady && implemented.includes("opencv");
  const canUseNative = implemented.includes("native") || implemented.length === 0;

  // Defensive: if native isn't implemented, still return native but it will fail at runtime (better than lying).
  void canUseNative;

  if (policy === "native") return { engine: "native" };

  if (policy === "opencv") {
    if (canUseOpenCv) return { engine: "opencv" };
    return {
      engine: "native",
      fallbackReason: runtimeOpenCvReady
        ? "Override policy=opencv, but this op has no OpenCV implementation."
        : "Override policy=opencv, but OpenCV is not available at runtime.",
    };
  }

  if (policy === "auto") {
    if (canUseOpenCv) return { engine: "opencv" };
    return { engine: "native" };
  }

  // "inherit" makes no sense as an explicit per-op override; treat as "no override"
  return { engine: "native" };
}

async function resolveEngineAndParams<K extends OpId>(
  op: K,
  override?: RunOpOverride<K>,
): Promise<{
  engine: EngineId;
  params: OpParamsByOp[K];
  fallbackReason?: string;
  opencvReady: boolean;
}> {
  const stored = await loadComponentConfigs();
  const runtime = getRuntime();

  const resolved = resolveComponent(op, registry, stored, runtime);

  const node = registry.byId.get(op);
  if (!node) throw new Error(`[opsDispatch] Unknown op in registry: ${op}`);

  // Base = tuning resolved (defaults + stored overrides)
  const baseParams = resolved.params as OpParamsByOp[K];

  // Merge instance params on top (instance wins)
  const mergedParams = {
    ...(baseParams as any),
    ...((override?.params ?? {}) as any),
  } as OpParamsByOp[K];

  // Policy: instance override wins; otherwise tuning policy wins
  const effectivePolicy: EnginePolicy =
    (override?.enginePolicy && override.enginePolicy !== "inherit" ? override.enginePolicy : resolved.policy) as EnginePolicy;

  // Engine: if instance policy differs, recompute engine for this op
  // Otherwise we can trust resolved.engine (already computed)
  let engine: EngineId = resolved.engine;
  let fallbackReason: string | undefined = resolved.fallbackReason;

  if (override?.enginePolicy && override.enginePolicy !== "inherit") {
    const picked = pickEngineForPolicy({
      implemented: node.implementedEngines,
      policy: effectivePolicy,
      runtimeOpenCvReady: !!runtime.opencvReady,
    });
    engine = picked.engine;
    fallbackReason = picked.fallbackReason;
  }

  return {
    engine,
    params: mergedParams,
    fallbackReason,
    opencvReady: !!runtime.opencvReady,
  };
}

export async function runOpCore<K extends OpId>(
  op: K,
  input: OpInputsByOp[K],
  impls: OpImpls,
  override?: RunOpOverride<K>,
): Promise<OpOutputsByOp[K]> {
  const { engine, params, fallbackReason, opencvReady } = await resolveEngineAndParams(op, override);

  if (engine === "opencv" && !opencvReady) {
    logWarn(`OpenCV selected for ${op} but not ready; falling back to native. ${fallbackReason ?? ""}`.trim());
    return await impls[op].native(input as any, params as any);
  }

  return await impls[op][engine](input as any, params as any);
}
