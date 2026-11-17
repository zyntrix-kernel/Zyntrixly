const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

test('project is configured for shadcn/ui JavaScript and the New York style', () => {
  const config = JSON.parse(read('components.json'));
  assert.equal(config.style, 'new-york');
  assert.equal(config.tsx, false);
  assert.equal(config.aliases.components, '@/components');
  assert.equal(config.aliases.ui, '@/components/ui');
  assert.equal(config.tailwind.css, 'src/ui/index.css');
});

test('shadcn primitives use the intended Radix, CVA and cmdk foundations', () => {
  const required = [
    'button', 'badge', 'input', 'avatar', 'tabs', 'dialog',
    'command', 'scroll-area', 'separator', 'card'
  ];
  for (const name of required) {
    const file = 'src/components/ui/' + name + '.jsx';
    assert.ok(exists(file), 'Missing shadcn component source: ' + file);
  }
  assert.match(read('src/components/ui/button.jsx'), /@radix-ui\\/react-slot/);
  assert.match(read('src/components/ui/button.jsx'), /class-variance-authority/);
  assert.match(read('src/components/ui/dialog.jsx'), /@radix-ui\\/react-dialog/);
  assert.match(read('src/components/ui/tabs.jsx'), /@radix-ui\\/react-tabs/);
  assert.match(read('src/components/ui/command.jsx'), /from ['"]cmdk['"]/);
});

test('V5 Smart Inbox and search are composed from shadcn React components', () => {
  const app = read('src/ui/main.jsx');
  for (const component of ['Button', 'Badge', 'Avatar', 'Tabs', 'Dialog', 'Command', 'ScrollArea', 'Separator']) {
    assert.match(app, new RegExp(component), 'V5 UI is missing ' + component);
  }
  assert.match(app, /createPortal/);
  assert.match(app, /window\\.ZxSearch/);
  assert.match(app, /Messages from this session/);
  assert.match(app, /command:safety-number/);
  assert.match(app, /command:clear-cache/);
});

test('shadcn interactive controls expose focus states and V5 motion preferences', () => {
  const button = read('src/components/ui/button.jsx');
  const css = read('src/styles/v5.css');
  const uiCss = read('src/ui/index.css');
  assert.match(button, /focus-visible:outline-none/);
  assert.match(button, /focus-visible:ring/);
  assert.match(css, /zx-v5-reduce-motion/);
  assert.match(css, /transition-duration:\\.01ms/);
  assert.match(uiCss, /--ring:/);
});

test('the old hand-built palette is removed and the React mount points exist', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /id=["']cmd-palette["']/);
  for (const id of ['zx-v5-ui-root', 'zx-v5-inbox-root', 'zx-v5-shortcut-root', 'zx-v5-mobile-shortcut-root']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing React mount point: ' + id);
  }
  assert.match(read('app.js'), /function openCommandPalette\\(\\)\\s*\\{[^}]*ZxV5\\.openPalette/s);
  assert.match(read('src/qol/V5Experience.js'), /getInboxSnapshot/);
});

test('production build and shadcn CLI are configured', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.build, /scripts\\/build_frontend\\.js/);
  assert.equal(pkg.scripts['ui:add'], 'shadcn add');
  assert.equal(pkg.devDependencies.shadcn, '2.3.0');
  for (const dep of ['react', 'react-dom', 'cmdk', 'lucide-react']) {
    assert.ok(pkg.dependencies[dep], 'Missing runtime dependency ' + dep);
  }
  assert.ok(pkg.devDependencies.esbuild);
  assert.ok(exists('scripts/build_frontend.js'));
});
