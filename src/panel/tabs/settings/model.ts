// src/panel/tabs/settings/model.ts
export type SettingsDevConfig = {
  traceConsole: boolean;

  actionLogMax: number;
  debugTraceMax: number;
  failureLogsPerRun: number;
};

export function createSettingsModel() {
  let showDevTools = false;

  let dev: SettingsDevConfig = {
    traceConsole: false,
    actionLogMax: 5000,
    debugTraceMax: 2000,
    failureLogsPerRun: 50,
  };

  let debugEnabled = false;
  let generalStatus = "";
  let devStatus = "";

  function setShowDevTools(v: boolean) {
    showDevTools = v;
  }

  function setDev(next: Partial<SettingsDevConfig>) {
    dev = { ...dev, ...next };
  }

  function setDebugEnabled(v: boolean) {
    debugEnabled = v;
  }

  function setStatus(next: Partial<{ general: string; dev: string }>) {
    if (typeof next.general === "string") generalStatus = next.general;
    if (typeof next.dev === "string") devStatus = next.dev;
  }

  return {
    get showDevTools() {
      return showDevTools;
    },
    get dev() {
      return dev;
    },
    get debugEnabled() {
      return debugEnabled;
    },
    get generalStatus() {
      return generalStatus;
    },
    get devStatus() {
      return devStatus;
    },

    setShowDevTools,
    setDev,
    setDebugEnabled,
    setStatus,
  };
}
