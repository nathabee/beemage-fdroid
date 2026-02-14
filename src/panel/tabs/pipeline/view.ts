// src/panel/tabs/pipeline/view.ts 
import type { Artifact, ImageArtifact, MaskArtifact, SvgArtifact } from "../../app/pipeline/type";
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

function svgToDataUrl(svg: string): string {
  // Works well for MVP. For huge SVGs you may switch to Blob URLs.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderArtifactPreview(a: Artifact, maxHeightPx: number): HTMLElement {
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
    // Defensive: if you add more Artifact types later, don’t silently mis-render.
    return el("div", { class: "muted", style: "margin-top:8px; font-size:12px;" }, `Unsupported output: ${String((a as any).type)}`);
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
  // Revoke a bit later to avoid race with navigation
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

  // First pass: detect whether this is binary and how dense it is.
  let maxV = 0;
  let onCount = 0;
  const n = width * height;

  for (let i = 0; i < n; i++) {
    const v = mask[i] ?? 0;
    if (v > maxV) maxV = v;
    if (v > 0) onCount++;
  }

  const isBinary = maxV <= 1;

  // For preview: binary masks are easiest to read as "black foreground on white background".
  // If mask is 0/1: show 1 as black, 0 as white.
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
      // Already 0..255 — keep as is.
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

  // Current output can be either:
  // - canvas (image/mask)
  // - img (svg)
  let currentCanvas: HTMLCanvasElement | null = null;
  let currentSvgImg: HTMLImageElement | null = null;

  let stagesHost: HTMLDivElement | null = null;

  // Keep the last rendered vm so download can access the current output.
  let lastVm: any = null;

  function clearHost(): void {
    while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild);
  }

  async function downloadCurrentOutput(vm: any): Promise<void> {
    const pipelineId = typeof vm?.activePipelineId === "string" ? vm.activePipelineId : "pipeline";
    const safeId = pipelineId.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40) || "pipeline";

    // Prefer svg if present, else image, else mask.
    const outSvg = vm?.outputSvg?.svg as string | undefined;
    if (typeof outSvg === "string" && outSvg.length > 0) {
      const blob = new Blob([outSvg], { type: "image/svg+xml;charset=utf-8" });
      downloadBlob(`beemage-${safeId}.svg`, blob);
      return;
    }

    const outImg = vm?.outputImage?.data as ImageData | undefined;
    if (outImg) {
      const c = document.createElement("canvas");
      drawImageToCanvas(c, outImg);
      await downloadCanvasPng(`beemage-${safeId}.png`, c);
      return;
    }

    const outMask = vm?.outputMask?.data as Uint8Array | undefined;
    const w = vm?.outputMask?.width as number | undefined;
    const h = vm?.outputMask?.height as number | undefined;
    if (outMask && typeof w === "number" && typeof h === "number") {
      const c = document.createElement("canvas");
      drawMaskToCanvas(c, outMask, w, h);
      await downloadCanvasPng(`beemage-${safeId}-mask.png`, c);
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

    currentCanvas = el("canvas", { class: "canvas", "aria-label": "Pipeline current output preview" }) as HTMLCanvasElement;
    currentSvgImg = el("img", {
      class: "canvas",
      "aria-label": "Pipeline SVG output preview",
      style: "display:none;",
    }) as HTMLImageElement;

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
        // Keep it simple: surface as status text.
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
    const img = vm?.input?.data as ImageData | undefined;
    if (!img) {
      inputCanvas.width = 1;
      inputCanvas.height = 1;
      const ctx = inputCanvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
      return;
    }
    drawImageToCanvas(inputCanvas, img);
  }

  function drawCurrent(vm: any): void {
    if (!currentCanvas || !currentSvgImg) return;

    // SVG takes precedence if present.
    const outSvg = vm?.outputSvg?.svg as string | undefined;
    if (typeof outSvg === "string" && outSvg.length > 0) {
      currentCanvas.style.display = "none";
      currentSvgImg.style.display = "block";
      currentSvgImg.src = svgToDataUrl(outSvg);
      return;
    }

    // Otherwise fallback to image/mask.
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

        const opHead = el("div", { class: "row", style: "align-items:center; justify-content:space-between; gap:10px;" });

        // Left: shared operation card
        const fakeSpec = {
          id: String(op.opId ?? ""),
          title: String(op.title ?? op.opId ?? "Operation"),
          io: { input: op.input, output: op.output },
          // optional metadata for badge display
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

        // Right: run status
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

      // Download enabled only if something exists
      if (btnDownload) {
        const hasSvg = typeof vm?.outputSvg?.svg === "string" && vm.outputSvg.svg.length > 0;
        const hasImg = !!vm?.outputImage?.data;
        const hasMask = !!vm?.outputMask?.data;
        btnDownload.disabled = !(hasSvg || hasImg || hasMask);
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

      stagesHost = null;

      lastVm = null;

      clearHost();
    },
  };
}

