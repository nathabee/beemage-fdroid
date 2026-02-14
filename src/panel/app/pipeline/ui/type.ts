// src/panel/app/pipeline/ui/type.ts

export type PortKind = "input" | "output";

/**
 * Keep this flexible:
 * - today: "image" | "mask" | "svg"
 * - tomorrow: could be "regions", "points", etc.
 */
export type PortType = string;

export type OperationPort = {
  kind: PortKind;
  type: PortType;
  label?: string;
};

export type OperationUi = {
  id: string;
  title: string;
  group?: string;

  /**
   * Future-proof multi-port operations.
   * For now catalogue ops are normalized to 1 input / 1 output.
   */
  inputs: OperationPort[];
  outputs: OperationPort[];
};
