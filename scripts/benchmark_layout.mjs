#!/usr/bin/env node
/* ZYNTRIXLY 10 — LAYOUT BENCHMARK HARNESS
   Measures OUR layout and REAL production messaging apps (Element Web,
   Telegram Web, WhatsApp Web) with the same extraction rules, at two
   viewports: desktop 1440x900 and mobile 390x844 (iPhone-class, touch).
   Output: scripts/benchmark_results.json + screenshots/bench/*.png        */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 3457;
const CHROME = process.env.CHROME_BIN || '/home/z/.cache/puppeteer/chrome/linux-157.0.8103.78/chrome-linux64/chrome';
const OUT = path.join(ROOT, 'scripts', 'benchmark_results.json');
const SHOTS = path.join(ROOT, 'screenshots', 'bench');
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    });
    srv.listen(PORT, () => res(srv));
  });
}

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

/* ── Generic layout scanner: same rules for every target ── */
const SCANNER = () => {
  const px = el => el ? Math.round(el.getBoundingClientRect().width) : null;
  const h = el => el ? Math.round(el.getBoundingClientRect().height) : null;
  const out = { title: document.title.slice(0, 60), panels: [], headers: [], composers: [], bubbles: [], listItems: [], hOverflow: null };
  // side panels: fixed/relative columns pinned left with ~full height
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.width < 180 || r.width > 560 || r.height < 300) continue;
    if (!/fixed|absolute|relative|sticky/.test(cs.position)) continue;
    const tag = `${el.tagName.toLowerCase()}.${(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').toString().split(' ').slice(0, 3).join('.')}`;
    if (/aside|nav|sidebar|left|panel|roomlist|conversation/i.test(tag)) out.panels.push({ sel: tag, w: Math.round(r.width), h: Math.round(r.height) });
  }
  // headers
  for (const el of document.querySelectorAll('[class*="header" i], header, [class*="Header" i]')) {
    const r = el.getBoundingClientRect();
    if (r.width > 250 && r.height >= 40 && r.height <= 90) out.headers.push({ sel: el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0], h: Math.round(r.height) });
  }
  // composers / inputs
  for (const el of document.querySelectorAll('[class*="composer" i], [class*="Composer" i], textarea, [contenteditable="true"], [class*="input-container" i]')) {
    const r = el.getBoundingClientRect();
    if (r.width > 150 && r.height > 30) out.composers.push({ sel: el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0], w: Math.round(r.width), h: Math.round(r.height), fs: getComputedStyle(el).fontSize });
  }
  // message bubbles
  for (const el of Array.from(document.querySelectorAll('[class*="message" i], [class*="Message" i], .bubble')).slice(0, 40)) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.width > 80 && r.height > 20 && cs.paddingTop !== '0px') out.bubbles.push({ w: Math.round(r.width), maxw: cs.maxWidth, pad: `${cs.paddingTop}/${cs.paddingBottom}`, fs: cs.fontSize, lineH: cs.lineHeight });
    if (out.bubbles.length >= 6) break;
  }
  // conversation list items
  for (const el of Array.from(document.querySelectorAll('[class*="room" i] li, [class*="chat" i] li, [class*="conversation" i], li[class*="room" i]')).slice(0, 10)) {
    const r = el.getBoundingClientRect();
    if (r.width > 200 && r.height > 40) out.listItems.push({ h: Math.round(r.height) });
  }
  out.hOverflow = document.scrollingElement ? document.scrollingElement.scrollWidth - window.innerWidth : null;
  return out;
};

/* ── OUR app: explicit measurements + audits ── */
const OURS = () => {
  const $ = s => document.querySelector(s);
  const rect = s => { const e = $(s); return e ? (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(e.getBoundingClientRect()) : null; };
  const style = (s, props) => { const e = $(s); if (!e) return null; const cs = getComputedStyle(e); return Object.fromEntries(props.map(p => [p, cs[p]])); };
  const r = { title: 'ZYNTRIXLY (ours)' };
  r.sidebar = rect('#sidebar'); r.sidebarStyle = style('#sidebar', ['width', 'minWidth', 'maxWidth']);
  r.chatHdr = rect('.chat-hdr'); r.mobHdr = rect('.mob-hdr');
  r.composer = rect('.composer'); r.composerPad = style('.composer', ['paddingBottom', 'padding']);
  r.input = rect('#msg-inp'); r.inputStyle = style('#msg-inp', ['fontSize', 'lineHeight', 'minHeight']);
  r.sendBtn = rect('.send-btn'); r.emojiBtn = rect('#emoji-btn');
  r.convItem = rect('.conv-item'); r.convItemStyle = style('.conv-item', ['padding', 'gap']);
  r.bubble = rect('.bubble'); r.bubbleStyle = style('.bubble', ['padding', 'fontSize', 'lineHeight', 'maxWidth', 'borderRadius']);
  r.msgsWrap = rect('#msgs-wrap');
  r.appLayout = style('#app-layout', ['display', 'gridTemplateColumns', 'flexDirection']);
  r.spaceRail = rect('.spaces-rail'); r.mainPanel = rect('#main-panel');
  // tap-target audit (mobile): every visible button with min side < 44px
  r.smallTargets = [];
  for (const b of document.querySelectorAll('button, [role="button"], .compose-icon-btn, .mob-icon-btn')) {
    const rr = b.getBoundingClientRect();
    if (rr.width === 0 || rr.height === 0) continue;
    const s = getComputedStyle(b);
    if (s.visibility === 'hidden' || s.display === 'none') continue;
    if (Math.min(rr.width, rr.height) < 44) r.smallTargets.push({ sel: (b.id || b.className.toString().split(' ')[0] || 'btn'), w: Math.round(rr.width), h: Math.round(rr.height) });
  }
  r.smallTargets = r.smallTargets.slice(0, 25);
  r.smallCount = r.smallTargets.length;
  return r;
};

const MOCK = () => {
  const show = (id, on) => { const e = document.getElementById(id); if (e) e.classList.toggle('hidden', !on); };
  show('startup', false); show('auth-screen', false); show('app-screen', true);
  show('empty-pane', false); show('chat-pane', true);
  // mobile shell contract: chat view replaces the list
  const layout = document.getElementById('app-layout');
  if (layout && window.innerWidth <= 925) layout.classList.add('mob-chat-open');
  const list = document.getElementById('sb-chats');
  if (list) list.innerHTML = `
    <button class="conv-item active" type="button"><div class="av-circle" style="width:40px;height:40px">A</div><div class="ci-info"><div class="ci-top"><span class="ci-name">Alice Smith</span></div><div class="ci-bot"><div class="ci-meta"><span class="ci-preview">Encrypted message received</span><span class="ci-unread">2</span></div></div></div></button>
    <button class="conv-item" type="button"><div class="av-circle" style="width:40px;height:40px">B</div><div class="ci-info"><div class="ci-top"><span class="ci-name">Bob Jones</span></div><div class="ci-bot"><div class="ci-meta"><span class="ci-preview">Sounds good, let us meet at 4</span></div></div></div></button>
    <button class="conv-item" type="button"><div class="av-circle" style="width:40px;height:40px">#</div><div class="ci-info"><div class="ci-top"><span class="ci-name">Security Ops</span></div><div class="ci-bot"><div class="ci-meta"><span class="ci-preview">Deployment verified</span></div></div></div></button>`;
  const mw = document.getElementById('msgs-wrap');
  if (mw) mw.innerHTML = `
    <div class="msg-row theirs"><div class="msg-sender-name">@alice</div><div class="bubble">Hey, did you see the new architectural blueprint? All cryptographic primitives are completely client-side.</div><div class="msg-foot"><span class="msg-time">10:42 AM</span></div></div>
    <div class="msg-row mine"><div class="bubble">Yes! RSA-OAEP 2048-bit key exchange and AES-256-GCM session keys. Zero-knowledge end to end.</div><div class="msg-foot"><span class="msg-ticks read">✓✓</span><span class="msg-time">10:44 AM</span></div></div>`;
  const inp = document.getElementById('msg-inp'); if (inp) inp.value = '';
};

const run = async () => {
  const srv = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars=false'] });
  const report = {};

  async function shot(page, name) { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }

  // ── OURS ──
  report.ours = {};
  const page = await browser.newPage();
  for (const [vp, dims] of Object.entries(VIEWPORTS)) {
    await page.setViewport({ ...dims, deviceScaleFactor: 1, isMobile: vp === 'mobile', hasTouch: vp === 'mobile' });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(MOCK);
    await new Promise(r => setTimeout(r, 700));
    report.ours[vp] = await page.evaluate(OURS);
    await shot(page, `ours-${vp}`);
  }
  await page.close();

  // ── REAL APPS ──
  const targets = [
    ['element', 'https://app.element.io/'],
    ['telegram', 'https://web.telegram.org/k/'],
    ['whatsapp', 'https://web.whatsapp.com/'],
  ];
  for (const [name, url] of targets) {
    report[name] = {};
    const p2 = await browser.newPage();
    await p2.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    for (const [vp, dims] of Object.entries(VIEWPORTS)) {
      try {
        await p2.setViewport({ ...dims, deviceScaleFactor: 1, isMobile: vp === 'mobile', hasTouch: vp === 'mobile' });
        await p2.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise(r => setTimeout(r, vp === 'desktop' ? 9000 : 7000));
        report[name][vp] = await p2.evaluate(SCANNER);
        await shot(p2, `${name}-${vp}`);
        report[name][vp]._ok = true;
      } catch (e) { report[name][vp] = { _ok: false, err: String(e).slice(0, 120) }; }
    }
    await p2.close();
  }

  await browser.close();
  srv.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('BENCHMARK COMPLETE →', OUT);
  for (const t of Object.keys(report)) for (const v of Object.keys(report[t])) console.log(`${t}/${v}: ok=${report[t][v]._ok !== false ? 'yes' : 'no'}`);
};

run().catch(e => { console.error('FATAL', e); process.exit(1); });
