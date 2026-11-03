/** Build-time checks for files in /public, so a bad path degrades gracefully instead of shipping a broken image. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { imageMetadata } from "astro/assets/utils";

const publicPath = (path: string) => join(process.cwd(), "public", path);

export function assetExists(path: string): boolean {
  return Boolean(path) && existsSync(publicPath(path));
}

export interface ImageInfo {
  src: string;
  width?: number;
  height?: number;
}

/** Returns null when the file is empty or missing. Dimensions are omitted for formats that cannot be probed. */
export async function imageInfo(path: string): Promise<ImageInfo | null> {
  if (!assetExists(path)) return null;
  try {
    const { width, height } = await imageMetadata(new Uint8Array(readFileSync(publicPath(path))));
    return { src: path, width, height };
  } catch {
    return { src: path };
  }
}
