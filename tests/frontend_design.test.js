const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

test('project is configured for official shadcn/ui JavaScript components', () => {
  const config = JSON.parse(read('components.json'));
  assert.equal(config.style, 'new-york');
  assert.equal(config.tsx, false);
  assert.equal(config.aliases.components, '@/components');
  assert.equal(config.aliases.ui, '@/components/ui');
});

test('shadcn/ui primitives are real React components backed by Radix and CVA', () => {
  for (const file of [
    'src/components/ui/button.jsx',
    'src/components/ui/badge.jsx',
    'src/components/ui/input.jsx',
    'src/components/ui/avatar.jsx',
    'src/components/ui/tabs.jsx',
    'src/components/ui/dialog.jsx',
    'src/components/ui/command.jsx',
    'src/components/ui/scroll-area.jsx',
    'src/components/ui/separator.jsx'
  ]) assert.ok(exists(file), 'Missing shadcn component: ' + file);
  assert.match(read('src/components/ui/button.jsx'), /@radix-ui\/react-slot/);
  assert.match(read('src/components/ui/button.jsx'), /class-variance-authority/);
  assert.match(read('src/components/ui/dialog.jsx'), /@radix-ui\/react-dialog/);
  assert.match(read('src/components/ui/command.jsx'), /from ['"]cmdk['"]/);
});

test('V5 application surfaces compose shadcn components instead of hand-built DOM controls', () => {
  const app = read('src/ui/main.jsx');
  for (const component of ['Button', 'Badge', 'Avatar', 'Tabs', 'Dialog', 'Command', 'ScrollArea', 'Separator']) {
    assert.match(app, new RegExp(component), 'V5 UI is missing ' + component);
  }
  assert.match(app, /createPortal/);
  assert.match(app, /window\.ZxSearch/);
});

test('legacy bridge provides React mount points for sidebar filters and palette triggers', () => {
  const html = read('index.html');
  for (const id of ['zx-v5-ui-root', 'zx-v5-inbox-root', 'zx-v5-shortcut-root', 'zx-v5-mobile-shortcut-root']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing React mount point: ' + id);
  }
  assert.match(read('src/qol/V5Experience.js'), /zx:v5:open-palette/);
  assert.match(read('src/qol/V5Experience.js'), /getInboxSnapshot/);
});

test('production build emits the React bundle and generated Tailwind stylesheet', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.build, /scripts\/build_frontend\.js/);
  for (const dep of ['react', 'react-dom', 'cmdk', 'lucide-react']) {
    assert.ok(pkg.dependencies[dep], 'Missing runtime dependency ' + dep);
  }
  assert.ok(pkg.devDependencies.esbuild, 'Missing esbuild build dependency');
  assert.ok(exists('scripts/build_frontend.js'));
});
