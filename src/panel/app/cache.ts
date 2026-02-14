// src/panel/app/cache.ts

/**
 * Generic panel cache (minimal template).
 *
 * - Stores an opaque list of items (unknown).
 * - Provides snapshot + subscription.
 * - No assumptions about item shape (no ids).
 * - Add id-based helpers later when a real feature needs them.
 */

export type CacheMeta = {
  scopeUpdatedSince?: string;
  updatedTs?: number;
  limit?: number;
};

export type CacheSnapshot<T> = {
  items: T[];
  counts: { items: number };
  meta: CacheMeta;
};

type Listener<T> = (snap: CacheSnapshot<T>) => void;

function makeSnapshot<T>(state: { items: T[]; meta: CacheMeta }): CacheSnapshot<T> {
  const n = state.items.length;
  return {
    items: state.items,
    counts: { items: n },
    meta: state.meta,
  };
}

export function createPanelCache<T = unknown>() {
  const state = {
    items: [] as T[],
    meta: {} as CacheMeta,
  };

  const listeners = new Set<Listener<T>>();

  function emit() {
    const snap = makeSnapshot(state);
    for (const fn of listeners) {
      try {
        fn(snap);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  function getSnapshot(): CacheSnapshot<T> {
    return makeSnapshot(state);
  }

  function subscribe(fn: Listener<T>): () => void {
    listeners.add(fn);
    try {
      fn(getSnapshot());
    } catch {
      // ignore
    }
    return () => listeners.delete(fn);
  }

  function clearAll() {
    state.items = [];
    state.meta = {};
    emit();
  }

  function setScopeUpdatedSince(isoDay: string) {
    state.meta.scopeUpdatedSince = isoDay;
    emit();
  }

  function getScopeUpdatedSince(): string {
    return String(state.meta.scopeUpdatedSince || "");
  }

  function setItems(items: T[], opts?: { limit?: number }) {
    state.items = items.slice();
    state.meta.updatedTs = Date.now();
    if (typeof opts?.limit === "number") state.meta.limit = opts.limit;
    emit();
  }

  return {
    getSnapshot,
    subscribe,
    getScopeUpdatedSince,
    clearAll,
    setScopeUpdatedSince,
    setItems,
  };
}

export type PanelCache<T = unknown> = ReturnType<typeof createPanelCache<T>>;
