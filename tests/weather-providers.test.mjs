import test from 'node:test';
import assert from 'node:assert/strict';
import { WMO_CODES, weatherNumber, readingFromOpenMeteo, readingFromMetNorway, wmoFromMetSymbol, pickUpcomingHours, openMeteoUrl } from '../features/weatherProviders.mjs';
import { resolveSkyScene, conditionForCode } from '../features/skyWeather.mjs';
import { resolveWeatherTheme } from '../features/weatherTheme.js';
import { hoursStripHtml, getWeatherCardHtml } from '../features/weatherCard.js';

const NOW = Date.parse('2026-10-02T09:20:00Z');
const makeOpen = (code = 63) => ({
    timezone: 'Europe/Athens', utc_offset_seconds: 10800,
    current: { time: NOW / 1000 - 300, temperature_2m: 21.6, weather_code: code, cloud_cover: 80, wind_speed_10m: 18, wind_direction_10m: 270, is_day: 1 },
    daily: { temperature_2m_max: [25.8], temperature_2m_min: [17.2] },
    hourly: { time: [NOW / 1000 - 1200, NOW / 1000 + 2400], weather_code: [3, code], temperature_2m: [21, 22], precipitation_probability: [null, 40] }
});
const makeMet = symbol => ({ properties: { timeseries: [0, 1, 2, 3, 4].map(i => ({
    time: new Date(NOW - 20 * 60000 + i * 3600000).toISOString(),
    data: { instant: { details: { air_temperature: 21 + i, cloud_area_fraction: 90, wind_speed: 5, wind_from_direction: 90 } }, next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: 0.5 } } }
})) } });

test('all existing WMO states survive the primary adapter, including ice and hail', () => {
    for (const code of WMO_CODES) {
        const reading = readingFromOpenMeteo(makeOpen(code), NOW);
        assert.equal(reading.code, code);
        assert.equal(reading.hours[0].code, code);
        assert.deepEqual(resolveWeatherTheme(reading.code), resolveWeatherTheme(code));
        const scene = resolveSkyScene(reading, { now: NOW, sunrise: NOW - 3600000, sunset: NOW + 3600000 });
        assert.equal(scene.condition, conditionForCode(code).condition);
    }
});

test('null values never turn into invented zero temperatures or dry forecasts', () => {
    for (const value of [null, undefined, '', '  ', false, true, 'bad']) assert.equal(weatherNumber(value), null);
    const input = makeOpen();
    input.current.temperature_2m = null;
    assert.equal(readingFromOpenMeteo(input, NOW), null);
    input.current.temperature_2m = 0;
    input.current.weather_code = null;
    assert.equal(readingFromOpenMeteo(input, NOW), null);
    input.current.weather_code = 0;
    input.daily.temperature_2m_max[0] = null;
    input.current.cloud_cover = null;
    input.hourly.precipitation_probability[1] = null;
    const reading = readingFromOpenMeteo(input, NOW);
    assert.equal(reading.temp, 0);
    assert.equal(reading.hi, null);
    assert.equal(reading.cloudCover, null);
    assert.equal(reading.hours[0].pop, null);
    assert.equal(readingFromOpenMeteo({ current: {} }, NOW), null);
});

test('absolute forecast hours and Greek labels work even on a UTC device', () => {
    const reading = readingFromOpenMeteo(makeOpen(), NOW);
    assert.equal(reading.hours[0].time, '2026-10-02T10:00:00.000Z');
    assert.match(hoursStripHtml(reading), /13:00/);
    assert.equal(pickUpcomingHours({ time: ['2026-10-02T12:00', '2026-10-02T13:00'], weather_code: [0, 3], temperature_2m: [20, 21] }, NOW, 4, 10800)[0].time, '2026-10-02T10:00:00.000Z');
    const url = new URL(openMeteoUrl({ latitude: 38, longitude: 23, timezone: 'Europe/Athens' }));
    assert.equal(url.searchParams.get('timeformat'), 'unixtime');
    assert.equal(url.searchParams.get('models'), 'best_match');
    assert.equal(url.searchParams.get('wind_speed_unit'), 'kmh');
});

test('outdated or invalid primary and fallback payloads are rejected', () => {
    const input = makeOpen();
    input.current.time = NOW / 1000 - 7200;
    assert.equal(readingFromOpenMeteo(input, NOW), null);
    assert.equal(readingFromMetNorway(makeMet('rain'), NOW + 10 * 3600000), null);
    assert.equal(readingFromMetNorway({ properties: { timeseries: [] } }, NOW), null);
    assert.equal(readingFromMetNorway(makeMet('unknown'), NOW), null);
});

test('MET maps forecast families and thunder without fabricating hail or freezing rain', () => {
    const pairs = { clearsky_day: 0, fair_night: 1, partlycloudy_day: 2, cloudy: 3, fog: 45, lightrain: 61, rain: 63, heavyrain: 65, lightrainshowers_day: 80, rainshowers_night: 81, heavyrainshowers_day: 82, lightsnow: 71, snow: 73, heavysnow: 75, lightsnowshowers_day: 85, heavysnowshowers_night: 86, rainandthunder: 95, lightssnowshowersandthunder_day: 95, lightssleetshowersandthunder_night: 95 };
    for (const [symbol, code] of Object.entries(pairs)) assert.equal(wmoFromMetSymbol(symbol), code, symbol);
    const reading = readingFromMetNorway(makeMet('rainshowers_day'), NOW);
    assert.equal(reading.windSpeed, 18);
    assert.equal(reading.temp, 21);
    assert.equal(reading.code, 81);
    assert.equal(reading.hi, null);
    assert.equal(reading.lo, null);
    assert.equal(reading.hours.length, 4);
    assert.equal(reading.hours[0].pop, null);
});

test('weather card identifies the source and omits missing wind', () => {
    const reading = readingFromMetNorway(makeMet('rain'), NOW);
    reading.windSpeed = null;
    const html = getWeatherCardHtml({ ...resolveWeatherTheme(reading.code), temp: '21°C' }, resolveSkyScene(reading), { reading });
    assert.match(html, /href="https:\/\/www.met.no\/en"/);
    assert.doesNotMatch(html, /weather-chip--wind/);
});
