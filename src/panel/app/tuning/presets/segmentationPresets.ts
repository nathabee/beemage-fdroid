// src/panel/app/tuning/presets/segmentationPresets.ts
import type { TuningPreset } from "./types";

export const segmentationPresets: ReadonlyArray<TuningPreset> = [
  {
    id: "seg.recipe.document",
    title: "Recipe: Document scan",
    target: "segmentation",
    params: [
      { id: "segmentation.resize", key: "resizeAlgo", value: 1 },
      { id: "segmentation.resize", key: "targetMaxW", value: 1200 },

      { id: "segmentation.denoise", key: "denoiseAlgo", value: 1 },
      { id: "segmentation.denoise", key: "blurK", value: 3 },

      { id: "segmentation.color", key: "colorMode", value: 1 },

      { id: "segmentation.threshold", key: "thresholdAlgo", value: 2 },
      { id: "segmentation.threshold", key: "adaptBlock", value: 31 },
      { id: "segmentation.threshold", key: "adaptC", value: 3 },

      { id: "segmentation.morphology", key: "morphAlgo", value: 2 },
      { id: "segmentation.morphology", key: "morphK", value: 5 },
      { id: "segmentation.morphology", key: "morphIters", value: 1 },
    ],
  },

  {
    id: "seg.threshold.otsu",
    title: "Threshold: Otsu",
    target: "segmentation.threshold",
    params: [{ id: "segmentation.threshold", key: "thresholdAlgo", value: 1 }],
  },

  {
    id: "seg.morph.fill-holes",
    title: "Morphology: Fill holes (close)",
    target: "segmentation.morphology",
    params: [
      { id: "segmentation.morphology", key: "morphAlgo", value: 3 },
      { id: "segmentation.morphology", key: "morphK", value: 7 },
      { id: "segmentation.morphology", key: "morphIters", value: 1 },
    ],
  },
];

export function getSegmentationPresetById(id: string): TuningPreset | null {
  return segmentationPresets.find((p) => p.id === id) ?? null;
}
