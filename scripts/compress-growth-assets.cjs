const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const dir = path.resolve(__dirname, '../assets/ceremony');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  for (const name of ['growth-festival-garden', 'growth-festival-garden-gate', 'growth-festival-bloom-wreath', 'growth-festival-golden-bloom']) {
    const input = path.join(dir, `${name}.webp`);
    const base64 = fs.readFileSync(input).toString('base64');
    const result = await page.evaluate(async ({ base64, name }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      const scale = name === 'growth-festival-garden' ? 1 : Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = name === 'growth-festival-garden' ? 1920 : Math.round(image.naturalWidth * scale);
      canvas.height = name === 'growth-festival-garden' ? 1080 : Math.round(image.naturalHeight * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', 0.55).split(',')[1];
    }, { base64, name });
    fs.writeFileSync(input, Buffer.from(result, 'base64'));
  }
  await browser.close();
})();
