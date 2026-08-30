const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('bottom nav keeps a tiny gap under the buttons without a tall extra dock', () => {
  const css = read('styles/nav.css');
  const navBlock = css.match(/#bottom-nav-bar\s*\{[^}]+\}/);
  assert.ok(navBlock, 'desktop bottom nav rule must exist');
  assert.match(
    navBlock[0],
    /padding-bottom:\s*calc\(\s*0\.3\d*rem\s*\+\s*env\(safe-area-inset-bottom/,
  );
  assert.doesNotMatch(navBlock[0], /padding-bottom:\s*env\(safe-area-inset-bottom/);
});

test('bottom nav night theme matches the header night indigo bar', () => {
  const css = read('styles/nav.css');
  assert.match(
    css,
    /body\.night-mode:not\(\.projector-mode\)\s+#bottom-nav-bar\s*\{[^}]*#1e3a8a[^}]*#312e81/s,
  );
  assert.match(
    css,
    /body\.night-mode:not\(\.projector-mode\)\s+#bottom-nav-bar::before\s*\{/s,
  );
  assert.match(css, /header\.header-night\.header-stormy[\s\S]*?#bottom-nav-bar/);
});
