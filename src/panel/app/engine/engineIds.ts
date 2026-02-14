// src/panel/app/engine/engineId.ts

export type EngineId =
  | "native"
  | "opencv"; // future: "nativeA" | "nativeB" | ...

export const ENGINE_NATIVE: EngineId = "native";
export const ENGINE_OPENCV: EngineId = "opencv";
