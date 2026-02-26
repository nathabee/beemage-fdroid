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


import { imagesToPdf } from "../../../shared/lib/pdf/imagesToPdf";

import type { Artifact, ImageArtifact } from "./type";

function isImageArtifact(a: any): a is ImageArtifact {
  return !!a && a.type === "image" && typeof a.width === "number" && typeof a.height === "number" && !!a.image;
}

function stackImageListVertical(items: ReadonlyArray<ImageArtifact>): ImageArtifact {
  const safe = items.filter(isImageArtifact);
  if (safe.length === 0) throw new Error("Stack vertical: empty imageList.");

  const outW = Math.max(...safe.map((x) => x.width));
  const outH = safe.reduce((sum, x) => sum + x.height, 0);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, outW);
  canvas.height = Math.max(1, outH);

  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Stack vertical: 2D context unavailable.");

  let y = 0;
  for (const it of safe) {
    ctx.putImageData(it.image, 0, y);
    y += it.height;
  }

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { type: "image", width: img.width, height: img.height, image: img };
}

function stackImageListHorizontal(items: ReadonlyArray<ImageArtifact>): ImageArtifact {
  const safe = items.filter(isImageArtifact);
  if (safe.length === 0) throw new Error("Stack horizontal: empty imageList.");

  const outW = safe.reduce((sum, x) => sum + x.width, 0);
  const outH = Math.max(...safe.map((x) => x.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, outW);
  canvas.height = Math.max(1, outH);

  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Stack horizontal: 2D context unavailable.");

  let x = 0;
  for (const it of safe) {
    ctx.putImageData(it.image, x, 0);
    x += it.width;
  }

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { type: "image", width: img.width, height: img.height, image: img };
}

function pngBytesFromImageData(img: ImageData): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, img.width);
  canvas.height = Math.max(1, img.height);

  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("PNG encode: 2D context unavailable.");

  ctx.putImageData(img, 0, 0);

  // Sync path: dataURL → bytes
  const url = canvas.toDataURL("image/png");
  const i = url.indexOf("base64,");
  if (i < 0) throw new Error("PNG encode: unexpected data URL.");
  const b64 = url.slice(i + "base64,".length);

  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let j = 0; j < bin.length; j++) out[j] = bin.charCodeAt(j);
  return out;
}

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

    // Multi-input (imageList)

    {
      kind: "js",
      id: "op.util.pass.imageList",
      title: "Pass-through (imageList)",
      io: io("imageList", "imageList"),
      group: "Utility",
      run: ({ input }) => input,
    },
    {
      kind: "js",
      id: "op.imageList.stackVertical",
      title: "Stack images (vertical)",
      io: io("imageList", "image"),
      group: "Multi-input",
      run: ({ input }) => {
        const a = input as Artifact;
        if (a.type !== "imageList") throw new Error(`Expected imageList, got ${a.type}`);
        return stackImageListVertical(a.items as ReadonlyArray<ImageArtifact>);
      },
    },
    {
      kind: "js",
      id: "op.imageList.stackHorizontal",
      title: "Stack images (horizontal)",
      io: io("imageList", "image"),
      group: "Multi-input",
      run: ({ input }) => {
        const a = input as Artifact;
        if (a.type !== "imageList") throw new Error(`Expected imageList, got ${a.type}`);
        return stackImageListHorizontal(a.items as ReadonlyArray<ImageArtifact>);
      },
    },
    {
      kind: "js",
      id: "op.imageList.toPdf",
      title: "Images → PDF",
      io: io("imageList", "pdf"),
      group: "Multi-input",
      run: async ({ input }) => {
        const a = input as Artifact;
        if (a.type !== "imageList") throw new Error(`Expected imageList, got ${a.type}`);

        const items = (a.items as ReadonlyArray<ImageArtifact>).filter(isImageArtifact);
        if (items.length === 0) throw new Error("PDF: empty imageList.");

        // Convert each ImageData to PNG bytes, then feed as bytes into imagesToPdf()
        const pngBytesList: Uint8Array[] = items.map((it) => pngBytesFromImageData(it.image));

        const pdfBytes = await imagesToPdf(pngBytesList, {
          // Optional: pick defaults you like
          contain: true,
          // A4 portrait defaults already apply if you omit sizes
        });

        return { type: "pdf", bytes: pdfBytes, filenameHint: "beemage.pdf" } as Artifact;
      },
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
