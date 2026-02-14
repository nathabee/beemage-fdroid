// src/panel/tabs/segmentation/lib/resize.ts

export type ResizeParams = {
  resizeAlgo: number; // 0..3 (we implement 0=nearest, others=bilinear)
  targetMaxW: number; // max width (keep aspect)
};

/**
 * Resize an ImageData while preserving aspect ratio.
 * If width <= targetMaxW, returns the original image.
 */
export function resizeNative(image: ImageData, width: number, height: number, params: ResizeParams): ImageData {
  const targetMaxW = Math.max(1, Math.floor(Number(params.targetMaxW ?? width)));
  if (!width || !height) return image;
  if (width <= targetMaxW) return image;

  const scale = targetMaxW / width;
  const outW = Math.max(1, Math.floor(width * scale));
  const outH = Math.max(1, Math.floor(height * scale));

  const algo = Math.floor(Number(params.resizeAlgo ?? 1));

  if (algo === 0) return resizeNearest(image, width, height, outW, outH);
  return resizeBilinear(image, width, height, outW, outH);
}

function resizeNearest(image: ImageData, w: number, h: number, outW: number, outH: number): ImageData {
  const src = image.data;
  const dst = new Uint8ClampedArray(outW * outH * 4);

  const sx = w / outW;
  const sy = h / outH;

  for (let y = 0; y < outH; y++) {
    const srcY = Math.min(h - 1, Math.max(0, Math.floor((y + 0.5) * sy - 0.5)));
    for (let x = 0; x < outW; x++) {
      const srcX = Math.min(w - 1, Math.max(0, Math.floor((x + 0.5) * sx - 0.5)));

      const si = (srcY * w + srcX) * 4;
      const di = (y * outW + x) * 4;

      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }

  return new ImageData(dst, outW, outH);
}

function resizeBilinear(image: ImageData, w: number, h: number, outW: number, outH: number): ImageData {
  const src = image.data;
  const dst = new Uint8ClampedArray(outW * outH * 4);

  const sx = w / outW;
  const sy = h / outH;

  for (let y = 0; y < outH; y++) {
    const fy = (y + 0.5) * sy - 0.5;
    const y0 = clampInt(Math.floor(fy), 0, h - 1);
    const y1 = clampInt(y0 + 1, 0, h - 1);
    const wy = fy - y0;

    for (let x = 0; x < outW; x++) {
      const fx = (x + 0.5) * sx - 0.5;
      const x0 = clampInt(Math.floor(fx), 0, w - 1);
      const x1 = clampInt(x0 + 1, 0, w - 1);
      const wx = fx - x0;

      const i00 = (y0 * w + x0) * 4;
      const i10 = (y0 * w + x1) * 4;
      const i01 = (y1 * w + x0) * 4;
      const i11 = (y1 * w + x1) * 4;

      const di = (y * outW + x) * 4;

      for (let c = 0; c < 4; c++) {
        const v00 = src[i00 + c];
        const v10 = src[i10 + c];
        const v01 = src[i01 + c];
        const v11 = src[i11 + c];

        const v0 = v00 + (v10 - v00) * wx;
        const v1 = v01 + (v11 - v01) * wx;
        const v = v0 + (v1 - v0) * wy;

        dst[di + c] = clampByte(v);
      }
    }
  }

  return new ImageData(dst, outW, outH);
}

function clampInt(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function clampByte(n: number): number {
  if (n <= 0) return 0;
  if (n >= 255) return 255;
  return n | 0;
}
