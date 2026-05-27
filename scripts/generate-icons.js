#!/usr/bin/env node
/**
 * Resize a source logo into the platform-specific app-icon files that
 * app.json references. Run after dropping a new brand asset in.
 *
 * Usage:
 *   node scripts/generate-icons.js                       # uses assets/images/source-logo.png
 *   node scripts/generate-icons.js path/to/logo.png      # custom source
 *
 * Conventions per Expo + the Gbolo brand:
 * - icon.png      → 1024×1024, brand-green background, used by iOS app
 *                    icon AND Android adaptive icon foreground.
 *                    Source should ideally be the icon-only mark
 *                    (NOT the wordmark lockup) — the wordmark becomes
 *                    illegible at 60×60 on a home screen.
 * - favicon.png   → 96×96, brand-green background, browser tab icon.
 * - splash-icon.png → 1024×1024, transparent background so the splash
 *                    backgroundColor (#1B3A27 per app.json) shows
 *                    behind. The full lockup CAN fit here since the
 *                    splash is displayed wide.
 *
 * The script preserves the source aspect ratio inside each target
 * (fit: "contain") so non-square sources don't get squashed; for
 * square targets it'll letterbox with the brand background.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DEFAULT_SOURCE = path.join(process.cwd(), "assets", "images", "source-logo.png");
const OUT_DIR = path.join(process.cwd(), "assets", "images");
const BRAND_GREEN = "#1B3A27";

const VARIANTS = [
  { name: "icon.png", size: 1024, background: BRAND_GREEN },
  { name: "favicon.png", size: 96, background: BRAND_GREEN },
  { name: "splash-icon.png", size: 1024, background: null }, // transparent
];

// Fraction of the lockup width that the icon mark is assumed to occupy
// (when the source is a wide icon+wordmark lockup). Adjust if your brand
// lockup has different proportions — too small and the icon gets cut,
// too large and you'll see the start of the wordmark on the right edge.
const LOCKUP_ICON_FRACTION = 0.4;
const LOCKUP_ASPECT_THRESHOLD = 1.2; // anything wider than this is treated as a lockup

async function generate(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    console.error(`✗ Source not found: ${sourcePath}`);
    console.error(`  Save your logo to ${DEFAULT_SOURCE}`);
    console.error("  or pass a path as the first argument.");
    process.exit(1);
  }

  console.log(`Source: ${sourcePath}`);

  // If the source is a wide lockup (icon + wordmark), crop the icon-only
  // region out of the leftmost portion so app-icon variants don't end up
  // showing a tiny letterboxed lockup. Square sources are used as-is.
  const meta = await sharp(sourcePath).metadata();
  const srcWidth = meta.width || 0;
  const srcHeight = meta.height || 0;
  const aspect = srcHeight ? srcWidth / srcHeight : 1;
  let sourceBuffer;
  if (aspect > LOCKUP_ASPECT_THRESHOLD) {
    const cropSize = Math.min(
      Math.round(srcWidth * LOCKUP_ICON_FRACTION),
      srcHeight,
    );
    const top = Math.max(0, Math.round((srcHeight - cropSize) / 2));
    console.log(
      `  Wide source detected (${srcWidth}×${srcHeight}); extracting icon region ` +
      `${cropSize}×${cropSize} from the left (LOCKUP_ICON_FRACTION=${LOCKUP_ICON_FRACTION}).`,
    );
    sourceBuffer = await sharp(sourcePath)
      .extract({ left: 0, top, width: cropSize, height: cropSize })
      .toBuffer();
  } else {
    sourceBuffer = await sharp(sourcePath).toBuffer();
  }

  for (const v of VARIANTS) {
    const out = path.join(OUT_DIR, v.name);
    let pipeline = sharp(sourceBuffer).resize(v.size, v.size, {
      fit: "contain",
      background: v.background || { r: 0, g: 0, b: 0, alpha: 0 },
    });
    if (v.background) {
      pipeline = pipeline.flatten({ background: v.background });
    }
    await pipeline.png().toFile(out);
    console.log(`✓ ${v.name} (${v.size}×${v.size}${v.background ? `, bg ${v.background}` : ", transparent"})`);
  }

  console.log("\nDone. Next:");
  console.log("  1. git add assets/images/*.png");
  console.log("  2. git commit + git push");
  console.log("  3. Railway rebuilds; hard-refresh the browser to see the new favicon");
}

const source = process.argv[2] || DEFAULT_SOURCE;
generate(source).catch((e) => {
  console.error("✗ Failed:", e?.message || e);
  process.exit(1);
});
