const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/styles/v5.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/qol/V5Experience.js'), 'utf8');

test('V5 visual system defines a coherent product-specific color palette', () => {
  for (const token of ['--zx-ink', '--zx-shell', '--zx-panel', '--zx-blue', '--zx-frost', '--zx-muted']) {
    assert.match(css, new RegExp(token + '\\s*:'), 'Missing design token ' + token);
  }
  assert.match(css, /--zx-blue\s*:\s*#[0-9a-f]{6}/i);
});

test('V5 interaction surfaces retain visible keyboard focus and reduced-motion support', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion\s*:\s*reduce/);
});

test('V5 layout has a narrow-screen treatment for the mobile command palette entry point', () => {
  assert.match(html, /id=["']mob-palette-btn["']/);
  assert.match(html, /id=["']mob-palette-btn["'][^>]*aria-label=["'][^"']+["']/);
  assert.match(css, /max-width\s*:\s*700px/);
});

test('message bubbles use the V5 signal palette without decorative gradients', () => {
  const sentRule = css.match(/\.msg-row\.mine\s+\.bubble\s*\{([^}]*)\}/);
  const receivedRule = css.match(/\.msg-row\.theirs\s+\.bubble\s*\{([^}]*)\}/);
  assert.ok(sentRule, 'Sent-message rule is present');
  assert.ok(receivedRule, 'Received-message rule is present');
  assert.match(sentRule[1], /background(?:-color)?\s*:\s*var\(--zx-blue\)/);
  assert.match(receivedRule[1], /background(?:-color)?\s*:\s*var\(--zx-panel\)/);
  assert.doesNotMatch(sentRule[1], /gradient/i);
});

test('command palette copy describes local search in plain language', () => {
  assert.match(app, /Messages are searched on this device/);
  assert.doesNotMatch(app, /messages in memory · no cloud search/i);
});
