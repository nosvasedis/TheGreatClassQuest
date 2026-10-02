import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchLiveWeather, getCachedWeather, LIVE_WEATHER_TTL_MS } from '../features/liveWeather.js';
import { setWeatherCoordinates, getActiveWeatherLocation, getWeatherCacheKey, normalizeWeatherLocation } from '../utils.js';

function mockStorage(t, value) {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value });
    t.after(() => {
        if (original) Object.defineProperty(globalThis, 'localStorage', original);
        else delete globalThis.localStorage;
    });
}

function storage() {
    const rows = new Map();
    return { rows, getItem: key => rows.get(key) || null, setItem: (key, value) => rows.set(key, value) };
}
function payload(code = 63) {
    return { timezone: 'Europe/Athens', current: { time: Math.floor(Date.now() / 1000), temperature_2m: 22, weather_code: code, cloud_cover: 80, wind_speed_10m: 15 } };
}
const response = data => ({ ok: true, headers: new Headers(), json: async () => data });
const place = (n, lat = 38) => ({ name: `Weather test ${n}`, latitude: lat, longitude: 20 + n / 100, timezone: 'Europe/Athens' });

test('parallel consumers share one request and reuse a validated cache', async t => {
    t.mock.method(globalThis, 'fetch', async () => response(payload()));
    mockStorage(t, storage());
    setWeatherCoordinates(place(1));
    const readings = await Promise.all([fetchLiveWeather(), fetchLiveWeather(), fetchLiveWeather()]);
    assert.equal(globalThis.fetch.mock.callCount(), 1);
    assert.equal(readings[0], readings[1]);
    assert.equal(getCachedWeather().code, 63);
    await fetchLiveWeather();
    assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('switching schools cannot share inflight requests or contaminate the new location cache', async t => {
    const store = storage();
    mockStorage(t, store);
    let finishFirst;
    t.mock.method(globalThis, 'fetch', url => {
        if (new URL(url).searchParams.get('latitude') === '38') return new Promise(resolve => { finishFirst = () => resolve(response(payload(65))); });
        return Promise.resolve(response(payload(0)));
    });
    setWeatherCoordinates(place(2, 38));
    const firstLocation = getActiveWeatherLocation();
    const first = fetchLiveWeather();
    setWeatherCoordinates(place(3, 40));
    const second = await fetchLiveWeather();
    finishFirst();
    assert.equal(await first, null);
    assert.equal(second.code, 0);
    assert.equal(getCachedWeather().code, 0);
    const original = JSON.parse(store.getItem(getWeatherCacheKey('gcq_weather_data_v2', firstLocation)));
    assert.equal(original.weather.code, 65);
    assert.equal(original.weather.location.latitude, 38);
});

test('invalid primary payload uses MET without guessing daily limits or rain probability', async t => {
    mockStorage(t, storage());
    t.mock.method(globalThis, 'fetch', async url => {
        if (url.includes('open-meteo')) return response({ current: { temperature_2m: null } });
        return response({ properties: { timeseries: [{ time: new Date().toISOString(), data: { instant: { details: { air_temperature: 20, wind_speed: 4 } }, next_1_hours: { summary: { symbol_code: 'rain' }, details: {} } } }] } });
    });
    setWeatherCoordinates(place(4));
    const reading = await fetchLiveWeather();
    assert.equal(reading.provider, 'met-norway');
    assert.equal(reading.windSpeed, 14.4);
    assert.equal(reading.hi, null);
    assert.equal(globalThis.fetch.mock.callCount(), 2);
    await fetchLiveWeather();
    assert.equal(globalThis.fetch.mock.callCount(), 2);
});

test('blocked localStorage remains usable and does not refetch for every consumer', async t => {
    mockStorage(t, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
    t.mock.method(globalThis, 'fetch', async () => response(payload()));
    setWeatherCoordinates(place(5));
    assert.equal((await fetchLiveWeather()).temp, 22);
    assert.equal((await fetchLiveWeather()).temp, 22);
    assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('both APIs failing retains only a recent same-school reading and throttles retries', async t => {
    const store = storage();
    mockStorage(t, store);
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
    setWeatherCoordinates(place(6));
    const location = getActiveWeatherLocation();
    const key = getWeatherCacheKey('gcq_weather_data_v2', location);
    store.setItem(key, JSON.stringify({ timestamp: Date.now() - LIVE_WEATHER_TTL_MS - 1000, weather: { temp: 20, code: 65, cloudCover: 95, provider: 'open-meteo', observedAt: Date.now() - 20 * 60000, location } }));
    assert.equal((await fetchLiveWeather()).code, 65);
    assert.equal((await fetchLiveWeather()).code, 65);
    assert.equal(globalThis.fetch.mock.callCount(), 2);
    store.setItem(key, JSON.stringify({ timestamp: Date.now() - 6 * 3600000, weather: { temp: 20, code: 65, provider: 'open-meteo', observedAt: Date.now() - 6 * 3600000, location } }));
    assert.equal(await fetchLiveWeather(), null);
});

test('invalid coordinates cannot silently request the equator or another hemisphere', () => {
    for (const extra of [{ latitude: null, longitude: 20 }, { latitude: 91, longitude: 20 }, { latitude: 38, longitude: 181 }]) {
        assert.equal(normalizeWeatherLocation({ name: 'School', ...extra }), null);
    }
});

test('MET expiry can extend its cache past the primary TTL, while an explicit refresh bypasses it', async t => {
    const store = storage();
    mockStorage(t, store);
    t.mock.method(globalThis, 'fetch', async () => response(payload(0)));
    setWeatherCoordinates(place(7));
    const location = getActiveWeatherLocation();
    const key = getWeatherCacheKey('gcq_weather_data_v2', location);
    store.setItem(key, JSON.stringify({ timestamp: Date.now() - 20 * 60000, expiresAt: Date.now() + 30 * 60000,
        weather: { temp: 20, code: 63, provider: 'met-norway', observedAt: Date.now() - 20 * 60000, location } }));
    assert.equal((await fetchLiveWeather()).provider, 'met-norway');
    assert.equal(globalThis.fetch.mock.callCount(), 0);
    assert.equal(getCachedWeather(0), null);
    assert.equal((await fetchLiveWeather({ maxAgeMs: 0 })).provider, 'open-meteo');
    assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('a hanging primary request aborts and hands control to the fallback', async t => {
    mockStorage(t, storage());
    let aborted = false;
    t.mock.method(globalThis, 'fetch', async (url, { signal }) => {
        if (url.includes('open-meteo')) return new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Timed out', 'AbortError')); });
        });
        return response({ properties: { timeseries: [{ time: new Date().toISOString(), data: { instant: { details: { air_temperature: 19 } }, next_1_hours: { summary: { symbol_code: 'cloudy' }, details: {} } } }] } });
    });
    setWeatherCoordinates(place(8));
    assert.equal((await fetchLiveWeather()).provider, 'met-norway');
    assert.equal(aborted, true);
});
