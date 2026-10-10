import * as ImageManipulator from "expo-image-manipulator";

import type { CompressOptions } from "./imageCompression.types";

// Downscale an image to at most `maxWidth` px wide (and optionally
// `maxHeight` tall) and re-encode it as JPEG, stepping quality and size
// down until it fits `maxBase64Length` when given. Returns raw base64
// (no data: prefix), or null if the image could not be read. Native
// implementation; the web build uses imageCompression.web.ts.
export async function compressImageToJpegBase64(
  uri: string,
  maxWidth: number,
  quality: number,
  options: CompressOptions = {},
): Promise<string | null> {
  try {
    // Original dimensions, to bound the longer side correctly.
    const info = await ImageManipulator.manipulateAsync(uri, []);
    let scale = Math.min(
      1,
      maxWidth / info.width,
      options.maxHeight ? options.maxHeight / info.height : 1,
    );
    let q = quality;
    for (let attempt = 0; attempt < 10; attempt++) {
      const width = Math.max(1, Math.round(info.width * scale));
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width } }],
        {
          compress: q,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      const b64 = result.base64 || null;
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
