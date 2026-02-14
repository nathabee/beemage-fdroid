// src/panel/platform/opsDispatch.ts
import {
  runOpCore,
  type OpId,
  type OpInputsByOp,
  type OpOutputsByOp,
  type RunOpOverride,
} from "./opsDispatchCore";
import { opImpls, OPS_IMPL_SOURCE } from "./opsDispatchImpl";
import type { MaskOpId, MaskOpInputs } from "./opsDispatchCore";
import { traceScope } from "../app/log";

export async function runOp<K extends OpId>(
  op: K,
  input: OpInputsByOp[K],
  override?: RunOpOverride<K>,
): Promise<OpOutputsByOp[K]> {
  // Console-only trace (dev). This proves which opImpls module got bundled.
  traceScope("[opsDispatch] runOp", {
    op,
    implSource: OPS_IMPL_SOURCE,
    inputKeys: input && typeof input === "object" ? Object.keys(input as any) : typeof input,
    override: override ? { enginePolicy: override.enginePolicy, paramsKeys: Object.keys(override.params ?? {}) } : null,
  });

  return runOpCore(op, input, opImpls, override);
}

// Backwards-compatible wrapper for image code
export async function runMaskOp(op: MaskOpId, input: MaskOpInputs): Promise<Uint8Array> {
  return runOp(op, input);
}
