// src/panel/tabs/segmentation/lib/threshold.ts

export type ThresholdParams = {
  manualT: number; // 0..255
};

export function thresholdManual(image: ImageData, width: number, height: number, params: ThresholdParams): Uint8Array {
  const t = Math.max(0, Math.min(255, Math.floor(Number(params.manualT ?? 128))));

  const out = new Uint8Array(width * height);
  const d = image.data;

  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    // fast luminance approx (0..255)
    const y = (r * 77 + g * 150 + b * 29) >> 8;
    out[p] = y >= t ? 1 : 0;
  }

  return out;
}

