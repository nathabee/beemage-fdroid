// src/panel/app/tuning/presets/edgePresets.ts
import type { TuningPreset } from "./types";

export const edgePresets: ReadonlyArray<TuningPreset> = [
  {
    id: "edge.recipe.basic",
    title: "Recipe: Basic edge",
    target: "edge",
    params: [
      { id: "edge.resize", key: "resizeAlgo", value: 1 },
      { id: "edge.resize", key: "targetMaxW", value: 1200 },

      { id: "edge.threshold", key: "manualT", value: 128 },

      { id: "edge.morphology", key: "morphAlgo", value: 2 },
      { id: "edge.morphology", key: "morphK", value: 3 },
      { id: "edge.morphology", key: "morphIters", value: 1 },
    ],
  },

  {
    id: "edge.thresh.low",
    title: "Threshold: Lower (more ink)",
    target: "edge.threshold",
    params: [{ id: "edge.threshold", key: "manualT", value: 100 }],
  },

  {
    id: "edge.clean.specks",
    title: "Morphology: Remove specks (open)",
    target: "edge.morphology",
    params: [
      { id: "edge.morphology", key: "morphAlgo", value: 2 },
      { id: "edge.morphology", key: "morphK", value: 5 },
      { id: "edge.morphology", key: "morphIters", value: 1 },
    ],
  },
];

export function getEdgePresetById(id: string): TuningPreset | null {
  return edgePresets.find((p) => p.id === id) ?? null;
}
