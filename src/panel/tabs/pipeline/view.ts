// src/panel/tabs/pipeline/view.ts
import type {
  Artifact,
  ImageArtifact,
  MaskArtifact,
  SvgArtifact,
  ImageListArtifact,
  PdfArtifact,
} from "../../app/pipeline/type";
import { createOperationCard } from "../../app/pipeline/ui/operationCard";

export type PipelineViewHandlers = {
  onSelectPipeline: (id: string) => void;
  onSelectRecipe: (id: string) => void;
  onRunAll: () => void;
  onNext: () => void;
  onReset: () => void;
};

export type PipelineView = {
  mount(): void;
  render(vm: any): void;
  dispose(): void;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (typeof text === "string") e.textContent = text;
  return e;
}

function isImage(a: Artifact): a is ImageArtifact {
  return a.type === "image";
}
function isMask(a: Artifact): a is MaskArtifact {
  return a.type === "mask";
}
function isSvg(a: Artifact): a is SvgArtifact {
  return a.type === "svg";
}
function isImageList(a: Artifact): a is ImageListArtifact {
  return a.type === "imageList";
}
function isPdf(a: Artifact): a is PdfArtifact {
  return a.type === "pdf";
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderArtifactPreview(a: Artifact, maxHeightPx: number): HTMLElement {
  if (isPdf(a)) {
    const kb = Math.max(1, Math.round((a.bytes?.length ?? 0) / 1024));
    return el(
      "div",
      { class: "muted", style: "margin-top:8px; font-size:12px; white-space:pre-wrap;" },
      `PDF output (${kb} KB)`,
    );
  }

  if (isImageList(a)) {
    const wrap = el("div", { style: "margin-top:8px;" });
    wrap.appendChild(
      el("div", { class: "muted", style: "font-size:12px; margin-bottom:6px;" }, `Image list (${a.items.length})`),
    );

    const first = a.items[0];
    if (first) {
      const canvas = el("canvas", {
        class: "canvas",
        style:
          `display:block; margin-left:auto; margin-right:auto; ` +
          `max-width:100%; max-height:${maxHeightPx}px; width:auto; height:auto;`,
      }) as HTMLCanvasElement;
      drawImageToCanvas(canvas, first.image);
      wrap.appendChild(canvas);
    }
    return wrap;
  }

  if (isImage(a)) {
    const canvas = el("canvas", {
      class: "canvas",
      style:
        `margin-top:8px; display:block; margin-left:auto; margin-right:auto; ` +
        `max-width:100%; max-height:${maxHeightPx}px; width:auto; height:auto;`,
    }) as HTMLCanvasElement;
    drawImageToCanvas(canvas, a.image);
    return canvas;
  }

  if (isMask(a)) {
    const canvas = el("canvas", {
      class: "canvas",
      style:
        `margin-top:8px; display:block; margin-left:auto; margin-right:auto; ` +
        `max-width:100%; max-height:${maxHeightPx}px; width:auto; height:auto;`,
    }) as HTMLCanvasElement;
    drawMaskToCanvas(canvas, a.mask, a.width, a.height);
    return canvas;
  }

  if (!isSvg(a)) {
    return el(
      "div",
      { class: "muted", style: "margin-top:8px; font-size:12px;" },
      `Unsupported output: ${String((a as any).type)}`,
    );
  }

  const img = el("img", {
    class: "canvas",
    style:
      `margin-top:8px; display:block; margin-left:auto; margin-right:auto; ` +
      `max-width:100%; max-height:${maxHeightPx}px; width:auto; height:auto;`,
    "aria-label": "SVG preview",
  }) as HTMLImageElement;

  img.src = svgToDataUrl(a.svg);
  return img;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function downloadCanvasPng(filename: string, canvas: HTMLCanvasElement): Promise<void> {
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  if (!blob) throw new Error("Failed to create PNG blob.");
  downloadBlob(filename, blob);
}

function drawImageToCanvas(canvas: HTMLCanvasElement, img: ImageData): void {
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (!ctx) return;
  ctx.putImageData(img, 0, 0);
}

function drawMaskToCanvas(canvas: HTMLCanvasElement, mask: Uint8Array, width: number, height: number): void {
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (!ctx) return;

  let maxV = 0;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const v = mask[i] ?? 0;
    if (v > maxV) maxV = v;
  }

  const isBinary = maxV <= 1;
  const invertBinaryPreview = true;

  const img = ctx.createImageData(width, height);
  const d = img.data;

  for (let i = 0; i < n; i++) {
    const raw = mask[i] ?? 0;

    let v: number;
    if (isBinary) {
      const bit = raw > 0 ? 1 : 0;
      v = invertBinaryPreview ? (bit ? 0 : 255) : (bit ? 255 : 0);
    } else {
      v = raw;
    }

    const j = i * 4;
    d[j] = v;
    d[j + 1] = v;
    d[j + 2] = v;
    d[j + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
}

export function createPipelineView(args: {
  hostEl: HTMLElement;
  statusEl: HTMLElement;
  handlers: PipelineViewHandlers;
}): PipelineView {
  const { hostEl, statusEl, handlers } = args;

  let mounted = false;

  let root: HTMLDivElement | null = null;

  let selectPipeline: HTMLSelectElement | null = null;
  let selectRecipe: HTMLSelectElement | null = null;

  let btnRunAll: HTMLButtonElement | null = null;
  let btnNext: HTMLButtonElement | null = null;
  let btnReset: HTMLButtonElement | null = null;
  let btnDownload: HTMLButtonElement | null = null;

  let descEl: HTMLParagraphElement | null = null;

  let inputCanvas: HTMLCanvasElement | null = null;

  let currentCanvas: HTMLCanvasElement | null = null;
  let currentSvgImg: HTMLImageElement | null = null;

  let currentMetaEl: HTMLDivElement | null = null;

  let stagesHost: HTMLDivElement | null = null;

  let lastVm: any = null;

  function clearHost(): void {
    while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild);
  }

  async function downloadCurrentOutput(vm: any): Promise<void> {
    const pipelineId = typeof vm?.activePipelineId === "string" ? vm.activePipelineId : "pipeline";
    const safeId = pipelineId.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40) || "pipeline";

    // Prefer pdf if present 
    const outPdf = vm?.outputPdf?.bytes as Uint8Array | undefined;
    if (outPdf && outPdf.byteLength > 0) {
      const hint = typeof vm?.outputPdf?.filenameHint === "string" ? vm.outputPdf.filenameHint : "";
      const name = hint && hint.toLowerCase().endsWith(".pdf") ? hint : `beemage-${safeId}.pdf`;

      // Copy into a fresh ArrayBuffer-backed view to satisfy BlobPart typings
      const copy = new Uint8Array(outPdf.byteLength);
      copy.set(outPdf);

      const blob = new Blob([copy], { type: "application/pdf" });
      downloadBlob(name, blob);
      return;
    }

    // Prefer svg
    const outSvg = vm?.outputSvg?.svg as string | undefined;
    if (typeof outSvg === "string" && outSvg.length > 0) {
      const blob = new Blob([outSvg], { type: "image/svg+xml;charset=utf-8" });
      downloadBlob(`beemage-${safeId}.svg`, blob);
      return;
    }

    // Image
    const outImg = vm?.outputImage?.data as ImageData | undefined;
    if (outImg) {
      const c = document.createElement("canvas");
      drawImageToCanvas(c, outImg);
      await downloadCanvasPng(`beemage-${safeId}.png`, c);
      return;
    }

    // Mask
    const outMask = vm?.outputMask?.data as Uint8Array | undefined;
    const w = vm?.outputMask?.width as number | undefined;
    const h = vm?.outputMask?.height as number | undefined;
    if (outMask && typeof w === "number" && typeof h === "number") {
      const c = document.createElement("canvas");
      drawMaskToCanvas(c, outMask, w, h);
      await downloadCanvasPng(`beemage-${safeId}-mask.png`, c);
      return;
    }

    // Image list (MVP): download first image only
    const listCount = vm?.outputImageList?.count as number | undefined;
    const first = vm?.outputImageList?.first?.data as ImageData | undefined;
    if (typeof listCount === "number" && listCount > 0 && first) {
      const c = document.createElement("canvas");
      drawImageToCanvas(c, first);
      await downloadCanvasPng(`beemage-${safeId}-0.png`, c);
      return;
    }

    throw new Error("No output to download.");
  }

  function ensureMounted(): void {
    if (mounted) return;
    mounted = true;

    clearHost();

    root = el("div", { class: "card" });

    descEl = el(
      "p",
      { class: "muted", style: "margin-top:0;" },
      "Universal pipeline runner. Select a pipeline and run it.",
    );

    const controls = el("div", { class: "row", style: "align-items:center; gap:10px; flex-wrap:wrap;" });

    const lblPipeline = el("label", { class: "fieldInline" });
    lblPipeline.appendChild(el("span", {}, "Pipeline"));
    selectPipeline = el("select") as HTMLSelectElement;
    lblPipeline.appendChild(selectPipeline);

    const lblRecipe = el("label", { class: "fieldInline" });
    lblRecipe.appendChild(el("span", {}, "Recipe"));
    selectRecipe = el("select") as HTMLSelectElement;
    lblRecipe.appendChild(selectRecipe);

    btnRunAll = el("button", { type: "button" }, "Run all") as HTMLButtonElement;
    btnNext = el("button", { type: "button" }, "Next step") as HTMLButtonElement;
    btnReset = el("button", { type: "button" }, "Reset") as HTMLButtonElement;
    btnDownload = el("button", { type: "button" }, "Download") as HTMLButtonElement;

    controls.appendChild(lblPipeline);
    controls.appendChild(lblRecipe);
    controls.appendChild(btnRunAll);
    controls.appendChild(btnNext);
    controls.appendChild(btnReset);
    controls.appendChild(btnDownload);

    const grid = el("div", { class: "grid4", style: "margin-top:12px;" });

    const inputCard = el("div", { class: "card" });
    inputCard.appendChild(el("div", { class: "cardTitle" }, "Input (from source)"));
    inputCanvas = el("canvas", { class: "canvas", "aria-label": "Pipeline input preview" }) as HTMLCanvasElement;
    inputCard.appendChild(inputCanvas);

    const currentCard = el("div", { class: "card" });
    currentCard.appendChild(el("div", { class: "cardTitle" }, "Current output"));

    currentMetaEl = el("div", { class: "muted", style: "font-size:12px; margin-top:6px;" }) as HTMLDivElement;

    currentCanvas = el("canvas", { class: "canvas", "aria-label": "Pipeline current output preview" }) as HTMLCanvasElement;
    currentSvgImg = el("img", {
      class: "canvas",
      "aria-label": "Pipeline SVG output preview",
      style: "display:none;",
    }) as HTMLImageElement;

    currentCard.appendChild(currentMetaEl);
    currentCard.appendChild(currentCanvas);
    currentCard.appendChild(currentSvgImg);

    const stagesCard = el("div", { class: "card", style: "grid-column:1 / -1;" });
    stagesCard.appendChild(el("div", { class: "cardTitle" }, "Stages"));
    stagesHost = el("div");
    stagesCard.appendChild(stagesHost);

    grid.appendChild(inputCard);
    grid.appendChild(currentCard);
    grid.appendChild(stagesCard);

    root.appendChild(descEl);
    root.appendChild(controls);
    root.appendChild(grid);

    hostEl.appendChild(root);

    selectPipeline.addEventListener("change", () => {
      const id = selectPipeline ? selectPipeline.value : "segmentation";
      handlers.onSelectPipeline(id);
    });

    selectRecipe.addEventListener("change", () => {
      const id = selectRecipe ? selectRecipe.value : "default";
      handlers.onSelectRecipe(id);
    });

    btnRunAll.addEventListener("click", () => handlers.onRunAll());
    btnNext.addEventListener("click", () => handlers.onNext());
    btnReset.addEventListener("click", () => handlers.onReset());

    btnDownload.addEventListener("click", async () => {
      try {
        await downloadCurrentOutput(lastVm);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        statusEl.textContent = `Download failed: ${msg}`;
      }
    });
  }

  function renderSelects(vm: any): void {
    if (!selectPipeline || !selectRecipe) return;

    const pipelines = Array.isArray(vm?.pipelines) ? vm.pipelines : [];
    const recipes = Array.isArray(vm?.recipes) ? vm.recipes : [];

    const activePipelineId = typeof vm?.activePipelineId === "string" ? vm.activePipelineId : "segmentation";
    const activeRecipeId = typeof vm?.activeRecipeId === "string" ? vm.activeRecipeId : "default";

    selectPipeline.innerHTML = "";
    for (const p of pipelines) {
      const opt = el("option") as HTMLOptionElement;
      opt.value = p.id;
      opt.textContent = p.title;
      if (p.id === activePipelineId) opt.selected = true;
      selectPipeline.appendChild(opt);
    }

    selectRecipe.innerHTML = "";
    for (const r of recipes) {
      const opt = el("option") as HTMLOptionElement;
      opt.value = r.id;
      opt.textContent = r.title;
      if (r.id === activeRecipeId) opt.selected = true;
      selectRecipe.appendChild(opt);
    }
  }

  function drawInput(vm: any): void {
    if (!inputCanvas) return;

    // Prefer new inputArtifact
    const a = vm?.inputArtifact as Artifact | undefined;

    if (a && a.type === "image") {
      drawImageToCanvas(inputCanvas, (a as any).image);
      return;
    }

    if (a && a.type === "imageList") {
      const first = (a as any).items?.[0]?.image as ImageData | undefined;
      if (first) {
        drawImageToCanvas(inputCanvas, first);
        return;
      }
    }

    // Legacy path (image-only)
    const img = vm?.input?.data as ImageData | undefined;
    if (img) {
      drawImageToCanvas(inputCanvas, img);
      return;
    }

    inputCanvas.width = 1;
    inputCanvas.height = 1;
    const ctx = inputCanvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
  }

  function drawCurrent(vm: any): void {
    if (!currentCanvas || !currentSvgImg || !currentMetaEl) return;

    // reset meta
    currentMetaEl.textContent = "";

    // PDF output (no canvas preview)
    const outPdf = vm?.outputPdf?.bytes as Uint8Array | undefined;
    if (outPdf && outPdf.length) {
      currentCanvas.style.display = "none";
      currentSvgImg.style.display = "none";
      currentSvgImg.src = "";
      const kb = Math.max(1, Math.round(outPdf.length / 1024));
      currentMetaEl.textContent = `PDF output (${kb} KB)`;
      return;
    }

    // Image list output
    const listCount = vm?.outputImageList?.count as number | undefined;
    const first = vm?.outputImageList?.first?.data as ImageData | undefined;
    if (typeof listCount === "number" && listCount > 0) {
      currentMetaEl.textContent = `Image list (${listCount})`;
      if (first) {
        currentCanvas.style.display = "block";
        currentSvgImg.style.display = "none";
        currentSvgImg.src = "";
        drawImageToCanvas(currentCanvas, first);
        return;
      }
      currentCanvas.style.display = "none";
      currentSvgImg.style.display = "none";
      currentSvgImg.src = "";
      return;
    }

    // SVG takes precedence
    const outSvg = vm?.outputSvg?.svg as string | undefined;
    if (typeof outSvg === "string" && outSvg.length > 0) {
      currentCanvas.style.display = "none";
      currentSvgImg.style.display = "block";
      currentSvgImg.src = svgToDataUrl(outSvg);
      return;
    }

    // Otherwise image/mask
    currentCanvas.style.display = "block";
    currentSvgImg.style.display = "none";
    currentSvgImg.src = "";

    const outImg = vm?.outputImage?.data as ImageData | undefined;
    if (outImg) {
      drawImageToCanvas(currentCanvas, outImg);
      return;
    }

    const outMask = vm?.outputMask?.data as Uint8Array | undefined;
    const w = vm?.outputMask?.width as number | undefined;
    const h = vm?.outputMask?.height as number | undefined;

    if (outMask && typeof w === "number" && typeof h === "number") {
      drawMaskToCanvas(currentCanvas, outMask, w, h);
      return;
    }

    currentCanvas.width = 1;
    currentCanvas.height = 1;
    const ctx = currentCanvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
  }

  function renderStages(vm: any): void {
    if (!stagesHost) return;
    stagesHost.innerHTML = "";

    const stages = Array.isArray(vm?.stages) ? vm.stages : [];
    if (!stages.length) {
      stagesHost.appendChild(el("div", { class: "muted", style: "font-size:12px;" }, "No stages."));
      return;
    }

    const list = el("div", { style: "display:flex; flex-direction:column; gap:10px;" });

    for (const st of stages) {
      list.appendChild(renderStageVm(st));
    }

    stagesHost.appendChild(list);
  }

  function renderStageVm(st: any): HTMLElement {
    const row = el("div", { class: "card", style: "padding:10px;" });

    const head = el("div", { class: "row", style: "align-items:center; justify-content:space-between;" });
    head.appendChild(el("div", { style: "font-weight:bold;" }, String(st.title ?? st.stageId)));
    head.appendChild(el("div", { class: "status" }, String(st.state ?? "idle")));
    row.appendChild(head);

    row.appendChild(el("div", { class: "muted", style: "font-size:12px;" }, `${st.input} -> ${st.output}`));

    if (typeof st.error === "string" && st.error.length > 0) {
      row.appendChild(
        el("div", { style: "margin-top:6px; font-size:12px; white-space:pre-wrap;" }, `Stage error: ${st.error}`),
      );
    }

    const stageOut = st.outputArtifact as Artifact | undefined;
    if (stageOut) {
      row.appendChild(renderArtifactPreview(stageOut, 260));
    }

    const ops = Array.isArray(st.ops) ? st.ops : [];
    if (ops.length) {
      const opsWrap = el("div", { style: "margin-top:10px; display:flex; flex-direction:column; gap:8px;" });

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        const isLast = i === ops.length - 1;

        const opRow = el("div", { class: "card", style: "padding:8px;" });

        const opHead = el("div", {
          class: "row",
          style: "align-items:center; justify-content:space-between; gap:10px;",
        });

        const fakeSpec = {
          id: String(op.opId ?? ""),
          title: String(op.title ?? op.opId ?? "Operation"),
          io: { input: op.input, output: op.output },
          group: (op as any).group,
        } as any;

        const opCard = createOperationCard(fakeSpec, {
          compact: true,
          showGroup: true,
          showId: true,
          portStyle: "puzzle",
          cardStyle: "plain",
        });

        opHead.appendChild(opCard);
        opHead.appendChild(el("div", { class: "status" }, String(op.state ?? "idle")));

        opRow.appendChild(opHead);

        if (typeof op.error === "string" && op.error.length > 0) {
          opRow.appendChild(
            el("div", { style: "margin-top:6px; font-size:12px; white-space:pre-wrap;" }, `Op error: ${op.error}`),
          );
        }

        const opOut = stageOut && isLast ? undefined : (op.outputArtifact as Artifact | undefined);
        if (opOut) {
          opRow.appendChild(renderArtifactPreview(opOut, 200));
        }

        opsWrap.appendChild(opRow);
      }

      row.appendChild(opsWrap);
    }

    return row;
  }

  return {
    mount(): void {
      ensureMounted();
    },

    render(vm: any): void {
      ensureMounted();

      lastVm = vm;

      renderSelects(vm);

      statusEl.textContent = typeof vm?.statusText === "string" ? vm.statusText : "Idle";

      if (descEl) {
        const desc = typeof vm?.description === "string" ? vm.description : "Universal pipeline runner.";
        descEl.textContent = desc;
      }
      if (btnDownload) {
        const pdfBytes = vm?.outputPdf?.bytes as Uint8Array | undefined;
        const hasPdf = (pdfBytes?.byteLength ?? 0) > 0;

        const hasSvg = typeof vm?.outputSvg?.svg === "string" && vm.outputSvg.svg.length > 0;
        const hasImg = !!vm?.outputImage?.data;
        const hasMask = !!vm?.outputMask?.data;
        const hasList = typeof vm?.outputImageList?.count === "number" && vm.outputImageList.count > 0;

        btnDownload.disabled = !(hasPdf || hasSvg || hasImg || hasMask || hasList);
      }

      drawInput(vm);
      drawCurrent(vm);
      renderStages(vm);
    },

    dispose(): void {
      mounted = false;

      root = null;

      selectPipeline = null;
      selectRecipe = null;

      btnRunAll = null;
      btnNext = null;
      btnReset = null;
      btnDownload = null;

      descEl = null;

      inputCanvas = null;
      currentCanvas = null;
      currentSvgImg = null;
      currentMetaEl = null;

      stagesHost = null;

      lastVm = null;

      clearHost();
    },
  };
}