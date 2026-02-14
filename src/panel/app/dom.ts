// src/panel/app/dom.ts
export type Dom = ReturnType<typeof getDom>;

export function getDom() {
  function must<T extends Element>(el: T | null, id: string): T {
    if (!el) throw new Error(`[dom] Missing #${id}`);
    return el;
  }

  // Root
  const rootEl = must(document.getElementById("appRoot") as HTMLDivElement | null, "appRoot");

  // -----------------------------
  // Tabs + views
  // -----------------------------
  const tabImage = must(document.getElementById("tabImage") as HTMLButtonElement | null, "tabImage");
  const tabColors = must(document.getElementById("tabColors") as HTMLButtonElement | null, "tabColors");
  const tabSettings = must(document.getElementById("tabSettings") as HTMLButtonElement | null, "tabSettings");
  const tabLogs = must(document.getElementById("tabLogs") as HTMLButtonElement | null, "tabLogs");
  const tabPipeline = must(document.getElementById("tabPipeline") as HTMLButtonElement | null, "tabPipeline");
  const tabBuilder = must(document.getElementById("tabBuilder") as HTMLButtonElement | null, "tabBuilder");


  const viewImage = must(document.getElementById("viewImage") as HTMLElement | null, "viewImage");
  const viewColors = must(document.getElementById("viewColors") as HTMLElement | null, "viewColors");
  const viewSettings = must(document.getElementById("viewSettings") as HTMLElement | null, "viewSettings");
  const viewLogs = must(document.getElementById("viewLogs") as HTMLElement | null, "viewLogs");
  const viewPipeline = must(document.getElementById("viewPipeline") as HTMLElement | null, "viewPipeline");
  const viewBuilder = must(document.getElementById("viewBuilder") as HTMLElement | null, "viewBuilder");

  // -----------------------------
  // image tab 
  // -----------------------------
  const dropZoneEl = must(document.getElementById("dropZone") as HTMLDivElement | null, "dropZone");
  const fileInputEl = must(document.getElementById("fileInput") as HTMLInputElement | null, "fileInput");
  const srcCanvasEl = must(document.getElementById("srcCanvas") as HTMLCanvasElement | null, "srcCanvas");



  // -----------------------------
  // Pipeline tab (NEW)
  // -----------------------------
  const pipelineStatusEl = must(
    document.getElementById("pipelineStatus") as HTMLSpanElement | null,
    "pipelineStatus",
  );

  const pipelineTuningMountEl = must(
    document.getElementById("pipelineTuningMount") as HTMLDivElement | null,
    "pipelineTuningMount",
  );

  const pipelineViewMountEl = must(
    document.getElementById("pipelineViewMount") as HTMLDivElement | null,
    "pipelineViewMount",
  );


  // -----------------------------
  // Builder tab
  // -----------------------------

  const builderImportFileEl = must(
    document.getElementById("builderImportFile") as HTMLInputElement | null,
    "builderImportFile",
  );

  const btnBuilderExportEl = must(
    document.getElementById("btnBuilderExport") as HTMLButtonElement | null,
    "btnBuilderExport",
  );

  const builderStatusEl = must(
    document.getElementById("builderStatus") as HTMLSpanElement | null,
    "builderStatus",
  );


  // -----------------------------
  // Colors tab
  // -----------------------------

  const colorsCanvasEl = must(document.getElementById("colorsCanvas") as HTMLCanvasElement | null, "colorsCanvas");

  const paletteEl = must(document.getElementById("palette") as HTMLDivElement | null, "palette");

  const btnColorsApplyEl = must(
    document.getElementById("btnColorsApply") as HTMLButtonElement | null,
    "btnColorsApply"
  );
  const btnColorsCancelEl = must(
    document.getElementById("btnColorsCancel") as HTMLButtonElement | null,
    "btnColorsCancel"
  );
  const btnColorsResetEl = must(
    document.getElementById("btnColorsReset") as HTMLButtonElement | null,
    "btnColorsReset"
  );

  const edgesDarkEl = must(document.getElementById("edgesDark") as HTMLInputElement | null, "edgesDark");
  const edgeMaskThresholdEl = must(
    document.getElementById("edgeMaskThreshold") as HTMLInputElement | null,
    "edgeMaskThreshold"
  );
  const edgeDilateEl = must(document.getElementById("edgeDilate") as HTMLInputElement | null, "edgeDilate");
  const maxRegionPxEl = must(document.getElementById("maxRegionPx") as HTMLInputElement | null, "maxRegionPx");
  const colorsStatusEl = must(document.getElementById("colorsStatus") as HTMLSpanElement | null, "colorsStatus");

  // -----------------------------
  // Settings
  // -----------------------------
  const cfgShowDevToolsEl = must(
    document.getElementById("cfgShowDevTools") as HTMLInputElement | null,
    "cfgShowDevTools"
  );
  const settingsGeneralStatusEl = must(
    document.getElementById("settingsGeneralStatus") as HTMLElement | null,
    "settingsGeneralStatus"
  );

  const devConfigDetailsEl = must(
    document.getElementById("devConfigDetails") as HTMLDetailsElement | null,
    "devConfigDetails"
  );

  const cfgTraceConsoleEl = must(
    document.getElementById("cfgTraceConsole") as HTMLInputElement | null,
    "cfgTraceConsole"
  );

  const cfgActionLogMaxEl = must(
    document.getElementById("cfgActionLogMax") as HTMLInputElement | null,
    "cfgActionLogMax"
  );
  const cfgDebugTraceMaxEl = must(
    document.getElementById("cfgDebugTraceMax") as HTMLInputElement | null,
    "cfgDebugTraceMax"
  );
  const cfgFailureLogsPerRunEl = must(
    document.getElementById("cfgFailureLogsPerRun") as HTMLInputElement | null,
    "cfgFailureLogsPerRun"
  );

  const logsCbDebugEl = must(document.getElementById("logsCbDebug") as HTMLInputElement | null, "logsCbDebug");

  const btnCfgResetDefaults = must(
    document.getElementById("btnCfgResetDefaults") as HTMLButtonElement | null,
    "btnCfgResetDefaults"
  );
  const cfgStatusEl = must(document.getElementById("cfgStatus") as HTMLElement | null, "cfgStatus");

  // Engine (OpenCV probe) — now in Settings

  const cfgOpenCvSpinner = must(
    document.getElementById("cfgOpenCvSpinner") as HTMLSpanElement | null,
    "cfgOpenCvSpinner",
  );
  const cfgOpenCvStatus = must(
    document.getElementById("cfgOpenCvStatus") as HTMLSpanElement | null,
    "cfgOpenCvStatus",
  );
  const cfgOpenCvReport = must(
    document.getElementById("cfgOpenCvReport") as HTMLPreElement | null,
    "cfgOpenCvReport",
  );

  const settingsEngineBoxEl = must(
    document.getElementById("settingsEngineBox") as HTMLDetailsElement | null,
    "settingsEngineBox",
  );

  const cfgUseOpenCvEl = must(
    document.getElementById("cfgUseOpenCv") as HTMLInputElement | null,
    "cfgUseOpenCv",
  );

  // Tuning mount (Settings)
  const tuningMountEl = must(
    document.getElementById("tuningMount") as HTMLDivElement | null,
    "tuningMount"
  );


  // About
  const settingsVersionEl = must(document.getElementById("settingsVersion") as HTMLElement | null, "settingsVersion");
  const settingsGitHubLinkEl = must(
    document.getElementById("settingsGitHubLink") as HTMLAnchorElement | null,
    "settingsGitHubLink"
  );

  // -----------------------------
  // Logs (audit)
  // -----------------------------
  const logsLimitEl = must(document.getElementById("logsLimit") as HTMLInputElement | null, "logsLimit");
  const btnLogsRefresh = must(document.getElementById("btnLogsRefresh") as HTMLButtonElement | null, "btnLogsRefresh");
  const logsStatusEl = must(document.getElementById("logsStatus") as HTMLSpanElement | null, "logsStatus");

  const logsTrimKeepEl = must(document.getElementById("logsTrimKeep") as HTMLInputElement | null, "logsTrimKeep");
  const btnLogsTrim = must(document.getElementById("btnLogsTrim") as HTMLButtonElement | null, "btnLogsTrim");
  const btnLogsExport = must(document.getElementById("btnLogsExport") as HTMLButtonElement | null, "btnLogsExport");
  const btnLogsClear = must(document.getElementById("btnLogsClear") as HTMLButtonElement | null, "btnLogsClear");

  const logsOutEl = must(document.getElementById("logsOut") as HTMLPreElement | null, "logsOut");

  // -----------------------------
  // Debug trace (shown in Logs view)
  // -----------------------------
  const debugLimitEl = must(document.getElementById("debugLimit") as HTMLInputElement | null, "debugLimit");
  const btnDebugRefresh = must(document.getElementById("btnDebugRefresh") as HTMLButtonElement | null, "btnDebugRefresh");
  const btnDebugExport = must(document.getElementById("btnDebugExport") as HTMLButtonElement | null, "btnDebugExport");
  const btnDebugClear = must(document.getElementById("btnDebugClear") as HTMLButtonElement | null, "btnDebugClear");
  const debugStatusEl = must(document.getElementById("debugStatus") as HTMLSpanElement | null, "debugStatus");
  const debugOutEl = must(document.getElementById("debugOut") as HTMLPreElement | null, "debugOut");

  return {
    rootEl,

    // Tabs + views
    tabImage,
    tabColors,
    tabSettings,
    tabLogs,
    tabPipeline,
    tabBuilder,


    viewImage,
    viewColors,
    viewSettings,
    viewLogs,
    viewPipeline,
    viewBuilder,

    // image tab
    dropZoneEl,
    fileInputEl,
    srcCanvasEl,

    // Pipeline
    pipelineStatusEl,
    pipelineTuningMountEl,
    pipelineViewMountEl,

    // Builder
    builderImportFileEl,
    btnBuilderExportEl,
    builderStatusEl,

    // Colors 
    colorsCanvasEl,
    paletteEl,
    btnColorsApplyEl,
    btnColorsCancelEl,
    btnColorsResetEl,
    edgesDarkEl,
    edgeMaskThresholdEl,
    edgeDilateEl,
    maxRegionPxEl,
    colorsStatusEl,

    // Settings
    cfgShowDevToolsEl,
    settingsGeneralStatusEl,
    devConfigDetailsEl,
    cfgTraceConsoleEl,
    cfgActionLogMaxEl,
    cfgDebugTraceMaxEl,
    cfgFailureLogsPerRunEl,
    logsCbDebugEl,
    btnCfgResetDefaults,
    cfgStatusEl,
    settingsVersionEl,
    settingsGitHubLinkEl,

    // Settings engine (OpenCV probe) 
    cfgOpenCvSpinner,
    cfgOpenCvStatus,
    cfgOpenCvReport,
    settingsEngineBoxEl,
    cfgUseOpenCvEl,


    // Settings tuning
    tuningMountEl,

    // Logs (audit)
    logsLimitEl,
    btnLogsRefresh,
    logsStatusEl,
    logsTrimKeepEl,
    btnLogsTrim,
    btnLogsExport,
    btnLogsClear,
    logsOutEl,

    // Debug trace
    debugLimitEl,
    btnDebugRefresh,
    btnDebugExport,
    btnDebugClear,
    debugStatusEl,
    debugOutEl,
  };
}
