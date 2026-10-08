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

export async function compressImageToJpegBase64(
  uri: string,
  maxWidth: number,
  quality: number,
): Promise<string | null> {
  let canvas: HTMLCanvasElement | null = null;
  try {
    const img = await loadImage(uri);
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    if (!naturalWidth || !naturalHeight) return null;

    // Never upscale small images.
    const scale = Math.min(1, maxWidth / naturalWidth);
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    canvas = document.createElement("canvas");
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
      canvas!.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob) return await blobToBase64(blob);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return dataUrl.slice(dataUrl.indexOf(",") + 1) || null;
  } catch (error) {
    console.error("Image compression failed:", error);
    return null;
  } finally {
    // Release the backing store promptly (matters on memory-tight phones).
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
