// src/panel/app/log.ts


import { createLogger } from "../../shared/logger";
import { getDevConfigSnapshot } from "../../shared/devConfigStore";

export const { logTrace, logWarn, logError, traceScope } = createLogger({
  scope: "panel",
  traceOn: () => !!getDevConfigSnapshot().traceConsole,
});
