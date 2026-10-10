// Web implementation of compressImageToJpegBase64 (Metro picks this file
// for the web build).
//
// Why not expo-image-manipulator on the web: it first draws the photo
// onto a canvas at FULL resolution, then resizes pixel-by-pixel in
// JavaScript. Phone browsers cap canvas size (iOS Safari: ~16.7M pixels)
// and memory — a current iPhone photo is 24 MP (5712x4284), so the
// canvas silently fails and photo uploads broke on mobile while working
// on desktop. Here the browser decodes the photo into an <img> and
// draws it straight onto a canvas that is already the TARGET size, so
// no full-resolution canvas ever exists and the resampling is native.

import type { CompressOptions } from "./imageCompression.types";

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/i.test(uri)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image could not be decoded"));
    img.src = uri;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function encode(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<string | null> {
  const canvas = document.createElement("canvas");
  try {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // JPEG has no alpha: paint transparent PNG areas white, not black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob) return await blobToBase64(blob);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return dataUrl.slice(dataUrl.indexOf(",") + 1) || null;
  } finally {
    // Release the backing store promptly (matters on memory-tight phones).
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function compressImageToJpegBase64(
  uri: string,
  maxWidth: number,
  quality: number,
  options: CompressOptions = {},
): Promise<string | null> {
  try {
    const img = await loadImage(uri);
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    if (!naturalWidth || !naturalHeight) return null;

    // Bound width and (optionally) height — a portrait photo bounded by
    // width alone came out 1536x2048, twice the bytes of a landscape one.
    // Never upscale small images.
    let scale = Math.min(
      1,
      maxWidth / naturalWidth,
      options.maxHeight ? options.maxHeight / naturalHeight : 1,
    );
    let q = quality;

    // Re-encode until it fits the byte budget: lower quality first (down
    // to 0.5), then shrink dimensions. Bounded, so it always terminates.
    for (let attempt = 0; attempt < 10; attempt++) {
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      const b64 = await encode(img, width, height, q);
      if (!b64) return null;
      if (!options.maxBase64Length || b64.length <= options.maxBase64Length) {
        return b64;
      }
      if (q > 0.55) q = Math.max(0.5, q - 0.1);
      else scale *= 0.8;
    }
    return null;
  } catch (error) {
    console.error("Image compression failed:", error);
    return null;
  }
}
