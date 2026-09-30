const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('mobile chrome is injected between the award header and the expanding sky', () => {
  const app = read('templates/app/index.js');
  const mobile = read('mobile/templates.js');

  const atmosphere = app.indexOf('id="award-header-atmosphere"');
  const skyMarkup = app.indexOf('${awardImmersiveSkyHTML}');
  assert.ok(atmosphere !== -1, 'award header atmosphere must exist');
  assert.ok(skyMarkup !== -1, 'award immersive sky must be composed into app-screen');
  assert.ok(atmosphere < skyMarkup, 'sky must follow the header atmosphere in source order');

  assert.match(
    mobile,
    /getElementById\('award-header-atmosphere'\)[\s\S]*insertAdjacentHTML\('afterend',\s*teacherHeaderHTML\)/,
  );
});

test('header weather is copied onto the expanding sky so awards can paint it directly', () => {
  const live = read('features/liveWeather.js');
  const utils = read('utils.js');
  const theme = read('features/weatherTheme.js');
  const chrome = live + utils + theme;

  assert.match(chrome, /['"]award-immersive-sky['"]/);
  assert.match(utils, /getElementById\(/);
  assert.match(live, /syncAwardSkyWeather/);
  assert.match(utils, /syncAwardSkyWeather/);
  assert.match(
    theme,
    /header-night[\s\S]*header-stormy[\s\S]*header-rainy[\s\S]*header-snowy[\s\S]*header-cloudy[\s\S]*header-foggy[\s\S]*header-icy[\s\S]*header-hail/,
  );
});

test('award immersive weather is painted from the shared sky palette, not header siblings', () => {
  const css = read('styles/award_immersive_weather.css');
  const sky = read('styles/sky_weather.css');

  // Sibling `:has() ~` misses the sky whenever chrome sits between the two ids.
  assert.doesNotMatch(css, /#award-header-atmosphere:has\([^)]*\)\s*~\s*#award-immersive-sky/);
  // One palette on <html data-wx-*> colours the header, the Award sky and the card.
  assert.match(sky, /\.award-immersive-sky-gradient[\s\S]*?var\(--wx-sky-1\)/);
  for (const tone of ['grey', 'rain', 'storm', 'snow', 'fog', 'ice']) {
    assert.match(sky, new RegExp(`html\\[data-wx-tone="${tone}"\\]`), tone);
  }
  for (const light of ['dawn', 'golden', 'twilight', 'night']) {
    assert.match(sky, new RegExp(`html\\[data-wx-light="${light}"\\]`), light);
  }
});

test('immersed header chrome lets the weather sky continue through the bar', () => {
  const css = read('styles/award_immersive_weather.css');
  assert.match(
    css,
    /#app-screen\.award-sky-active:not\(\.award-sky-leaving\) #award-header-atmosphere > header[\s\S]*?background:\s*transparent\s*!important/,
  );
  assert.match(
    css,
    /#app-screen\.award-sky-active:not\(\.award-sky-leaving\) #award-header-atmosphere > header[\s\S]*?border-bottom-color:\s*transparent\s*!important/,
  );
  assert.match(
    css,
    /#app-screen\.award-sky-active:not\(\.award-sky-leaving\) \.header-night-stars[\s\S]*?opacity:\s*0\s*!important/,
  );
});

test('award sky markup carries the shared cloud and weather layers', () => {
  const app = read('templates/app/index.js');
  const stage = read('features/skyWeatherStage.js');
  assert.match(app, /wx-clouds--sky/);
  assert.match(app, /wx-stage--sky/);
  assert.match(stage, /#award-immersive-sky \.wx-clouds--sky/);
  assert.match(stage, /\.wx-stage--sky/);
});

test('award and wallpaper moons share the cartoon Quest moon', () => {
  const app = read('templates/app/index.js');
  const wallpaper = read('templates/app/screens/wallpaper.js');
  const awardCss = read('styles/award_immersive_weather.css');
  const wallCss = read('styles/wallpaper.css');
  const wall2 = read('styles/wallpaper2.css');

  assert.match(wallpaper, /moon\.jpg\?url/);
  assert.match(wallpaper, /export function celestialMoonHTML/);
  assert.ok(fs.existsSync(path.join(root, 'assets/celestial/moon.jpg')));
  assert.match(app, /celestialMoonHTML/);
  assert.doesNotMatch(app, /celestialMoon\.js/);
  assert.doesNotMatch(wallpaper, /bg-slate-100/);
  assert.doesNotMatch(
    awardCss,
    /award-immersive-moon::before[\s\S]*#f8fafc/,
  );
  assert.match(wallCss, /\.gcq-moon/);
  assert.match(wallCss, /255, 236, 179/);
  assert.doesNotMatch(
    wall2,
    /#wall-sun,\s*#wall-moon[\s\S]{0,80}255,\s*215,\s*0/,
  );
});
