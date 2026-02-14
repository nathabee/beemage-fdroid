// src/panel/app/pipeline/typing.ts

import type {
  ArtifactType,
  OpSpec,
  PipelineCatalogue,
  PipelineDef,
  PipelineOpInstance,
} from "./type";

export type ResolvedLinearPipeline = {
  enabledInstances: PipelineOpInstance[];
  specs: OpSpec[];
  error?: string;
};

export type LinearTypingStep = {
  index: number;
  instanceId: string;
  opId: string;
  title: string;
  expectedInput: ArtifactType;
  actualInput: ArtifactType;
  output: ArtifactType;
  ok: boolean;
  error?: string;
};

export type LinearTypingResult = {
  ok: boolean;
  startType: ArtifactType;
  endType?: ArtifactType;
  error?: string;
  steps: LinearTypingStep[];
};

export function resolveEnabledLinear(args: {
  catalogue: PipelineCatalogue;
  pipeline: PipelineDef;
}): ResolvedLinearPipeline {
  const { catalogue, pipeline } = args;

  const enabledInstances = (pipeline.ops ?? []).filter((x) => x.enabled !== false);

  const specs: OpSpec[] = [];
  for (const inst of enabledInstances) {
    const s = catalogue.getOp(inst.opId);
    if (!s) {
      return {
        enabledInstances: [],
        specs: [],
        error: `Unknown opId in pipeline: ${inst.opId}`,
      };
    }
    specs.push(s);
  }

  return { enabledInstances, specs };
}

export function validateLinearChainTypes(args: {
  specs: ReadonlyArray<OpSpec>;
  instances: ReadonlyArray<PipelineOpInstance>;
  startType: ArtifactType;
}): LinearTypingResult {
  const { specs, instances, startType } = args;

  if (specs.length === 0) {
    return {
      ok: false,
      startType,
      error: "Pipeline has no ops",
      steps: [],
    };
  }

  let cur: ArtifactType = startType;
  const steps: LinearTypingStep[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!;
    const inst = instances[i]!;

    const expected = spec.io.input;
    const ok = expected === cur;

    steps.push({
      index: i,
      instanceId: inst.instanceId,
      opId: spec.id,
      title: spec.title,
      expectedInput: expected,
      actualInput: cur,
      output: spec.io.output,
      ok,
      error: ok ? undefined : `Chain IO mismatch at "${spec.title}": needs ${expected} but current is ${cur}`,
    });

    if (!ok) {
      return {
        ok: false,
        startType,
        error: steps[steps.length - 1]!.error,
        steps,
      };
    }

    cur = spec.io.output;
  }

  return { ok: true, startType, endType: cur, steps };
}

export function typeAtIndex(args: {
  specs: ReadonlyArray<OpSpec>;
  startType: ArtifactType;
  index: number;
}): ArtifactType {
  const { specs, startType, index } = args;
  if (index <= 0) return startType;

  let cur: ArtifactType = startType;
  for (let i = 0; i < Math.min(index, specs.length); i++) {
    const spec = specs[i]!;
    if (spec.io.input !== cur) return cur; // safety for invalid chain
    cur = spec.io.output;
  }
  return cur;
}

export function canInsertBetween(args: {
  beforeType: ArtifactType;
  afterType?: ArtifactType;
  op: OpSpec;
}): { ok: boolean; reason?: string } {
  const { beforeType, afterType, op } = args;

  if (op.io.input !== beforeType) {
    return { ok: false, reason: `Needs ${op.io.input} but slot provides ${beforeType}` };
  }

  if (afterType && op.io.output !== afterType) {
    return { ok: false, reason: `Produces ${op.io.output} but next op needs ${afterType}` };
  }

  return { ok: true };
}
