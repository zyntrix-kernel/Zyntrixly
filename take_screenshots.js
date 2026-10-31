const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = 3456;
const CHROME_PATH = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOCAL_DIR = path.join(__dirname, 'screenshots');
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join('C:', 'Users', 'USER', '.gemini', 'antigravity', 'brain', 'cb239868-c9aa-42f5-ac96-9790b5d3c206', 'screenshots');

[LOCAL_DIR, ARTIFACT_DIR].forEach(dir => {
  if (dir && !fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
});

// Simple static server
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const resolvedBase = path.resolve(__dirname);
  const filePath = path.resolve(path.join(__dirname, reqPath));

  if (!filePath.startsWith(resolvedBase) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found: ' + reqPath);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`Visual Test Server running on http://localhost:${PORT}`);

  let exitCode = 0;
  try {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

    const capture = async (name) => {
      const localPath = path.join(LOCAL_DIR, name);
      await page.screenshot({ path: localPath });
      try {
        if (fs.existsSync(ARTIFACT_DIR)) {
          fs.copyFileSync(localPath, path.join(ARTIFACT_DIR, name));
        }
      } catch (_) {}
      console.log(`Captured ${name}`);
    };

    console.log(`Navigating to http://localhost:${PORT}`);
    await page.goto('http://localhost:' + PORT, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));

    // 1. Startup splash
    await capture('01-startup.png');

    // 2. Hide startup, show auth login
    await page.evaluate(() => {
      const startup = document.getElementById('startup');
      if (startup) startup.classList.add('out');
      const auth = document.getElementById('auth-screen');
      if (auth) auth.classList.remove('hidden');
    });
    await new Promise(r => setTimeout(r, 500));
    await capture('02-auth-login.png');

    // 3. Switch to Register mode
    await page.evaluate(() => {
      const toggleBtn = document.querySelector('.auth-toggle');
      if (toggleBtn) toggleBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    await capture('03-auth-register.png');

    // 4. Switch to main app empty state
    await page.evaluate(() => {
      const auth = document.getElementById('auth-screen');
      if (auth) auth.classList.add('hidden');
      const app = document.getElementById('app-screen');
      if (app) app.classList.remove('hidden');
      const empty = document.getElementById('empty-pane');
      if (empty) empty.classList.remove('hidden');
      const chat = document.getElementById('chat-pane');
      if (chat) chat.classList.add('hidden');

      // Populate mock conversation items
      const list = document.getElementById('sb-chats');
      if (list) {
        list.innerHTML = `
          <button class="conv-item active" type="button">
            <div class="av-circle" style="background:#27272a;width:40px;height:40px;font-size:15px;flex-shrink:0">A</div>
            <div class="ci-info">
              <div class="ci-top"><span class="ci-name">Alice Smith</span><span class="ci-pin">📌</span></div>
              <div class="ci-bot"><div class="ci-meta"><span class="ci-preview">Encrypted message received</span><span class="ci-unread">2</span></div></div>
            </div>
          </button>
          <button class="conv-item" type="button">
            <div class="av-circle" style="background:#27272a;width:40px;height:40px;font-size:15px;flex-shrink:0">B</div>
            <div class="ci-info">
              <div class="ci-top"><span class="ci-name">Bob Jones</span></div>
              <div class="ci-bot"><div class="ci-meta"><span class="ci-preview">Sounds good, let us meet at 4</span></div></div>
            </div>
          </button>
          <button class="conv-item" type="button">
            <div class="av-circle" style="background:#27272a;width:40px;height:40px;font-size:15px;flex-shrink:0">#</div>
            <div class="ci-info">
              <div class="ci-top"><span class="ci-name">Security Ops</span></div>
              <div class="ci-bot"><div class="ci-meta"><span class="ci-preview">Deployment verified</span></div></div>
            </div>
          </button>
        `;
      }
    });
    await new Promise(r => setTimeout(r, 500));
    await capture('04-main-app-empty.png');

    // 5. Open New Chat modal
    await page.evaluate(() => {
      const ncModal = document.getElementById('nc-modal');
      if (ncModal) ncModal.classList.remove('hidden');
    });
    await new Promise(r => setTimeout(r, 400));
    await capture('05-modal-new-chat.png');

    // 6. Switch to Create Group tab in modal
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('.m-tab');
      if (tabs[1]) tabs[1].click();
      const chipsRow = document.getElementById('chips-row');
      if (chipsRow) {
        chipsRow.innerHTML = `
          <span class="chip">@alice <span class="chip-x">×</span></span>
          <span class="chip">@bob <span class="chip-x">×</span></span>
        `;
      }
    });
    await new Promise(r => setTimeout(r, 400));
    await capture('06-modal-create-group.png');

    // 7. Close New Chat modal and Open Settings modal
    await page.evaluate(() => {
      const ncModal = document.getElementById('nc-modal');
      if (ncModal) ncModal.classList.add('hidden');
      const setModal = document.getElementById('settings-modal');
      if (setModal) setModal.classList.remove('hidden');
    });
    await new Promise(r => setTimeout(r, 400));
    await capture('07-modal-settings.png');

    // 8. Close Settings modal and show Active Chat Pane with messages
    await page.evaluate(() => {
      const setModal = document.getElementById('settings-modal');
      if (setModal) setModal.classList.add('hidden');
      const empty = document.getElementById('empty-pane');
      if (empty) empty.classList.add('hidden');
      const chat = document.getElementById('chat-pane');
      if (chat) chat.classList.remove('hidden');

      const msgsWrap = document.getElementById('msgs-wrap');
      if (msgsWrap) {
        msgsWrap.innerHTML = `
          <div class="msg-row theirs">
            <div class="msg-sender-name">@alice</div>
            <div class="bubble">Hey, did you see the new architectural blueprint? All cryptographic primitives are completely client-side.</div>
            <div class="msg-foot"><span class="msg-time">10:42 AM</span></div>
          </div>
          <div class="msg-row mine">
            <div class="bubble">Yes! RSA-OAEP 2048-bit key exchange and AES-256-GCM symmetric session keys. Everything is zero-knowledge.</div>
            <div class="msg-foot"><span class="msg-ticks read">✓✓</span><span class="msg-time">10:43 AM</span></div>
            <div class="msg-reactions">
              <div class="r-pill mine-r">🔥 <span>3</span></div>
              <div class="r-pill">🔒 <span>2</span></div>
            </div>
          </div>
          <div class="msg-row theirs">
            <div class="msg-reply-preview"><span class="mrp-name">@you</span><span class="mrp-txt">Yes! RSA-OAEP 2048-bit key exchange...</span></div>
            <div class="bubble">The depth and lighting feel incredible. The subtle hairlines and zinc contrast are on point.</div>
            <div class="msg-foot"><span class="msg-time">10:44 AM</span></div>
          </div>
        `;
      }
    });
    await new Promise(r => setTimeout(r, 400));
    await capture('08-active-chat-pane.png');

    // 9. Mobile viewport - Chat list view (390x844 iPhone 14)
    await page.setViewport({ width: 390, height: 844 });
    await new Promise(r => setTimeout(r, 400));
    await capture('09-mobile-list.png');

    // 10. Mobile viewport - Active conversation view (with mob-chat-open)
    await page.evaluate(() => {
      const layout = document.getElementById('app-layout');
      if (layout) layout.classList.add('mob-chat-open');
      const chatPane = document.getElementById('chat-pane');
      if (chatPane) chatPane.classList.remove('hidden');
      const emptyPane = document.getElementById('empty-pane');
      if (emptyPane) emptyPane.style.display = 'none';
      if (typeof updateMobileChatActions === 'function') {
        updateMobileChatActions({ type: 'dm', id: 'alice' });
      } else {
        const mobBack = document.getElementById('mob-back-btn');
        if (mobBack) mobBack.style.display = 'flex';
        const mobAv = document.getElementById('mob-av-btn');
        if (mobAv) mobAv.style.display = 'none';
        const mobNC = document.getElementById('mob-newchat-btn');
        if (mobNC) mobNC.style.display = 'none';
        const mobMore = document.getElementById('mob-more-btn');
        if (mobMore) mobMore.style.display = 'flex';
      }
      const mobTitle = document.getElementById('mob-title');
      if (mobTitle) mobTitle.innerHTML = '<span style="font-size:15px;font-weight:600;color:#fafafa">Alice Smith</span>';
    });
    await new Promise(r => setTimeout(r, 400));
    await capture('10-mobile-chat.png');

    await browser.close();
    console.log('All visual regression screenshots captured successfully!');
  } catch (err) {
    console.error('Error taking screenshots:', err);
    exitCode = 1;
  } finally {
    server.close();
    process.exit(exitCode);
  }
});
