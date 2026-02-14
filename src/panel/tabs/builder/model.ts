// src/panel/tabs/builder/model.ts

import type { PipelineDef, OpSpec } from "../../app/pipeline/type";
import { createPipelineCatalogue } from "../../app/pipeline/catalogue";
import type { AllRecipes } from "../../app/pipeline/recipeStore";

import { loadUserPipelines, saveUserPipelines, upsertUserPipeline, deleteUserPipeline } from "../../app/pipeline/userPipelineStore";
import type { PipelineRecipeBundle } from "../../app/pipeline/recipeStore";
import {
  loadAllRecipes,
  saveAllRecipes,
  allRecipesToBundles,
  bundlesToAllRecipes,
  setSelectedRecipe as setSelectedRecipeStore,
  upsertRecipe as upsertRecipeStore,
  deleteRecipe as deleteRecipeStore,
} from "../../app/pipeline/recipeStore";

import { emitPipelineStorageChanged } from "../../app/pipeline/storageSignals";


export type BuilderExportFileV2 = {
  format: "beemage.pipeline.userPipelines.v2";
  exportedAt: string; // ISO
  pipelines: PipelineDef[];
  recipes?: PipelineRecipeBundle[]; // optional but if present, always an array
};


export type BuilderImportResult = {
  imported: number;
  skipped: number;
  totalInFile: number;
};

export type BuilderModel = {
  listUserPipelines(): Promise<PipelineDef[]>;
  listOperations(): ReadonlyArray<OpSpec>;

  // import/export
  importFromJsonText(jsonText: string): Promise<BuilderImportResult>;
  exportToJsonText(): Promise<string>;

  // NEW: recipes + management
  listAllRecipes(): Promise<AllRecipes>;
  deleteUserPipelineById(pipelineId: string): Promise<void>;
  upsertUserPipeline(p: PipelineDef): Promise<void>;

  setSelectedRecipe(pipelineId: string, recipeId: string): Promise<void>;
  upsertRecipe(pipelineId: string, recipe: { id: string; title: string; ops: any[] }): Promise<void>;
  deleteRecipe(pipelineId: string, recipeId: string): Promise<void>;

  deleteAllRecipesForPipeline(pipelineId: string): Promise<void>;
};


function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

function isPipelineDef(x: unknown): x is PipelineDef {
  if (!isObject(x)) return false;

  if (typeof (x as any).id !== "string" || !(x as any).id) return false;
  if (typeof (x as any).title !== "string" || !(x as any).title) return false;
  if (typeof (x as any).implemented !== "boolean") return false;
  if (!Array.isArray((x as any).ops)) return false;

  for (const op of (x as any).ops) {
    if (!isObject(op)) return false;
    if (typeof (op as any).instanceId !== "string" || !(op as any).instanceId) return false;
    if (typeof (op as any).opId !== "string" || !(op as any).opId) return false;
    if ((op as any).enabled !== undefined && typeof (op as any).enabled !== "boolean") return false;
  }

  return true;
}

export function createBuilderModel(): BuilderModel {
  // Ops are the global library shipped in the catalogue.
  // User pipelines do not define ops; they only reference opIds.
  const catalogue = createPipelineCatalogue({ userPipelines: [] });

  async function listUserPipelines(): Promise<PipelineDef[]> {
    return await loadUserPipelines().catch(() => []);
  }

  function listOperations(): ReadonlyArray<OpSpec> {
    return catalogue.ops;
  }

  async function listAllRecipes(): Promise<AllRecipes> {
    return await loadAllRecipes().catch(() => ({} as any));
  }

  async function deleteUserPipelineById(pipelineId: string): Promise<void> {
    await deleteUserPipeline(pipelineId).catch(() => null);

    emitPipelineStorageChanged({
      kind: "userPipelines",
      reason: "delete",
      pipelineId,
    });
  }


  async function upsertUserPipelineApi(p: PipelineDef): Promise<void> {
    await upsertUserPipeline(p).catch(() => null);

    emitPipelineStorageChanged({
      kind: "userPipelines",
      reason: "upsert",
      pipelineId: p.id,
    });
  }

  async function deleteAllRecipesForPipeline(pipelineId: string): Promise<void> {
    const all = await loadAllRecipes().catch(() => ({} as any));
    if (!all || typeof all !== "object") return;

    delete (all as any)[pipelineId];
    await saveAllRecipes(all as any).catch(() => null);

    emitPipelineStorageChanged({
      kind: "recipes",
      reason: "deleteAllForPipeline",
      pipelineId,
    });
  }



  async function setSelectedRecipeApi(pipelineId: string, recipeId: string): Promise<void> {
    await setSelectedRecipeStore(pipelineId, recipeId).catch(() => null);

    emitPipelineStorageChanged({
      kind: "recipes",
      reason: "select",
      pipelineId,
      recipeId,
    });
  }


  async function upsertRecipeApi(
    pipelineId: string,
    recipe: { id: string; title: string; ops: any[] },
  ): Promise<void> {
    await upsertRecipeStore(pipelineId, recipe as any).catch(() => null);

    emitPipelineStorageChanged({
      kind: "recipes",
      reason: "upsert",
      pipelineId,
      recipeId: recipe.id,
    });
  }


  async function deleteRecipeApi(pipelineId: string, recipeId: string): Promise<void> {
    await deleteRecipeStore(pipelineId, recipeId).catch(() => null);

    emitPipelineStorageChanged({
      kind: "recipes",
      reason: "delete",
      pipelineId,
      recipeId,
    });
  }

  async function importFromJsonText(jsonText: string): Promise<BuilderImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error("Invalid JSON (parse failed).");
    }

    // Accept:
    // A) { format, pipelines: [...] } (v1 or v2)
    // B) [...] (raw PipelineDef[])
    let pipelinesRaw: unknown;
    let recipesRaw: unknown = undefined;

    if (Array.isArray(parsed)) {
      pipelinesRaw = parsed;
    } else if (isObject(parsed) && Array.isArray((parsed as any).pipelines)) {
      pipelinesRaw = (parsed as any).pipelines;
      recipesRaw = (parsed as any).recipes; // v2 optional (array)
    } else {
      throw new Error('Invalid file shape. Expected {"pipelines":[...]} or an array of pipelines.');
    }

    const incoming = pipelinesRaw as unknown[];
    const totalInFile = incoming.length;

    const valid: PipelineDef[] = [];
    let skipped = 0;

    for (const p of incoming) {
      if (!isPipelineDef(p)) {
        skipped++;
        continue;
      }
      valid.push(p);
    }

    if (valid.length === 0) {
      throw new Error("No valid pipelines found in the imported file.");
    }

    // Merge by id: imported pipelines override existing ones.
    const existing = await loadUserPipelines().catch(() => []);
    const byId = new Map<string, PipelineDef>();
    for (const p of existing) byId.set(p.id, p);
    for (const p of valid) byId.set(p.id, p);

    await saveUserPipelines(Array.from(byId.values()));

    emitPipelineStorageChanged({
      kind: "userPipelines",
      reason: "import",
    });

    // Import recipes if provided (array-only).
    if (recipesRaw !== undefined) {
      if (!Array.isArray(recipesRaw)) {
        throw new Error('Invalid "recipes" shape. Expected an array (or omit the field).');
      }
      const all: AllRecipes = bundlesToAllRecipes(recipesRaw);
      await saveAllRecipes(all).catch(() => null);

      emitPipelineStorageChanged({
        kind: "recipes",
        reason: "import",
      });
    }

    return { imported: valid.length, skipped, totalInFile };
  }


  async function exportToJsonText(): Promise<string> {
    const pipelines = await loadUserPipelines().catch(() => []);
    const all = await loadAllRecipes().catch(() => ({} as any));

    const file: BuilderExportFileV2 = {
      format: "beemage.pipeline.userPipelines.v2",
      exportedAt: new Date().toISOString(),
      pipelines,
      recipes: allRecipesToBundles(all), // always array (possibly empty)
    };

    return JSON.stringify(file, null, 2);
  }

  return {
    listUserPipelines,
    listOperations,
    importFromJsonText,
    exportToJsonText,

    listAllRecipes,
    deleteUserPipelineById,
    upsertUserPipeline: upsertUserPipelineApi,

    setSelectedRecipe: setSelectedRecipeApi,
    upsertRecipe: upsertRecipeApi,
    deleteRecipe: deleteRecipeApi,

    deleteAllRecipesForPipeline,
  };
}



