// src/panel/platform/engineAdapter.ts (extension stub)

import { setEngineUnavailable } from "../app/engine/engineAvailability";

export function supportsOpenCvLoad(): boolean {
  return false;
}

export async function attemptLoadOpenCv(): Promise<void> {
  setEngineUnavailable(
    "opencv",
    "OpenCV injection is not supported in the extension build (CSP / policy).",
  );
  throw new Error("OpenCV injection is not supported in the extension build.");
}
