#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   ZYNTRIXLY 10 — GSAP vendoring script (runs on npm postinstall)
   Copies GSAP 3.13 from node_modules into vendor/gsap/ so the client stays
   fully self-hosted (strict CSP: no CDN phone-home on npm-installed deploys).
   On raw static checkouts (no npm install), index.html falls back to the
   jsDelivr copy, so animations still work everywhere.
   ═══════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'node_modules', 'gsap', 'dist', 'gsap.min.js');
const DEST_DIR = path.join(__dirname, '..', 'vendor', 'gsap');
const DEST = path.join(DEST_DIR, 'gsap.min.js');

try {
  if (fs.existsSync(DEST)) {
    console.log('[vendor-gsap] vendor/gsap/gsap.min.js already present — skipping.');
    process.exit(0);
  }
  if (fs.existsSync(SRC)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
    fs.copyFileSync(SRC, DEST);
    console.log('[vendor-gsap] Copied GSAP into vendor/gsap/gsap.min.js (self-hosted).');
    process.exit(0);
  }
  console.warn('[vendor-gsap] gsap not found in node_modules — raw static checkout detected.');
  console.warn('[vendor-gsap] index.html will fall back to the jsDelivr copy at runtime.');
  process.exit(0);
} catch (err) {
  console.warn('[vendor-gsap] Non-fatal failure, continuing without vendoring:', err.message);
  process.exit(0);
}
