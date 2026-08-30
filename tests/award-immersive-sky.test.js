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

test('award immersive night/weather sky styles survive a sibling between header and sky', () => {
  const css = read('styles/award_immersive_weather.css');

  // Adjacent `+` stops matching once #m-teacher-header sits between the two ids,
  // which leaves nav.css's default daytime gradient on the expanding sky.
  assert.doesNotMatch(css, /\+\s*#award-immersive-sky/);
  assert.match(css, /~\s*#award-immersive-sky/);
  assert.match(
    css,
    /header\.header-night:not\(\.header-stormy\):not\(\.header-rainy\):not\(\.header-snowy\):not\(\.header-cloudy\)[\s\S]*?~\s*#award-immersive-sky[\s\S]*?#1e3a8a/,
  );
});
