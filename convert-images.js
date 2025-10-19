const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDirs = ['../Logo', '../Photos'];
const outputDir = './public/images';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function convertImages() {
  for (const inputDir of inputDirs) {
    const files = fs.readdirSync(inputDir);

    for (const file of files) {
      const inputPath = path.join(inputDir, file);
      const ext = path.extname(file).toLowerCase();

      // Skip if not an image
      if (!['.jpg', '.jpeg', '.png', '.heic'].includes(ext)) {
        continue;
      }

      const outputFileName = path.basename(file, ext) + '.webp';
      const outputPath = path.join(outputDir, outputFileName);

      try {
        await sharp(inputPath)
          .webp({ quality: 85 })
          .toFile(outputPath);
        console.log(`✓ Converted ${file} to ${outputFileName}`);
      } catch (error) {
        console.error(`✗ Error converting ${file}:`, error.message);
      }
    }
  }

  console.log('\n✓ Image conversion complete!');
}

convertImages();
