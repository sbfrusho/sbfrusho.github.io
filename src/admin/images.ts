/** Client-side validation and processing of uploads. Geometry helpers are pure. */
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES } from "./config";

export class UploadError extends Error {}

export interface CropState {
  /** Centre of the crop, 0..1 of the source width/height. */
  cx: number;
  cy: number;
  /** 1 = the largest square that fits. */
  zoom: number;
}

export function cropRect(w: number, h: number, { cx, cy, zoom }: CropState) {
  const side = Math.min(w, h) / Math.max(1, zoom);
  const sx = Math.min(Math.max(0, cx * w - side / 2), w - side);
  const sy = Math.min(Math.max(0, cy * h - side / 2), h - side);
  return { sx, sy, side };
}

/** Keeps the crop inside the image, so the sliders never show empty space. */
export function clampCrop(w: number, h: number, c: CropState): CropState {
  const { sx, sy, side } = cropRect(w, h, c);
  return { zoom: c.zoom, cx: (sx + side / 2) / w, cy: (sy + side / 2) / h };
}

export function fitWithin(w: number, h: number, max: number) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export function isPdfHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

/** SVG can carry script, and may be mislabelled, so the bytes are inspected as well as the name. */
export function looksLikeSvg(file: { name: string; type: string }, head: Uint8Array): boolean {
  if (file.type === "image/svg+xml" || /\.svgz?$/i.test(file.name)) return true;
  const text = new TextDecoder().decode(head).trimStart().toLowerCase();
  return text.startsWith("<svg") || (text.startsWith("<?xml") && text.includes("<svg")) || text.startsWith("<!doctype svg");
}

export async function decodeImage(file: File): Promise<ImageBitmap> {
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError(`That image is ${(file.size / 1048576).toFixed(1)} MB. The limit is 15 MB.`);
  const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  if (looksLikeSvg(file, head)) throw new UploadError("SVG files are not allowed. Use JPEG, PNG or WebP.");
  try {
    return await createImageBitmap(file);
  } catch {
    throw new UploadError("That file could not be read as an image. Use JPEG, PNG or WebP.");
  }
}

export async function validatePdf(file: File): Promise<void> {
  if (file.size > MAX_PDF_BYTES) throw new UploadError(`That PDF is ${(file.size / 1048576).toFixed(1)} MB. The limit is 5 MB.`);
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (!isPdfHeader(head)) throw new UploadError("That file is not a valid PDF.");
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<{ blob: Blob; ext: string; type: string }> {
  // JPEG has no alpha: flatten onto white first, or transparency becomes black.
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext("2d");
  if (!ctx) throw new UploadError("This browser could not process the image.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  const jpeg = await toBlob(flat, "image/jpeg", quality);
  if (!jpeg) throw new UploadError("This browser could not process the image.");
  return { blob: jpeg, ext: "jpg", type: "image/jpeg" };
}

/** WebP where the browser can encode it (Safari cannot), JPEG otherwise. */
export async function encodeCanvas(canvas: HTMLCanvasElement, quality = 0.85): Promise<{ blob: Blob; ext: string; type: string }> {
  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp?.type === "image/webp") return { blob: webp, ext: "webp", type: "image/webp" };
  return encodeJpeg(canvas, quality);
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UploadError("This browser could not process the image.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

/** The profile photo doubles as the site's og:image, and link-preview crawlers handle JPEG most reliably. */
export async function renderCrop(bitmap: ImageBitmap, crop: CropState, maxPx: number) {
  const { sx, sy, side } = cropRect(bitmap.width, bitmap.height, crop);
  const out = Math.max(1, Math.round(Math.min(side, maxPx)));
  const { canvas, ctx } = canvasOf(out, out);
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  return encodeJpeg(canvas);
}

export async function renderResized(bitmap: ImageBitmap, maxPx: number) {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxPx);
  const { canvas, ctx } = canvasOf(width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return encodeCanvas(canvas);
}
