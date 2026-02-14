// src/shared/debugTrace.ts

import { storageGet, storageSet, storageRemove } from "./platform/storage";

export type DebugTraceScope =
  | "background"
  | "panel"
  | "image"
  | "colors"
  | "settings"
  | "builder"
  | "pipeline"
  | "logs"
  | "demo"
  | "ui"
  | "api";

export type DebugTraceKind = "debug" | "info" | "error";

export type DebugTraceEntry = {
  id: string; // unique
  ts: number; // Date.now()

  scope: DebugTraceScope;
  kind: DebugTraceKind;

  message: string;

  ok?: boolean;
  status?: number;
  error?: string;

  meta?: Record<string, unknown>;
};

// Template-safe keys. Will be replaced by change-name.sh.
const TRACE_KEY = "beemage.debugTrace";
const ENABLED_KEY = "beemage.debugTrace.enabled";

// Default retention if not specified by caller.
const DEFAULT_MAX = 2000;

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function getRaw(): Promise<DebugTraceEntry[]> {
  const res = await storageGet(TRACE_KEY);
  const v = (res as any)?.[TRACE_KEY];
  return Array.isArray(v) ? (v as DebugTraceEntry[]) : [];
}

async function setRaw(entries: DebugTraceEntry[]): Promise<void> {
  await storageSet({ [TRACE_KEY]: entries });
}

export async function isEnabled(): Promise<boolean> {
  const res = await storageGet(ENABLED_KEY);
  return !!(res as any)?.[ENABLED_KEY];
}

/**
 * Turning OFF:
 * - stores enabled=false
 * - wipes the entire debug trace
 */
export async function setEnabled(next: boolean): Promise<void> {
  await storageSet({ [ENABLED_KEY]: !!next });
  if (!next) {
    await storageRemove(TRACE_KEY);
  }
}

export async function clear(): Promise<void> {
  await storageRemove(TRACE_KEY);
}

export type ListOptions = {
  limit?: number; // default 200
  offset?: number; // default 0
  reverse?: boolean; // default true (newest first)
};

export type ListResult = {
  total: number;
  items: DebugTraceEntry[];
};

export async function append(
  entryOrEntries:
    | Omit<DebugTraceEntry, "id" | "ts">
    | Array<Omit<DebugTraceEntry, "id" | "ts">>,
  opts?: { max?: number }
): Promise<{ total: number }> {
  // IMPORTANT: debug trace is silent when disabled
  const enabled = await isEnabled();
  if (!enabled) return { total: 0 };

  const max = clampInt(opts?.max ?? DEFAULT_MAX, 100, 50000);

  const incoming = (Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries]).map((e) => ({
    ...e,
    id: makeId(),
    ts: Date.now(),
  }));

  if (!incoming.length) {
    const current = await getRaw();
    return { total: current.length };
  }

  const current = await getRaw();
  const merged = current.concat(incoming);

  // hard cap: keep last N (newest)
  const capped = merged.length > max ? merged.slice(merged.length - max) : merged;

  await setRaw(capped);
  return { total: capped.length };
}

export async function list(opts?: ListOptions): Promise<ListResult> {
  const limit = clampInt(opts?.limit ?? 200, 1, 50000);
  const offset = clampInt(opts?.offset ?? 0, 0, 1_000_000);
  const reverse = opts?.reverse ?? true;

  const all = await getRaw();
  const total = all.length;

  const ordered = reverse ? all.slice().reverse() : all;
  const items = ordered.slice(offset, offset + limit);

  return { total, items };
}

export async function exportJson(opts?: { pretty?: boolean }): Promise<string> {
  const all = await getRaw();
  return JSON.stringify(all, null, opts?.pretty ? 2 : 0);
}
