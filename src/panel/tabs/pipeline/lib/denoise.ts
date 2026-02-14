// src/panel/tabs/segmentation/lib/denoise.ts

export type DenoiseParams = {
  denoiseAlgo: number; // 0..2 (0=none, 1=box blur, 2=median 3x3 fallback to blur for large k)
  blurK: number;       // odd >=1
  bilateralSigma: number; // ignored in native for now (kept for schema parity)
};

export function denoiseNative(image: ImageData, width: number, height: number, params: DenoiseParams): ImageData {
  if (!width || !height) return image;

  const algo = Math.floor(Number(params.denoiseAlgo ?? 1));
  if (algo <= 0) return image;

  const kRaw = Math.floor(Number(params.blurK ?? 3));
  const k = normalizeOddKernel(kRaw);

  if (algo === 2 && k <= 3) {
    // Median 3x3 only (kept intentionally small for predictable cost).
    return median3x3(image, width, height);
  }

  // Default: separable box blur (very fast, good enough as a native baseline).
  if (k <= 1) return image;
  return boxBlurSeparable(image, width, height, k);
}

function normalizeOddKernel(k: number): number {
  if (!Number.isFinite(k)) return 3;
  if (k < 1) return 1;
  if (k % 2 === 0) return k + 1;
  return k;
}

function boxBlurSeparable(image: ImageData, w: number, h: number, k: number): ImageData {
  const r = (k - 1) >> 1;
  const src = image.data;

  // First pass: horizontal into temp
  const tmp = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;

    // init window
    for (let dx = -r; dx <= r; dx++) {
      const x = clampInt(dx, 0, w - 1);
      const i = (y * w + x) * 4;
      sumR += src[i];
      sumG += src[i + 1];
      sumB += src[i + 2];
      sumA += src[i + 3];
    }

    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;
      tmp[di] = (sumR / k) | 0;
      tmp[di + 1] = (sumG / k) | 0;
      tmp[di + 2] = (sumB / k) | 0;
      tmp[di + 3] = (sumA / k) | 0;

      // slide window: remove left, add right
      const xOut = clampInt(x - r, 0, w - 1);
      const xIn = clampInt(x + r + 1, 0, w - 1);

      const iOut = (y * w + xOut) * 4;
      const iIn = (y * w + xIn) * 4;

      sumR += src[iIn] - src[iOut];
      sumG += src[iIn + 1] - src[iOut + 1];
      sumB += src[iIn + 2] - src[iOut + 2];
      sumA += src[iIn + 3] - src[iOut + 3];
    }
  }

  // Second pass: vertical into dst
  const dst = new Uint8ClampedArray(w * h * 4);

  for (let x = 0; x < w; x++) {
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;

    for (let dy = -r; dy <= r; dy++) {
      const y = clampInt(dy, 0, h - 1);
      const i = (y * w + x) * 4;
      sumR += tmp[i];
      sumG += tmp[i + 1];
      sumB += tmp[i + 2];
      sumA += tmp[i + 3];
    }

    for (let y = 0; y < h; y++) {
      const di = (y * w + x) * 4;
      dst[di] = (sumR / k) | 0;
      dst[di + 1] = (sumG / k) | 0;
      dst[di + 2] = (sumB / k) | 0;
      dst[di + 3] = (sumA / k) | 0;

      const yOut = clampInt(y - r, 0, h - 1);
      const yIn = clampInt(y + r + 1, 0, h - 1);

      const iOut = (yOut * w + x) * 4;
      const iIn = (yIn * w + x) * 4;

      sumR += tmp[iIn] - tmp[iOut];
      sumG += tmp[iIn + 1] - tmp[iOut + 1];
      sumB += tmp[iIn + 2] - tmp[iOut + 2];
      sumA += tmp[iIn + 3] - tmp[iOut + 3];
    }
  }

  return new ImageData(dst, w, h);
}

function median3x3(image: ImageData, w: number, h: number): ImageData {
  const src = image.data;
  const dst = new Uint8ClampedArray(w * h * 4);

  const wr = new Array<number>(9);
  const wg = new Array<number>(9);
  const wb = new Array<number>(9);
  const wa = new Array<number>(9);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = clampInt(y + dy, 0, h - 1);
        for (let dx = -1; dx <= 1; dx++) {
          const xx = clampInt(x + dx, 0, w - 1);
          const i = (yy * w + xx) * 4;
          wr[n] = src[i];
          wg[n] = src[i + 1];
          wb[n] = src[i + 2];
          wa[n] = src[i + 3];
          n++;
        }
      }

      wr.sort(numAsc);
      wg.sort(numAsc);
      wb.sort(numAsc);
      wa.sort(numAsc);

      const di = (y * w + x) * 4;
      dst[di] = wr[4] | 0;
      dst[di + 1] = wg[4] | 0;
      dst[di + 2] = wb[4] | 0;
      dst[di + 3] = wa[4] | 0;
    }
  }

  return new ImageData(dst, w, h);
}

function numAsc(a: number, b: number): number {
  return a - b;
}

function clampInt(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
