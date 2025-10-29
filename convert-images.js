const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesDir = './public/images';

async function convertImagesToWebP(directory) {
  const files = fs.readdirSync(directory, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(directory, file.name);

    if (file.isDirectory()) {
      // Recursively process subdirectories
      await convertImagesToWebP(fullPath);
    } else {
      const ext = path.extname(file.name).toLowerCase();

      // Check if it's an image that needs conversion (not already WebP)
      if (['.jpg', '.jpeg', '.png', '.heic'].includes(ext)) {
        const outputFileName = path.basename(file.name, ext) + '.webp';
        const outputPath = path.join(directory, outputFileName);

        try {
          await sharp(fullPath)
            .webp({ quality: 85 })
            .toFile(outputPath);
          console.log(`✓ Converted ${file.name} to ${outputFileName}`);
          
          // Delete the original file after successful conversion
          fs.unlinkSync(fullPath);
          console.log(`  Deleted original: ${file.name}`);
        } catch (error) {
          console.error(`✗ Error converting ${file.name}:`, error.message);
        }
      }
    }
  }
}

async function main() {
  console.log('Starting image conversion to WebP...\n');
  await convertImagesToWebP(imagesDir);
  console.log('\n✓ Image conversion and cleanup complete!');
}

main();
