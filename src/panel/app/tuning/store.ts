// src/panel/app/tuning/store.ts

import { storageGet, storageSet } from "../../../shared/platform/storage";
import type { ComponentConfig, ComponentId } from "./types";

const KEY = "beemage.tuning.components.v1";

/**
 * Stored as:
 * {
 *   "mage.clean": { enginePolicy: "opencv", params: { cleanRadius: 2 } },
 *   "mage.clean.removeSmallComponents": { enginePolicy: "native" }
 * }
 */
export type StoredComponentConfigs = Record<ComponentId, ComponentConfig>;

export async function loadComponentConfigs(): Promise<StoredComponentConfigs> {
  const res = await storageGet([KEY]).catch(() => ({} as any));
  const raw = (res as any)?.[KEY];

  if (!raw || typeof raw !== "object") return {};
  return raw as StoredComponentConfigs;
}

export async function saveComponentConfigs(next: StoredComponentConfigs): Promise<void> {
  await storageSet({ [KEY]: next }).catch(() => null);
}

export async function setComponentConfig(id: ComponentId, patch: ComponentConfig): Promise<void> {
  const all = await loadComponentConfigs();
  const prev = all[id] ?? {};
  all[id] = {
    enginePolicy: patch.enginePolicy ?? prev.enginePolicy,
    params: { ...(prev.params ?? {}), ...(patch.params ?? {}) },
  };
  await saveComponentConfigs(all);
}

export async function clearComponentConfig(id: ComponentId): Promise<void> {
  const all = await loadComponentConfigs();
  delete all[id];
  await saveComponentConfigs(all);
}
