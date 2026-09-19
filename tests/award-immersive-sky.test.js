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
  const home = read('features/home.js');
  const utils = read('utils.js');
  const theme = read('features/weatherTheme.js');
  const chrome = home + utils + theme;

  assert.match(chrome, /['"]award-immersive-sky['"]/);
  assert.match(utils, /getElementById\(/);
  assert.match(home, /syncAwardSkyWeather/);
  assert.match(utils, /syncAwardSkyWeather/);
  assert.match(
    theme,
    /header-night[\s\S]*header-stormy[\s\S]*header-rainy[\s\S]*header-snowy[\s\S]*header-cloudy[\s\S]*header-foggy[\s\S]*header-icy[\s\S]*header-hail/,
  );
});

test('award immersive weather is styled from classes on the sky, not header siblings', () => {
  const css = read('styles/award_immersive_weather.css');

  // Sibling `:has() ~` misses the sky whenever chrome sits between the two ids,
  // which leaves nav.css's default sunny sky under a cloudy/rainy header.
  assert.doesNotMatch(css, /#award-header-atmosphere:has\([^)]*\)\s*~\s*#award-immersive-sky/);
  assert.match(css, /#award-immersive-sky\.header-cloudy[\s\S]*?#94a3b8/);
  assert.match(css, /#award-immersive-sky\.header-rainy[\s\S]*?#4b5563/);
  assert.match(css, /#award-immersive-sky\.header-stormy[\s\S]*?#374151/);
  assert.match(css, /#award-immersive-sky\.header-snowy[\s\S]*?#cbd5e1/);
  assert.match(
    css,
    /#award-immersive-sky\.header-night:not\(\.header-stormy\):not\(\.header-rainy\):not\(\.header-snowy\):not\(\.header-cloudy\):not\(\.header-foggy\):not\(\.header-icy\):not\(\.header-hail\)[\s\S]*?#1e3a8a/,
  );
  assert.match(css, /#award-immersive-sky\.header-foggy[\s\S]*?#c5d4e0/);
  assert.match(css, /#award-immersive-sky\.header-icy[\s\S]*?#4a7c8a/);
  assert.match(css, /#award-immersive-sky\.header-hail[\s\S]*?#4338ca/);
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

test('award sky markup includes fog and hail overlay planes', () => {
  const app = read('templates/app/index.js');
  assert.match(app, /award-immersive-fog-fx/);
  assert.match(app, /award-immersive-hail-fx/);
});

test('award and wallpaper moons share the cartoon Quest moon', () => {
  const moon = read('templates/app/celestialMoon.js');
  const app = read('templates/app/index.js');
  const wallpaper = read('templates/app/screens/wallpaper.js');
  const awardCss = read('styles/award_immersive_weather.css');
  const wallCss = read('styles/wallpaper.css');
  const wall2 = read('styles/wallpaper2.css');

  assert.match(moon, /moon\.jpg/);
  assert.doesNotMatch(moon, /GSFC_20171208_Archive_e001861/);
  assert.ok(fs.existsSync(path.join(root, 'assets/celestial/moon.jpg')));
  assert.match(app, /celestialMoonHTML\(\)/);
  assert.match(wallpaper, /celestialMoonHTML\(\)/);
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
