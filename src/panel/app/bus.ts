// src/panel/app/bus.ts
import { runtimeOnMessageAdd, runtimeOnMessageRemove } from "../platform/runtime";

export type Bus = ReturnType<typeof createBus>;

type Handler = (msg: unknown) => void;

export function createBus() {
  const handlers = new Set<Handler>();

  function on(handler: Handler) {
    handlers.add(handler);
    return () => handlers.delete(handler);
  }

  function start() {
    const listener: Handler = (msg) => {
      for (const h of handlers) h(msg);
    };

    runtimeOnMessageAdd(listener);

    // Keep remove available (even if unused now)
    void runtimeOnMessageRemove;
  }

  return { on, start };
}
