// src/panel/app/format.ts
export function clampInt(v: any, min: number, max: number, fallback: number): number {
  const n = Number(String(v ?? "").trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "?";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  return `${s}s`;
}