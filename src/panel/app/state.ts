// src/panel/app/state.ts
/*
Why radius should NOT live in state
state is for derived artifacts and workflow flags (hasImage/hasOutput). Parameters belong to:
DOM inputs (current approach), or later
a Settings object you persist.
If you store radius in state, you’ll create two sources of truth (DOM + state), and they will drift.
*/

import type { Dom } from "./dom";
import { logTrace, logError } from "./log";

let busyCount = 0;
let prevDisabled = new Map<HTMLElement, boolean>();

export function getBusy(): boolean {
  return busyCount > 0;
}

export function setBusy(dom: Dom, next: boolean): void {
  if (next) {
    beginBusy(dom);
    return;
  }
  busyCount = 0; 

  applyBusy(dom, false);
}
 

export async function withBusy<T>(dom: Dom, fn: () => Promise<T>): Promise<T> {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  logTrace("[state] withBusy: enter", { id, busyCount });
  beginBusy(dom, id);

  try {
    logTrace("[state] withBusy: before await fn", { id, busyCount });
    const res = await fn();
    logTrace("[state] withBusy: after await fn (resolved)", { id, busyCount });
    return res;
  } catch (e: any) {
    logError("[state] withBusy: fn threw", {
      id,
      busyCount,
      msg: String(e?.message ?? e),
      stack: String(e?.stack ?? ""),
    });
    throw e;
  } finally {
    logTrace("[state] withBusy: finally before endBusy", { id, busyCount });
    endBusy(dom, id);
    logTrace("[state] withBusy: finally after endBusy", { id, busyCount });
  }
}

function beginBusy(dom: Dom, id?: string): void {
  busyCount++;
  logTrace("[state] beginBusy", { id, busyCount });
  if (busyCount === 1) applyBusy(dom, true);
}

function endBusy(dom: Dom, id?: string): void {
  busyCount--;
  logTrace("[state] endBusy: dec", { id, busyCount });

  if (busyCount <= 0) {
    busyCount = 0;
    logTrace("[state] endBusy: applying busy=false", { id, busyCount });
    applyBusy(dom, false);
    return;
  }

  // This branch is technically redundant with the <=0 guard,
  // but kept to preserve your original structure.
  if (busyCount === 0) {
    logTrace("[state] endBusy: applying busy=false (redundant branch)", { id, busyCount });
    applyBusy(dom, false);
  }
}


function applyBusy(dom: Dom, next: boolean): void {
  dom.rootEl.classList.toggle("is-busy", next);

  // Allow toggling visibility even while busy (so you can escape Logs if needed)
  dom.cfgShowDevToolsEl.disabled = false;

  // -----------------------------
  // image tab controls
  // -----------------------------
  dom.fileInputEl.disabled = next; 
  // -----------------------------
  // Settings (dev config)
  // -----------------------------
  dom.cfgTraceConsoleEl.disabled = next;
  dom.cfgActionLogMaxEl.disabled = next;
  dom.cfgDebugTraceMaxEl.disabled = next;
  dom.cfgFailureLogsPerRunEl.disabled = next;
  dom.btnCfgResetDefaults.disabled = next;

  // Debug enabled toggle lives in Settings
  dom.logsCbDebugEl.disabled = next;

  // Settings (engine probe) 
  dom.cfgUseOpenCvEl.disabled = next;


  // -----------------------------
  // Logs tab controls
  // -----------------------------
  dom.logsLimitEl.disabled = next;
  dom.btnLogsRefresh.disabled = next;
  dom.logsTrimKeepEl.disabled = next;
  dom.btnLogsTrim.disabled = next;
  dom.btnLogsExport.disabled = next;
  dom.btnLogsClear.disabled = next;

  dom.debugLimitEl.disabled = next;
  dom.btnDebugRefresh.disabled = next;
  dom.btnDebugExport.disabled = next;
  dom.btnDebugClear.disabled = next;

  // -----------------------------
  // Colors tab (region fill)
  // -----------------------------
  dom.btnColorsApplyEl.disabled = next;
  dom.btnColorsCancelEl.disabled = next;
  dom.btnColorsResetEl.disabled = next;

  dom.edgesDarkEl.disabled = next;
  dom.edgeMaskThresholdEl.disabled = next;
  dom.edgeDilateEl.disabled = next;
  dom.maxRegionPxEl.disabled = next;

  // palette buttons live inside paletteEl
  for (const el of Array.from(dom.paletteEl.querySelectorAll("button"))) {
    (el as HTMLButtonElement).disabled = next;
  }
  dom.colorsCanvasEl.style.pointerEvents = next ? "none" : "auto";
}



