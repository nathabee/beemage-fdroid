// src/panel/tabs/colors/tab.ts
import type { Dom } from "../../app/dom";
import type { Bus } from "../../app/bus";

import { createColorsView } from "./view";
import { applyFillToImage, makePreviewFromClick } from "./model";
import { getLastPipelineOutput } from "../../app/pipeline/outputStore";
 
import type { Preview } from "./model";

type TabApi = {
  bind(): void;
  boot?: () => void;
};

const PALETTE_20 = [
  "#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00c7be",
  "#007aff", "#5856d6", "#af52de", "#ff2d55", "#a2845e",
  "#8e8e93", "#1c1c1e", "#ffffff", "#000000", "#4cd964",
  "#5ac8fa", "#ff6b6b", "#7aa2ff", "#f5a623", "#50e3c2",
];

export function createColorsTab(dom: Dom, _bus: Bus): TabApi {
  const view = createColorsView(dom);

  // Working image for the Colors tab (starts as copy of the last pipeline output)
  let baseImg: ImageData | null = null;
  let preview: Preview | null = null;

  function setStatus(t: string) {
    view.setStatus(t);
  }

  function maskToImageData(mask: Uint8Array, w: number, h: number): ImageData {
    const out = new ImageData(w, h);
    const d = out.data;

    // Render mask 1 => black, 0 => white (easy to see regions)
    for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
      const on = (mask[p] ?? 0) > 0;
      const v = on ? 0 : 255;
      d[i + 0] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }

    return out;
  }

  function readPipelineOutputAsImage(): ImageData | null {
    const out = getLastPipelineOutput();

    if (out.type === "image") return out.image;

    if (out.type === "mask") {
      return maskToImageData(out.mask, out.width, out.height);
    }

    // SVG output isn't directly usable for pixel flood-fill here
    return null;
  }

  function explainWhyNoInput(): string {
    const out = getLastPipelineOutput();
    if (out.type === "svg") return "Pipeline output is SVG. Colors needs an image or mask output.";
    return "No pipeline output available. Run the Pipeline first.";
  }

  function resetFromPipelineOutput(): void {
    const img = readPipelineOutputAsImage();

    if (!img) {
      baseImg = null;
      preview = null;
      view.setApplyEnabled(false);
      view.setCancelEnabled(false);
      setStatus(explainWhyNoInput());
      return;
    }

    baseImg = img;
    preview = null;

    view.drawBase(baseImg);
    view.setApplyEnabled(false);
    view.setCancelEnabled(false);
    setStatus("Ready. Pick a color, click inside a region.");
  }

  /**
   * On entering Colors tab:
   * - if we already have baseImg, keep it (user work-in-progress)
   * - otherwise, try to prefill from last pipeline output
   */
  function maybePrefillOnEnter(): void {
    if (baseImg) {
      view.drawBase(baseImg);
      return;
    }

    const img = readPipelineOutputAsImage();
    if (!img) {
      setStatus(explainWhyNoInput());
      return;
    }

    baseImg = img;
    preview = null;

    view.drawBase(baseImg);
    view.setApplyEnabled(false);
    view.setCancelEnabled(false);
    setStatus("Loaded pipeline output. Pick a color, click inside a region.");
  }

  function applyPreview(): void {
    if (!baseImg || !preview) return;

    const hex = view.getSelectedColor();
    baseImg = applyFillToImage(baseImg, preview, hex);
    preview = null;

    view.drawBase(baseImg);
    view.setApplyEnabled(false);
    view.setCancelEnabled(false);
    setStatus("Fill applied. Click another region.");
  }

  function cancelPreview(): void {
    if (!baseImg) return;

    preview = null;
    view.drawBase(baseImg);
    view.setApplyEnabled(false);
    view.setCancelEnabled(false);
    setStatus("Preview canceled.");
  }

  return {
    bind() {
      view.bind();
      view.renderPalette(PALETTE_20);

      view.onCanvasClick((x, y) => {
        if (!baseImg) {
          setStatus(explainWhyNoInput());
          return;
        }

        const settings = view.getSettings();
        const res = makePreviewFromClick(baseImg, x, y, settings);

        if (!res.ok) {
          preview = null;
          view.setApplyEnabled(false);
          view.setCancelEnabled(false);
          setStatus(res.message);
          return;
        }

        preview = res.preview;
        view.drawPreview(baseImg, preview);
        view.setApplyEnabled(true);
        view.setCancelEnabled(true);
        setStatus("Preview shown. Apply fill or cancel.");
      });

      dom.btnColorsApplyEl.addEventListener("click", () => applyPreview());
      dom.btnColorsCancelEl.addEventListener("click", () => cancelPreview());
      dom.btnColorsResetEl.addEventListener("click", () => resetFromPipelineOutput());

      dom.tabColors.addEventListener("click", () => {
        queueMicrotask(() => maybePrefillOnEnter());
      });

      setStatus("Idle");
      view.setApplyEnabled(false);
      view.setCancelEnabled(false);
    },
  };
}


