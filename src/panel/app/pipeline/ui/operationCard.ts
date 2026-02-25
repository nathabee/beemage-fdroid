// src/panel/app/pipeline/ui/operationCard.ts

import type { OpSpec } from "../type";
import type { OperationUi, OperationPort, PortType } from "./type";

export type PortStyle = "chip" | "puzzle";

export type CardStyle = "plain" | "puzzleFrame";

type ConnectorShape = "triangle" | "circle" | "rect";
 


export type OperationCardOptions = {
  compact?: boolean;
  showId?: boolean;
  showGroup?: boolean;

  /**
   * How to render ports:
   * - "chip": the current text chips (default)
   * - "puzzle": render a small SVG connector glyph (male/female by kind, shape by type)
   */
  portStyle?: PortStyle;

  /**
   * How to render the *card frame*:
   * - "plain": normal rounded rect (default)
   * - "puzzleFrame": the whole card is a puzzle piece silhouette (top socket = input type, bottom plug = output type)
   */
  cardStyle?: CardStyle;

  /**
   * Map a port type to a CSS modifier class (without leading dot).
   * Default mapping is opPort--image / --mask / --svg / --unknown.
   */
  getPortClass?: (type: PortType) => string;

  onClick?: (opId: string) => void;
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

function normalizeOpToUi(op: OpSpec): OperationUi {
  // Today: single input/output in op.io. Tomorrow: extend here.
  const inputs: OperationPort[] = [{ kind: "input", type: op.io.input }];
  const outputs: OperationPort[] = [{ kind: "output", type: op.io.output }];

  return {
    id: op.id,
    title: op.title,
    group: (op as any).group,
    inputs,
    outputs,
  };
}

function defaultPortClass(type: PortType): string {
  const t = String(type || "").toLowerCase();
  if (t === "image") return "opPort--image";
  if (t === "mask") return "opPort--mask";
  if (t === "svg") return "opPort--svg";
  if (t === "imagelist") return "opPort--imageList";
  if (t === "pdf") return "opPort--pdf";
  return "opPort--unknown";
}

/**
 * Puzzle glyph rendering
 *
 * We keep it intentionally simple: one SVG per port with:
 * - shape family by type: image/mask/svg/unknown
 * - male/female by kind: output=input plug, input=female socket
 *
 * The CSS class (opPort--image/--mask/--svg/--unknown) can color it.
 */
function createPortPuzzleGlyph(args: {
  kind: "input" | "output";
  type: PortType;
}): SVGSVGElement {
  const { kind, type } = args;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 48 20");
  svg.setAttribute("width", "48");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("opPort__glyph");

  const t = String(type || "").toLowerCase();
  const isMale = kind === "output";

  // Base track: a rounded pill background so ports look consistent
  const track = document.createElementNS(ns, "rect");
  track.setAttribute("x", "1");
  track.setAttribute("y", "3");
  track.setAttribute("width", "46");
  track.setAttribute("height", "14");
  track.setAttribute("rx", "7");
  track.setAttribute("ry", "7");
  track.classList.add("opPort__glyphTrack");
  svg.appendChild(track);

  // Connector shape: drawn around the center line.
  // We render it as a path; CSS can set fill/stroke via classes.
  const path = document.createElementNS(ns, "path");
  path.classList.add("opPort__glyphShape");

  // Helper: clamp to avoid weird shapes
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  // Geometry knobs (tweak in CSS/JS later if needed)
  const cx = 24;
  const cy = 10;
  const depth = isMale ? 7 : 7; // how far plug protrudes or socket indents
  const w = t === "mask" ? 12 : t === "svg" ? 14 : t === "image" ? 14 : 12;

  const halfW = clamp(w / 2, 4, 10);

  if (t === "image") {
    // Triangle family
    // Male: triangle protruding to the right
    // Female: triangle notch cut inward (rendered as an outline shape)
    if (isMale) {
      // triangle plug
      // Start at left of triangle base, draw to tip, back to base
      const x0 = cx - halfW;
      const xTip = cx + halfW + depth;
      const yTop = cy - 6;
      const yBot = cy + 6;
      path.setAttribute("d", `M ${x0} ${yTop} L ${xTip} ${cy} L ${x0} ${yBot} Z`);
    } else {
      // triangle socket (draw a "cut" shape; visually it should look like an indentation)
      // We draw a triangle pointing left to suggest socket
      const x0 = cx + halfW;
      const xTip = cx - halfW - depth;
      const yTop = cy - 6;
      const yBot = cy + 6;
      path.setAttribute("d", `M ${x0} ${yTop} L ${xTip} ${cy} L ${x0} ${yBot} Z`);
      path.classList.add("opPort__glyphShape--socket");
    }
  } else if (t === "svg") {
    // Round family
    if (isMale) {
      // circle-ish plug (use a capsule)
      const x = cx - halfW;
      const plugW = halfW * 2 + depth;
      path.setAttribute(
        "d",
        [
          `M ${x} ${cy - 6}`,
          `h ${plugW}`,
          `a 6 6 0 0 1 0 12`,
          `h ${-plugW}`,
          `a 6 6 0 0 1 0 -12`,
          "Z",
        ].join(" "),
      );
    } else {
      // socket capsule reversed
      const x = cx + halfW;
      const plugW = halfW * 2 + depth;
      path.setAttribute(
        "d",
        [
          `M ${x} ${cy - 6}`,
          `h ${-plugW}`,
          `a 6 6 0 0 0 0 12`,
          `h ${plugW}`,
          `a 6 6 0 0 0 0 -12`,
          "Z",
        ].join(" "),
      );
      path.classList.add("opPort__glyphShape--socket");
    }
  } else {
    // mask + unknown -> rectangle family
    if (isMale) {
      const x = cx - halfW;
      const plugW = halfW * 2 + depth;
      path.setAttribute("d", `M ${x} ${cy - 6} h ${plugW} v 12 h ${-plugW} Z`);
    } else {
      const x = cx + halfW;
      const plugW = halfW * 2 + depth;
      path.setAttribute("d", `M ${x} ${cy - 6} h ${-plugW} v 12 h ${plugW} Z`);
      path.classList.add("opPort__glyphShape--socket");
    }
  }

  svg.appendChild(path);
  return svg;
}

function renderPortChip(args: {
  port: OperationPort;
  getPortClass: (type: PortType) => string;
}): HTMLElement {
  const { port, getPortClass } = args;

  const cls = `opPort ${getPortClass(port.type)}`;
  const text = port.label ? `${port.label}: ${port.type}` : String(port.type);

  return el(
    "div",
    {
      class: cls,
      "data-port-kind": port.kind,
      "data-port-type": String(port.type),
    },
    text,
  );
}

function renderPortPuzzle(args: {
  port: OperationPort;
  getPortClass: (type: PortType) => string;
}): HTMLElement {
  const { port, getPortClass } = args;

  // Container: still gets the opPort class so you can color by type.
  const cls = `opPort opPort--puzzle ${getPortClass(port.type)}`;

  const root = el("div", {
    class: cls,
    "data-port-kind": port.kind,
    "data-port-type": String(port.type),
  });

  // Left: small label (optional)
  const labelText = port.label ? port.label : String(port.type);
  root.appendChild(el("div", { class: "opPort__puzzleLabel" }, labelText));

  // Right: glyph
  const glyph = createPortPuzzleGlyph({ kind: port.kind, type: port.type });
  root.appendChild(glyph);

  return root;
}

function renderPortsRow(args: {
  ports: OperationPort[];
  kind: "input" | "output";
  portStyle: PortStyle;
  getPortClass: (type: PortType) => string;
}): HTMLElement {
  const { ports, kind, portStyle, getPortClass } = args;

  const row = el("div", { class: "opCard__portsRow" });

  const label = el("div", { class: "opCard__portsLabel" }, kind === "input" ? "IN" : "OUT");
  row.appendChild(label);

  const portsWrap = el("div", { class: "opCard__ports" });

  for (const p of ports) {
    const portEl =
      portStyle === "puzzle"
        ? renderPortPuzzle({ port: p, getPortClass })
        : renderPortChip({ port: p, getPortClass });

    portsWrap.appendChild(portEl);
  }

  row.appendChild(portsWrap);
  return row;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

 
 

function typeFamily(type: PortType): "image" | "mask" | "svg" | "rect" | "unknown" {
  const t = String(type || "").toLowerCase();
  if (t === "image") return "image";
  if (t === "mask") return "mask";
  if (t === "svg") return "svg";
  if (t === "imagelist") return "image"; // image-like connector
  if (t === "pdf") return "rect"; // document-like connector
  return "unknown";
}
 

function connectorDims(fam: "image" | "mask" | "svg" | "rect" | "unknown"): { w: number; d: number; shape: ConnectorShape } {
  if (fam === "image") return { w: 34, d: 7, shape: "circle" };
  if (fam === "svg") return { w: 30, d: 7, shape: "triangle" };
  if (fam === "mask") return { w: 28, d: 6, shape: "rect" };
  if (fam === "rect") return { w: 30, d: 6, shape: "rect" }; // pdf
  return { w: 26, d: 6, shape: "rect" };
}
 

function svgToDataUrl(svg: string): string {
  // Encode minimal safely for data URL usage
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return `url("data:image/svg+xml,${encoded}")`;
}

 

function applyPuzzleMaskFrame(args: {
  root: HTMLElement;
  inType: PortType;
  outType: PortType;
}): void {
  const { root, inType, outType } = args;

  const inFam = typeFamily(inType);
  const outFam = typeFamily(outType);

  const inC = connectorDims(inFam);
  const outC = connectorDims(outFam);

  const d = buildPuzzlePathD({ inType, outType });

  // 1) Mask (scales with the element)
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110" preserveAspectRatio="none">
    <path d="${d}" fill="white"/>
  </svg>`;

  const maskUrl = svgToDataUrl(maskSvg);

  // Chrome often needs webkitMask*
  (root.style as any).webkitMaskImage = maskUrl;
  (root.style as any).webkitMaskRepeat = "no-repeat";
  (root.style as any).webkitMaskSize = "100% 100%";
  (root.style as any).webkitMaskPosition = "center";

  root.style.maskImage = maskUrl;
  root.style.maskRepeat = "no-repeat";
  root.style.maskSize = "100% 100%";
  root.style.maskPosition = "center";

  // 2) Frame base
  root.classList.add("opCard--puzzleFrame");
  root.style.position = "relative";
  root.style.border = "none";
  root.style.overflow = "visible";

  // IMPORTANT: allow flex layouts to shrink this card instead of clipping content
  root.style.minWidth = "0";

  // 3) Insert/update outline SVG
  let outline = root.querySelector(":scope > svg.opCard__puzzleOutline") as SVGSVGElement | null;
  if (!outline) {
    outline = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    outline.classList.add("opCard__puzzleOutline");
    outline.setAttribute("viewBox", "0 0 100 110");
    outline.setAttribute("preserveAspectRatio", "none");
    outline.innerHTML = `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>`;
    root.insertBefore(outline, root.firstChild);
  } else {
    const path = outline.querySelector("path");
    if (path) path.setAttribute("d", d);
  }

  // 4) Insets (border gap / "rand")
  const isCompact = root.classList.contains("opCard--compact");

  const insetX = isCompact ? 22 : 26;
  const insetTopBase = isCompact ? 16 : 18;
  const insetBottomBase = isCompact ? 16 : 18;

  const insetTop = insetTopBase + Math.round(inC.d * 0.9);
  const insetBottom = insetBottomBase + Math.round(outC.d * 0.9);

  root.style.setProperty("--opPuzzleInsetX", `${insetX}px`);
  root.style.setProperty("--opPuzzleInsetTop", `${insetTop}px`);
  root.style.setProperty("--opPuzzleInsetBottom", `${insetBottom}px`);
}


/**
 * Builds a normalized puzzle-piece path in a 100x100 viewBox.
 * - Top edge: socket (concave) encodes input type
 * - Bottom edge: plug (convex) encodes output type
 *
 * NOTE: This produces a single closed silhouette suitable for masking.
 */

function buildPuzzlePathD(args: { inType: PortType; outType: PortType }): string {
  const xL = 6;
  const xR = 94;

  // ViewBox is 0..100 in X and 0..110 in Y
  const VB_H = 110;

  // Top edge at yT.
  const yT = 0;

  // BODY bottom edge (corners sit on this line)
  // Move this DOWN so the plug lives in the bottom "margin zone".
  const yB = 100;

  const r = 10;

  const inFam = typeFamily(args.inType);
  const outFam = typeFamily(args.outType);

  const inC = connectorDims(inFam);
  const outC = connectorDims(outFam);

  const cx = 50;

  const socketW = clamp(inC.w, 18, 40);
  const socketD = clamp(inC.d, 6, 12);

  const plugW = clamp(outC.w, 18, 40);

  // Make sure the plug never exceeds the viewBox height.
  // Leave a small safety gap so stroke/AA never clips.
  const maxPlugD = Math.max(6, Math.min(12, VB_H - yB - 2));
  const plugD = clamp(outC.d, 6, maxPlugD);

  const socketStart = clamp(cx - socketW / 2, xL + r + 4, xR - r - 4);
  const socketEnd = clamp(cx + socketW / 2, xL + r + 4, xR - r - 4);

  const plugStart = clamp(cx - plugW / 2, xL + r + 4, xR - r - 4);
  const plugEnd = clamp(cx + plugW / 2, xL + r + 4, xR - r - 4);

  function socketSegD(): string {
    if (inC.shape === "triangle") {
      return `L ${cx} ${yT + socketD} L ${socketEnd} ${yT}`;
    }

    if (inC.shape === "circle") {
      const x0 = socketStart;
      const x1 = socketEnd;
      const w = x1 - x0;
      const d = socketD;
      const c = Math.max(6, w * 0.25);
      const mid = x0 + w / 2;

      return [
        `C ${x0 + c} ${yT} ${x0 + c} ${yT + d} ${mid} ${yT + d}`,
        `C ${x1 - c} ${yT + d} ${x1 - c} ${yT} ${x1} ${yT}`,
      ].join(" ");
    }

    // rect
    return `V ${yT + socketD} H ${socketEnd} V ${yT}`;
  }

  function plugSegD(): string {
    if (outC.shape === "triangle") {
      return `L ${cx} ${yB + plugD} L ${plugStart} ${yB}`;
    }

    if (outC.shape === "circle") {
      const x0 = plugEnd;
      const x1 = plugStart;
      const w = x0 - x1;
      const d = plugD;
      const c = Math.max(6, w * 0.25);
      const mid = x1 + w / 2;

      return [
        `C ${x0 - c} ${yB} ${x0 - c} ${yB + d} ${mid} ${yB + d}`,
        `C ${x1 + c} ${yB + d} ${x1 + c} ${yB} ${x1} ${yB}`,
      ].join(" ");
    }

    // rect
    return `V ${yB + plugD} H ${plugStart} V ${yB}`;
  }

  return [
    `M ${xL + r} ${yT}`,
    `H ${socketStart}`,
    socketSegD(),
    `H ${xR - r}`,
    `A ${r} ${r} 0 0 1 ${xR} ${yT + r}`,
    `V ${yB - r}`,
    `A ${r} ${r} 0 0 1 ${xR - r} ${yB}`,
    `H ${plugEnd}`,
    plugSegD(),
    `H ${xL + r}`,
    `A ${r} ${r} 0 0 1 ${xL} ${yB - r}`,
    `V ${yT + r}`,
    `A ${r} ${r} 0 0 1 ${xL + r} ${yT}`,
    "Z",
  ].join(" ");
}






/**
 * Shared UI component:
 * - Used in Builder (list of operations)
 * - Used in Pipeline (display of steps)
 * - Multi-port ready via OperationUi normalization
 */

export function createOperationCard(op: OpSpec, opts?: OperationCardOptions): HTMLElement {
  const ui = normalizeOpToUi(op);

  const options: {
    compact: boolean;
    showId: boolean;
    showGroup: boolean;
    portStyle: PortStyle;
    cardStyle: CardStyle;
    getPortClass: (type: PortType) => string;
    onClick?: (opId: string) => void;
  } = {
    compact: !!opts?.compact,
    showId: opts?.showId ?? true,
    showGroup: opts?.showGroup ?? true,
    portStyle: opts?.portStyle ?? "chip",
    cardStyle: opts?.cardStyle ?? "plain",
    getPortClass: opts?.getPortClass ?? defaultPortClass,
    onClick: opts?.onClick,
  };

  const root = el("div", {
    class: `opCard${options.compact ? " opCard--compact" : ""}`,
    "data-op-id": ui.id,
  });

  const content = el("div", { class: "opCard__content" });

  const head = el("div", { class: "opCard__head" });

  const title = el("div", { class: "opCard__title" }, ui.title);
  head.appendChild(title);

  const meta = el("div", { class: "opCard__meta" });

  if (options.showGroup && ui.group) {
    meta.appendChild(el("span", { class: "opBadge opBadge--group" }, ui.group));
  }

  if (options.showId) {
    meta.appendChild(el("span", { class: "opBadge opBadge--id" }, ui.id));
  }

  head.appendChild(meta);
  content.appendChild(head);

  const body = el("div", { class: "opCard__body" });

  body.appendChild(
    renderPortsRow({
      ports: ui.inputs,
      kind: "input",
      portStyle: options.portStyle,
      getPortClass: options.getPortClass,
    }),
  );

  body.appendChild(
    renderPortsRow({
      ports: ui.outputs,
      kind: "output",
      portStyle: options.portStyle,
      getPortClass: options.getPortClass,
    }),
  );

  content.appendChild(body);
  root.appendChild(content);

  if (options.cardStyle === "puzzleFrame") {
    applyPuzzleMaskFrame({
      root,
      inType: op.io.input,
      outType: op.io.output,
    });
  }

  if (options.onClick) {
    root.classList.add("opCard--clickable");
    root.addEventListener("click", (ev) => {
      ev.preventDefault?.();
      options.onClick?.(ui.id);
    });
  }

  return root;
}


