// src/panel/tabs/settings/view.ts
import type { Dom } from "../../app/dom";
import type { SettingsDevConfig } from "./model";

export function createSettingsView(dom: Dom) {
  function setGeneralStatus(text: string) {
    dom.settingsGeneralStatusEl.textContent = text || "";
  }

  function setDevStatus(text: string) {
    dom.cfgStatusEl.textContent = text || "";
  }

  function setShowDevToolsChecked(checked: boolean) {
    dom.cfgShowDevToolsEl.checked = checked;
  }

  function setDevToolsVisible(visible: boolean) {
    // Tabs: tabs.ts checks `.hidden`
    dom.tabLogs.hidden = !visible;

    // Settings sections
    dom.devConfigDetailsEl.classList.toggle("is-hidden", !visible);

    if (!visible) {
      // keep UI consistent if Logs was visible
      dom.viewLogs.hidden = true;
      dom.viewSettings.hidden = false;

      // avoid “re-open surprises”
      dom.devConfigDetailsEl.open = false;
    }
  }

  function setDevConfig(dev: SettingsDevConfig) {
    dom.cfgTraceConsoleEl.checked = !!dev.traceConsole;

    dom.cfgActionLogMaxEl.value = String(dev.actionLogMax ?? 5000);
    dom.cfgDebugTraceMaxEl.value = String(dev.debugTraceMax ?? 2000);
    dom.cfgFailureLogsPerRunEl.value = String(dev.failureLogsPerRun ?? 50);
  }

  function setDebugEnabledChecked(checked: boolean) {
    dom.logsCbDebugEl.checked = checked;
  }

  function setAbout(version: string, githubUrl: string) {
    dom.settingsVersionEl.textContent = version || "—";
    dom.settingsGitHubLinkEl.href = githubUrl || "#";
    dom.settingsGitHubLinkEl.hidden = !githubUrl;
  }

  function setBusy(disabled: boolean) {
    // allow toggling visibility while busy
    dom.cfgShowDevToolsEl.disabled = false;

    dom.cfgTraceConsoleEl.disabled = disabled;
    dom.cfgActionLogMaxEl.disabled = disabled;
    dom.cfgDebugTraceMaxEl.disabled = disabled;
    dom.cfgFailureLogsPerRunEl.disabled = disabled;
    dom.btnCfgResetDefaults.disabled = disabled;

    dom.logsCbDebugEl.disabled = disabled;
    dom.cfgUseOpenCvEl.disabled = disabled;


    // Engine probe lives in Settings 
  }

  return {
    setGeneralStatus,
    setDevStatus,
    setShowDevToolsChecked,
    setDevToolsVisible,
    setDevConfig,
    setDebugEnabledChecked,
    setAbout,
    setBusy,
  };
}
