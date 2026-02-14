// src/panel/app/tuning/registry.ts

import type {
  ComponentId,
  ComponentNode,
  ComponentRegistry,
  EngineId,
  EnginePolicy,
  ParamSchema,
} from "./types";

function n(
  id: ComponentId,
  title: string,
  implementedEngines: ReadonlyArray<EngineId>,
  defaultEnginePolicy: EnginePolicy,
  params: Record<string, ParamSchema>,
  children?: ComponentNode[],
  description?: string,
): ComponentNode {
  return { id, title, implementedEngines, defaultEnginePolicy, params, children, description };
}

function buildIndex(root: ComponentNode): ComponentRegistry {
  const byId = new Map<ComponentId, ComponentNode>();
  const parentById = new Map<ComponentId, ComponentId | null>();

  function walk(node: ComponentNode, parent: ComponentId | null) {
    if (byId.has(node.id)) {
      throw new Error(`[tuning] Duplicate component id: ${node.id}`);
    }
    byId.set(node.id, node);
    parentById.set(node.id, parent);

    for (const ch of node.children ?? []) walk(ch, node.id);
  }

  walk(root, null);
  return { root, byId, parentById };
}

/**
 * Registry is the source of truth for:
 * - component tree
 * - parameter schemas + defaults
 * - which engines are implemented (native/opencv)
 *
 * NOTE: "opencv" implementation presence is separate from runtime availability (injection).
 */
export function createComponentRegistry(): ComponentRegistry {
  const root = n(
    "app",
    "BeeMage",
    ["native", "opencv"],
    "native",
    {},
    [

      // -----------------------------
      // Edge (pipeline)
      // -----------------------------
      n(
        "edge",
        "Edge",
        ["native", "opencv"],
        "auto",
        {},
        [
          n(
            "edge.resize",
            "Resize",
            ["native", "opencv"],
            "auto",
            {
              resizeAlgo: { kind: "number", label: "Resize algo", min: 0, max: 3, step: 1, default: 1 },
              targetMaxW: { kind: "number", label: "Target max width", min: 100, max: 4000, step: 50, default: 1200 },
            },
            undefined,
            "Prepare image for stable downstream processing.",
          ),

          n(
            "edge.threshold",
            "Threshold",
            ["native", "opencv"],
            "auto",
            {
              manualT: { kind: "number", label: "Manual threshold", min: 0, max: 255, step: 1, default: 128 },
            },
            undefined,
            "Convert image into a binary mask before edge extraction.",
          ),

          n(
            "edge.morphology",
            "Morphology cleanup",
            ["native", "opencv"],
            "auto",
            {
              morphAlgo: { kind: "number", label: "Morph algo", min: 0, max: 3, step: 1, default: 2 },
              morphK: { kind: "number", label: "Kernel size", min: 1, max: 31, step: 2, default: 3 },
              morphIters: { kind: "number", label: "Iterations", min: 1, max: 5, step: 1, default: 1 },
            },
            undefined,
            "Clean the mask before extracting edges.",
          ),

          n(
            "edge.extract",
            "Edge extract",
            ["native", "opencv"],
            "auto",
            {},
            undefined,
            "Extract a 1px outline from the cleaned mask.",
          ),
        ],
        "Fixed-order edge pipeline (image -> mask -> edges). Presets configure each step.",
      ),


      // -----------------------------
      // SVG (pipeline)
      // -----------------------------
      n(
        "svg",
        "SVG",
        ["native", "opencv"],
        "auto",
        {},
        [
          n(
            "svg.create",
            "Create SVG",
            ["native", "opencv"],
            "auto",
            {
              scale: { kind: "number", label: "Scale", min: 1, max: 10, step: 1, default: 1 },
              transparentBg: { kind: "number", label: "Transparent bg (0/1)", min: 0, max: 1, step: 1, default: 1 },
              color: { kind: "text", label: "Color", default: "#3bca1e" },

            } as any,
            undefined,
            "Convert the edge mask into an SVG.",
          ),
        ],
        "SVG generation parameters.",
      ),


      // -----------------------------
      // Segmentation (pipeline)
      // -----------------------------
      n(
        "segmentation",
        "Segmentation",
        ["native", "opencv"],
        "auto",
        {},
        [
          n(
            "segmentation.resize",
            "Resize",
            ["native", "opencv"],
            "auto",
            {
              resizeAlgo: { kind: "number", label: "Resize algo", min: 0, max: 3, step: 1, default: 1 },
              targetMaxW: { kind: "number", label: "Target max width", min: 100, max: 4000, step: 50, default: 1200 },
            },
            undefined,
            "Prepare image for stable downstream processing.",
          ),

          n(
            "segmentation.denoise",
            "Denoise",
            ["native", "opencv"],
            "auto",
            {
              denoiseAlgo: { kind: "number", label: "Denoise algo", min: 0, max: 2, step: 1, default: 1 },
              blurK: { kind: "number", label: "Blur kernel", min: 1, max: 21, step: 2, default: 3 },
              bilateralSigma: { kind: "number", label: "Bilateral sigma", min: 1, max: 150, step: 1, default: 35 },
            },
            undefined,
            "Reduce noise before thresholding.",
          ),

          n(
            "segmentation.color",
            "Color / Gray",
            ["native", "opencv"],
            "auto",
            {
              colorMode: { kind: "number", label: "Color mode", min: 0, max: 3, step: 1, default: 1 },
              hsvChannel: { kind: "number", label: "HSV channel", min: 0, max: 2, step: 1, default: 2 },
            },
            undefined,
            "Select color space / channel features for thresholding.",
          ),

          n(
            "segmentation.threshold",
            "Threshold",
            ["native", "opencv"],
            "auto",
            {
              thresholdAlgo: { kind: "number", label: "Threshold algo", min: 0, max: 3, step: 1, default: 1 },
              manualT: { kind: "number", label: "Manual threshold", min: 0, max: 255, step: 1, default: 128 },
              adaptBlock: { kind: "number", label: "Adaptive block", min: 3, max: 101, step: 2, default: 31 },
              adaptC: { kind: "number", label: "Adaptive C", min: -50, max: 50, step: 1, default: 3 },
            },
            undefined,
            "Convert features into a binary mask.",
          ),

          n(
            "segmentation.morphology",
            "Morphology cleanup",
            ["native", "opencv"],
            "auto",
            {
              morphAlgo: { kind: "number", label: "Morph algo", min: 0, max: 3, step: 1, default: 2 },
              morphK: { kind: "number", label: "Kernel size", min: 1, max: 31, step: 2, default: 5 },
              morphIters: { kind: "number", label: "Iterations", min: 1, max: 5, step: 1, default: 1 },
            },
            undefined,
            "Remove specks, fill holes, and stabilize regions.",
          ),
        ],
        "Fixed-order segmentation pipeline. Presets configure each step.",
      ),
      // -----------------------------
      // image
      // -----------------------------
      n(
        "image",
        "iMage",
        ["native", "opencv"],
        "auto",
        {},
        [
          n(
            "mage.process",
            "Process",
            ["native"], // later: add "opencv" if you implement it
            "auto",
            {
              imageScale: { kind: "number", label: "Processing scale", min: 25, max: 100, step: 5, default: 100 },
              edgeThreshold: { kind: "number", label: "Edge threshold", min: 1, max: 255, step: 1, default: 70 },
              invertOutput: { kind: "boolean", label: "White background", default: true },
            },
          ),

          n(
            "mage.clean",
            "Clean & Smooth",
            ["native", "opencv"], // parent clean is a container; you can keep it native-only
            "auto",
            {
              cleanMinArea: { kind: "number", label: "Min fragment size", min: 0, max: 500, step: 1, default: 12 },
              cleanRadius: { kind: "number", label: "Repair strength", min: 1, max: 3, step: 1, default: 1 },
              cleanBinaryThreshold: {
                kind: "number",
                label: "Binary threshold",
                min: 1,
                max: 254,
                step: 1,
                default: 128,
              },
            },
            [
              n("mage.clean.threshold", "Threshold", ["native"], "auto", {}),
              n(
                "mage.clean.removeSmallComponents",
                "Remove small components",
                ["native", "opencv"],
                "auto",
                {
                  cleanMinArea: { kind: "number", label: "Min fragment size", min: 0, max: 5000, step: 1, default: 12 },
                },
                undefined,
                "Remove connected components smaller than the minimum area.",
              ),

              n("mage.clean.repair", "Repair gaps", ["native"], "auto", {}),
              n("mage.clean.smooth", "Smooth mask", ["native"], "auto", {}),
              n("mage.clean.quality", "Quality metrics", ["native"], "auto", {}),
            ],
          ),

          n(
            "mage.vectorize",
            "Vectorize (SVG)",
            ["native"],
            "native",
            {
              pathSmoothIters: {
                kind: "number",
                label: "Path smoothing",
                min: 0,
                max: 4,
                step: 1,
                default: 2,
              },
            },
          ),
        ],
      ),

      // -----------------------------
      // Colors
      // -----------------------------
      n(
        "colors",
        "Colors",
        ["native"],
        "auto",
        {},
        [
          n(
            "colors.fill",
            "Region fill",
            ["native"],
            "auto",
            {
              edgesDark: { kind: "boolean", label: "Edges are dark", default: true },
              edgeMaskThreshold: { kind: "number", label: "Edge threshold", min: 0, max: 255, step: 1, default: 80 },
              edgeDilate: { kind: "number", label: "Gap close (px)", min: 0, max: 6, step: 1, default: 2 },
              maxRegionPx: { kind: "number", label: "Max region (px)", min: 1000, step: 1000, default: 200000 },
            },
          ),
        ],
      ),
      // -----------------------------
      // Pipeline (generic runner) — UI state only
      // -----------------------------
      n(
        "pipeline",
        "Pipeline (UI)",
        ["native", "opencv"],
        "auto",
        {
          mode: { kind: "text", label: "Pipeline", default: "segmentation" },
          recipe: { kind: "text", label: "Recipe", default: "default" },
        },
        undefined,
        "UI state for the Pipeline tab (selected pipeline + recipe).",
      ),

    ],
  );

  return buildIndex(root);
}
