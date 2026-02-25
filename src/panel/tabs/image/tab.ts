// src/panel/tabs/image/tab.ts
import type { Dom } from "../../app/dom";
import type { Bus } from "../../app/bus";

import { createMageTabView } from "./view";
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
  const view = createMageTabView(dom, state);

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
    images: LoadedImage[];
    createdAtMs: number;
  }): void {
    // Temporary bridge until we formalize this into cache.ts / pipeline input store.
    (globalThis as any).app__ = (globalThis as any).app__ ?? {};
    (globalThis as any).app__.input__ = payload;
  }

  async function loadFilesIntoSourceCanvas(files: File[]): Promise<void> {
    const imgFiles = (files ?? []).filter((f) => f && f.type.startsWith("image/"));
    if (imgFiles.length === 0) {
      throw new Error("No supported images found.");
    }

    // Decode all; draw the first as preview (keeps current UX)
    const decoded = await Promise.all(imgFiles.map(decodeImageFromFile));

    view.drawImageToSource(decoded[0]!);

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

    view.showLoadOk(imgFiles.map((f) => f.name));

    // Publish as "image" or "imageList"
    publishInputPlaceholder({
      kind: loaded.length === 1 ? "image" : "imageList",
      images: loaded,
      createdAtMs: Date.now(),
    });

    actionLog.append({
      scope: "panel",
      kind: "info",
      message: loaded.length === 1 ? `Input loaded: ${loaded[0]!.name}` : `Inputs loaded: ${loaded.length} images`,
    });

    debugTrace.append({
      scope: "panel",
      kind: "info",
      message: "Mage input loaded",
      meta: {
        count: loaded.length,
        names: loaded.slice(0, 10).map((x) => x.name),
        first: loaded[0]
          ? { name: loaded[0].name, w: loaded[0].width, h: loaded[0].height, type: loaded[0].type }
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