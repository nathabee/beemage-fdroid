// src/panel/app/pipeline/catalogue.ts 
import type {
  OpSpec,
  PipelineCatalogue,
  PipelineDef,
  PipelineId,
  OpSpecId,
  PipelineOpInstance,
  OpIO,
} from "./type";
 

function byId<T extends { id: string }>(items: ReadonlyArray<T>, id: string): T | null {
  return items.find((x) => x.id === id) ?? null;
}

function io(input: OpIO["input"], output: OpIO["output"]): OpIO {
  return { input, output };
}

function makeInstanceId(prefix: string, index0: number): string {
  return `${prefix}.${index0 + 1}`;
}
 

/**
 * SINGLE source of truth for:
 * - global process library (OpSpec)
 * - built-in pipelines (PipelineDef as linear sequences)
 *
 * User pipelines are stored via load/save helpers in THIS module.
 * getPipeline(id) returns user pipeline first, then built-in (user overrides built-in on id collision)
 * listPipelines() returns built-ins not shadowed by user + then all user pipelines
 */
export function createPipelineCatalogue(args?: { userPipelines?: ReadonlyArray<PipelineDef> }): PipelineCatalogue {
  // -----------------------------
  // Global processes (ops)
  // -----------------------------
  const ops: OpSpec[] = [
    // Segmentation
    {
      kind: "dispatch",
      id: "op.seg.resize",
      title: "Resize",
      io: io("image", "image"),
      dispatchId: "segmentation.resize",
      tuningId: "segmentation.resize",
      group: "Segmentation",
    },
    {
      kind: "dispatch",
      id: "op.seg.denoise",
      title: "Denoise",
      io: io("image", "image"),
      dispatchId: "segmentation.denoise",
      tuningId: "segmentation.denoise",
      group: "Segmentation",
    },
    {
      kind: "dispatch",
      id: "op.seg.color",
      title: "Color / Gray",
      io: io("image", "image"),
      dispatchId: "segmentation.color",
      tuningId: "segmentation.color",
      group: "Segmentation",
    },
    {
      kind: "dispatch",
      id: "op.seg.threshold",
      title: "Threshold",
      io: io("image", "mask"),
      dispatchId: "segmentation.threshold",
      tuningId: "segmentation.threshold",
      group: "Segmentation",
    },
    {
      kind: "dispatch",
      id: "op.seg.morphology",
      title: "Morphology cleanup",
      io: io("mask", "mask"),
      dispatchId: "segmentation.morphology",
      tuningId: "segmentation.morphology",
      group: "Segmentation",
    },

    // Edge
    {
      kind: "dispatch",
      id: "op.edge.resize",
      title: "Resize",
      io: io("image", "image"),
      dispatchId: "edge.resize",
      tuningId: "edge.resize",
      group: "Edge",
    },
    {
      kind: "dispatch",
      id: "op.edge.threshold",
      title: "Threshold",
      io: io("image", "mask"),
      dispatchId: "edge.threshold",
      tuningId: "edge.threshold",
      group: "Edge",
    },
    {
      kind: "dispatch",
      id: "op.edge.morphology",
      title: "Morphology cleanup",
      io: io("mask", "mask"),
      dispatchId: "edge.morphology",
      tuningId: "edge.morphology",
      group: "Edge",
    },
    {
      kind: "dispatch",
      id: "op.edge.extract",
      title: "Edge extract",
      io: io("mask", "mask"),
      dispatchId: "edge.extract",
      tuningId: "edge.extract",
      group: "Edge",
    },

    // SVG
    {
      kind: "dispatch",
      id: "op.svg.create",
      title: "Create SVG",
      io: io("mask", "svg"),
      dispatchId: "svg.create",
      tuningId: "svg.create",
      group: "SVG",
    },

    // Cleanup (min area)
    {
      kind: "dispatch",
      id: "op.mage.clean.removeSmallComponents",
      title: "Remove small components",
      io: io("mask", "mask"),
      dispatchId: "mage.clean.removeSmallComponents",
      tuningId: "mage.clean.removeSmallComponents",
      group: "Cleanup",
    },

    // Utility
    {
      kind: "js",
      id: "op.util.pass.image",
      title: "Pass-through (image)",
      io: io("image", "image"),
      group: "Utility",
      run: ({ input }) => input,
    },
    {
      kind: "js",
      id: "op.util.pass.mask",
      title: "Pass-through (mask)",
      io: io("mask", "mask"),
      group: "Utility",
      run: ({ input }) => input,
    },
  ];


  function getOp(id: OpSpecId): OpSpec | null {
    return byId(ops, id);
  }

  // -----------------------------
  // Built-in pipelines (linear)
  // -----------------------------
  function pipeOps(prefix: string, opIds: ReadonlyArray<OpSpecId>): PipelineOpInstance[] {
    return opIds.map((opId, i) => ({
      instanceId: makeInstanceId(prefix, i),
      opId,
      enabled: true,
    }));
  }


  const builtIns: PipelineDef[] = [
    {
      id: "segmentation",
      title: "Segmentation",
      implemented: true,
      description: "Multi-step segmentation pipeline (image -> mask).",
      ops: pipeOps("segmentation", [
        "op.seg.resize",
        "op.seg.denoise",
        "op.seg.color",
        "op.seg.threshold",
        "op.seg.morphology",
      ]),
    },

    {
      id: "edge",
      title: "Edge",
      implemented: true,
      description: "Edge extraction pipeline (image -> mask -> edges).",
      ops: pipeOps("edge", ["op.edge.resize", "op.edge.threshold", "op.edge.morphology", "op.edge.extract"]),
    },

    {
      id: "svg",
      title: "SVG",
      implemented: true,
      description: "Image to SVG outline.",
      ops: pipeOps("svg", [
        "op.edge.resize",
        "op.edge.threshold",
        "op.edge.morphology",
        "op.edge.extract",
        "op.svg.create",
      ]),
    },

    {
      id: "cleanup",
      title: "Cleanup (min area)",
      implemented: true,
      description: "Image -> mask -> cleanup (morphology + remove small components).",
      ops: pipeOps("cleanup", [
        "op.seg.resize",
        "op.seg.threshold",
        "op.seg.morphology",
        "op.mage.clean.removeSmallComponents",
      ]),
    },

    {
      id: "surface",
      title: "Surface",
      implemented: false,
      description: "Future: region labeling + vectorize pipeline.",
      ops: [],
    },
  ];

const userPipelines: ReadonlyArray<PipelineDef> = args?.userPipelines ?? [];

  function getBuiltIn(id: PipelineId): PipelineDef | null {
    return byId(builtIns, id);
  }

  function getPipeline(id: PipelineId): PipelineDef | null {
    // Recommend: user overrides built-in on id collision
    return byId(userPipelines, id) ?? byId(builtIns, id);
  }

  function listPipelines(): ReadonlyArray<PipelineDef> {
    // If a user pipeline shadows a built-in, keep only the user copy
    const userIds = new Set(userPipelines.map((p) => p.id));
    const mergedBuiltIns = builtIns.filter((p) => !userIds.has(p.id));
    return [...mergedBuiltIns, ...userPipelines];
  }

  return {
    ops,
    getOp,

    builtIns,
    getBuiltIn,

    listPipelines,
    getPipeline,

    createInstanceId: makeInstanceId,
  };
}
