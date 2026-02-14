// src/panel/tabs/image/tab.ts
import type { Dom } from "../../app/dom";
import type { Bus } from "../../app/bus";

import { createMageTabView } from "./view";
import { createInitialMageTabState } from "./model";

import * as actionLog from "../../../shared/actionLog";
import * as debugTrace from "../../../shared/debugTrace";

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

  async function loadIntoSourceCanvas(file: File): Promise<void> {
    const img = await decodeImageFromFile(file);

    view.drawImageToSource(img);
    view.showLoadOk(file.name);

    actionLog.append({ scope: "panel", kind: "info", message: `Input loaded: ${file.name}` });

    debugTrace.append({
      scope: "panel",
      kind: "info",
      message: "Mage input loaded into srcCanvas",
      meta: {
        name: file.name,
        type: file.type,
        size: file.size,
        canvasW: dom.srcCanvasEl.width,
        canvasH: dom.srcCanvasEl.height,
        naturalW: img.naturalWidth || img.width,
        naturalH: img.naturalHeight || img.height,
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

      const f = e.dataTransfer?.files?.[0];
      if (!f) return;

      void loadIntoSourceCanvas(f).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);

        view.showLoadError(msg);

        actionLog.append({ scope: "panel", kind: "error", message: `Input load failed: ${msg}` });
        debugTrace.append({ scope: "panel", kind: "error", message: "Input load failed", meta: { error: msg } });
      });
    });

    dom.fileInputEl.addEventListener("change", () => {
      const f = dom.fileInputEl.files?.[0];
      if (!f) return;

      void loadIntoSourceCanvas(f).catch((err) => {
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
