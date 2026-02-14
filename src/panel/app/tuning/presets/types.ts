// src/panel/app/tuning/presets/types.ts
import type { ComponentId, EnginePolicy, ParamValue } from "../types";

export type TuningPreset = {
  id: string;
  title: string;
  description?: string;

  // Where it is intended to be dropped (useful for UI filtering)
  target: ComponentId; // e.g. "pipeline" or "segmentation.threshold"

  policies?: Array<{ id: ComponentId; policy: EnginePolicy }>;
  params?: Array<{ id: ComponentId; key: string; value: ParamValue }>;
};
