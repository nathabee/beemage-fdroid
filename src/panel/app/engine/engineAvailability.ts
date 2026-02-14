// src/panel/app/engine/engineAvailibity.ts

import type { EngineId } from "./engineIds";

export type EngineAvailability = {
  available: boolean;
  reason?: string;
};

const availability: Record<EngineId, EngineAvailability> = {
  native: { available: true },
  opencv: { available: false, reason: "OpenCV not loaded" },
};

export function getEngineAvailability(id: EngineId): EngineAvailability {
  return availability[id];
}

export function setEngineAvailable(id: EngineId): void {
  availability[id] = { available: true };
}

export function setEngineUnavailable(id: EngineId, reason: string): void {
  availability[id] = { available: false, reason };
}

export function isOpenCvInjected(): boolean {
  return availability.opencv.available === true;
}
