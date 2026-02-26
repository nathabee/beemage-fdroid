import type { Dom } from "../../app/dom";
import type { Bus } from "../../app/bus";

import { createMageTabView } from "./view";
import type { ImageTabViewHandlers } from "./view";
import { createInitialMageTabState } from "./model";

import * as actionLog from "../../../shared/actionLog";
import * as debugTrace from "../../../shared/debugTrace";

type LoadedImage = {
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  imageData: ImageData;
};

export function createMageTab(dom: Dom, _bus: Bus) {
  const state = createInitialMageTabState();

  // Keep the ordered list here. The order is what we publish to app__.input__.
  let loadedImages: LoadedImage[] = [];

  const handlers: ImageTabViewHandlers = {
    onMove: (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || fromIndex >= loadedImages.length) return;
      if (toIndex < 0 || toIndex >= loadedImages.length) return;

      const next = loadedImages.slice();
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return;
      next.splice(toIndex, 0, moved);

      loadedImages = next;

      // Preview remains "first image"
      redrawPreviewFromFirst();
      publishCurrentInput();
      view.showLoadOk(loadedImages.map((x) => x.name));

      actionLog.append({
        scope: "panel",
        kind: "info",
        message: `Input order updated: ${fromIndex + 1} → ${toIndex + 1}`,
      });

      debugTrace.append({
        scope: "panel",
        kind: "info",
        message: "Mage input reordered",
        meta: { fromIndex, toIndex, names: loadedImages.slice(0, 10).map((x) => x.name) },
      });
    },
  };

  const view = createMageTabView(dom, state, handlers);

  async function decodeImageFromFile(file: File): Promise<HTMLImageElement> {
    if (!file.type.startsWith("image/")) {
      throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
    }

    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;

      if (typeof (img as any).decode === "function") {
        await (img as any).decode();
      } else {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image decode failed."));
        });
      }

      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function imageToImageData(img: HTMLImageElement): ImageData {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) throw new Error("Image has invalid dimensions.");

    const canvas = document.createElement("canvas");
    canvas.width = iw;
    canvas.height = ih;

    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (!ctx) throw new Error("2D canvas context unavailable.");

    ctx.drawImage(img, 0, 0, iw, ih);
    return ctx.getImageData(0, 0, iw, ih);
  }

  function publishInputPlaceholder(payload: {
    kind: "image" | "imageList";
    images: ImageData[];
    names?: string[];
    createdAtMs: number;
  }): void {
    // Temporary bridge until we formalize this into cache.ts / pipeline input store.
    (globalThis as any).app__ = (globalThis as any).app__ ?? {};
    (globalThis as any).app__.input__ = payload;
  }

  function publishCurrentInput(): void {
    const imgs = loadedImages.map((x) => x.imageData);
    const names = loadedImages.map((x) => x.name);

    publishInputPlaceholder({
      kind: imgs.length === 1 ? "image" : "imageList",
      images: imgs,
      names,
      createdAtMs: Date.now(),
    });
  }

  function redrawPreviewFromFirst(): void {
    // Keep current UX: draw first image on srcCanvas as preview.
    const first = loadedImages[0];
    if (!first) return;

    // Recreate an HTMLImageElement is expensive; instead draw ImageData directly.
    const c = dom.srcCanvasEl;
    c.width = Math.max(1, first.width);
    c.height = Math.max(1, first.height);

    const ctx = c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (!ctx) return;

    ctx.putImageData(first.imageData, 0, 0);
  }

  async function loadFilesIntoSourceCanvas(files: File[]): Promise<void> {
    const imgFiles = (files ?? []).filter((f) => f && f.type.startsWith("image/"));
    if (imgFiles.length === 0) {
      throw new Error("No supported images found.");
    }

    // Decode all
    const decoded = await Promise.all(imgFiles.map(decodeImageFromFile));

    const loaded: LoadedImage[] = decoded.map((img, i) => {
      const f = imgFiles[i]!;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;

      return {
        name: f.name,
        type: f.type,
        size: f.size,
        width: iw,
        height: ih,
        imageData: imageToImageData(img),
      };
    });

    loadedImages = loaded;

    // Preview (first)
    view.drawImageToSource(decoded[0]!);

    view.showLoadOk(imgFiles.map((f) => f.name));

    // Publish as ImageData[] (this is the important fix)
    publishCurrentInput();

    actionLog.append({
      scope: "panel",
      kind: "info",
      message: loadedImages.length === 1 ? `Input loaded: ${loadedImages[0]!.name}` : `Inputs loaded: ${loadedImages.length} images`,
    });

    debugTrace.append({
      scope: "panel",
      kind: "info",
      message: "Mage input loaded",
      meta: {
        count: loadedImages.length,
        names: loadedImages.slice(0, 10).map((x) => x.name),
        first: loadedImages[0]
          ? { name: loadedImages[0].name, w: loadedImages[0].width, h: loadedImages[0].height, type: loadedImages[0].type }
          : null,
      },
    });
  }

  function bindDragDrop(): void {
    dom.dropZoneEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      view.setHover(true);
    });

    dom.dropZoneEl.addEventListener("dragleave", () => view.setHover(false));

    dom.dropZoneEl.addEventListener("drop", (e) => {
      e.preventDefault();
      view.setHover(false);

      const list = Array.from(e.dataTransfer?.files ?? []);
      if (list.length === 0) return;

      void loadFilesIntoSourceCanvas(list).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);

        view.showLoadError(msg);

        actionLog.append({ scope: "panel", kind: "error", message: `Input load failed: ${msg}` });
        debugTrace.append({ scope: "panel", kind: "error", message: "Input load failed", meta: { error: msg } });
      });
    });

    dom.fileInputEl.addEventListener("change", () => {
      const list = Array.from(dom.fileInputEl.files ?? []);
      if (list.length === 0) return;

      void loadFilesIntoSourceCanvas(list).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);

        view.showLoadError(msg);

        actionLog.append({ scope: "panel", kind: "error", message: `Input load failed: ${msg}` });
        debugTrace.append({ scope: "panel", kind: "error", message: "Input load failed", meta: { error: msg } });
      });

      dom.fileInputEl.value = "";
    });
  }

  function bind(): void {
    bindDragDrop();
  }

  function mount(): void {}
  function unmount(): void {}

  return { id: "image" as const, bind, mount, unmount };
}