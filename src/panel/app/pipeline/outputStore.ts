// src/panel/app/pipeline/outputStore.ts
import type { Artifact, ImageArtifact, MaskArtifact, SvgArtifact } from "./type";

export type PipelineLastOutput =
  | { type: "none" }
  | { type: "image"; image: ImageData }
  | { type: "mask"; mask: Uint8Array; width: number; height: number }
  | { type: "svg"; svg: string };

let last: PipelineLastOutput = { type: "none" };

export function setLastPipelineOutput(a: PipelineLastOutput): void {
  last = a;
}

export function getLastPipelineOutput(): PipelineLastOutput {
  return last;
}

export function setLastPipelineOutputFromArtifact(a: Artifact | null | undefined): void {
  if (!a) {
    setLastPipelineOutput({ type: "none" });
    return;
  }

  if (a.type === "image") {
    setLastPipelineOutput({ type: "image", image: (a as ImageArtifact).image });
    return;
  }
  if (a.type === "mask") {
    const m = a as MaskArtifact;
    setLastPipelineOutput({ type: "mask", mask: m.mask, width: m.width, height: m.height });
    return;
  }
  if (a.type === "svg") {
    setLastPipelineOutput({ type: "svg", svg: (a as SvgArtifact).svg });
    return;
  }

  setLastPipelineOutput({ type: "none" });
}

/**
 * Convenience adapter for the Pipeline tab VM.
 * Keeps tabs decoupled from Artifact internals.
 */
export function setLastPipelineOutputFromVm(vm: {
  outputImage?: { data: ImageData };
  outputMask?: { data: Uint8Array; width: number; height: number };
  outputSvg?: { svg: string };
} | null | undefined): void {
  if (!vm) {
    setLastPipelineOutput({ type: "none" });
    return;
  }

  const svg = vm.outputSvg?.svg;
  if (typeof svg === "string" && svg.length > 0) {
    setLastPipelineOutput({ type: "svg", svg });
    return;
  }

  const img = vm.outputImage?.data;
  if (img) {
    setLastPipelineOutput({ type: "image", image: img });
    return;
  }

  const mask = vm.outputMask?.data;
  const w = vm.outputMask?.width;
  const h = vm.outputMask?.height;
  if (mask && typeof w === "number" && typeof h === "number") {
    setLastPipelineOutput({ type: "mask", mask, width: w, height: h });
    return;
  }

  setLastPipelineOutput({ type: "none" });
}
