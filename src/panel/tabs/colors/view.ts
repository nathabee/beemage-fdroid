// src/panel/tabs/colors/view.ts
import type { Dom } from "../../app/dom";
import type { FillSettings, Preview } from "./model";
import { sanitizeSettings } from "./model";

export type ColorsViewApi = {
  bind(): void;
  setStatus(text: string): void;
  getSettings(): FillSettings;
  setSelectedColor(hex: string): void;
  getSelectedColor(): string;
  renderPalette(colors: string[]): void;

  drawBase(img: ImageData): void;
  drawPreview(img: ImageData, preview: Preview): void;

  setApplyEnabled(on: boolean): void;
  setCancelEnabled(on: boolean): void;

  onCanvasClick(cb: (x: number, y: number) => void): void;
};

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}

function normHex(s: string): string | null {
  const v = (s || "").trim();
  if (!v) return null;
  const x = v.startsWith("#") ? v : `#${v}`;
  if (/^#[0-9a-fA-F]{6}$/.test(x)) return x.toLowerCase();
  return null;
}

export function createColorsView(dom: Dom): ColorsViewApi {
  let selectedHex = "#ff3b30"; // default: vivid red-ish for visibility
  let palette: string[] = [];
  let clickHandler: ((x: number, y: number) => void) | null = null;

  function setStatus(text: string) {
    dom.colorsStatusEl.textContent = text || "";
  }

  function getSettings(): FillSettings {
    const edgesDark = !!dom.edgesDarkEl.checked;
    const edgeThreshold = clampInt(parseInt(dom.edgeMaskThresholdEl.value, 10), 0, 255);
    const edgeDilate = clampInt(parseInt(dom.edgeDilateEl.value, 10), 0, 6);
    const maxRegionPx = clampInt(parseInt(dom.maxRegionPxEl.value, 10), 1000, 10_000_000);

    // normalize fields
    dom.edgeMaskThresholdEl.value = String(edgeThreshold);
    dom.edgeDilateEl.value = String(edgeDilate);
    dom.maxRegionPxEl.value = String(maxRegionPx);

    return sanitizeSettings({ edgesDark, edgeThreshold, edgeDilate, maxRegionPx });
  }

  function setSelectedColor(hex: string) {
    const v = normHex(hex);
    if (!v) return;
    selectedHex = v;
    // update palette selection UI
    for (const el of Array.from(dom.paletteEl.querySelectorAll(".paletteItem"))) {
      const c = (el as HTMLElement).dataset["hex"] || "";
      el.classList.toggle("is-selected", c === selectedHex);
    }
  }

  function getSelectedColor(): string {
    return selectedHex;
  }

  function renderPalette(colors: string[]) {
    palette = colors.slice();
    dom.paletteEl.innerHTML = "";

    for (const hex of palette) {
      const v = normHex(hex);
      if (!v) continue;

      const item = document.createElement("button");
      item.type = "button";
      item.className = "paletteItem";
      item.style.background = v;
      item.dataset["hex"] = v;
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-label", `Select ${v}`);

      item.addEventListener("click", () => {
        setSelectedColor(v);
      });

      dom.paletteEl.appendChild(item);
    }

    // ensure one selected
    setSelectedColor(selectedHex);
  }

  function drawBase(img: ImageData) {
    const c = dom.colorsCanvasEl;
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.putImageData(img, 0, 0);
  }

  function drawPreview(img: ImageData, preview: Preview) {
    drawBase(img);

    const ctx = dom.colorsCanvasEl.getContext("2d")!;
    const { outline, w, h } = preview;

    const overlay = ctx.getImageData(0, 0, w, h);
    const d = overlay.data;

    // paint outline in red, semi-opaque
    for (let p = 0, i = 0; p < outline.length; p++, i += 4) {
      if (!outline[p]) continue;
      d[i + 0] = 255;
      d[i + 1] = 60;
      d[i + 2] = 60;
      d[i + 3] = 220;
    }

    ctx.putImageData(overlay, 0, 0);
  }

  function setApplyEnabled(on: boolean) {
    dom.btnColorsApplyEl.disabled = !on;
  }

  function setCancelEnabled(on: boolean) {
    dom.btnColorsCancelEl.disabled = !on;
  }

  function onCanvasClick(cb: (x: number, y: number) => void) {
    clickHandler = cb;
  }

  function bind() {
    setStatus("Idle");
    setApplyEnabled(false);
    setCancelEnabled(false);

    dom.colorsCanvasEl.addEventListener("click", (e) => {
      if (!clickHandler) return;

      const rect = dom.colorsCanvasEl.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * dom.colorsCanvasEl.width);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * dom.colorsCanvasEl.height);

      clickHandler(x, y);
    });
  }

  return {
    bind,
    setStatus,
    getSettings,
    setSelectedColor,
    getSelectedColor,
    renderPalette,
    drawBase,
    drawPreview,
    setApplyEnabled,
    setCancelEnabled,
    onCanvasClick,
  };
}
