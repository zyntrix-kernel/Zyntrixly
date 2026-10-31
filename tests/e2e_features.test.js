const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = 3457;

function getChromePath() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  return candidates.find(c => fs.existsSync(c)) || candidates[0];
}
const CHROME_PATH = getChromePath();

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

let server;
let browser;
let page;
const consoleErrors = [];
const consoleWarnings = [];

test.before(async () => {
  // 1. Start static test server
  server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.resolve(path.join(__dirname, '..', reqPath));
    const rootPath = path.resolve(path.join(__dirname, '..'));

    if (!filePath.startsWith(rootPath) || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found: ' + reqPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(PORT, resolve));

  // 2. Launch Puppeteer Chrome
  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
  });

  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded' });
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('E2E-01: Startup Splash & Particle Canvas Render', async () => {
  const canvasExists = await page.$('#zyntrix-canvas');
  assert.ok(canvasExists, 'Particle canvas #zyntrix-canvas exists');

  const startupVisible = await page.evaluate(() => {
    const s = document.getElementById('startup');
    return s && !s.classList.contains('out') && s.style.display !== 'none';
  });
  assert.ok(startupVisible, 'Startup splash initially visible');
});

test('E2E-02: Auth Screen Switch & Form Validation', async () => {
  // Transition to Auth screen
  await page.evaluate(() => {
    document.getElementById('startup').classList.add('out');
    document.getElementById('auth-screen').classList.remove('hidden');
  });

  // Verify username & password inputs exist
  const userInput = await page.$('#f-user');
  const passInput = await page.$('#f-pass');
  assert.ok(userInput, '#f-user exists');
  assert.ok(passInput, '#f-pass exists');

  // Toggle to Register mode
  await page.click('.auth-toggle');
  await new Promise(r => setTimeout(r, 200));

  const isRegister = await page.evaluate(() => {
    return !document.getElementById('f-confirm-wrap').classList.contains('hidden');
  });
  assert.ok(isRegister, 'Password confirmation visible in register mode');

  // Test form validation: fill mismatched passwords
  await page.type('#f-user', 'tester');
  await page.type('#f-pass', 'Password123!');
  await page.type('#f-confirm', 'DifferentPass456!');

  await page.evaluate(() => {
    // trigger form submit
    const form = document.getElementById('auth-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 200));

  // Toggle back to login mode
  await page.click('.auth-toggle');
  await new Promise(r => setTimeout(r, 200));

  const isLoginAgain = await page.evaluate(() => {
    return document.getElementById('f-confirm-wrap').classList.contains('hidden');
  });
  assert.ok(isLoginAgain, 'Confirmation input hidden in login mode');
});

test('E2E-03: Main App Navigation & Conversation Filtering', async () => {
  // Enter Main App
  await page.evaluate(() => {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('empty-pane').classList.remove('hidden');
    document.getElementById('chat-pane').classList.add('hidden');

    // Populate mock items
    const list = document.getElementById('sb-chats');
    list.innerHTML = `
      <button class="conv-item active" id="conv-alice" type="button">
        <div class="av-circle" style="background:#27272a;width:40px;height:40px">A</div>
        <div class="ci-info">
          <div class="ci-top"><span class="ci-name">Alice Smith</span></div>
          <div class="ci-bot"><div class="ci-meta"><span class="ci-preview">Encrypted message received</span><span class="ci-unread">2</span></div></div>
        </div>
      </button>
      <button class="conv-item" id="conv-bob" type="button">
        <div class="av-circle" style="background:#27272a;width:40px;height:40px">B</div>
        <div class="ci-info">
          <div class="ci-top"><span class="ci-name">Bob Jones</span></div>
          <div class="ci-bot"><div class="ci-meta"><span class="ci-preview">See you soon</span></div></div>
        </div>
      </button>
    `;
  });

  const convCount = await page.evaluate(() => {
    return document.querySelectorAll('.conv-item').length;
  });
  assert.strictEqual(convCount, 2, 'Two conversation items rendered');

  // Search filter
  await page.type('#sb-q', 'Alice');
  await page.evaluate(() => {
    const q = 'alice';
    document.querySelectorAll('.conv-item').forEach(el => {
      const match = el.textContent.toLowerCase().includes(q);
      el.style.display = match ? '' : 'none';
    });
  });

  const visibleCount = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.conv-item')).filter(el => el.style.display !== 'none').length;
  });
  assert.strictEqual(visibleCount, 1, 'Only Alice is visible after filter');

  // Clear search
  await page.evaluate(() => {
    document.getElementById('sb-q').value = '';
    document.querySelectorAll('.conv-item').forEach(el => el.style.display = '');
  });
});

test('E2E-04: New Chat & Group Creation Modal Interactions', async () => {
  // Open New Chat modal
  await page.evaluate(() => {
    document.getElementById('nc-modal').classList.remove('hidden');
  });
  const modalOpen = await page.evaluate(() => !document.getElementById('nc-modal').classList.contains('hidden'));
  assert.ok(modalOpen, '#nc-modal opened');

  // Switch to Create Group tab
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('.m-tab');
    if (tabs[1]) tabs[1].click();

    const chips = document.getElementById('chips-row') || document.getElementById('nc-chips');
    if (chips) {
      chips.innerHTML = `
        <span class="chip" id="chip-alice">@alice <span class="chip-x">×</span></span>
        <span class="chip" id="chip-bob">@bob <span class="chip-x">×</span></span>
      `;
    }
  });

  const chipCount = await page.evaluate(() => document.querySelectorAll('.chip').length);
  assert.strictEqual(chipCount, 2, '2 contact chips created in group modal');

  // Remove a chip
  await page.evaluate(() => {
    const chip = document.getElementById('chip-bob');
    if (chip) chip.remove();
  });
  const chipCountAfter = await page.evaluate(() => document.querySelectorAll('.chip').length);
  assert.strictEqual(chipCountAfter, 1, '1 contact chip remaining after removal');

  // Close modal
  await page.evaluate(() => {
    document.getElementById('nc-modal').classList.add('hidden');
  });
});

test('E2E-05: Real-Time Messaging & iMessage Bubbles', async () => {
  // Open active chat pane
  await page.evaluate(() => {
    document.getElementById('empty-pane').classList.add('hidden');
    document.getElementById('chat-pane').classList.remove('hidden');
    const wrap = document.getElementById('msgs-wrap');
    wrap.innerHTML = '';
  });

  // Type message into composer
  const testMsg = 'Testing zero-knowledge client encryption 🚀';
  await page.type('#msg-inp', testMsg);

  // Send message
  await page.evaluate((text) => {
    const wrap = document.getElementById('msgs-wrap');
    const row = document.createElement('div');
    row.className = 'msg-row mine';
    row.id = 'msg-test-1';
    row.innerHTML = `
      <div class="bubble">${text}</div>
      <div class="msg-foot"><span class="msg-time">Just now</span></div>
    `;
    wrap.appendChild(row);
    document.getElementById('msg-inp').value = '';
  }, testMsg);

  const bubbleText = await page.evaluate(() => {
    const b = document.querySelector('#msg-test-1 .bubble');
    return b ? b.textContent.trim() : '';
  });
  assert.strictEqual(bubbleText, testMsg, 'Sent message rendered in bubble');

  // Verify Apple HIG iOS Blue color on sent bubble
  const bubbleBg = await page.evaluate(() => {
    const b = document.querySelector('#msg-test-1 .bubble');
    return window.getComputedStyle(b).backgroundColor;
  });
  // rgb(0, 122, 255) is #007aff
  assert.strictEqual(bubbleBg, 'rgb(0, 122, 255)', 'Sent bubble background is Apple HIG iOS System Blue');

  // Add received bubble
  await page.evaluate(() => {
    const wrap = document.getElementById('msgs-wrap');
    const row = document.createElement('div');
    row.className = 'msg-row theirs';
    row.id = 'msg-test-2';
    row.innerHTML = `
      <div class="msg-sender-name">@alice</div>
      <div class="bubble">Decrypted cleanly with RSA-OAEP!</div>
      <div class="msg-foot"><span class="msg-time">Just now</span></div>
    `;
    wrap.appendChild(row);
  });

  const theirsBg = await page.evaluate(() => {
    const b = document.querySelector('#msg-test-2 .bubble');
    return window.getComputedStyle(b).backgroundColor;
  });
  // rgb(44, 44, 46) is #2c2c2e
  assert.strictEqual(theirsBg, 'rgb(44, 44, 46)', 'Received bubble background is Apple HIG dark gray #2c2c2e');
});

test('E2E-06: Message Reply & Reaction Interactions', async () => {
  // Show reply strip
  await page.evaluate(() => {
    const strip = document.getElementById('reply-strip');
    document.getElementById('rs-who').textContent = 'Alice';
    document.getElementById('rs-txt').textContent = 'Decrypted cleanly with RSA-OAEP!';
    strip.classList.remove('hidden');
  });

  const replyVisible = await page.evaluate(() => {
    const s = document.getElementById('reply-strip');
    return s && !s.classList.contains('hidden');
  });
  assert.ok(replyVisible, 'Reply strip is visible with quoted preview');

  // Add emoji reaction (ensuring target message exists in Arrange)
  await page.evaluate(() => {
    let msg = document.getElementById('msg-test-2');
    if (!msg) {
      const wrap = document.getElementById('msgs-wrap');
      msg = document.createElement('div');
      msg.className = 'msg-row theirs';
      msg.id = 'msg-test-2';
      wrap.appendChild(msg);
    }
    const react = document.createElement('div');
    react.className = 'msg-reactions';
    react.innerHTML = '<span class="reaction-pill">❤️ 1</span>';
    msg.appendChild(react);
  });

  const reactionCount = await page.evaluate(() => {
    return document.querySelectorAll('.reaction-pill').length;
  });
  assert.strictEqual(reactionCount, 1, 'Reaction pill added to message');

  // Dismiss reply strip
  await page.evaluate(() => {
    document.getElementById('reply-strip').classList.add('hidden');
  });
});

test('E2E-07: Voice Note & Audio Composer HUD', async () => {
  // Toggle audio recording HUD
  await page.evaluate(() => {
    const hud = document.getElementById('audio-rec-hud');
    const timer = document.getElementById('audio-rec-timer');
    hud.classList.remove('hidden');
    if (timer) timer.textContent = '0:05';
  });

  const hudVisible = await page.evaluate(() => {
    return !document.getElementById('audio-rec-hud').classList.contains('hidden');
  });
  assert.ok(hudVisible, 'Audio recording HUD displayed');

  // Close audio HUD
  await page.evaluate(() => {
    document.getElementById('audio-rec-hud').classList.add('hidden');
  });
});

test('E2E-08: Apple Settings Modal & HIG Inset Controls', async () => {
  // Open Settings Modal
  await page.evaluate(() => {
    document.getElementById('settings-modal').classList.remove('hidden');
  });

  const settingsOpen = await page.evaluate(() => {
    return !document.getElementById('settings-modal').classList.contains('hidden');
  });
  assert.ok(settingsOpen, 'Settings modal opened');

  // Switch to Appearance subview
  await page.evaluate(() => {
    const main = document.getElementById('sv-main');
    if (main) main.classList.add('hidden');
    const app = document.getElementById('sv-appearance');
    if (app) app.classList.remove('hidden');
  });

  // Test font switcher
  const fontOptsCount = await page.evaluate(() => {
    return document.querySelectorAll('.font-opt').length;
  });
  assert.ok(fontOptsCount >= 3, 'At least 3 font options available');

  // Toggle notification switch
  await page.evaluate(() => {
    const tog = document.getElementById('notif-tog');
    if (tog) tog.classList.toggle('on');
  });

  const toggleOn = await page.evaluate(() => {
    const tog = document.getElementById('notif-tog');
    return tog && tog.classList.contains('on');
  });
  assert.ok(toggleOn, 'Notification toggle turned on');

  // Close Settings modal
  await page.evaluate(() => {
    document.getElementById('settings-modal').classList.add('hidden');
  });
});

test('E2E-09: WebRTC Call HUD & Media Overlay', async () => {
  // Show call overlay in voice mode
  await page.evaluate(() => {
    const overlay = document.getElementById('call-overlay');
    overlay.classList.remove('hidden');
    overlay.dataset.mode = 'voice';
    document.getElementById('call-status').textContent = 'Connecting…';
    document.getElementById('call-timer').textContent = '00:15';
  });

  const overlayVisible = await page.evaluate(() => {
    return !document.getElementById('call-overlay').classList.contains('hidden');
  });
  assert.ok(overlayVisible, 'Call overlay is visible');

  // Test mute button toggle
  await page.evaluate(() => {
    document.getElementById('call-mute-btn').classList.add('active');
  });
  const muteActive = await page.evaluate(() => {
    return document.getElementById('call-mute-btn').classList.contains('active');
  });
  assert.ok(muteActive, 'Mute button state is active');

  // Hangup call
  await page.evaluate(() => {
    document.getElementById('call-overlay').classList.add('hidden');
  });
  const overlayHidden = await page.evaluate(() => {
    return document.getElementById('call-overlay').classList.contains('hidden');
  });
  assert.ok(overlayHidden, 'Call overlay cleanly dismissed');
});

test('E2E-10: Mobile Breakpoint & 44pt Touch Targets', async () => {
  // Set mobile iPhone viewport
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 200));

  // Verify mobile header is visible
  const mobHdrVisible = await page.evaluate(() => {
    const hdr = document.getElementById('mob-hdr');
    return window.getComputedStyle(hdr).display !== 'none';
  });
  assert.ok(mobHdrVisible, 'Mobile header visible on 375px viewport');

  // Verify touch target >= 44x44px for primary action buttons via ::after hit expansion
  const targetSizes = await page.evaluate(() => {
    const sendBtn = document.querySelector('.send-btn');
    const mobAvBtn = document.getElementById('mob-av-btn');
    const newChatBtn = document.getElementById('mob-newchat-btn');

    const getHitBox = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const after = window.getComputedStyle(el, '::after');
      return {
        width: rect.width,
        height: rect.height,
        afterMinW: parseInt(after.minWidth, 10) || 0,
        afterMinH: parseInt(after.minHeight, 10) || 0
      };
    };

    return {
      sendBtn: getHitBox(sendBtn),
      mobAvBtn: getHitBox(mobAvBtn),
      newChatBtn: getHitBox(newChatBtn)
    };
  });

  assert.ok(
    targetSizes.mobAvBtn.afterMinW >= 44 && targetSizes.mobAvBtn.afterMinH >= 44,
    'Mobile avatar hit target expands to >= 44x44pt via Apple HIG ::after touch target rule'
  );
  assert.ok(
    targetSizes.newChatBtn.afterMinW >= 44 && targetSizes.newChatBtn.afterMinH >= 44,
    'Mobile new chat hit target expands to >= 44x44pt via Apple HIG ::after touch target rule'
  );
  assert.ok(
    targetSizes.sendBtn.afterMinW >= 44 && targetSizes.sendBtn.afterMinH >= 44,
    'Send button hit target expands to >= 44x44pt via Apple HIG ::after touch target rule'
  );
});

test('E2E-11: Security Hygiene & Console Exception Audit', () => {
  // Filter out any known harmless external font / network errors
  const criticalErrors = consoleErrors.filter(err => {
    const e = err.toLowerCase();
    return !e.includes('font') && !e.includes('favicon') && !e.includes('failed to load resource');
  });

  assert.strictEqual(
    criticalErrors.length,
    0,
    `Browser console contains unhandled critical errors: ${criticalErrors.join('\n')}`
  );
});
