#!/usr/bin/env node
/* One-off: capture the settings modal as a mobile bottom sheet (390x844). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = '/home/z/my-project/Zyntrixly';
const PORT = 3459;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const srv = http.createServer((req, r) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
srv.listen(PORT, async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/home/z/.cache/puppeteer/chrome/linux-157.0.8103.78/chrome-linux64/chrome', headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    document.getElementById('startup')?.classList.add('out');
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.getElementById('app-screen')?.classList.remove('hidden');
    document.getElementById('settings-modal')?.classList.remove('hidden');
  });
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: path.join(ROOT, 'screenshots', '13-mobile-bottom-sheet.png') });
  console.log('captured 13-mobile-bottom-sheet.png');
  await browser.close(); srv.close(); process.exit(0);
});
