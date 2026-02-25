// src/panel/app/pipeline/outputStore.ts
import type { Artifact, ImageArtifact, MaskArtifact, SvgArtifact, PdfArtifact, ImageListArtifact } from "./type";

export type PipelineLastOutput =
  | { type: "none" }
  | { type: "image"; image: ImageData }
  | { type: "mask"; mask: Uint8Array; width: number; height: number }
  | { type: "svg"; svg: string }
  | { type: "pdf"; bytes: Uint8Array; mime: "application/pdf"; filenameHint?: string }
  | {
      type: "imageList";
      count: number;
      first?: { width: number; height: number; data: ImageData };
    };

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

  if (a.type === "pdf") {
    const p = a as PdfArtifact;
    setLastPipelineOutput({ type: "pdf", bytes: p.bytes, mime: p.mime, filenameHint: p.filenameHint });
    return;
  }

  if (a.type === "imageList") {
    const list = a as ImageListArtifact;
    const first = list.items?.[0];
    setLastPipelineOutput({
      type: "imageList",
      count: Array.isArray(list.items) ? list.items.length : 0,
      first: first ? { width: first.width, height: first.height, data: first.image } : undefined,
    });
    return;
  }

  setLastPipelineOutput({ type: "none" });
}

/**
 * Convenience adapter for the Pipeline tab VM.
 * Must match the actual PipelineVm shape (summary preview for imageList).
 */
export function setLastPipelineOutputFromVm(
  vm:
    | {
        outputImage?: { data: ImageData };
        outputMask?: { data: Uint8Array; width: number; height: number };
        outputSvg?: { svg: string };
        outputPdf?: { bytes: Uint8Array; filenameHint?: string };
        outputImageList?: { count: number; first?: { width: number; height: number; data: ImageData } };
      }
    | null
    | undefined,
): void {
  if (!vm) {
    setLastPipelineOutput({ type: "none" });
    return;
  }

  // Prefer PDF if present
  const pdfBytes = vm.outputPdf?.bytes;
  if (pdfBytes && pdfBytes.byteLength > 0) {
    setLastPipelineOutput({
      type: "pdf",
      bytes: pdfBytes,
      mime: "application/pdf",
      filenameHint: vm.outputPdf?.filenameHint,
    });
    return;
  }

  // Then imageList summary (Phase 5: avoid "unknown")
  const list = vm.outputImageList;
  if (list && typeof list.count === "number" && list.count > 0) {
    setLastPipelineOutput({
      type: "imageList",
      count: list.count,
      first: list.first ? { width: list.first.width, height: list.first.height, data: list.first.data } : undefined,
    });
    return;
  }

  // Then SVG
  const svg = vm.outputSvg?.svg;
  if (typeof svg === "string" && svg.length > 0) {
    setLastPipelineOutput({ type: "svg", svg });
    return;
  }

  // Then image
  const img = vm.outputImage?.data;
  if (img) {
    setLastPipelineOutput({ type: "image", image: img });
    return;
  }

  // Then mask
  const mask = vm.outputMask?.data;
  const w = vm.outputMask?.width;
  const h = vm.outputMask?.height;
  if (mask && typeof w === "number" && typeof h === "number") {
    setLastPipelineOutput({ type: "mask", mask, width: w, height: h });
    return;
  }

  setLastPipelineOutput({ type: "none" });
}