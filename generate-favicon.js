const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateFavicons() {
  const logoPath = path.join(__dirname, 'public', 'images', 'logo.webp');
  const publicDir = path.join(__dirname, 'public');

  try {
    console.log('Generating favicons from logo.webp...');

    // Generate favicon.ico (32x32)
    await sharp(logoPath)
      .resize(32, 32)
      .toFile(path.join(publicDir, 'favicon.ico'));
    console.log('✓ Generated favicon.ico (32x32)');

    // Generate logo192.png for PWA
    await sharp(logoPath)
      .resize(192, 192)
      .toFile(path.join(publicDir, 'logo192.png'));
    console.log('✓ Generated logo192.png (192x192)');

    // Generate logo512.png for PWA
    await sharp(logoPath)
      .resize(512, 512)
      .toFile(path.join(publicDir, 'logo512.png'));
    console.log('✓ Generated logo512.png (512x512)');

    // Generate apple-touch-icon.png (180x180)
    await sharp(logoPath)
      .resize(180, 180)
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('✓ Generated apple-touch-icon.png (180x180)');

    console.log('\nAll favicons generated successfully!');
  } catch (error) {
    console.error('Error generating favicons:', error);
  }
}

generateFavicons();
