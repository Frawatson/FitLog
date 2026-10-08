import * as ImageManipulator from "expo-image-manipulator";

// Downscale an image to at most `maxWidth` px wide and re-encode it as
// JPEG. Returns raw base64 (no data: prefix), or null if the image could
// not be read. Native implementation; the web build uses
// imageCompression.web.ts (see there for why).
export async function compressImageToJpegBase64(
  uri: string,
  maxWidth: number,
  quality: number,
): Promise<string | null> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );
    return result.base64 || null;
  } catch (error) {
    console.error("Image compression failed:", error);
    return null;
  }
}
