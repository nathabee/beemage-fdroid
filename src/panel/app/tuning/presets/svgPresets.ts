// src/panel/app/tuning/presets/svgPresets.ts
import type { TuningPreset } from "./types";

export const svgPresets: ReadonlyArray<TuningPreset> = [
  {
    id: "svg.recipe.basic",
    title: "Recipe: Basic SVG outline",
    target: "svg",
    params: [
      { id: "edge.resize", key: "targetMaxW", value: 1200 },
      { id: "edge.threshold", key: "manualT", value: 128 },
      { id: "edge.morphology", key: "morphK", value: 3 },
      { id: "svg.create", key: "scale", value: 1 },
      { id: "svg.create", key: "transparentBg", value: 1 },
    ],
  },
];

export function getSvgPresetById(id: string): TuningPreset | null {
  return svgPresets.find((p) => p.id === id) ?? null;
}
