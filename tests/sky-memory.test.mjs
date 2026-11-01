import test from 'node:test';
import assert from 'node:assert/strict';
import {
    approxSunTimes, loadingSkyPlan, readSkyMemory, rememberSkyReading, rememberSunTimes, SKY_MEMORY_FRESH_MS
} from '../features/skyMemory.mjs';

function memoryStorage() {
    const data = new Map();
    return {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, String(v)),
    };
}

const ATHENS = { latitude: 37.9667, longitude: 23.7167 };
const utcHours = (ms) => {
    const d = new Date(ms);
    return d.getUTCHours() + d.getUTCMinutes() / 60;
};

test('approxSunTimes gives Athens sunrise and sunset within a few minutes', () => {
    // 1 November: about 04:50 and 15:20 UTC.
    const nov = approxSunTimes(Date.UTC(2026, 10, 1, 9), ATHENS);
    assert.ok(Math.abs(utcHours(nov.sunrise) - 4.83) < 0.15, `sunrise ${utcHours(nov.sunrise)}`);
    assert.ok(Math.abs(utcHours(nov.sunset) - 15.33) < 0.15, `sunset ${utcHours(nov.sunset)}`);
    // 21 June: about 03:02 and 17:51 UTC.
    const jun = approxSunTimes(Date.UTC(2026, 5, 21, 9), ATHENS);
    assert.ok(Math.abs(utcHours(jun.sunrise) - 3.03) < 0.15, `sunrise ${utcHours(jun.sunrise)}`);
    assert.ok(Math.abs(utcHours(jun.sunset) - 17.85) < 0.15, `sunset ${utcHours(jun.sunset)}`);
});

test('loadingSkyPlan works out the sun with no memory and asks nothing', () => {
    const plan = loadingSkyPlan(Date.UTC(2026, 10, 1, 9), { storage: memoryStorage() });
    assert.equal(plan.weather, null);
    assert.equal(plan.place, null);
    assert.ok(plan.sun.sunset > plan.sun.sunrise);
});

test('a fresh reading is used; an old one is not, but its place is kept for asking', () => {
    const storage = memoryStorage();
    const t0 = new Date(2026, 10, 1, 9, 0).getTime();
    rememberSkyReading({ code: 63, cloudCover: 90, windSpeed: 20, windDirection: 90, location: ATHENS }, { now: t0, storage });
    const fresh = loadingSkyPlan(t0 + 10 * 60 * 1000, { storage });
    assert.deepEqual(fresh.weather, { code: 63, cloudCover: 90, windSpeed: 20, windDirection: 90 });
    assert.deepEqual(fresh.place, ATHENS);
    const stale = loadingSkyPlan(t0 + SKY_MEMORY_FRESH_MS + 1, { storage });
    assert.equal(stale.weather, null);
    assert.deepEqual(stale.place, ATHENS);
});

test('remembered sun times carry over to today at the same clock time', () => {
    const storage = memoryStorage();
    const yesterday = new Date(2026, 9, 31, 12, 0).getTime();
    rememberSunTimes({ sunrise: new Date(2026, 9, 31, 6, 49).getTime(), sunset: new Date(2026, 9, 31, 17, 21).getTime() }, { now: yesterday, storage });
    const plan = loadingSkyPlan(new Date(2026, 10, 1, 8, 0).getTime(), { storage });
    assert.equal(plan.sun.sunrise, new Date(2026, 10, 1, 6, 49).getTime());
    assert.equal(plan.sun.sunset, new Date(2026, 10, 1, 17, 21).getTime());
});

test('nonsense is ignored and broken storage never throws', () => {
    const storage = memoryStorage();
    rememberSkyReading({ code: null }, { storage });
    rememberSunTimes({ sunrise: 10, sunset: 5 }, { storage });
    assert.equal(readSkyMemory(storage), null);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    assert.doesNotThrow(() => rememberSkyReading({ code: 0 }, { storage: broken }));
    assert.ok(loadingSkyPlan(Date.now(), { storage: broken }).sun);
});
