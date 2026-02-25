// src/panel/tabs/builder/pipelinePlayground.ts

import type { ArtifactType, OpSpec, PipelineDef } from "../../app/pipeline/type";
import { createOperationCard } from "../../app/pipeline/ui/operationCard";
import { canInsertBetween, typeAtIndex } from "../../app/pipeline/typing";
import * as debugTrace from "../../../shared/debugTrace";

type Draft = {
    id: string;
    title: string;
    description: string;
    implemented: boolean;
    opIds: string[];
};

export type PipelinePlayground = {
    render(args: { opsLibrary: ReadonlyArray<OpSpec> }): void;
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

function clear(node: HTMLElement) {
    while (node.firstChild) node.removeChild(node.firstChild);
}

function makeInstanceId(prefix: string, index0: number): string {
    return `${prefix}.${index0 + 1}`;
}

function buildOpIndex(ops: ReadonlyArray<OpSpec>): Map<string, OpSpec> {
    const m = new Map<string, OpSpec>();
    for (const op of ops) m.set(op.id, op);
    return m;
}

function resolveDraftSpecs(draft: Draft, opById: Map<string, OpSpec>): OpSpec[] {
    const out: OpSpec[] = [];
    for (const id of draft.opIds) {
        const s = opById.get(id);
        if (s) out.push(s);
    }
    return out;
}

function computeEndType(specs: ReadonlyArray<OpSpec>, startType: ArtifactType): ArtifactType {
    let cur: ArtifactType = startType;
    for (const s of specs) {
        if (s.io.input !== cur) return cur; // should not happen if we enforce inserts
        cur = s.io.output;
    }
    return cur;
}

 export function createPipelinePlayground(args: {
  mountEl: HTMLElement;
  onSavePipeline: (p: PipelineDef) => Promise<void> | void;
}): PipelinePlayground {
  const { mountEl, onSavePipeline } = args;

  let disposed = false;
  let opsLibrary: ReadonlyArray<OpSpec> = [];
  let opById = new Map<string, OpSpec>();

  let noticeKind: "info" | "error" = "info";
  let noticeText = "Drag an operation from the left and drop it into a slot.";
  let noticeEl: HTMLDivElement | null = null;

  function noticeStyle(kind: "info" | "error"): string {
    const base =
      "margin-top:10px; padding:8px 10px; border-radius:10px; font-size:12px; border:1px solid rgba(255,255,255,0.12);";
    if (kind === "error") return base + " background: rgba(255, 80, 80, 0.10);";
    if (kind === "info") return base + " background: rgba(255, 200, 80, 0.10);";
    return base + " background: rgba(80, 160, 255, 0.08);";
  }

  function setNotice(kind: "info" | "error", text: string): void {
    noticeKind = kind;
    noticeText = text;
    if (noticeEl) {
      noticeEl.setAttribute("style", noticeStyle(kind));
      noticeEl.textContent = text;
    }
  }

  function readDraggedOpId(dt: DataTransfer | null | undefined): string {
    if (!dt) return "";
    return dt.getData("application/x-beemage-opid") || dt.getData("text/plain") || "";
  }

  const draft: Draft & { startType: ArtifactType } = {
    id: "myPipeline",
    title: "My pipeline",
    description: "",
    implemented: true,
    opIds: [],
    startType: "image", // NEW
  };

  function insertOpAt(index: number, opId: string): void {
    draft.opIds.splice(index, 0, opId);
  }

  function removeAt(index: number): void {
    draft.opIds.splice(index, 1);
  }

  function move(index: number, dir: -1 | 1): void {
    const j = index + dir;
    if (j < 0 || j >= draft.opIds.length) return;
    const tmp = draft.opIds[index]!;
    draft.opIds[index] = draft.opIds[j]!;
    draft.opIds[j] = tmp;
  }

  function canDropAt(index: number, opId: string): { ok: boolean; reason?: string } {
    const spec = opById.get(opId);
    if (!spec) return { ok: false, reason: "Unknown op" };

    const specs = resolveDraftSpecs(draft, opById);

    const beforeType = typeAtIndex({ specs, startType: draft.startType, index });
    const afterType = index < specs.length ? specs[index]!.io.input : undefined;

    return canInsertBetween({ beforeType, afterType, op: spec });
  }

  function saveNow(): void {
    const id = draft.id.trim();
    const title = draft.title.trim();

    if (!id) {
      window.alert("Pipeline id is required.");
      return;
    }
    if (!title) {
      window.alert("Pipeline title is required.");
      return;
    }

    // Resolve specs; if some opIds are unknown (should not happen), refuse.
    const specs: OpSpec[] = [];
    for (const opId of draft.opIds) {
      const s = opById.get(opId);
      if (!s) {
        window.alert(`Unknown operation in draft: ${opId}`);
        return;
      }
      specs.push(s);
    }

    // Build PipelineDef (linear)
    const pipeline: PipelineDef = {
      id,
      title,
      description: draft.description || undefined,
      implemented: !!draft.implemented,
      ops: draft.opIds.map((opId, i) => ({
        instanceId: makeInstanceId(id, i),
        opId,
        enabled: true,
      })),
    };

    // Minimal safety: verify adjacency typing with selected startType.
    let cur: ArtifactType = draft.startType;
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i]!;
      if (s.io.input !== cur) {
        window.alert(`Invalid typing at step ${i + 1}: "${s.title}" needs ${s.io.input} but current is ${cur}`);
        return;
      }
      cur = s.io.output;
    }

    void onSavePipeline(pipeline);
  }

  function render(): void {
    if (disposed) return;

    clear(mountEl);

    const card = el("div", { class: "card", style: "padding:10px;" });
    card.appendChild(el("div", { class: "cardTitle" }, "Pipeline playground"));

    // Draft form
    const form = el("div", { class: "row", style: "gap:10px; flex-wrap:wrap; align-items:flex-end; margin-top:10px;" });

    const fldId = el("label", { class: "fieldInline" });
    fldId.appendChild(el("span", {}, "Id"));
    const inpId = el("input", { type: "text", value: draft.id, style: "min-width:200px;" }) as HTMLInputElement;
    inpId.addEventListener("input", () => {
      draft.id = inpId.value;
    });
    fldId.appendChild(inpId);

    const fldTitle = el("label", { class: "fieldInline" });
    fldTitle.appendChild(el("span", {}, "Title"));
    const inpTitle = el("input", { type: "text", value: draft.title, style: "min-width:240px;" }) as HTMLInputElement;
    inpTitle.addEventListener("input", () => {
      draft.title = inpTitle.value;
    });
    fldTitle.appendChild(inpTitle);

    const fldStart = el("label", { class: "fieldInline" });
    fldStart.appendChild(el("span", {}, "Start type"));
    const selStart = el("select") as HTMLSelectElement;

    const startChoices: ArtifactType[] = ["image", "imageList", "mask", "svg", "pdf"];
    for (const t of startChoices) {
      const opt = el("option") as HTMLOptionElement;
      opt.value = t;
      opt.textContent = t;
      if (t === draft.startType) opt.selected = true;
      selStart.appendChild(opt);
    }

    selStart.addEventListener("change", () => {
      const v = String(selStart.value) as ArtifactType;
      draft.startType = v;
      setNotice("info", `Start type set to "${v}".`);
      render();
    });

    fldStart.appendChild(selStart);

    const fldImpl = el("label", { class: "fieldInline" });
    fldImpl.appendChild(el("span", {}, "Implemented"));
    const chkImpl = el("input", { type: "checkbox" }) as HTMLInputElement;
    chkImpl.checked = !!draft.implemented;
    chkImpl.addEventListener("change", () => {
      draft.implemented = !!chkImpl.checked;
    });
    fldImpl.appendChild(chkImpl);

    const btnClear = el("button", { type: "button", class: "btn" }, "Clear") as HTMLButtonElement;
    btnClear.addEventListener("click", () => {
      draft.opIds = [];
      render();
    });

    const btnSave = el("button", { type: "button", class: "btn" }, "Save pipeline") as HTMLButtonElement;
    btnSave.addEventListener("click", saveNow);

    form.appendChild(fldId);
    form.appendChild(fldTitle);
    form.appendChild(fldStart);
    form.appendChild(fldImpl);
    form.appendChild(btnClear);
    form.appendChild(btnSave);

    card.appendChild(form);

    // Description
    const fldDesc = el("label", { style: "display:block; margin-top:10px;" });
    fldDesc.appendChild(el("div", { class: "muted", style: "font-size:12px; margin-bottom:4px;" }, "Description"));
    const ta = el("textarea", { style: "width:100%; min-height:54px;" }) as HTMLTextAreaElement;
    ta.value = draft.description;
    ta.addEventListener("input", () => {
      draft.description = ta.value;
    });
    fldDesc.appendChild(ta);
    card.appendChild(fldDesc);

    // Typing summary
    const specs = resolveDraftSpecs(draft, opById);
    const endType = computeEndType(specs, draft.startType);

    const summary = el(
      "div",
      { class: "muted", style: "font-size:12px; margin-top:10px;" },
      `Start: ${draft.startType}  →  Current output: ${endType}`,
    );
    card.appendChild(summary);

    noticeEl = el("div", { style: noticeStyle(noticeKind) }, noticeText) as HTMLDivElement;
    card.appendChild(noticeEl);

    // Canvas
    const canvas = el("div", { style: "margin-top:10px; display:flex; flex-direction:column; gap:8px;" });

    // Explicit start node
    canvas.appendChild(
      el(
        "div",
        {
          style:
            "border:1px dashed rgba(255,255,255,0.18); border-radius:10px; padding:8px; background:rgba(0,0,0,0.08);",
        },
        `Input (${draft.startType})`,
      ),
    );

    function makeDropSlot(index: number): HTMLDivElement {
      const slot = el("div", {
        "data-slot-index": String(index),
        style:
          "min-height:46px; display:flex; align-items:center; justify-content:center;" +
          " border:1px dashed rgba(255,255,255,0.14); border-radius:10px; padding:8px;" +
          " background:rgba(0,0,0,0.05); text-align:center; font-size:12px; cursor:copy;",
      }) as HTMLDivElement;

      const beforeType = typeAtIndex({ specs, startType: draft.startType, index });
      const afterType = index < specs.length ? specs[index]!.io.input : undefined;

      slot.textContent = afterType
        ? `Drop here (slot type: ${beforeType} → next needs: ${afterType})`
        : `Drop here (slot type: ${beforeType})`;

      slot.addEventListener("dragenter", (ev) => {
        ev.preventDefault();
        slot.style.background = "rgba(80, 160, 255, 0.08)";
      });

      slot.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";

        const opId = readDraggedOpId(ev.dataTransfer);
        if (!opId) return;

        const res = canDropAt(index, opId);
        slot.style.background = res.ok ? "rgba(80, 255, 140, 0.08)" : "rgba(255, 80, 80, 0.06)";
      });

      slot.addEventListener("dragleave", () => {
        slot.style.background = "rgba(0,0,0,0.05)";
      });

      slot.addEventListener("drop", (ev) => {
        ev.preventDefault();
        slot.style.background = "rgba(0,0,0,0.05)";

        const opId = readDraggedOpId(ev.dataTransfer);

        if (!opId) {
          setNotice("error", "Drop refused: could not read operation id from the drag payload.");
          debugTrace.append({
            scope: "panel",
            kind: "error",
            message: "Builder playground drop refused (missing opId)",
            meta: { index },
          });
          return;
        }

        const res = canDropAt(index, opId);
        if (!res.ok) {
          setNotice("info", `Drop refused: ${res.reason ?? "operation cannot be inserted here."}`);
          debugTrace.append({
            scope: "panel",
            kind: "info",
            message: "Builder playground drop refused (typing mismatch)",
            meta: { index, opId, reason: res.reason ?? "" },
          });
          return;
        }

        insertOpAt(index, opId);
        setNotice("info", `Inserted "${opId}" at position ${index + 1}.`);
        debugTrace.append({
          scope: "panel",
          kind: "info",
          message: "Builder playground op inserted",
          meta: { index, opId },
        });

        render();
      });

      return slot;
    }

    // Slots + steps
    for (let i = 0; i <= draft.opIds.length; i++) {
      canvas.appendChild(makeDropSlot(i));

      if (i < draft.opIds.length) {
        const opId = draft.opIds[i]!;
        const spec = opById.get(opId);

        const row = el("div", { class: "row", style: "gap:8px; align-items:flex-start;" });

        const left = el("div", { style: "flex:1;" });
        if (spec) {
          left.appendChild(
            createOperationCard(spec, {
              compact: true,
              showGroup: true,
              showId: true,
              portStyle: "puzzle",
              cardStyle: "puzzleFrame",
            }),
          );
        } else {
          left.appendChild(el("div", { class: "muted" }, `Unknown op: ${opId}`));
        }

        const right = el("div", { style: "display:flex; flex-direction:column; gap:6px;" });

        const btnUp = el("button", { type: "button", class: "btn" }, "Up") as HTMLButtonElement;
        btnUp.disabled = i === 0;
        btnUp.addEventListener("click", () => {
          move(i, -1);
          render();
        });

        const btnDown = el("button", { type: "button", class: "btn" }, "Down") as HTMLButtonElement;
        btnDown.disabled = i === draft.opIds.length - 1;
        btnDown.addEventListener("click", () => {
          move(i, 1);
          render();
        });

        const btnRemove = el("button", { type: "button", class: "btn" }, "Remove") as HTMLButtonElement;
        btnRemove.addEventListener("click", () => {
          removeAt(i);
          render();
        });

        right.appendChild(btnUp);
        right.appendChild(btnDown);
        right.appendChild(btnRemove);

        row.appendChild(left);
        row.appendChild(right);

        canvas.appendChild(row);
      }
    }

    card.appendChild(canvas);
    mountEl.appendChild(card);
  }

  return {
    render(args2: { opsLibrary: ReadonlyArray<OpSpec> }) {
      opsLibrary = args2.opsLibrary ?? [];
      opById = buildOpIndex(opsLibrary);
      render();
    },
    dispose() {
      disposed = true;
      clear(mountEl);
    },
  };
}
