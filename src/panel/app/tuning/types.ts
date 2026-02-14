// src/panel/app/tuning/types.ts

export type EngineId = "native" | "opencv";

/**
 * Engine policy stored per component.
 * - inherit: defer to parent
 * - native: force native
 * - opencv: force opencv (if available), otherwise fallback
 * - auto: prefer opencv when available, otherwise native
 */
export type EnginePolicy = "inherit" | "native" | "opencv" | "auto";

export type ParamValue = number | boolean | string;

export type ParamSchema =
  | {
      kind: "number";
      label: string;
      min?: number;
      max?: number;
      step?: number;
      default: number;
    }
  | {
      kind: "boolean";
      label: string;
      default: boolean;
    }
  | {
      kind: "text";
      label: string;
      default: string;
    };

export type ComponentId = string;

/**
 * Persisted per-component config (user overrides only).
 * - If a key is missing, registry defaults apply.
 */
export type ComponentConfig = {
  enginePolicy?: EnginePolicy;
  params?: Record<string, ParamValue>;
};

export type ComponentNode = {
  id: ComponentId;

  /** UI label. */
  title: string;

  /** Optional short description for tuning UI. */
  description?: string;

  /**
   * Which engines are implemented for THIS component.
   * (Not "available at runtime", just "we have code for it".)
   */
  implementedEngines: ReadonlyArray<EngineId>;

  /** Default engine policy for this node (usually inherit on children). */
  defaultEnginePolicy: EnginePolicy;

  /** Parameters owned by this node. */
  params: Record<string, ParamSchema>;

  /** Children (subprocesses). */
  children?: ComponentNode[];
};

export type ComponentRegistry = {
  root: ComponentNode;
  byId: Map<ComponentId, ComponentNode>;
  parentById: Map<ComponentId, ComponentId | null>;
};

export type RuntimeEngineAvailability = {
  /** OpenCV is injected and ready in THIS runtime session. */
  opencvReady: boolean;
};

export type ResolvedComponent = {
  id: ComponentId;

  /** Effective policy after inheritance. */
  policy: EnginePolicy;

  /** Engine that will actually run. */
  engine: EngineId;

  /** If forced fallback happened, explain why. */
  fallbackReason?: string;

  /** Effective params after applying defaults + stored overrides. */
  params: Record<string, ParamValue>;
};
