// android/src/mocks/storage.ts
export type StorageChange = { oldValue?: any; newValue?: any };
export type StorageChanges = Record<string, StorageChange>;
export type StorageChangedHandler = (changes: StorageChanges, areaName: string) => void;

const changed = new Set<StorageChangedHandler>();

function notify(changes: StorageChanges) {
  for (const h of changed) h(changes, "local");
}

function readKey(k: string): any {
  const raw = localStorage.getItem(k);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    // allow plain strings (rare, but safe)
    return raw;
  }
}

function writeKey(k: string, v: any) {
  localStorage.setItem(k, JSON.stringify(v));
}

export async function storageGet<T = any>(keys: string | string[] | Record<string, any>): Promise<T> {
  if (typeof keys === "string") {
    return { [keys]: readKey(keys) } as any;
  }
  if (Array.isArray(keys)) {
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = readKey(k);
    return out as any;
  }
  // object shape => defaults
  const out: Record<string, any> = {};
  for (const [k, def] of Object.entries(keys)) out[k] = localStorage.getItem(k) !== null ? readKey(k) : def;
  return out as any;
}

export async function storageSet(items: Record<string, any>): Promise<void> {
  const changes: StorageChanges = {};
  for (const [k, v] of Object.entries(items)) {
    const oldValue = readKey(k);
    writeKey(k, v);
    changes[k] = { oldValue, newValue: v };
  }
  notify(changes);
}

export async function storageRemove(keys: string | string[]): Promise<void> {
  const ks = Array.isArray(keys) ? keys : [keys];
  const changes: StorageChanges = {};
  for (const k of ks) {
    const oldValue = readKey(k);
    localStorage.removeItem(k);
    changes[k] = { oldValue, newValue: undefined };
  }
  notify(changes);
}

export function storageOnChangedAdd(handler: StorageChangedHandler): void {
  changed.add(handler);

  // Optional: also listen to cross-tab changes
  // (won't fire in the same tab that made the change)
  window.addEventListener("storage", (e) => {
    if (!e.key) return;
    handler({ [e.key]: { oldValue: e.oldValue, newValue: e.newValue } }, "local");
  });
}

export function storageOnChangedRemove(handler: StorageChangedHandler): void {
  changed.delete(handler);
}
