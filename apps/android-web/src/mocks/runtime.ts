// android/src/mocks/runtime.ts

import type { AnyEvent } from "@shared/messages";
import type { AnyRequest } from "@shared/messages/requests";

type RuntimeMessageHandler = (msg: AnyEvent) => void;
const listeners = new Set<RuntimeMessageHandler>();

export function emitEvent(ev: AnyEvent) {
  for (const h of Array.from(listeners)) h(ev);
}

export function runtimeOnMessageAdd(handler: RuntimeMessageHandler): void {
  listeners.add(handler);
}

export function runtimeOnMessageRemove(handler: RuntimeMessageHandler): void {
  listeners.delete(handler);
}

export async function runtimeSend<T = any>(_msg: AnyRequest): Promise<T> {
  // Generic demo: no background features
  return { ok: true } as T;
}

/**
 * Resolve a public asset URL in the demo build.
 * Example: runtimeGetAssetUrl("assets/pipelines/index.json") -> "./assets/pipelines/index.json"
 */
export function runtimeGetAssetUrl(relPath: string): string {
  const p = String(relPath || "").replace(/^\/+/, "");
  return `./${p}`;
}
