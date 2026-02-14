// src/panel/tabs/pipeline/lib/edge.ts

export type EdgeFromMaskResult = {
  mask: Uint8Array;
  width: number;
  height: number;
};


/**
 * Simple binary edge extraction from a mask.
 * Input mask is expected to be 0/255 (or 0/non-zero).
 * Output mask is 0/255 edges.
 *
 * Strategy:
 * - A pixel is an edge if it is "on" and at least one 4-neighbor is "off".
 * - This produces a 1px outline around foreground regions.
 */
 

/**
 * Binary edge extraction from a mask.
 * Input mask is expected to be 0/255 (or 0/non-zero).
 * Output is a Uint8Array mask (0/255 edges).
 */
export function edgeFromMask(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);

  const idx = (x: number, y: number) => y * width + x;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y);
      const v = mask[i];
      if (v === 0) continue;

      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        out[i] = 255;
        continue;
      }

      const left = mask[idx(x - 1, y)];
      const right = mask[idx(x + 1, y)];
      const up = mask[idx(x, y - 1)];
      const down = mask[idx(x, y + 1)];

      if (left === 0 || right === 0 || up === 0 || down === 0) out[i] = 255;
    }
  }

  return out;
}
