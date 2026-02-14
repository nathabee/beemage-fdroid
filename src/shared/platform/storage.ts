// src/shared/platform/storage.ts 
/**
 * Minimal wrapper around chrome.storage for code shared by panel and shared utilities.
 * Demo build will alias this module to an in-memory or localStorage-backed implementation.
 */




export type StorageChange = { oldValue?: any; newValue?: any };
export type StorageChanges = Record<string, StorageChange>;
export type StorageChangedHandler = (changes: StorageChanges, areaName: string) => void;

function ensureStorage() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    throw new Error("chrome.storage.local is not available in this context.");
  }
}

export async function storageGet<T = any>(
  keys: string | string[] | Record<string, any>
): Promise<T> {
  ensureStorage();
  return (await chrome.storage.local.get(keys as any)) as T;
}

export async function storageSet(items: Record<string, any>): Promise<void> {
  ensureStorage();
  await chrome.storage.local.set(items);
}

export async function storageRemove(keys: string | string[]): Promise<void> {
  ensureStorage();
  await chrome.storage.local.remove(keys as any);
}

export function storageOnChangedAdd(handler: StorageChangedHandler): void {
  ensureStorage();
  chrome.storage.onChanged.addListener(handler as any);
}

export function storageOnChangedRemove(handler: StorageChangedHandler): void {
  ensureStorage();
  chrome.storage.onChanged.removeListener(handler as any);
}
