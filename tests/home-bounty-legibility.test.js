import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeJs = readFileSync(new URL('../features/home.js', import.meta.url), 'utf8');
const homeCss = readFileSync(new URL('../styles/home.css', import.meta.url), 'utf8');
const shopCss = readFileSync(new URL('../styles/shop.css', import.meta.url), 'utf8');
const bountyJs = readFileSync(new URL('../ui/core/misc.js', import.meta.url), 'utf8');

function cssRule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{[^}]+\\}`));
  assert.ok(match, `missing CSS rule ${selector}`);
  return match[0];
}

test('Home bounty launcher is an opaque chip with a solid text fill', () => {
  assert.match(homeJs, /greeting-top-row/);
  assert.match(homeCss, /\.greeting-top-row\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(homeCss, /\.greeting-top-row__bounty\s*\{[^}]*flex:\s*0 0 auto/);
  assert.match(homeJs, /class="home-bounty-pill/);
  assert.doesNotMatch(
    homeJs,
    /class="home-bounty-pill font-title/,
    'font-title on the button can inherit clipped/transparent title fills'
  );
  assert.match(homeJs, /home-bounty-pill__title[^>]*(font-title|class="[^"]*font-title)/);

  const pill = cssRule(homeCss, '.home-bounty-pill');
  assert.match(pill, /color:\s*#fff/);
  assert.match(pill, /-webkit-text-fill-color:\s*#fff/);
  assert.match(pill, /isolation:\s*isolate/);
  assert.match(pill, /flex-shrink:\s*0/);
  assert.match(pill, /-webkit-background-clip:\s*(padding-box|border-box)/);
  assert.match(pill, /background-clip:\s*(padding-box|border-box)/);
  assert.doesNotMatch(pill, /background-clip:\s*text/);
  assert.match(pill, /#fbbf24|#ea580c|#f97316/);

  const text = cssRule(homeCss, '.home-bounty-pill__text');
  assert.doesNotMatch(text, /flex:\s*1\b/, 'flex:1 (basis 0) collapses Bounty / Post a quest in a shrink-wrapped chip');
  assert.doesNotMatch(text, /min-width:\s*0/);

  const title = cssRule(homeCss, '.home-bounty-pill__title');
  assert.match(title, /color:\s*#fff/);
  assert.match(title, /-webkit-text-fill-color:\s*#fff/);
});

test('Active bounty reminder on Home uses a dark fill on an opaque cream chip', () => {
  assert.match(homeJs, /date-pill--quest-bounty/);
  const bounty = cssRule(homeCss, '.date-pill--quest-bounty');
  assert.match(bounty, /color:\s*#7c2d12/);
  assert.match(bounty, /-webkit-text-fill-color:\s*#7c2d12/);
  assert.match(bounty, /background-color:\s*#fde68a/);
});

test('Timer bounty board cards keep a painted background and white fill', () => {
  assert.match(bountyJs, /function renderTimerBountyCard/);
  assert.match(bountyJs, /bounty-card--timer-live/);

  const base = cssRule(shopCss, '.bounty-card');
  assert.doesNotMatch(
    base,
    /background:\s*linear-gradient/,
    'shorthand background on .bounty-card wipes timer gradients and leaves white-on-cream text'
  );
  assert.match(base, /background-color:/);

  const timer = cssRule(shopCss, '.bounty-card--timer-live');
  assert.match(timer, /flex-direction:\s*column/);
  assert.match(timer, /color:\s*#fff/);
  assert.match(timer, /-webkit-text-fill-color:\s*#fff/);
});
