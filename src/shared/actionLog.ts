// src/shared/actionLog.ts

import { storageGet, storageSet, storageRemove } from "./platform/storage";

export type ActionLogKind = "run" | "info" | "error";

export type ActionLogScope =
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

export type ActionLogEntry = {
  id: string; // unique id
  ts: number; // Date.now()
  kind: ActionLogKind;
  scope: ActionLogScope;

  message: string;

  ok?: boolean;
  status?: number;
  error?: string;

  meta?: Record<string, unknown>;
};
 
// Template-safe storage key. This will be replaced by change-name.sh.
const STORAGE_KEY = "beemage.actionLog";

// Default retention if not specified by caller.
const DEFAULT_MAX = 5000;

function makeId(): string {
  // stable enough: timestamp + random
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function getRaw(): Promise<ActionLogEntry[]> {
  const res = await storageGet(STORAGE_KEY);
  const v = (res as any)?.[STORAGE_KEY];
  if (!Array.isArray(v)) return [];
  return v as ActionLogEntry[];
}

async function setRaw(entries: ActionLogEntry[]): Promise<void> {
  await storageSet({ [STORAGE_KEY]: entries });
}

export type ListOptions = {
  limit?: number; // default 200
  offset?: number; // default 0
  reverse?: boolean; // default true (newest first)
  kind?: ActionLogKind;
  scope?: ActionLogScope;
  sinceTs?: number;
  untilTs?: number;
};

export type ListResult = {
  total: number;
  items: ActionLogEntry[];
};

export async function append(
  entryOrEntries:
    | Omit<ActionLogEntry, "id" | "ts">
    | Omit<ActionLogEntry, "id" | "ts">[],
  opts?: { max?: number }
): Promise<{ total: number }> {
  // Keep this generic: caller may pass max; otherwise use default.
  const max = clampInt(opts?.max ?? DEFAULT_MAX, 100, 50000);

  const incomingAll = toArray(entryOrEntries);

  const incoming = incomingAll.map((e) => ({
    ...e,
    id: makeId(),
    ts: Date.now(),
  }));

  if (!incoming.length) {
    // no-op
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

  let filtered = all;

  if (opts?.kind) filtered = filtered.filter((x) => x.kind === opts.kind);
  if (opts?.scope) filtered = filtered.filter((x) => x.scope === opts.scope);
  if (typeof opts?.sinceTs === "number") filtered = filtered.filter((x) => x.ts >= opts.sinceTs!);
  if (typeof opts?.untilTs === "number") filtered = filtered.filter((x) => x.ts <= opts.untilTs!);

  const total = filtered.length;

  if (reverse) filtered = filtered.slice().reverse();

  const items = filtered.slice(offset, offset + limit);
  return { total, items };
}

export async function trim(opts: { keepLast?: number; beforeTs?: number }): Promise<{ total: number }> {
  const all = await getRaw();

  let next = all;

  // Keep entries with ts >= beforeTs (i.e. remove anything older than beforeTs).
  if (typeof opts.beforeTs === "number") {
    next = next.filter((x) => x.ts >= opts.beforeTs!);
  }

  if (typeof opts.keepLast === "number") {
    const keep = clampInt(opts.keepLast, 0, 50000);
    if (keep === 0) next = [];
    else if (next.length > keep) next = next.slice(next.length - keep);
  }

  await setRaw(next);
  return { total: next.length };
}

export async function clear(): Promise<void> {
  await storageRemove(STORAGE_KEY);
}

export async function exportJson(opts?: { pretty?: boolean }): Promise<string> {
  const all = await getRaw();
  return JSON.stringify(all, null, opts?.pretty ? 2 : 0);
}
