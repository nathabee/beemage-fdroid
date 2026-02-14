// android/src/mocks/engineAdapter.ts
import { setEngineUnavailable } from "@panel/app/engine/engineAvailability";

export function supportsOpenCvLoad(): boolean {
  return false;
}

export async function attemptLoadOpenCv(): Promise<void> {
  setEngineUnavailable("opencv", "OpenCV is not enabled in the Android build.");
  throw new Error("OpenCV is not enabled in the Android build.");
}
