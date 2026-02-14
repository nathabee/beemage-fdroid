// src/shared/logger.ts

// do not call directly
// Panel logger: prints to the panel page console, reads panel devConfig store
// from panel  call please : from /panel/app/log 
 

import * as debugTrace from "./debugTrace";

function prefix(level: string) {
  return `[BCT][${level}]`;
}

export function createLogger(opts: {
  scope:    "panel" | "colors" | "image" | "settings"  | "logs" | "ui";
  traceOn: () => boolean; // reads the right dev config snapshot for that runtime
}) {
  function logTrace(...args: any[]) {
    if (!opts.traceOn()) return;
    console.log(prefix("trace"), ...args);
  }

  function logWarn(...args: any[]) {
    console.warn(prefix("warn"), ...args);
  }

  function logError(...args: any[]) {
    console.error(prefix("error"), ...args);
  }

  function traceScope(message: string, meta?: Record<string, unknown>) {
    logTrace(message, meta);
    void debugTrace.append({
      scope: opts.scope,
      kind: "debug",
      message,
      meta,
    });
  }

  return { logTrace, logWarn, logError, traceScope };
}
