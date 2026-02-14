// src/shared/devConfigStore.ts
import { storageGet, storageSet } from "./platform/storage";
import { clampInt } from "../panel/app/format";

const STORAGE_KEY = "beemage.devConfig";

export type DevConfig = {
  traceConsole: boolean;

  // caps
  actionLogMax: number;      // stored ActionLog entries cap
  debugTraceMax: number;     // stored DebugTrace entries cap
  failureLogsPerRun: number; // per-run spam cap in UI
};

export const DEV_CONFIG_DEFAULTS: DevConfig = {
  traceConsole: false,

  actionLogMax: 5000,
  debugTraceMax: 2000,
  failureLogsPerRun: 50,
};

let loaded = false;
let snapshot: DevConfig = { ...DEV_CONFIG_DEFAULTS };

function normalize(raw: any): DevConfig {
  const r = raw || {};
  return {
    traceConsole: !!r.traceConsole,

    actionLogMax: clampInt(r.actionLogMax ?? DEV_CONFIG_DEFAULTS.actionLogMax, 100, 50000, DEV_CONFIG_DEFAULTS.actionLogMax),
    debugTraceMax: clampInt(r.debugTraceMax ?? DEV_CONFIG_DEFAULTS.debugTraceMax, 100, 50000, DEV_CONFIG_DEFAULTS.debugTraceMax),
    failureLogsPerRun: clampInt(r.failureLogsPerRun ?? DEV_CONFIG_DEFAULTS.failureLogsPerRun, 0, 50000, DEV_CONFIG_DEFAULTS.failureLogsPerRun),
  };
}

export async function ensureDevConfigLoaded(): Promise<void> {
  if (loaded) return;
  const res = await storageGet([STORAGE_KEY]).catch(() => ({} as any));
  snapshot = normalize((res as any)?.[STORAGE_KEY]);
  loaded = true;
}

export function getDevConfigSnapshot(): DevConfig {
  return snapshot;
}

export async function setDevConfig(next: DevConfig): Promise<void> {
  snapshot = normalize(next);
  loaded = true;
  await storageSet({ [STORAGE_KEY]: snapshot }).catch(() => null);
}

export async function resetDevConfigDefaults(): Promise<void> {
  await setDevConfig({ ...DEV_CONFIG_DEFAULTS });
}
