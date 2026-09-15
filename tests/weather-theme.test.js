const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

async function loadTheme() {
  return import('../features/weatherTheme.js');
}

test('Open-Meteo codes keep the existing clear, cloudy, rain, snow, and storm skins', async () => {
  const { resolveWeatherTheme } = await loadTheme();

  assert.equal(resolveWeatherTheme(0).weatherBg, 'w-day');
  assert.equal(resolveWeatherTheme(1).weatherBg, 'w-day');
  assert.equal(resolveWeatherTheme(2).weatherBg, 'w-day');
  assert.equal(resolveWeatherTheme(3).weatherBg, 'w-cloudy');
  assert.equal(resolveWeatherTheme(3).headerClass, 'header-cloudy');
  assert.equal(resolveWeatherTheme(61).weatherBg, 'w-rainy');
  assert.equal(resolveWeatherTheme(63).weatherBg, 'w-rainy');
  assert.equal(resolveWeatherTheme(73).weatherBg, 'w-snowy');
  assert.equal(resolveWeatherTheme(95).weatherBg, 'w-stormy');
  assert.equal(resolveWeatherTheme(95).headerClass, 'header-stormy');
});

test('fog, freezing precip, and hail get their own skins instead of cloudy/rain/storm', async () => {
  const { resolveWeatherTheme } = await loadTheme();

  for (const code of [45, 48]) {
    const theme = resolveWeatherTheme(code);
    assert.equal(theme.weatherBg, 'w-foggy');
    assert.equal(theme.headerClass, 'header-foggy');
    assert.equal(theme.wallpaperClass, 'weather-foggy');
    assert.equal(theme.weatherIcon, 'fa-smog');
    assert.match(theme.weatherText, /Fog/i);
  }

  for (const code of [56, 57, 66, 67]) {
    const theme = resolveWeatherTheme(code);
    assert.equal(theme.weatherBg, 'w-icy');
    assert.equal(theme.headerClass, 'header-icy');
    assert.equal(theme.wallpaperClass, 'weather-icy');
    assert.equal(theme.weatherIcon, 'fa-icicles');
    assert.match(theme.weatherText, /Ic|Freez/i);
  }

  for (const code of [96, 99]) {
    const theme = resolveWeatherTheme(code);
    assert.equal(theme.weatherBg, 'w-hail');
    assert.equal(theme.headerClass, 'header-hail');
    assert.equal(theme.wallpaperClass, 'weather-hail');
    assert.equal(theme.weatherIcon, 'fa-cloud-meatball');
    assert.match(theme.weatherText, /Hail/i);
  }
});

test('rain and snow intensity is light, default, or heavy from WMO codes', async () => {
  const { resolveWeatherTheme } = await loadTheme();

  assert.equal(resolveWeatherTheme(51).intensity, 'light');
  assert.equal(resolveWeatherTheme(61).intensity, 'light');
  assert.equal(resolveWeatherTheme(80).intensity, 'light');
  assert.equal(resolveWeatherTheme(71).intensity, 'light');
  assert.equal(resolveWeatherTheme(77).intensity, 'light');
  assert.equal(resolveWeatherTheme(85).intensity, 'light');
  assert.equal(resolveWeatherTheme(56).intensity, 'light');
  assert.equal(resolveWeatherTheme(66).intensity, 'light');

  assert.equal(resolveWeatherTheme(53).intensity, '');
  assert.equal(resolveWeatherTheme(63).intensity, '');
  assert.equal(resolveWeatherTheme(73).intensity, '');
  assert.equal(resolveWeatherTheme(81).intensity, '');
  assert.equal(resolveWeatherTheme(95).intensity, '');

  assert.equal(resolveWeatherTheme(55).intensity, 'heavy');
  assert.equal(resolveWeatherTheme(65).intensity, 'heavy');
  assert.equal(resolveWeatherTheme(82).intensity, 'heavy');
  assert.equal(resolveWeatherTheme(75).intensity, 'heavy');
  assert.equal(resolveWeatherTheme(86).intensity, 'heavy');
  assert.equal(resolveWeatherTheme(57).intensity, 'heavy');
  assert.equal(resolveWeatherTheme(67).intensity, 'heavy');
  assert.equal(resolveWeatherTheme(99).intensity, 'heavy');
});

test('night labels keep the condition and mark night', async () => {
  const { resolveWeatherTheme, withNightWeatherText } = await loadTheme();

  assert.equal(withNightWeatherText(resolveWeatherTheme(0).weatherText), 'Clear Night');
  assert.equal(withNightWeatherText(resolveWeatherTheme(45).weatherText), 'Foggy Night');
  assert.equal(withNightWeatherText(resolveWeatherTheme(66).weatherText), 'Icy Night');
  assert.equal(withNightWeatherText(resolveWeatherTheme(96).weatherText), 'Hail Night');
  assert.equal(withNightWeatherText(resolveWeatherTheme(61).weatherText), 'Light Rain Night');
});

test('wallpaper class lists include the new skins and intensity modifiers', async () => {
  const { wallpaperClassesForCode, WALLPAPER_WEATHER_CLASSES } = await loadTheme();

  assert.deepEqual(wallpaperClassesForCode(0), ['weather-clear']);
  assert.deepEqual(wallpaperClassesForCode(45), ['weather-foggy']);
  assert.deepEqual(wallpaperClassesForCode(66), ['weather-icy', 'weather-light']);
  assert.deepEqual(wallpaperClassesForCode(65), ['weather-rainy', 'weather-heavy']);
  assert.deepEqual(wallpaperClassesForCode(96), ['weather-hail']);
  assert.deepEqual(wallpaperClassesForCode(99), ['weather-hail', 'weather-heavy']);

  for (const name of ['weather-foggy', 'weather-icy', 'weather-hail', 'weather-light', 'weather-heavy']) {
    assert.ok(WALLPAPER_WEATHER_CLASSES.includes(name), name);
  }
});

test('home, utils, and wallpaper consume the shared weather theme module', () => {
  const home = read('features/home.js');
  const utils = read('utils.js');
  const wallpaper = read('ui/wallpaper.js');

  assert.match(home, /resolveWeatherTheme/);
  assert.match(home, /headerClassesForTheme/);
  assert.match(utils, /HEADER_WEATHER_CLASSES/);
  assert.match(wallpaper, /wallpaperClassesForCode/);
  assert.match(wallpaper, /WALLPAPER_WEATHER_CLASSES/);
});
