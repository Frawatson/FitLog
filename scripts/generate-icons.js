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

async function generate(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    console.error(`✗ Source not found: ${sourcePath}`);
    console.error(`  Save your logo to ${DEFAULT_SOURCE}`);
    console.error("  or pass a path as the first argument.");
    process.exit(1);
  }

  console.log(`Source: ${sourcePath}`);
  for (const v of VARIANTS) {
    const out = path.join(OUT_DIR, v.name);
    let pipeline = sharp(sourcePath).resize(v.size, v.size, {
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
