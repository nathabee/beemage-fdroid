// src/panel/app/tuning/presets/pipelinePresets.ts
import type { TuningPreset } from "./types";

export const pipelinePresets: ReadonlyArray<TuningPreset> = [
  {
    id: "pipe.recipe.edge.basic",
    title: "Recipe: Edge (basic)",
    target: "pipeline",
    params: [
      { id: "pipeline", key: "mode", value: "edge" },

      // NOTE: these ids should later be renamed to op-level ids (edge.prep, edge.detect)
      { id: "pipeline.edge.prep", key: "targetMaxW", value: 1200 },
      { id: "pipeline.edge.edges", key: "edgeThreshold", value: 70 },
      { id: "pipeline.edge.edges", key: "edgesDark", value: true },
    ],
  },

  {
    id: "pipe.recipe.clean.basic",
    title: "Recipe: Clean (basic)",
    target: "pipeline",
    params: [
      { id: "pipeline", key: "mode", value: "clean" },

      { id: "pipeline.clean.threshold", key: "thresholdAlgo", value: 1 },
      { id: "pipeline.clean.threshold", key: "manualT", value: 128 },

      { id: "pipeline.clean.morphology", key: "morphAlgo", value: 2 },
      { id: "pipeline.clean.morphology", key: "morphK", value: 5 },
      { id: "pipeline.clean.morphology", key: "morphIters", value: 1 },
    ],
  },

  {
    id: "pipe.recipe.surface.colorbook",
    title: "Recipe: Surface (colorbook)",
    target: "pipeline",
    params: [
      { id: "pipeline", key: "mode", value: "surface" },

      { id: "pipeline.surface.bg", key: "bgTol", value: 14 },

      { id: "pipeline.surface.quantize", key: "kColors", value: 12 },
      { id: "pipeline.surface.quantize", key: "smoothSigma", value: 35 },

      { id: "pipeline.surface.regions", key: "minRegionArea", value: 200 },

      { id: "pipeline.surface.merge", key: "mergeSmallMode", value: 0 },
      { id: "pipeline.surface.merge", key: "thinAsStroke", value: true },

      { id: "pipeline.surface.vectorize", key: "simplifyEps", value: 1.8 },
      { id: "pipeline.surface.vectorize", key: "fillRule", value: "evenodd" },

      { id: "pipeline.surface.outline", key: "outlinePx", value: 2 },
    ],
  },
];

export function getPipelinePresetById(id: string): TuningPreset | null {
  return pipelinePresets.find((p) => p.id === id) ?? null;
}
