// src/shared/lib/pdf/imagesToPdf.ts
// Minimal "images -> multi-page PDF" generator.
// Works in browser contexts (demo, android-web, extension side panel).
// No PDF editing. No external deps.

export type PdfImageInput =
  | Blob
  | Uint8Array
  | { blob: Blob; name?: string }
  | { bytes: Uint8Array; name?: string };

export type ImagesToPdfOptions = {
  /** Page size in PDF points (1 pt = 1/72 inch). Default A4 portrait. */
  pageWidthPt?: number;
  pageHeightPt?: number;

  /** JPEG quality when encoding via canvas. Default 0.92 */
  jpegQuality?: number;

  /** Keep aspect ratio and contain within margins (true) or stretch (false). Default true. */
  contain?: boolean;

  /** Margin in points when contain=true. Default 18 (~0.25") */
  marginPt?: number;
};

export async function imagesToPdf(
  images: PdfImageInput[],
  options: ImagesToPdfOptions = {},
): Promise<Uint8Array> {
  const pageW = options.pageWidthPt ?? 595.28;
  const pageH = options.pageHeightPt ?? 841.89;
  const jpegQuality = options.jpegQuality ?? 0.92;
  const contain = options.contain ?? true;
  const margin = options.marginPt ?? 18;

  const normalized: Array<{ jpegBytes: Uint8Array; pxW: number; pxH: number }> = [];
  for (const img of images) {
    const blob = await toBlob(img);
    const { jpegBytes, pxW, pxH } = await blobToJpegBytes(blob, jpegQuality);
    normalized.push({ jpegBytes, pxW, pxH });
  }

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // xref offsets; offsets[0] unused
  let byteLen = 0;

  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    byteLen += b.byteLength;
  };
  const pushStr = (s: string) => pushBytes(new TextEncoder().encode(s));

  const startObj = (objNum: number) => {
    offsets[objNum] = byteLen;
    pushStr(`${objNum} 0 obj\n`);
  };
  const endObj = () => pushStr("endobj\n");

  // Header
  pushStr("%PDF-1.4\n");
  // Binary comment
  pushBytes(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A])); // %âãÏÓ\n

  const catalogObj = 1;
  const pagesObj = 2;
  let nextObj = 3;

  type PageRefs = { pageObj: number; contentObj: number; imageObj: number };
  const pages: PageRefs[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const imageObj = nextObj++;
    const contentObj = nextObj++;
    const pageObj = nextObj++;
    pages.push({ pageObj, contentObj, imageObj });

    const { jpegBytes, pxW, pxH } = normalized[i];

    // Image XObject
    startObj(imageObj);
    pushStr("<<\n");
    pushStr("/Type /XObject\n");
    pushStr("/Subtype /Image\n");
    pushStr(`/Width ${pxW}\n`);
    pushStr(`/Height ${pxH}\n`);
    pushStr("/ColorSpace /DeviceRGB\n");
    pushStr("/BitsPerComponent 8\n");
    pushStr("/Filter /DCTDecode\n");
    pushStr(`/Length ${jpegBytes.byteLength}\n`);
    pushStr(">>\n");
    pushStr("stream\n");
    pushBytes(jpegBytes);
    pushStr("\nendstream\n");
    endObj();

    const { drawW, drawH, offsetX, offsetY } = computePlacement({
      pageW,
      pageH,
      pxW,
      pxH,
      contain,
      margin,
    });

    const content =
      "q\n" +
      `${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${offsetX.toFixed(2)} ${offsetY.toFixed(2)} cm\n` +
      "/Im0 Do\n" +
      "Q\n";

    const contentBytes = new TextEncoder().encode(content);

    // Content stream
    startObj(contentObj);
    pushStr("<<\n");
    pushStr(`/Length ${contentBytes.byteLength}\n`);
    pushStr(">>\n");
    pushStr("stream\n");
    pushBytes(contentBytes);
    pushStr("endstream\n");
    endObj();

    // Page object
    startObj(pageObj);
    pushStr("<<\n");
    pushStr("/Type /Page\n");
    pushStr(`/Parent ${pagesObj} 0 R\n`);
    pushStr(`/MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}]\n`);
    pushStr("/Resources <<\n");
    pushStr("/XObject << /Im0 ");
    pushStr(`${imageObj} 0 R`);
    pushStr(" >>\n");
    pushStr(">>\n");
    pushStr(`/Contents ${contentObj} 0 R\n`);
    pushStr(">>\n");
    endObj();
  }

  // Pages tree
  startObj(pagesObj);
  pushStr("<<\n");
  pushStr("/Type /Pages\n");
  pushStr(`/Count ${pages.length}\n`);
  pushStr("/Kids [");
  for (const p of pages) pushStr(` ${p.pageObj} 0 R`);
  pushStr(" ]\n");
  pushStr(">>\n");
  endObj();

  // Catalog
  startObj(catalogObj);
  pushStr("<<\n");
  pushStr("/Type /Catalog\n");
  pushStr(`/Pages ${pagesObj} 0 R\n`);
  pushStr(">>\n");
  endObj();

  // XRef
  const xrefStart = byteLen;
  pushStr("xref\n");
  pushStr(`0 ${nextObj}\n`);
  pushStr("0000000000 65535 f \n"); // object 0

  for (let objNum = 1; objNum < nextObj; objNum++) {
    const off = offsets[objNum] ?? 0;
    pushStr(off.toString().padStart(10, "0"));
    pushStr(" 00000 n \n");
  }

  // Trailer
  pushStr("trailer\n");
  pushStr("<<\n");
  pushStr(`/Size ${nextObj}\n`);
  pushStr(`/Root ${catalogObj} 0 R\n`);
  pushStr(">>\n");
  pushStr("startxref\n");
  pushStr(`${xrefStart}\n`);
  pushStr("%%EOF\n");

  return concat(chunks, byteLen);
}

function computePlacement(args: {
  pageW: number;
  pageH: number;
  pxW: number;
  pxH: number;
  contain: boolean;
  margin: number;
}) {
  const { pageW, pageH, pxW, pxH, contain, margin } = args;

  if (!contain) return { drawW: pageW, drawH: pageH, offsetX: 0, offsetY: 0 };

  const maxW = Math.max(1, pageW - 2 * margin);
  const maxH = Math.max(1, pageH - 2 * margin);

  const imgAspect = pxW / pxH;
  const boxAspect = maxW / maxH;

  let drawW: number;
  let drawH: number;

  if (imgAspect >= boxAspect) {
    drawW = maxW;
    drawH = maxW / imgAspect;
  } else {
    drawH = maxH;
    drawW = maxH * imgAspect;
  }

  return {
    drawW,
    drawH,
    offsetX: (pageW - drawW) / 2,
    offsetY: (pageH - drawH) / 2,
  };
}
 

async function toBlob(input: PdfImageInput): Promise<Blob> {
  if (input instanceof Blob) return input;

  // IMPORTANT: copy views into a fresh ArrayBuffer to avoid
  // Uint8Array<ArrayBufferLike> / SharedArrayBuffer typing problems.
  if (input instanceof Uint8Array) {
    const copy = new Uint8Array(input); // new ArrayBuffer-backed copy
    return new Blob([copy.buffer]);
  }

  if ("blob" in input) return input.blob;

  // input.bytes might be a view with ArrayBufferLike — copy it too
  const copy = new Uint8Array(input.bytes);
  return new Blob([copy.buffer]);
}

async function blobToJpegBytes(blob: Blob, quality: number) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, img.naturalWidth || img.width);
    canvas.height = Math.max(1, img.naturalHeight || img.height);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PDF: canvas 2D context unavailable.");

    ctx.drawImage(img, 0, 0);

    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PDF: JPEG encode failed."))),
        "image/jpeg",
        quality,
      );
    });

    const buf = await jpegBlob.arrayBuffer();
    return { jpegBytes: new Uint8Array(buf), pxW: canvas.width, pxH: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("PDF: image load failed."));
    img.src = url;
  });
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}