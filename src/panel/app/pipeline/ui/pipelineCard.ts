// src/panel/app/pipeline/ui/pipelineCard.ts

import type { OpSpec, PipelineDef, PipelineOpInstance } from "../type";
import { createOperationCard } from "./operationCard";

export type PipelineCardOptions = {
  showId?: boolean;
  showDescription?: boolean;
  showImplementationFlag?: boolean;

  /**
   * If true, render a thin connector line between operations.
   */
  showConnectors?: boolean;

  /**
   * If true, render disabled ops too (visually muted).
   */
  showDisabledOps?: boolean;

  /**
   * Compact cards for dense lists.
   */
  compactOps?: boolean;
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

function isEnabled(inst: PipelineOpInstance): boolean {
  return inst.enabled !== false;
}

function buildOpIndex(ops: ReadonlyArray<OpSpec>): Map<string, OpSpec> {
  const m = new Map<string, OpSpec>();
  for (const op of ops) m.set(op.id, op);
  return m;
}

export function createPipelineCard(
  pipeline: PipelineDef,
  allOps: ReadonlyArray<OpSpec>,
  opts?: PipelineCardOptions,
): HTMLElement {
  const options: Required<PipelineCardOptions> = {
    showId: opts?.showId ?? true,
    showDescription: opts?.showDescription ?? true,
    showImplementationFlag: opts?.showImplementationFlag ?? true,
    showConnectors: opts?.showConnectors ?? true,
    showDisabledOps: opts?.showDisabledOps ?? false,
    compactOps: opts?.compactOps ?? true,
  };

  const opById = buildOpIndex(allOps);

  const root = el("div", { class: "pipelineCard" });

  // Header
  const head = el("div", { class: "pipelineCardHead" });

  const titleWrap = el("div", { style: "display:flex; flex-direction:column; gap:2px;" });
  titleWrap.appendChild(el("div", { class: "pipelineCardTitle" }, pipeline.title || pipeline.id));

  if (options.showId) {
    titleWrap.appendChild(el("div", { class: "muted", style: "font-size:12px;" }, pipeline.id));
  }

  head.appendChild(titleWrap);

  if (options.showImplementationFlag) {
    const impl = pipeline.implemented ? "implemented" : "not implemented";
    head.appendChild(el("div", { class: "status" }, impl));
  }

  root.appendChild(head);

  if (options.showDescription && typeof pipeline.description === "string" && pipeline.description.length > 0) {
    root.appendChild(el("div", { class: "muted", style: "font-size:12px; margin-top:6px;" }, pipeline.description));
  }

  // Ops
  const opsWrap = el("div", { class: "pipelineOps", style: "margin-top:10px;" });

  const instances = Array.isArray(pipeline.ops) ? pipeline.ops : [];
  const shown = options.showDisabledOps ? instances : instances.filter((x) => isEnabled(x));

  if (!shown.length) {
    opsWrap.appendChild(el("div", { class: "muted", style: "font-size:12px;" }, "No operations in this pipeline."));
    root.appendChild(opsWrap);
    return root;
  }

  for (let i = 0; i < shown.length; i++) {
    const inst = shown[i]!;
    const spec = opById.get(inst.opId);

    const isDisabled = !isEnabled(inst);
    const card = spec
      ? createOperationCard(spec, {
          compact: options.compactOps,
          showGroup: true,
          showId: true,
        })
      : el(
          "div",
          { class: "opCard opCard--unknown", style: "padding:10px;" },
          `Unknown operation: ${inst.opId}`,
        );

    if (isDisabled) card.classList.add("is-disabled");

    opsWrap.appendChild(card);

    if (options.showConnectors && i < shown.length - 1) {
      opsWrap.appendChild(el("div", { class: "pipelineConnector", "aria-hidden": "true" }));
    }
  }

  root.appendChild(opsWrap);
  return root;
}
