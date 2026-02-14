// src/panel/tabs/image/view.ts
import type { Dom } from "../../app/dom";
import type { imageTabState } from "./model";

export type imageTabView = {
  setHover: (on: boolean) => void;
  drawImageToSource: (img: HTMLImageElement) => void;
  showLoadOk: (filename: string) => void;
  showLoadError: (message: string) => void;
};

export function createMageTabView(dom: Dom, state: imageTabState): imageTabView {
  function setHover(on: boolean): void {
    dom.dropZoneEl.classList.toggle("is-hover", on);
  }

  function drawImageContain(canvas: HTMLCanvasElement, img: HTMLImageElement): void {
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (!ctx) return;

    const cw = Math.max(1, canvas.width);
    const ch = Math.max(1, canvas.height);
    ctx.clearRect(0, 0, cw, ch);

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;

    const scale = Math.min(cw / iw, ch / ih);
    const dw = Math.max(1, Math.round(iw * scale));
    const dh = Math.max(1, Math.round(ih * scale));
    const dx = Math.floor((cw - dw) / 2);
    const dy = Math.floor((ch - dh) / 2);

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function drawImageToSource(img: HTMLImageElement): void {
    drawImageContain(dom.srcCanvasEl, img);
  }

  function showLoadOk(filename: string): void {
    state.lastError = undefined;
    state.loadedImageName = filename;
    state.hasImage = true;
  }

  function showLoadError(message: string): void {
    state.lastError = message;
    state.hasImage = false;
  }

  return { setHover, drawImageToSource, showLoadOk, showLoadError };
}
