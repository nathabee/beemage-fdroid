// src/panel/tabs/segmentation/lib/color.ts

export type ColorParams = {
  colorMode: number; // 0..3
  hsvChannel: number; // 0..2
};

export function colorNative(image: ImageData, width: number, height: number, params: ColorParams): ImageData {
  if (!width || !height) return image;

  const mode = Math.floor(Number(params.colorMode ?? 1));
  if (mode === 0) return image;

  const src = image.data;
  const dst = new Uint8ClampedArray(width * height * 4);

  const ch = clampInt(Math.floor(Number(params.hsvChannel ?? 2)), 0, 2);

  for (let p = 0, i = 0; p < width * height; p++, i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const a = src[i + 3];

    let y = 0;

    if (mode === 1) {
      // fast luminance approx (0..255)
      y = (r * 77 + g * 150 + b * 29) >> 8;
    } else if (mode === 2) {
      // HSV channel as grayscale feature
      const hsv = rgbToHsv01(r, g, b);
      const v = ch === 0 ? hsv.h : ch === 1 ? hsv.s : hsv.v;
      y = clampByte(v * 255);
    } else {
      // mode === 3: inverted luminance
      const lum = (r * 77 + g * 150 + b * 29) >> 8;
      y = 255 - lum;
    }

    dst[i] = y;
    dst[i + 1] = y;
    dst[i + 2] = y;
    dst[i + 3] = a;
  }

  return new ImageData(dst, width, height);
}

function rgbToHsv01(r8: number, g8: number, b8: number): { h: number; s: number; v: number } {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }

  const s = max === 0 ? 0 : d / max;
  const v = max;

  return { h, s, v };
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
