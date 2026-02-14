// src/panel/app/pipeline/type.ts
import type { ParamValue, EnginePolicy } from "../tuning/types";
import type { OpId as DispatchOpId } from "../../platform/opsDispatchCore";

export type PipelineId = string;
export type OpSpecId = string;
export type OpInstanceId = string;

export type ArtifactType = "image" | "mask" | "svg";

export type ImageArtifact = {
  type: "image";
  width: number;
  height: number;
  image: ImageData;
};

export type MaskArtifact = {
  type: "mask";
  width: number;
  height: number;
  // 0..255 per pixel (single channel)
  mask: Uint8Array;
};

export type SvgArtifact = {
  type: "svg";
  width: number;
  height: number;
  // Full SVG markup (including <svg ...> root)
  svg: string;
};

export type Artifact = ImageArtifact | MaskArtifact | SvgArtifact;

export type OpIO = {
  input: ArtifactType;
  output: ArtifactType;
};

// -----------------------------
// Process library (global)
// -----------------------------
export type DispatchOpSpec = {
  kind: "dispatch";
  id: OpSpecId;
  title: string;
  description?: string;

  io: OpIO;

  /**
   * Typed dispatcher op id.
   * Must match opsDispatchCore.OpId union.
   */
  dispatchId: DispatchOpId;

  /**
   * Tuning component id used for param lookup & policy.
   * Usually equals dispatchId (but kept explicit).
   */
  tuningId: string;

  /**
   * Optional UX grouping metadata (never used for legality).
   */
  group?: string;
  tags?: ReadonlyArray<string>;
};

export type JsOpSpec = {
  kind: "js";
  id: OpSpecId;
  title: string;
  description?: string;

  io: OpIO;

  /**
   * Optional tuning id for param lookup.
   * If omitted, params will be {}.
   */
  tuningId?: string;

  group?: string;
  tags?: ReadonlyArray<string>;

  run: (args: {
    input: Artifact;
    params: Record<string, ParamValue>;
  }) => Promise<Artifact> | Artifact;
};

export type OpSpec = DispatchOpSpec | JsOpSpec;

// -----------------------------
// Universal pipeline model (linear)
// -----------------------------
export type PipelineOpInstanceOverride = {
  /**
   * Per-step engine policy override.
   * If omitted, global tuning resolution applies.
   */
  enginePolicy?: EnginePolicy;

  /**
   * Per-step params override (merged on top of global effective params).
   */
  params?: Record<string, ParamValue>;
};

export type PipelineOpInstance = {
  instanceId: OpInstanceId;
  opId: OpSpecId;
  enabled?: boolean;

  /**
   * Optional per-step override (instance-level), enabling truly dynamic pipelines.
   */
  override?: PipelineOpInstanceOverride;
};

export type PipelineDef = {
  id: PipelineId;
  title: string;
  description?: string;

  /**
   * If false, runner should refuse to execute (but UI can still display).
   */
  implemented: boolean;

  /**
   * Linear sequence of op instances.
   * IO validity is derived from OpSpec.io chaining.
   */
  ops: ReadonlyArray<PipelineOpInstance>;
};
 
// -----------------------------
// Catalogue (built-ins + process library + optional user pipelines)
// -----------------------------
export type PipelineCatalogue = {
  // Global process library
  ops: ReadonlyArray<OpSpec>;
  getOp(id: OpSpecId): OpSpec | null;

  // Built-in pipelines (shipped)
  builtIns: ReadonlyArray<PipelineDef>;
  getBuiltIn(id: PipelineId): PipelineDef | null;

  // Merged pipelines (built-in + user)
  listPipelines(): ReadonlyArray<PipelineDef>;
  getPipeline(id: PipelineId): PipelineDef | null;

  // Helpers
  createInstanceId(prefix: string, index0: number): OpInstanceId;
};

// -----------------------------
// Run results (linear)
// -----------------------------
export type RunStepStatus = "ok" | "error" | "skipped";

export type OpRunResult = {
  instanceId: OpInstanceId;
  opId: OpSpecId;
  title: string;

  io: OpIO;

  status: RunStepStatus;
  error?: string;

  output?: Artifact;
};

export type PipelineRunResult = {
  pipelineId: PipelineId;
  title: string;

  status: "ok" | "error";
  error?: string;

  input: Artifact;

  /**
   * Output after last enabled op.
   * Present only when status=ok.
   */
  output?: Artifact;

  ops: OpRunResult[];
};

export type PipelineRunnerDeps = {
  /**
   * Resolve effective params for a tuning node (defaults + overrides + inheritance).
   */
  getEffectiveParams: (tuningId: string) => Promise<Record<string, ParamValue>>;

  /**
   * Persisted debug channel (wire to debugTrace.append in caller).
   */
  debug: (message: string, meta?: Record<string, unknown>) => void;
};

export function artifactDims(a: Artifact): { width: number; height: number } {
  return { width: a.width, height: a.height };
}
