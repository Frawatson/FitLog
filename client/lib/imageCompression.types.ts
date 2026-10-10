export interface CompressOptions {
  // Also bound the height (portrait photos otherwise come out taller
  // than wide at maxWidth, doubling their size).
  maxHeight?: number;
  // Re-encode at lower quality / smaller size until the base64 output
  // is at most this many characters (i.e. fits a server upload cap).
  maxBase64Length?: number;
}
