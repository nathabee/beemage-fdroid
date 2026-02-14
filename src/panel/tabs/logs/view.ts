// src/panel/tabs/logs/view.ts
import type { Dom } from "../../app/dom";
import type { ActionLogEntry } from "../../../shared/actionLog";
import type { DebugTraceEntry } from "../../../shared/debugTrace";

function fmtTs(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function renderInto(pre: HTMLPreElement, args: { total: number; items: Array<{ ts: number; message: string; scope?: string; kind?: string; ok?: boolean; status?: number; error?: string; meta?: any }> }) {
  const lines: string[] = [];
  lines.push(`Total entries: ${args.total}`);
  lines.push("");

  for (const e of args.items) {
    const ok = typeof e.ok === "boolean" ? (e.ok ? "ok" : "fail") : "";
    const metaBits: string[] = [];
    if (typeof e.status === "number") metaBits.push(`status=${e.status}`);
    if (ok) metaBits.push(ok);

    const head = [e.scope, e.kind].filter(Boolean).join("/");
    lines.push(`[${fmtTs(e.ts)}] ${head}${metaBits.length ? ` (${metaBits.join(", ")})` : ""}`);
    lines.push(`  ${e.message}`);
    if (e.error) lines.push(`  error: ${e.error}`);
    lines.push("");
  }

  pre.textContent = lines.join("\n");
  pre.scrollTop = 0;
}

export function createLogsView(dom: Dom) {
  function setAuditStatus(s: string) {
    dom.logsStatusEl.textContent = s;
  }

  function setDebugStatus(s: string) {
    dom.debugStatusEl.textContent = s;
  }

  function setDebugChecked(on: boolean) {
    dom.logsCbDebugEl.checked = on;
  }

  function renderAudit(args: { items: ActionLogEntry[]; total: number }) {
    renderInto(dom.logsOutEl, {
      total: args.total,
      items: args.items.map((x) => ({
        ts: x.ts,
        message: x.message,
        scope: x.scope,
        kind: x.kind,
        ok: x.ok,
        status: x.status,
        error: x.error,
        meta: x.meta,
      })),
    });
  }

  function renderDebug(args: { items: DebugTraceEntry[]; total: number }) {
    renderInto(dom.debugOutEl, {
      total: args.total,
      items: args.items.map((x) => ({
        ts: x.ts,
        message: x.message,
        scope: x.scope,
        kind: x.kind,
        ok: x.ok,
        status: x.status,
        error: x.error,
        meta: x.meta,
      })),
    });
  }

  return { setAuditStatus, setDebugStatus, setDebugChecked, renderAudit, renderDebug };
}
