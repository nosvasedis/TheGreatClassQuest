import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = __dirname;
const PORT = 4789;
const PDF = path.join(DIR, 'GCQ_Quest_Master_Guidebook.pdf');
const PREVIEW = path.join(DIR, 'preview');

function mime(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let rel = urlPath === '/' ? '/index.html' : urlPath;
      const file = path.normalize(path.join(DIR, rel));
      if (!file.startsWith(DIR)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(file) });
        res.end(data);
      });
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
fs.mkdirSync(PREVIEW, { recursive: true });

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(PREVIEW, 'html-cover.png'), fullPage: false });
await page.locator('#classroom-chrome .ui-shot').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(PREVIEW, 'html-header.png'), fullPage: false });
await page.locator('#the-quest .ifaces').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(100);
await page.screenshot({ path: path.join(PREVIEW, 'html-orientation.png'), fullPage: false });
await page.locator('#award-stars .ui-shot').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(PREVIEW, 'html-award-stars.png'), fullPage: false });
await page.locator('#adventure-log .ui-shot').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(PREVIEW, 'html-adventure-log.png'), fullPage: false });
await page.locator('#school-office .office-mini').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(100);
await page.screenshot({ path: path.join(PREVIEW, 'html-school-office.png'), fullPage: false });

const printPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await printPage.goto(`http://127.0.0.1:${PORT}/print.html`, { waitUntil: 'load', timeout: 60000 });
await printPage.evaluate(() => document.fonts && document.fonts.ready);
await printPage.waitForTimeout(400);
await printPage.screenshot({ path: path.join(PREVIEW, 'print-cover.png'), fullPage: false });
await printPage.locator('.print-toc').scrollIntoViewIfNeeded();
await printPage.waitForTimeout(100);
await printPage.screenshot({ path: path.join(PREVIEW, 'print-toc.png'), fullPage: false });
await printPage.locator('#classroom-chrome .ui-shot').first().scrollIntoViewIfNeeded();
await printPage.waitForTimeout(100);
await printPage.screenshot({ path: path.join(PREVIEW, 'print-header-chapter.png'), fullPage: false });
await printPage.locator('#the-quest .ifaces').first().scrollIntoViewIfNeeded();
await printPage.waitForTimeout(80);
await printPage.screenshot({ path: path.join(PREVIEW, 'print-orientation.png'), fullPage: false });
await printPage.locator('#award-stars .ui-shot').first().scrollIntoViewIfNeeded();
await printPage.waitForTimeout(100);
await printPage.screenshot({ path: path.join(PREVIEW, 'print-award.png'), fullPage: false });
await printPage.locator('#adventure-log .ui-shot').first().scrollIntoViewIfNeeded();
await printPage.waitForTimeout(80);
await printPage.screenshot({ path: path.join(PREVIEW, 'print-adventure-log.png'), fullPage: false });
await printPage.locator('#school-office .office-mini').first().scrollIntoViewIfNeeded();
await printPage.waitForTimeout(80);
await printPage.screenshot({ path: path.join(PREVIEW, 'print-school-office.png'), fullPage: false });

await printPage.pdf({
  path: PDF,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: `<div></div>`,
  footerTemplate: `<div style="font-size:8px;width:100%;padding:0 14mm;color:#64748b;font-family:'Open Sans',sans-serif;display:flex;justify-content:space-between;"><span>The Great Class Quest · Quest Master's Guidebook</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: '14mm', bottom: '16mm', left: '15mm', right: '15mm' }
});

try {
  const pdfPage = await browser.newPage({ viewport: { width: 900, height: 1280 } });
  const pdfUrl = pathToFileURL(PDF).href;
  await pdfPage.goto(`${pdfUrl}#page=1`, { waitUntil: 'load' });
  await pdfPage.waitForTimeout(1200);
  await pdfPage.screenshot({ path: path.join(PREVIEW, 'pdf-page-1.png') });
  await pdfPage.goto(`${pdfUrl}#page=2`, { waitUntil: 'load' });
  await pdfPage.waitForTimeout(800);
  await pdfPage.screenshot({ path: path.join(PREVIEW, 'pdf-page-2.png') });
  await pdfPage.goto(`${pdfUrl}#page=7`, { waitUntil: 'load' });
  await pdfPage.waitForTimeout(800);
  await pdfPage.screenshot({ path: path.join(PREVIEW, 'pdf-page-7.png') });
  await pdfPage.goto(`${pdfUrl}#page=12`, { waitUntil: 'load' });
  await pdfPage.waitForTimeout(800);
  await pdfPage.screenshot({ path: path.join(PREVIEW, 'pdf-page-12.png') });
} catch (err) {
  console.warn('PDF viewer screenshot skipped:', err.message);
}

await browser.close();
server.close();
console.log('Wrote', PDF);
console.log('Previews in', PREVIEW);
