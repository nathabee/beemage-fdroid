// src/panel/app/pipeline/userPipelineStore.ts
import { storageGet, storageSet } from "../../../shared/platform/storage";
import type { 
  PipelineDef,
  PipelineId, 
} from "./type";

const USER_KEY = "beemage.pipeline.userPipelines.v1";

// -----------------------------
// User pipeline storage helpers
// -----------------------------
export type StoredUserPipelines = ReadonlyArray<PipelineDef>;

export async function loadUserPipelines(): Promise<PipelineDef[]> {
  const res = await storageGet([USER_KEY]).catch(() => ({} as any));
  const raw = (res as any)?.[USER_KEY];

  if (!Array.isArray(raw)) return [];

  const out: PipelineDef[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    if (typeof (p as any).id !== "string") continue;
    if (!Array.isArray((p as any).ops)) continue;
    out.push(p as PipelineDef);
  }
  return out;
}

export async function saveUserPipelines(next: PipelineDef[]): Promise<void> {
  await storageSet({ [USER_KEY]: next }).catch(() => null);
}

export async function upsertUserPipeline(p: PipelineDef): Promise<void> {
  const all = await loadUserPipelines();
  const idx = all.findIndex((x) => x.id === p.id);

  if (idx >= 0) {
    const copy = all.slice();
    copy[idx] = p;
    await saveUserPipelines(copy);
    return;
  }

  await saveUserPipelines([...all, p]);
}

export async function deleteUserPipeline(id: PipelineId): Promise<void> {
  const all = await loadUserPipelines();
  const next = all.filter((p) => p.id !== id);
  await saveUserPipelines(next);
}
