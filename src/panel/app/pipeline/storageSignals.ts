// src/panel/app/pipeline/storageSignals.ts

export const PIPELINE_STORAGE_SIGNALS_VERSION = 1 as const;

export type PipelineStorageChange =
  | {
      kind: "userPipelines";
      reason: "import" | "upsert" | "delete" | "saveAll";
      pipelineId?: string;
    }
  | {
      kind: "recipes";
      reason: "import" | "upsert" | "delete" | "select" | "deleteAllForPipeline";
      pipelineId?: string;
      recipeId?: string;
    };

type Listener = (change: PipelineStorageChange) => void;

const listeners = new Set<Listener>();

export function onPipelineStorageChanged(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitPipelineStorageChanged(change: PipelineStorageChange): void {
  // Snapshot to avoid issues if a listener unsubscribes during iteration.
  const snap = Array.from(listeners);
  for (const cb of snap) {
    try {
      cb(change);
    } catch {
      // Never let a listener crash the emitter.
    }
  }
}
