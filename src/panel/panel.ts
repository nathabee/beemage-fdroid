// src/panel/panel.ts
import { getDom } from "./app/dom";
import { createBus } from "./app/bus";
import { createTabs } from "./app/tabs";
import { createPanelCache } from "./app/cache";

import { createMageTab } from "./tabs/image/tab";
import { createColorsTab } from "./tabs/colors/tab";
import { createSettingsTab } from "./tabs/settings/tab";
import { createLogsTab } from "./tabs/logs/tab";
import { createTuningController } from "./app/tuning/controller";
import { createPipelineTab } from "./tabs/pipeline/tab";
import { createBuilderTab } from "./tabs/builder/tab";

import * as actionLog from "../shared/actionLog";
import * as debugTrace from "../shared/debugTrace";

import { ensureDevConfigLoaded } from "../shared/devConfigStore";

async function boot(): Promise<void> {
  const dom = getDom();

  await ensureDevConfigLoaded().catch(() => null);

  const bus = createBus();
  bus.start();

  const cache = createPanelCache();

  (globalThis as any).app__ = {
    ...(globalThis as any).app__,
    cache,
  };

  const tuning = createTuningController({
    getRuntimeAvailability: () => ({ opencvReady: false }),

    debugTraceAppend: (message) =>
      debugTrace.append({
        scope: "panel",
        kind: "debug",
        message,
      }),

    actionLogAppend: (message) =>
      actionLog.append({
        scope: "panel",
        kind: "info",
        message,
      }),
  });

  tuning.mount({ mountEl: dom.tuningMountEl, scopeRootId: "app" });

  const imageTab = createMageTab(dom, bus);
  const colorsTab = createColorsTab(dom, bus);
  const pipelineTab = createPipelineTab(dom, bus, tuning);
  const settingsTab = createSettingsTab(dom, bus);
  const logsTab = createLogsTab(dom, bus);
  const builderTab = createBuilderTab(dom, bus);


  imageTab.bind();
  pipelineTab.bind();
  colorsTab.bind();
  settingsTab.bind();
  logsTab.bind();
  builderTab.bind();

  const tabs = createTabs(dom, {
    image: imageTab,
    pipeline: pipelineTab,
    builder: builderTab,
    colors: colorsTab,
    settings: settingsTab,
    logs: logsTab,
  });

  tabs.bind();
  tabs.boot();
}

void boot();
