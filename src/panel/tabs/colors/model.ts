// src/panel/tabs/colors/model.ts

export type FillSettings = {
  edgesDark: boolean;      // true: dark edges on light bg; false: light edges on dark bg
  edgeThreshold: number;   // 0..255
  edgeDilate: number;      // 0..6
  maxRegionPx: number;     // safety cap
};

export type Preview = {
  mask: Uint8Array;        // 1 => in region
  outline: Uint8Array;     // 1 => boundary pixel
  w: number;
  h: number;
};

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}

function luma(r: number, g: number, b: number): number {
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

export function sanitizeSettings(s: Partial<FillSettings>): FillSettings {
  return {
    edgesDark: !!(s.edgesDark ?? true),
    edgeThreshold: clampInt(s.edgeThreshold ?? 80, 0, 255),
    edgeDilate: clampInt(s.edgeDilate ?? 2, 0, 6),
    maxRegionPx: clampInt(s.maxRegionPx ?? 200000, 1000, 10_000_000),
  };
}

function buildEdgeMask(img: ImageData, edgesDark: boolean, edgeThreshold: number): Uint8Array {
  const { data, width, height } = img;
  const mask = new Uint8Array(width * height);

  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    const r = data[i + 0], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a === 0) {
      // transparent counts as background, not an edge
      mask[p] = 0;
      continue;
    }
    const lum = luma(r, g, b);
    const isEdge = edgesDark ? (lum <= edgeThreshold) : (lum >= (255 - edgeThreshold));
    mask[p] = isEdge ? 1 : 0;
  }
  return mask;
}

function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask;
  let cur = mask;
  for (let iter = 0; iter < r; iter++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (cur[idx]) {
          next[idx] = 1;
          continue;
        }
        // 8-neighborhood
        let on = 0;
        for (let dy = -1; dy <= 1 && !on; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            if (cur[yy * w + xx]) { on = 1; break; }
          }
        }
        next[idx] = on;
      }
    }
    cur = next;
  }
  return cur;
}

function floodFill(
  startX: number,
  startY: number,
  edge: Uint8Array,
  w: number,
  h: number,
  maxPx: number
): { ok: true; mask: Uint8Array } | { ok: false; message: string } {
  const idx0 = startY * w + startX;
  if (edge[idx0]) return { ok: false, message: "Click is on an edge; pick inside a region." };

  const mask = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let qh = 0, qt = 0;

  qx[qt] = startX;
  qy[qt] = startY;
  qt++;
  mask[idx0] = 1;

  let count = 1;

  while (qh < qt) {
    const x = qx[qh];
    const y = qy[qh];
    qh++;

    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (mask[ni]) continue;
      if (edge[ni]) continue;

      mask[ni] = 1;
      qx[qt] = nx;
      qy[qt] = ny;
      qt++;
      count++;

      if (count > maxPx) {
        return { ok: false, message: `Region too large (>${maxPx}px). Increase Max region or fix gaps.` };
      }
    }
  }

  return { ok: true, mask };
}

function computeOutline(mask: Uint8Array, edge: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;

      // boundary if any 4-neighbor is not in mask OR is edge
      const n = (y - 1) * w + x;
      const s = (y + 1) * w + x;
      const wI = y * w + (x - 1);
      const eI = y * w + (x + 1);

      if (!mask[n] || !mask[s] || !mask[wI] || !mask[eI] || edge[n] || edge[s] || edge[wI] || edge[eI]) {
        out[i] = 1;
      }
    }
  }
  return out;
}

export function makePreviewFromClick(
  baseImg: ImageData,
  clickX: number,
  clickY: number,
  settings: FillSettings
): { ok: true; preview: Preview } | { ok: false; message: string } {
  const s = sanitizeSettings(settings);
  const w = baseImg.width;
  const h = baseImg.height;

  let edge = buildEdgeMask(baseImg, s.edgesDark, s.edgeThreshold);
  edge = dilate(edge, w, h, s.edgeDilate);

  const ff = floodFill(clickX, clickY, edge, w, h, s.maxRegionPx);
  if (!ff.ok) return { ok: false, message: ff.message };

  const outline = computeOutline(ff.mask, edge, w, h);
  return { ok: true, preview: { mask: ff.mask, outline, w, h } };
}

export function applyFillToImage(
  baseImg: ImageData,
  preview: Preview,
  hex: string
): ImageData {
  const out = new ImageData(new Uint8ClampedArray(baseImg.data), baseImg.width, baseImg.height);

  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);

  const d = out.data;
  for (let p = 0, i = 0; p < preview.mask.length; p++, i += 4) {
    if (!preview.mask[p]) continue;
    // keep alpha as-is
    d[i + 0] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  return out;
}
