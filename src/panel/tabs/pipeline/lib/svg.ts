// src/panel/tabs/pipeline/lib/svg.ts

export type SvgCreateParams = {
  // Pixel size in SVG units for each source pixel.
  // 1 => same size, 2 => twice as large, etc.
  scale: number;

  // If true, background is transparent (no rect).
  transparentBg: boolean;

  // Fill color of drawn edge pixels.
  color: string;
};

/**
 * MVP: convert an edge mask (0/255) to an SVG by stamping 1x1 squares
 * for every "on" pixel, scaled by params.scale.
 *
 * Pros: trivial, robust, no complex tracing.
 * Cons: many tiny shapes (large SVG). Next step is image tracing.
 */
export function edgeMaskToSvg(
  edgeMask: Uint8Array,
  width: number,
  height: number,
  params: SvgCreateParams,
): string {
  const scale = Math.max(1, Math.floor(params.scale || 1));
  const outW = width * scale;
  const outH = height * scale;

  // Build a single path containing many rect subpaths to reduce DOM nodes.
  // Each pixel: "M x y h s v s h -s Z"
  const s = scale;
  let d = "";

  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      const v = edgeMask[rowOff + x];
      if (v === 0) continue;

      const px = x * s;
      const py = y * s;

      // Draw a filled square.
      d += `M${px} ${py}h${s}v${s}h-${s}Z`;
    }
  }

  const bg = params.transparentBg ? "" : `<rect x="0" y="0" width="${outW}" height="${outH}" fill="white"/>`;
  const color = params.color || "#000";

  // If there are no edges, still return a valid SVG.
  const path = d.length > 0 ? `<path d="${d}" fill="${color}" stroke="none"/>` : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">` +
    bg +
    path +
    `</svg>`
  );
}
