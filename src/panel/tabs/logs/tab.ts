// src/panel/tabs/logs/tab.ts

import type { Dom } from "../../app/dom";
import type { createBus } from "../../app/bus";
import { getBusy, setBusy } from "../../app/state";
import { clampInt } from "../../app/format";

import { createLogsModel } from "./model";
import { createLogsView } from "./view";

import * as actionLog from "../../../shared/actionLog";
import * as debugTrace from "../../../shared/debugTrace";

type Bus = ReturnType<typeof createBus>;

// Template download prefix (kept generic; can be replaced by change-name script later)
const DOWNLOAD_PREFIX = "beemage";

export function createLogsTab(dom: Dom, _bus: Bus) {
  const model = createLogsModel();
  const view = createLogsView(dom);

  async function refreshAudit() {
    view.setAuditStatus("Loading…");
    setBusy(dom, true);

    try {
      const limit = clampInt(dom.logsLimitEl.value, 10, 5000, 200);
      const res = await actionLog.list({ limit, reverse: true });
      model.set(res);
      view.renderAudit({ items: model.items, total: model.total });
      view.setAuditStatus(`Showing ${model.items.length} (newest first)`);
    } catch (e: any) {
      view.setAuditStatus(`Failed: ${e?.message || String(e)}`);
    } finally {
      setBusy(dom, false);
    }
  }

  async function refreshDebug() {
    view.setDebugStatus("Loading…");
    setBusy(dom, true);

    try {
      const limit = clampInt(dom.debugLimitEl.value, 10, 5000, 200);
      const res = await debugTrace.list({ limit, reverse: true });
      view.renderDebug(res);
      view.setDebugStatus(`Showing ${res.items.length} (newest first)`);
    } catch (e: any) {
      view.setDebugStatus(`Failed: ${e?.message || String(e)}`);
    } finally {
      setBusy(dom, false);
    }
  }

  async function bootDebugToggle() {
    const on = await debugTrace.isEnabled();
    view.setDebugChecked(on);
  }

  async function setDebug(on: boolean) {
    // OFF wipes everything by design
    await debugTrace.setEnabled(on);
    view.setDebugChecked(on);

    if (!on) {
      view.setDebugStatus("Debug OFF. Traces wiped.");
      dom.debugOutEl.textContent = "";
      return;
    }

    view.setDebugStatus("Debug ON.");
    await refreshDebug();
  }

  async function doTrimAudit() {
    const keepLast = clampInt(dom.logsTrimKeepEl.value, 0, 50000, 2000);

    view.setAuditStatus("Trimming…");
    setBusy(dom, true);
    try {
      const r = await actionLog.trim({ keepLast });
      await refreshAudit();
      view.setAuditStatus(`Trimmed. Remaining: ${r.total}`);
    } catch (e: any) {
      view.setAuditStatus(`Trim failed: ${e?.message || String(e)}`);
    } finally {
      setBusy(dom, false);
    }
  }

  async function doClearAudit() {
    view.setAuditStatus("Clearing…");
    setBusy(dom, true);
    try {
      await actionLog.clear();
      await refreshAudit();
      view.setAuditStatus("Cleared.");
    } catch (e: any) {
      view.setAuditStatus(`Clear failed: ${e?.message || String(e)}`);
    } finally {
      setBusy(dom, false);
    }
  }

  async function doExportAudit() {
    view.setAuditStatus("Exporting…");
    try {
      const json = await actionLog.exportJson({ pretty: true });
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${DOWNLOAD_PREFIX}-audit-${Date.now()}.json`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      view.setAuditStatus("Exported.");
    } catch (e: any) {
      view.setAuditStatus(`Export failed: ${e?.message || String(e)}`);
    }
  }

  async function doClearDebug() {
    view.setDebugStatus("Clearing…");
    setBusy(dom, true);
    try {
      await debugTrace.clear();
      await refreshDebug();
      view.setDebugStatus("Cleared.");
    } catch (e: any) {
      view.setDebugStatus(`Clear failed: ${e?.message || String(e)}`);
    } finally {
      setBusy(dom, false);
    }
  }

  async function doExportDebug() {
    view.setDebugStatus("Exporting…");
    try {
      const json = await debugTrace.exportJson({ pretty: true });
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${DOWNLOAD_PREFIX}-debug-${Date.now()}.json`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      view.setDebugStatus("Exported.");
    } catch (e: any) {
      view.setDebugStatus(`Export failed: ${e?.message || String(e)}`);
    }
  }

  function bind() {
    // audit
    dom.btnLogsRefresh.addEventListener("click", () => {
      if (getBusy()) return;
      void refreshAudit();
    });

    dom.btnLogsTrim.addEventListener("click", () => {
      if (getBusy()) return;
      void doTrimAudit();
    });

    dom.btnLogsClear.addEventListener("click", () => {
      if (getBusy()) return;
      void doClearAudit();
    });

    dom.btnLogsExport.addEventListener("click", () => {
      if (getBusy()) return;
      void doExportAudit();
    });

    // debug
    dom.logsCbDebugEl.addEventListener("change", () => {
      if (getBusy()) return;
      void setDebug(dom.logsCbDebugEl.checked);
    });

    dom.btnDebugRefresh.addEventListener("click", () => {
      if (getBusy()) return;
      void refreshDebug();
    });

    dom.btnDebugClear.addEventListener("click", () => {
      if (getBusy()) return;
      void doClearDebug();
    });

    dom.btnDebugExport.addEventListener("click", () => {
      if (getBusy()) return;
      void doExportDebug();
    });
  }

  return {
    id: "logs" as const,
    bind,
    mount() {
      void bootDebugToggle();
      void refreshAudit();
      void refreshDebug();
    },
    unmount() {},
    dispose() {},
  };
}
