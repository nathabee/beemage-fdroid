// src/panel/app/pipeline/recipeStore.ts
import { storageGet, storageSet } from "../../../shared/platform/storage";
import type { EnginePolicy, ParamValue } from "../tuning/types";
import type { OpInstanceId, PipelineId } from "./type";

const KEY = "beemage.pipeline.recipes.v1";

export type RecipeId = string;

export type OpInstancePatch = {
  instanceId: OpInstanceId;

  /**
   * If omitted, instance keeps whatever the pipeline def says (default enabled=true).
   */
  enabled?: boolean;

  /**
   * Per-instance override, merged on top of global tuning.
   */
  override?: {
    enginePolicy?: EnginePolicy;
    params?: Record<string, ParamValue>;
  };
};

export type PipelineRecipe = {
  id: RecipeId;
  title: string;
  updatedTs: number;

  /**
   * Only store per-instance changes.
   * Anything missing means "use pipeline default".
   */
  ops: OpInstancePatch[];
};

export type PipelineRecipeState = {
  selectedRecipeId?: RecipeId;
  recipesById: Record<RecipeId, PipelineRecipe>;
};

export type AllRecipes = Record<PipelineId, PipelineRecipeState>;

function now() {
  return Date.now();
}

function defaultState(): PipelineRecipeState {
  return { recipesById: {} };
}

export async function loadAllRecipes(): Promise<AllRecipes> {
  const res = await storageGet([KEY]).catch(() => ({} as any));
  const raw = (res as any)?.[KEY];
  if (!raw || typeof raw !== "object") return {};
  return raw as AllRecipes;
}

export async function saveAllRecipes(next: AllRecipes): Promise<void> {
  await storageSet({ [KEY]: next }).catch(() => null);
}

export async function getPipelineRecipeState(pipelineId: PipelineId): Promise<PipelineRecipeState> {
  const all = await loadAllRecipes();
  return all[pipelineId] ?? defaultState();
}

export async function setSelectedRecipe(pipelineId: PipelineId, recipeId: RecipeId): Promise<void> {
  const all = await loadAllRecipes();
  const st = all[pipelineId] ?? defaultState();

  st.selectedRecipeId = recipeId;
  all[pipelineId] = st;

  await saveAllRecipes(all);
}

export async function upsertRecipe(pipelineId: PipelineId, recipe: Omit<PipelineRecipe, "updatedTs">): Promise<void> {
  const all = await loadAllRecipes();
  const st = all[pipelineId] ?? defaultState();

  st.recipesById[recipe.id] = {
    ...recipe,
    updatedTs: now(),
  };

  // If nothing selected yet, select this one.
  if (!st.selectedRecipeId) st.selectedRecipeId = recipe.id;

  all[pipelineId] = st;
  await saveAllRecipes(all);
}

export async function deleteRecipe(pipelineId: PipelineId, recipeId: RecipeId): Promise<void> {
  const all = await loadAllRecipes();
  const st = all[pipelineId];
  if (!st) return;

  delete st.recipesById[recipeId];

  if (st.selectedRecipeId === recipeId) {
    const remaining = Object.keys(st.recipesById);
    st.selectedRecipeId = remaining.length ? remaining[0] : undefined;
  }

  all[pipelineId] = st;
  await saveAllRecipes(all);
}

/**
 * Merge a stored recipe onto a pipeline's op instances.
 *
 * - pipelineOps is the pipeline def ops (instances) from catalogue
 * - patches are sparse deltas keyed by instanceId
 */
export function applyRecipeToPipelineOps<T extends { instanceId: string; enabled?: boolean; override?: any }>(args: {
  pipelineOps: ReadonlyArray<T>;
  recipe?: PipelineRecipe | null;
}): T[] {
  const { pipelineOps, recipe } = args;
  if (!recipe) return pipelineOps.map((x) => ({ ...x }));

  const patchById = new Map<string, OpInstancePatch>();
  for (const p of recipe.ops) patchById.set(p.instanceId, p);

  return pipelineOps.map((inst) => {
    const p = patchById.get(inst.instanceId);
    if (!p) return { ...inst };

    const mergedOverride =
      p.override || inst.override
        ? {
            ...(inst.override ?? {}),
            ...(p.override ?? {}),
            params: {
              ...((inst.override as any)?.params ?? {}),
              ...(p.override?.params ?? {}),
            },
          }
        : undefined;

    // enabled precedence: patch.enabled overrides instance.enabled
    const enabled = typeof p.enabled === "boolean" ? p.enabled : inst.enabled;

    return {
      ...inst,
      enabled,
      override: mergedOverride,
    };
  });
}


export type PipelineRecipeBundle = {
  pipelineId: PipelineId;
  selectedRecipeId?: RecipeId;
  recipes: PipelineRecipe[];
};

/**
 * Convert internal AllRecipes map to an array (portable export format).
 * - Always returns an array (possibly empty).
 */
export function allRecipesToBundles(all: AllRecipes): PipelineRecipeBundle[] {
  const out: PipelineRecipeBundle[] = [];

  for (const [pipelineId, st] of Object.entries(all ?? {})) {
    const recipes = Object.values(st.recipesById ?? {});
    out.push({
      pipelineId,
      selectedRecipeId: st.selectedRecipeId,
      recipes,
    });
  }

  // stable order for diffs
  out.sort((a, b) => a.pipelineId.localeCompare(b.pipelineId));
  return out;
}

/**
 * Convert portable array format back into the internal AllRecipes map.
 * - Tolerant: skips invalid entries.
 * - If duplicates exist for the same pipelineId, later entries win.
 */
export function bundlesToAllRecipes(bundles: unknown): AllRecipes {
  if (!Array.isArray(bundles)) return {};

  const out: AllRecipes = {};

  for (const b of bundles) {
    if (!b || typeof b !== "object") continue;

    const pipelineId = (b as any).pipelineId;
    if (typeof pipelineId !== "string" || !pipelineId) continue;

    const selectedRecipeId = (b as any).selectedRecipeId;
    const recipesArr = (b as any).recipes;

    const recipesById: Record<RecipeId, PipelineRecipe> = {};

    if (Array.isArray(recipesArr)) {
      for (const r of recipesArr) {
        if (!r || typeof r !== "object") continue;
        const id = (r as any).id;
        const title = (r as any).title;
        const updatedTs = (r as any).updatedTs;
        const ops = (r as any).ops;

        if (typeof id !== "string" || !id) continue;
        if (typeof title !== "string" || !title) continue;
        if (typeof updatedTs !== "number") continue;
        if (!Array.isArray(ops)) continue;

        recipesById[id] = r as PipelineRecipe;
      }
    }

    out[pipelineId] = {
      selectedRecipeId: typeof selectedRecipeId === "string" ? selectedRecipeId : undefined,
      recipesById,
    };
  }

  return out;
}
