//src/panel/app/engine/engineStrategy.ts

import type { EngineId } from "./engineIds";
import { ENGINE_NATIVE, ENGINE_OPENCV } from "./engineIds";
import { getEngineAvailability } from "./engineAvailability";

export type EngineStrategy =
  | EngineId
  | "auto";

export function resolveEngine(strategy: EngineStrategy): EngineId {
  if (strategy === "auto") {
    return getEngineAvailability(ENGINE_OPENCV).available
      ? ENGINE_OPENCV
      : ENGINE_NATIVE;
  }

  const a = getEngineAvailability(strategy);
  if (!a.available) {
    throw new Error(
      `Engine "${strategy}" selected but not available: ${a.reason ?? "unknown reason"}`,
    );
  }

  return strategy;
}
