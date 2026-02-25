// src/panel/tabs/pipeline/model.ts
import { createPipelineCatalogue } from "../../app/pipeline/catalogue";
import { runPipelineDef } from "../../app/pipeline/runner";
import { loadUserPipelines } from "../../app/pipeline/userPipelineStore";
import type { AllRecipes } from "../../app/pipeline/recipeStore";
import { loadAllRecipes } from "../../app/pipeline/recipeStore";

import type {
  Artifact,
  ArtifactType,
  OpSpec,
  PipelineCatalogue,
  PipelineDef,
  PipelineId,
  PipelineRunnerDeps,
  PipelineRunResult,
  OpRunResult,
} from "../../app/pipeline/type";

export type RunState = "idle" | "ok" | "error";
export type PipelineRecipeId = string;

export type OpVm = {
  instanceId: string;
  opId: string;
  title: string;
  input: ArtifactType;
  output: ArtifactType;
  state: RunState;
  error?: string;
  outputArtifact?: Artifact;
};

export type StageVm = {
  stageId: string;
  title: string;
  input: ArtifactType;
  output: ArtifactType;
  ops: OpVm[];
  state: RunState;
  error?: string;
  outputArtifact?: Artifact;
};

export type PipelineVm = {
  pipelines: Array<{ id: PipelineId; title: string }>;
  recipes: Array<{ id: PipelineRecipeId; title: string }>;

  activePipelineId: PipelineId;
  activeRecipeId: PipelineRecipeId;

  statusText: string;

  description?: string;

  stages: StageVm[];

  input?: { width: number; height: number; data: ImageData };

  outputImage?: { width: number; height: number; data: ImageData };
  outputMask?: { width: number; height: number; data: Uint8Array };
  outputSvg?: { width: number; height: number; svg: string };

  nextIndex: number;
  totalOps: number;
};

 

export type PipelineModel = {
  getVm(): PipelineVm;

  setActivePipeline(id: PipelineId): void;
  setActiveRecipe(id: PipelineRecipeId): void;

  setInputImageData(img: ImageData): void;

  // NEW:
  setInputArtifact(a: Artifact): void;

  runAll(): Promise<void>;
  runNext(): Promise<void>;
  reset(): void;

  reloadCatalogue(): Promise<void>;
};

export type PipelineModelDeps = {
  runner: PipelineRunnerDeps;
};

type RecipeDef = {
  id: PipelineRecipeId;
  title: string;
  buildPipeline: (base: PipelineDef) => PipelineDef;
};

type PlannedStep = {
  index0: number;
  instanceId: string;
  opSpec: OpSpec;
};

function isImage(a: Artifact): a is Extract<Artifact, { type: "image" }> {
  return a.type === "image";
}
function isMask(a: Artifact): a is Extract<Artifact, { type: "mask" }> {
  return a.type === "mask";
}
function isSvg(a: Artifact): a is Extract<Artifact, { type: "svg" }> {
  return a.type === "svg";
}

export function createPipelineModel(deps: PipelineModelDeps): PipelineModel {
  // IMPORTANT: catalogue is no longer const. We rebuild it when user pipelines change.
  let catalogue: PipelineCatalogue = createPipelineCatalogue({ userPipelines: [] });
  let allRecipes: AllRecipes = {} as any;

  const firstPipelineId: PipelineId =
    ((catalogue.listPipelines?.()?.[0]?.id ?? catalogue.builtIns[0]?.id) ?? "segmentation") as PipelineId;

  let activePipelineId: PipelineId = firstPipelineId;
  let activeRecipeId: PipelineRecipeId = "default";

  let input: Artifact | null = null;

  let statusText = "Idle";
  let lastResult: PipelineRunResult | null = null;

  // For Next-step runs
  let plan: PlannedStep[] = [];
  let nextIndex = 0;
  let currentArtifact: Artifact | null = null;

  async function reloadCatalogue(): Promise<void> {
    const prevPipelineId = activePipelineId;
    const prevRecipeId = activeRecipeId;

    const userPipelines = await loadUserPipelines().catch(() => []);
    catalogue = createPipelineCatalogue({ userPipelines });

    // Load all stored recipes (created/imported via Builder)
    allRecipes = await loadAllRecipes().catch(() => ({} as any));

    // If the currently selected pipeline id no longer exists, fall back to first available.
    const all = catalogue.listPipelines?.() ?? catalogue.builtIns;
    const pipelineExists = all.some((p) => p.id === activePipelineId);

    if (!pipelineExists) {
      activePipelineId = (all[0]?.id ?? "segmentation") as PipelineId;
      activeRecipeId = "default";
    }

    // If current recipe doesn't exist for current pipeline, fall back to default
    const base = catalogue.getPipeline?.(activePipelineId) ?? catalogue.listPipelines?.()?.[0];
    if (base) {
      const recipes = makeRecipesForPipeline(base);
      const recipeOk = recipes.some((r) => r.id === activeRecipeId);
      if (!recipeOk) activeRecipeId = "default";
    } else {
      activeRecipeId = "default";
    }

    const selectionChanged = prevPipelineId !== activePipelineId || prevRecipeId !== activeRecipeId;

    if (selectionChanged) {
      // Selection invalidated (deleted pipeline or recipe) → full reset is correct.
      resetRunState();
      return;
    }

    // Selection is still valid:
    // - keep lastResult/output so user doesn't lose their preview
    // - but invalidate step-plan because opSpec references can become stale
    plan = [];
    nextIndex = 0;

    // statusText/lastResult/currentArtifact stay as-is by design
  }



  function getBasePipeline(): PipelineDef {
    const p = catalogue.getPipeline?.(activePipelineId) ?? catalogue.listPipelines?.()?.[0];
    if (!p) throw new Error("[pipeline] No pipelines available.");
    return p;
  }

  function makeRecipesForPipeline(pipeline: PipelineDef): RecipeDef[] {
    const defDefault: RecipeDef = {
      id: "default",
      title: "Default",
      buildPipeline: (base) => base,
    };

    // AllRecipes shape in your project (from builder):
    // { [pipelineId]: { selectedRecipeId?: string; recipesById: { [rid]: { id, title, ops } } } }
    const st = (allRecipes as any)?.[pipeline.id];
    const recipesById = st?.recipesById ?? {};

    const defs: RecipeDef[] = [defDefault];

    for (const rid of Object.keys(recipesById)) {
      const r = recipesById[rid];
      if (!r || typeof r.id !== "string") continue;

      defs.push({
        id: String(r.id),
        title: typeof r.title === "string" && r.title.trim().length ? r.title : String(r.id),
        buildPipeline: (base) => {
          // Recipe ops should be compatible with PipelineDef.ops.
          const opsRaw = Array.isArray(r.ops) ? r.ops : null;
          if (!opsRaw) return base;

          // Defensive normalization: keep only fields your runner expects.
          const ops = opsRaw
            .filter((x: any) => x && typeof x === "object")
            .map((x: any) => ({
              instanceId: typeof x.instanceId === "string" ? x.instanceId : String(x.instanceId ?? ""),
              opId: typeof x.opId === "string" ? x.opId : String(x.opId ?? ""),
              enabled: x.enabled === undefined ? true : !!x.enabled,
            }))
            .filter((x: any) => x.instanceId && x.opId);

          if (!ops.length) return base;

          return {
            ...base,
            ops,
          };
        },
      });
    }

    // Stable ordering: Default first, then by title
    return defs.slice(0, 1).concat(
      defs
        .slice(1)
        .sort((a, b) => String(a.title).localeCompare(String(b.title))),
    );
  }

  function getActivePipelineDef(): PipelineDef {
    const base = getBasePipeline();
    const recipes = makeRecipesForPipeline(base);
    const r = recipes.find((x) => x.id === activeRecipeId) ?? recipes[0]!;
    activeRecipeId = r.id;
    return r.buildPipeline(base);
  }

  function resetRunState(): void {
    statusText = getActivePipelineDef().implemented ? "Ready" : "Not implemented yet";
    lastResult = null;

    plan = [];
    nextIndex = 0;
    currentArtifact = null;
  }

  function reset(): void {
    resetRunState();
  }

  function setActivePipeline(id: PipelineId): void {
    if (id === activePipelineId) return;

    const p = catalogue.getPipeline?.(id) ?? catalogue.getBuiltIn?.(id);
    if (!p) return;

    activePipelineId = id;
    activeRecipeId = "default";
    reset();
  }

  function setActiveRecipe(id: PipelineRecipeId): void {
    if (id === activeRecipeId) return;

    const base = getBasePipeline();
    const recipes = makeRecipesForPipeline(base);

    const exists = recipes.some((r) => r.id === id);
    activeRecipeId = exists ? id : "default";

    reset();
  }

function setInputArtifact(a: Artifact): void {
  input = a;
  resetRunState();
}

function setInputImageData(img: ImageData): void {
  setInputArtifact({ type: "image", width: img.width, height: img.height, image: img });
}

  function buildPlanFromPipeline(p: PipelineDef): PlannedStep[] {
    const enabled = p.ops.filter((x) => x.enabled !== false);
    const out: PlannedStep[] = [];

    for (let i = 0; i < enabled.length; i++) {
      const inst = enabled[i]!;
      const spec = catalogue.getOp(inst.opId);
      if (!spec) continue;
      out.push({ index0: i, instanceId: inst.instanceId, opSpec: spec });
    }

    return out;
  }

  function mapResultToSingleStage(result: PipelineRunResult): StageVm[] {
    const ops: OpVm[] = result.ops.map((op: OpRunResult): OpVm => {
      return {
        instanceId: op.instanceId,
        opId: op.opId,
        title: op.title,
        input: op.io.input,
        output: op.io.output,
        state: op.status === "ok" ? "ok" : op.status === "error" ? "error" : "idle",
        error: op.error,
        outputArtifact: op.output,
      };
    });

    const stageState: RunState = result.status === "ok" ? "ok" : "error";
    const stageOut = result.output ?? ops.slice().reverse().find((x) => x.outputArtifact)?.outputArtifact;

    return [
      {
        stageId: "pipeline",
        title: "Pipeline",
        input: result.input.type,
        output: stageOut?.type ?? "image",
        ops,
        state: stageState,
        error: result.error,
        outputArtifact: stageOut,
      },
    ];
  }

  function applyOutputsToVm(vm: PipelineVm, out: Artifact | null): void {
    if (!out) return;

    if (isImage(out)) {
      vm.outputImage = { width: out.width, height: out.height, data: out.image };
    } else if (isMask(out)) {
      vm.outputMask = { width: out.width, height: out.height, data: out.mask };
    } else if (isSvg(out)) {
      vm.outputSvg = { width: out.width, height: out.height, svg: out.svg };
    }
  }

async function runAll(): Promise<void> {
  const p = getActivePipelineDef();
  if (!p.implemented) {
    statusText = "Not implemented yet";
    return;
  }
  if (!input) {
    statusText = "No input";
    return;
  }

  statusText = "Running all…";

  const result = await runPipelineDef({
    catalogue,
    pipeline: p,
    input, // Artifact
    deps: deps.runner,
  });

  lastResult = result;

  plan = buildPlanFromPipeline(p);
  nextIndex = plan.length;
  currentArtifact = result.output ?? null;

  statusText = result.status === "ok" ? "Done" : result.error ?? "Error";
}
 

async function runNext(): Promise<void> {
  const p = getActivePipelineDef();
  if (!p.implemented) {
    statusText = "Not implemented yet";
    return;
  }
  if (!input) {
    statusText = "No input";
    return;
  }

  if (plan.length === 0) {
    plan = buildPlanFromPipeline(p);
    nextIndex = 0;

    currentArtifact = input;

    lastResult = {
      pipelineId: p.id,
      title: p.title,
      status: "ok",
      input,
      output: input,
      ops: [],
    };
  }

  if (nextIndex >= plan.length) {
    statusText = "Done";
    return;
  }

  const step = plan[nextIndex]!;
  const spec = step.opSpec;

  if (!currentArtifact) {
    currentArtifact = input;
  }

  try {
    statusText = `Running: ${spec.title}`;

    // IO check (input)
    if (currentArtifact.type !== spec.io.input) {
      throw new Error(`IO mismatch: expected ${spec.io.input}, got ${currentArtifact.type}`);
    }

    const params = spec.tuningId ? await deps.runner.getEffectiveParams(spec.tuningId).catch(() => ({})) : {};

    let out: Artifact;

    if (spec.kind === "dispatch") {
      const { runOp } = await import("../../platform/opsDispatch");

      if (currentArtifact.type === "image") {
        const raw = await runOp(
          spec.dispatchId as any,
          { image: currentArtifact.image, width: currentArtifact.width, height: currentArtifact.height } as any,
        );

        if (spec.io.output === "image") {
          const img = raw as ImageData;
          out = { type: "image", width: img.width, height: img.height, image: img };
        } else if (spec.io.output === "mask") {
          out = { type: "mask", width: currentArtifact.width, height: currentArtifact.height, mask: raw as Uint8Array };
        } else if (spec.io.output === "svg") {
          out = { type: "svg", width: currentArtifact.width, height: currentArtifact.height, svg: raw as string };
        } else {
          throw new Error(`Unsupported dispatch output: ${spec.io.output}`);
        }
      } else if (currentArtifact.type === "mask") {
        const raw = await runOp(
          spec.dispatchId as any,
          { mask: (currentArtifact as any).mask, width: currentArtifact.width, height: currentArtifact.height } as any,
        );

        if (spec.io.output === "mask") {
          out = { type: "mask", width: currentArtifact.width, height: currentArtifact.height, mask: raw as Uint8Array };
        } else if (spec.io.output === "svg") {
          out = { type: "svg", width: currentArtifact.width, height: currentArtifact.height, svg: raw as string };
        } else {
          throw new Error(`Invalid dispatch output: ${spec.io.output}`);
        }
      } else {
        // IMPORTANT: dispatch ops do not support svg/imageList/pdf inputs
        throw new Error(`Dispatch ops cannot take ${currentArtifact.type} input.`);
      }
    } else {
      out = await spec.run({ input: currentArtifact, params });
    }

    // IO check (output)
    if (out.type !== spec.io.output) {
      throw new Error(`IO mismatch: expected ${spec.io.output}, got ${out.type}`);
    }

    const prevOps = lastResult?.ops ?? [];
    const nextOps: OpRunResult[] = prevOps.concat([
      { instanceId: step.instanceId, opId: spec.id, title: spec.title, io: spec.io, status: "ok", output: out },
    ]);

    lastResult = {
      pipelineId: p.id,
      title: p.title,
      status: "ok",
      input,
      output: out,
      ops: nextOps,
    };

    currentArtifact = out;
    nextIndex += 1;

    statusText = nextIndex >= plan.length ? "Done" : "Ready";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    statusText = `Error: ${spec.title} — ${msg}`;

    const prevOps = lastResult?.ops ?? [];
    const nextOps: OpRunResult[] = prevOps.concat([
      { instanceId: step.instanceId, opId: spec.id, title: spec.title, io: spec.io, status: "error", error: msg },
    ]);

    lastResult = {
      pipelineId: p.id,
      title: p.title,
      status: "error",
      error: msg,
      input,
      ops: nextOps,
    };

    deps.runner.debug("pipeline next-step failed", {
      pipelineId: p.id,
      recipeId: activeRecipeId,
      instanceId: step.instanceId,
      opId: spec.id,
      error: msg,
    });
  }
}


  function getVm(): PipelineVm {
    const base = getBasePipeline();
    const pipeline = getActivePipelineDef();
    const recipes = makeRecipesForPipeline(base);

    const all = catalogue.listPipelines?.() ?? catalogue.builtIns;
    const pipelines = all.map((x: PipelineDef) => ({ id: x.id, title: x.title }));

    const vm: PipelineVm = {
      pipelines,
      recipes: recipes.map((r) => ({ id: r.id, title: r.title })),

      activePipelineId,
      activeRecipeId,

      statusText,
      description: pipeline.description,

      stages: lastResult ? mapResultToSingleStage(lastResult) : [],

      input: input && input.type === "image"
  ? { width: input.width, height: input.height, data: input.image }
  : undefined,

      nextIndex,
      totalOps: plan.length || pipeline.ops.filter((x) => x.enabled !== false).length,
    };

    const out = lastResult?.output ?? currentArtifact ?? null;
    applyOutputsToVm(vm, out);

    return vm;
  }

  // Initial state
  reset();

return {
  getVm,
  setActivePipeline,
  setActiveRecipe,
  setInputImageData,
  setInputArtifact, // NEW
  runAll,
  runNext,
  reset,
  reloadCatalogue,
};
}
