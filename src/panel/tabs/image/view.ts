import type { Dom } from "../../app/dom";
import type { imageTabState } from "./model";

export type ImageTabViewHandlers = {
  onMove: (fromIndex: number, toIndex: number) => void;
};

export type imageTabView = {
  setHover: (on: boolean) => void;
  drawImageToSource: (img: HTMLImageElement) => void;
  showLoadOk: (filenames: string[]) => void;
  showLoadError: (message: string) => void;
};

export function createMageTabView(dom: Dom, state: imageTabState, handlers: ImageTabViewHandlers): imageTabView {
  let listHost: HTMLDivElement | null = null;

  function ensureListHost(): HTMLDivElement {
    if (listHost) return listHost;

    const host = document.createElement("div");
    host.className = "mageFileList";
    host.setAttribute(
      "style",
      [
        "margin-top:10px;",
        "padding:8px 10px;",
        "border-radius:10px;",
        "border:1px solid rgba(255,255,255,0.12);",
        "background: rgba(0,0,0,0.06);",
        "font-size:12px;",
      ].join(" "),
    );

    const parent = dom.dropZoneEl.parentElement ?? dom.dropZoneEl;
    parent.appendChild(host);

    listHost = host;
    return host;
  }

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

  function renderFileList(names: string[]): void {
    const host = ensureListHost();
    host.innerHTML = "";

    if (!names.length) {
      host.textContent = "No files loaded.";
      return;
    }

    const title = document.createElement("div");
    title.textContent = names.length === 1 ? "Loaded file:" : `Loaded files (${names.length}) — reorder for stacking/PDF:`;
    title.setAttribute("style", "margin-bottom:6px; opacity:0.85;");
    host.appendChild(title);

    for (let i = 0; i < names.length; i++) {
      const row = document.createElement("div");
      row.setAttribute(
        "style",
        [
          "display:flex;",
          "align-items:center;",
          "gap:8px;",
          "padding:4px 0;",
          "border-top: 1px solid rgba(255,255,255,0.06);",
        ].join(" "),
      );

      const nameEl = document.createElement("div");
      nameEl.textContent = `${i + 1}. ${names[i]}`;
      nameEl.setAttribute("style", "flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;");
      row.appendChild(nameEl);

      const btnUp = document.createElement("button");
      btnUp.type = "button";
      btnUp.textContent = "Up";
      btnUp.disabled = i === 0;
      btnUp.addEventListener("click", () => handlers.onMove(i, i - 1));
      row.appendChild(btnUp);

      const btnDown = document.createElement("button");
      btnDown.type = "button";
      btnDown.textContent = "Down";
      btnDown.disabled = i === names.length - 1;
      btnDown.addEventListener("click", () => handlers.onMove(i, i + 1));
      row.appendChild(btnDown);

      host.appendChild(row);
    }
  }

  function showLoadOk(filenames: string[]): void {
    state.lastError = undefined;

    const names = Array.isArray(filenames) ? filenames.filter(Boolean) : [];
    state.loadedImageNames = names;
    state.loadedCount = names.length;

    state.loadedImageName = names[0] ?? null; // keep old field consistent
    state.hasImage = names.length > 0;

    renderFileList(names);
  }

  function showLoadError(message: string): void {
    state.lastError = message;
    state.hasImage = false;
    state.loadedImageName = null;
    state.loadedImageNames = [];
    state.loadedCount = 0;

    const host = ensureListHost();
    host.innerHTML = "";
    host.textContent = `Error: ${message}`;
  }

  // initial render
  renderFileList(state.loadedImageNames ?? []);

  return { setHover, drawImageToSource, showLoadOk, showLoadError };
}