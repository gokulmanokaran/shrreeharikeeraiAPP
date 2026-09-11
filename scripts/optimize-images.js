import fs from "fs";
import path from "path";
import sharp from "sharp";

const imagesDir = path.resolve("public/product-images");

async function optimizeAll() {
  const files = fs.readdirSync(imagesDir);
  console.log(`Found ${files.length} files in ${imagesDir}`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (![".png", ".jpg", ".jpeg"].includes(ext)) continue;

    const filePath = path.join(imagesDir, file);
    const stat = fs.statSync(filePath);
    const sizeBefore = stat.size;
    totalBefore += sizeBefore;

    // Read into buffer to allow in-place overwrite
    const inputBuffer = fs.readFileSync(filePath);

    try {
      let pipeline = sharp(inputBuffer)
        .resize({ width: 600, height: 600, fit: "cover", withoutEnlargement: true });

      let outputBuffer;
      if (ext === ".png") {
        outputBuffer = await pipeline.png({ quality: 82, compressionLevel: 9, palette: true }).toBuffer();
      } else {
        outputBuffer = await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      }

      // Also generate .webp companion for ultra-fast modern browser serving
      const webpPath = path.join(imagesDir, `${path.basename(file, ext)}.webp`);
      const webpBuffer = await sharp(inputBuffer)
        .resize({ width: 600, height: 600, fit: "cover", withoutEnlargement: true })
        .webp({ quality: 80, effort: 6 })
        .toBuffer();
      fs.writeFileSync(webpPath, webpBuffer);

      // Only overwrite original if optimized is smaller
      if (outputBuffer.length < sizeBefore) {
        fs.writeFileSync(filePath, outputBuffer);
        totalAfter += outputBuffer.length;
        console.log(`Optimized ${file}: ${(sizeBefore / 1024).toFixed(1)}KB -> ${(outputBuffer.length / 1024).toFixed(1)}KB (WebP: ${(webpBuffer.length / 1024).toFixed(1)}KB)`);
      } else {
        totalAfter += sizeBefore;
      }
    } catch (err) {
      console.error(`Failed to optimize ${file}:`, err.message);
      totalAfter += sizeBefore;
    }
  }

  console.log(`\n========================================`);
  console.log(`Total Before: ${(totalBefore / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Total After:  ${(totalAfter / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Saved:        ${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}% network payload!`);
  console.log(`========================================\n`);
}

optimizeAll();
