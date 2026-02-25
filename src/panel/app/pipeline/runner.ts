// src/panel/app/pipeline/runner.ts
import { runOp } from "../../platform/opsDispatch";
import type {
  Artifact,
  ImageArtifact,
  MaskArtifact,
  SvgArtifact,
  PdfArtifact,
  ImageListArtifact,
  OpSpec,
  PipelineCatalogue,
  PipelineDef,
  PipelineRunnerDeps,
  PipelineRunResult,
  OpRunResult,
  PipelineOpInstance,
} from "./type";
import { artifactDims } from "./type";
import { resolveEnabledLinear, validateLinearChainTypes } from "./typing";

function isImage(a: Artifact): a is ImageArtifact {
  return a.type === "image";
}
function isMask(a: Artifact): a is MaskArtifact {
  return a.type === "mask";
}
function isSvg(a: Artifact): a is SvgArtifact {
  return a.type === "svg";
}
function isImageList(a: Artifact): a is ImageListArtifact {
  return a.type === "imageList";
}
function isPdf(a: Artifact): a is PdfArtifact {
  return a.type === "pdf";
}

function makeImageArtifact(img: ImageData): ImageArtifact {
  return { type: "image", width: img.width, height: img.height, image: img };
}
function makeMaskArtifact(mask: Uint8Array, width: number, height: number): MaskArtifact {
  return { type: "mask", width, height, mask };
}
function makeSvgArtifact(svg: string, width: number, height: number): SvgArtifact {
  return { type: "svg", width, height, svg };
}

function ioMismatch(expected: string, got: string): string {
  return `IO mismatch: expected ${expected}, got ${got}`;
}

async function execDispatchOp(
  spec: Extract<OpSpec, { kind: "dispatch" }>,
  inst: PipelineOpInstance,
  input: Artifact,
): Promise<Artifact> {
  const override = inst.override;

  // Dispatch layer currently supports only image/mask IO in your opsDispatchCore.
  // Anything else is an explicit runtime error (until you add dispatcher support).
  if (spec.io.input !== "image" && spec.io.input !== "mask") {
    throw new Error(`Dispatch op does not support input type: ${spec.io.input}`);
  }

  if (spec.io.input === "image") {
    if (!isImage(input)) throw new Error(ioMismatch("image", input.type));
    const { width, height } = input;

    if (spec.io.output === "image") {
      const out = await runOp(
        spec.dispatchId,
        { image: input.image, width, height } as any,
        override ? { enginePolicy: override.enginePolicy, params: override.params } : undefined,
      );
      return makeImageArtifact(out as ImageData);
    }

    if (spec.io.output === "mask") {
      const out = await runOp(
        spec.dispatchId,
        { image: input.image, width, height } as any,
        override ? { enginePolicy: override.enginePolicy, params: override.params } : undefined,
      );
      return makeMaskArtifact(out as Uint8Array, width, height);
    }

    if (spec.io.output === "svg") {
      const out = await runOp(
        spec.dispatchId,
        { image: input.image, width, height } as any,
        override ? { enginePolicy: override.enginePolicy, params: override.params } : undefined,
      );
      return makeSvgArtifact(out as string, width, height);
    }

    throw new Error(`Unsupported dispatch output: ${spec.io.output}`);
  }

  // mask input
  if (!isMask(input)) throw new Error(ioMismatch("mask", input.type));
  const { width, height } = input;

  if (spec.io.output === "mask") {
    const out = await runOp(
      spec.dispatchId,
      { mask: input.mask, width, height } as any,
      override ? { enginePolicy: override.enginePolicy, params: override.params } : undefined,
    );
    return makeMaskArtifact(out as Uint8Array, width, height);
  }

  if (spec.io.output === "svg") {
    const out = await runOp(
      spec.dispatchId,
      { mask: input.mask, width, height } as any,
      override ? { enginePolicy: override.enginePolicy, params: override.params } : undefined,
    );
    return makeSvgArtifact(out as string, width, height);
  }

  throw new Error(`Invalid op spec: mask input cannot produce ${spec.io.output} (unsupported here)`);
}

async function execOp(
  spec: OpSpec,
  inst: PipelineOpInstance,
  input: Artifact,
  deps: PipelineRunnerDeps,
): Promise<Artifact> {
  if (spec.kind === "dispatch") {
    return await execDispatchOp(spec, inst, input);
  }

  // JS op: global effective params + instance override.params (if any)
  const baseParams = spec.tuningId ? await deps.getEffectiveParams(spec.tuningId).catch(() => ({})) : {};
  const mergedParams = {
    ...baseParams,
    ...(inst.override?.params ?? {}),
  };

  const out = await spec.run({ input, params: mergedParams });
  return out;
}

/**
 * Universal runner: executes a PipelineDef (linear) using the global process library in catalogue.
 */
export async function runPipelineDef(args: {
  catalogue: PipelineCatalogue;
  pipeline: PipelineDef;
  input: Artifact;
  deps: PipelineRunnerDeps;
}): Promise<PipelineRunResult> {
  const { catalogue, pipeline, input, deps } = args;

  if (!pipeline.implemented) {
    return {
      pipelineId: pipeline.id,
      title: pipeline.title,
      status: "error",
      error: "Not implemented yet",
      input,
      ops: [],
    };
  }

  // Resolve enabled op specs
  const resolved = resolveEnabledLinear({ catalogue, pipeline });
  if (resolved.error) {
    return {
      pipelineId: pipeline.id,
      title: pipeline.title,
      status: "error",
      error: resolved.error,
      input,
      ops: [],
    };
  }

  const enabledInstances = resolved.enabledInstances;
  const resolvedSpecs = resolved.specs;

  const typing = validateLinearChainTypes({
    specs: resolvedSpecs,
    instances: enabledInstances,
    startType: input.type,
  });

  if (!typing.ok) {
    deps.debug("pipeline validation failed (linear)", { pipelineId: pipeline.id, error: typing.error });
    return {
      pipelineId: pipeline.id,
      title: pipeline.title,
      status: "error",
      error: typing.error ?? "Invalid pipeline typing",
      input,
      ops: enabledInstances.map((inst, i): OpRunResult => ({
        instanceId: inst.instanceId,
        opId: inst.opId,
        title: resolvedSpecs[i]?.title ?? inst.opId,
        io: resolvedSpecs[i]?.io ?? { input: input.type, output: input.type },
        status: "error",
        error: typing.error ?? "Invalid pipeline typing",
      })),
    };
  }

  const runs: OpRunResult[] = [];
  let current: Artifact = input;

  for (let i = 0; i < resolvedSpecs.length; i++) {
    const inst = enabledInstances[i]!;
    const spec = resolvedSpecs[i]!;

    try {
      // Runtime IO enforcement (input)
      if (spec.io.input !== current.type) {
        throw new Error(ioMismatch(spec.io.input, current.type));
      }

      const out = await execOp(spec, inst, current, deps);

      // Runtime IO enforcement (output)
      if (out.type !== spec.io.output) {
        throw new Error(ioMismatch(spec.io.output, out.type));
      }

      runs.push({
        instanceId: inst.instanceId,
        opId: spec.id,
        title: spec.title,
        io: spec.io,
        status: "ok",
        output: out,
      });

      current = out;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      runs.push({
        instanceId: inst.instanceId,
        opId: spec.id,
        title: spec.title,
        io: spec.io,
        status: "error",
        error: msg,
      });

      const d = artifactDims(current);

      deps.debug("pipeline op failed (linear)", {
        pipelineId: pipeline.id,
        opId: spec.id,
        error: msg,
        ...(d ?? {}),
        currentType: current.type,
      });

      return {
        pipelineId: pipeline.id,
        title: pipeline.title,
        status: "error",
        error: `Op "${spec.title}" failed: ${msg}`,
        input,
        ops: runs,
      };
    }
  }

  return {
    pipelineId: pipeline.id,
    title: pipeline.title,
    status: "ok",
    input,
    output: current,
    ops: runs,
  };
}