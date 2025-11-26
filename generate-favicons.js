const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "public");
const sourceLogo = path.join(publicDir, "logo192.png");

async function generateFavicons() {
  console.log("Generating favicons from logo192.png...");

  // Generate favicon-32x32.png
  await sharp(sourceLogo).resize(32, 32).toFile(path.join(publicDir, "favicon-32x32.png"));
  console.log("✓ Generated favicon-32x32.png");

  // Generate favicon-16x16.png
  await sharp(sourceLogo).resize(16, 16).toFile(path.join(publicDir, "favicon-16x16.png"));
  console.log("✓ Generated favicon-16x16.png");

  // Generate apple-touch-icon.png (180x180) if it doesn't exist or is wrong size
  const appleIconPath = path.join(publicDir, "apple-touch-icon.png");
  await sharp(sourceLogo).resize(180, 180).toFile(appleIconPath);
  console.log("✓ Generated apple-touch-icon.png (180x180)");

  // Generate favicon.ico (32x32) using PNG as base
  // Note: Sharp doesn't natively output .ico, so we'll create a 32x32 PNG and rename/convert
  // For true .ico support, you'd use a dedicated library, but browsers accept PNG as favicon.ico
  const favicon32 = path.join(publicDir, "favicon-temp-32.png");
  await sharp(sourceLogo).resize(32, 32).toFile(favicon32);

  // Copy to favicon.ico (browsers will accept PNG format)
  fs.copyFileSync(favicon32, path.join(publicDir, "favicon.ico"));
  fs.unlinkSync(favicon32);
  console.log("✓ Generated favicon.ico (32x32)");

  console.log("\nAll favicons generated successfully!");
}

generateFavicons().catch((err) => {
  console.error("Error generating favicons:", err);
  process.exit(1);
});
