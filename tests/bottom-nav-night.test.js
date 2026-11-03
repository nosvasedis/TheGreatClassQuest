const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('bottom nav is a bar-less cloud dock sitting flush on the bottom edge', () => {
  const css = read('styles/nav.css');
  const navBlock = css.match(/#bottom-nav-bar\s*\{[^}]+\}/);
  assert.ok(navBlock, 'desktop bottom nav rule must exist');
  assert.match(navBlock[0], /position:\s*fixed/);
  assert.match(navBlock[0], /background:\s*transparent/);
  assert.match(navBlock[0], /pointer-events:\s*none/);
  assert.match(navBlock[0], /padding-bottom:\s*env\(safe-area-inset-bottom, 0px\);/);
});

test('every teacher nav tab gets its own cloud shape', () => {
  const css = read('styles/nav.css');
  const nav = read('templates/app/nav.js');
  const tabs = [...nav.matchAll(/\{ tab: '([a-z-]+)'/g)].map((m) => m[1]);
  assert.equal(tabs.length, 10);
  assert.match(nav, /class="nav-button nav-color-\$\{t\.color\}[^"]*" data-tab="\$\{t\.tab\}"/);
  assert.match(nav, /<span class="nav-cloud" aria-hidden="true"><\/span>/, 'every cloud button renders its cloud body');

  const shapes = new Set();
  for (const tab of tabs) {
    const rule = css.match(
      new RegExp(`#bottom-nav-bar \\.nav-button\\[data-tab="${tab}"\\]\\s*\\{\\s*--cloud-shape:\\s*(url\\("[^"]+"\\))`),
    );
    assert.ok(rule, `${tab} needs a --cloud-shape`);
    shapes.add(rule[1]);
  }
  assert.equal(shapes.size, tabs.length, 'cloud shapes must all differ');
});

test('clouds sink when asleep and the icon/label motion is untouched', () => {
  const css = read('styles/nav.css');
  assert.match(css, /#bottom-nav-bar\.cloud-dock--asleep \.nav-button\s*\{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.nav-button:hover \.icon,\s*\.nav-button\.active \.icon\s*\{\s*transform:\s*translateY\(-0\.5rem\) scale\(0\.65\);/);
  assert.match(css, /\.nav-button:hover \.text,\s*\.nav-button\.active \.text\s*\{\s*opacity:\s*1;/);

  const dock = read('ui/core/cloudDock.js');
  assert.match(dock, /\(hover: hover\) and \(pointer: fine\)/, 'auto-hide only on mouse devices');
  assert.match(dock, /focusin/, 'keyboard focus must wake the clouds');
  assert.match(read('ui/core/listeners.js'), /setupCloudDock\(\)/);
});

test('bottom nav night theme dims the clouds under the night sky', () => {
  const css = read('styles/nav.css');
  assert.match(css, /body\.night-mode:not\(\.projector-mode\)\s+#bottom-nav-bar::before\s*\{/s);
  assert.match(css, /body\.night-mode:not\(\.projector-mode\)\s+#bottom-nav-bar \.nav-cloud\s*\{/s);
});

test('each cloud carries its own description tip, never a "requires" title', async () => {
  const nav = read('templates/app/nav.js');
  assert.match(nav, /data-gtip-look="cloud"/);
  assert.match(nav, /data-gtip="\$\{navTipText\(t\)/);
  const gate = read('ui/tabs/navigation.js');
  assert.doesNotMatch(gate, /btn\.title\s*=/, 'a title would be kept by the tooltip system after the plan unlocks');
  assert.match(gate, /btn\.removeAttribute\('data-gtip-note'\)/);
  assert.match(read('ui/questTipsCard.js'), /\['cloud', '#bottom-nav-bar'\]/);
  assert.match(read('styles/quest_tips.css'), /\.qtip--cloud\s*\{/);
});
