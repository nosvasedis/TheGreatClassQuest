import test from 'node:test';
import assert from 'node:assert/strict';
import {
    HABITAT_SEASONS,
    HABITAT_SPECIES,
    HABITAT_TIMES,
    buildHabitat,
    habitatPlaces,
    habitatSeason,
    habitatSpots,
    habitatTimeOfDay,
    habitatWeather,
    habitatWeathers
} from '../features/familiarHabitat.mjs';

const SPECIES = ['emberfang', 'frostpaw', 'thornback', 'veilshade', 'sparkling', 'tidefin', 'stormwing', 'gemshell', 'starfoal', 'cloverhop'];

test('every species has its own home with six places (egg nest + five forms)', () => {
    assert.deepEqual([...HABITAT_SPECIES].sort(), [...SPECIES].sort());
    const homes = new Set();
    for (const typeId of SPECIES) {
        const places = habitatPlaces(typeId);
        assert.equal(places.length, 6, typeId);
        assert.equal(new Set(places).size, 6, `${typeId} places are all different`);
        homes.add(buildHabitat({ typeId, stage: 1, seed: 's', time: 'day', season: 'spring' }).home);
    }
    assert.equal(homes.size, SPECIES.length);
});

test('every species, form, time, season and weather paints a clean scene', () => {
    for (const typeId of SPECIES) {
        for (let stage = 0; stage <= 5; stage++) {
            for (const time of HABITAT_TIMES) {
                for (const season of HABITAT_SEASONS) {
                    for (const weather of habitatWeathers(season)) {
                        const h = buildHabitat({ typeId, stage, time, season, weather, seed: `${typeId}-${stage}` });
                        assert.ok(h.svg.startsWith('<svg') && h.svg.endsWith('</svg>'));
                        assert.doesNotMatch(h.svg + h.airSvg + h.mistSvg, /NaN|undefined|Infinity/, `${typeId} ${stage} ${time} ${season} ${weather}`);
                        assert.equal(h.time, time);
                        assert.equal(h.season, season);
                        assert.equal(h.weather, weather);
                        assert.equal(h.place, habitatPlaces(typeId)[stage]);
                    }
                }
            }
        }
    }
});

test('the home grows: each form adds its landmark', () => {
    for (const typeId of SPECIES) {
        let last = -1;
        for (let stage = 0; stage <= 5; stage++) {
            const h = buildHabitat({ typeId, stage, seed: 'grow', time: 'day', season: 'summer', weather: 'clear' });
            const landmarks = (h.svg.match(/class="hb-landmark"/g) || []).length;
            assert.ok(landmarks > last, `${typeId} stage ${stage}`);
            last = landmarks;
        }
    }
});

test('the same student gets the same home; another student gets another layout', () => {
    const a = buildHabitat({ typeId: 'thornback', stage: 3, seed: 'stu-a', time: 'day', season: 'summer', weather: 'clear' });
    const a2 = buildHabitat({ typeId: 'thornback', stage: 3, seed: 'stu-a', time: 'day', season: 'summer', weather: 'clear' });
    const b = buildHabitat({ typeId: 'thornback', stage: 3, seed: 'stu-b', time: 'day', season: 'summer', weather: 'clear' });
    assert.equal(a.svg, a2.svg);
    assert.notEqual(a.svg, b.svg);
});

test('clock and calendar pick the time of day and the season', () => {
    assert.equal(habitatTimeOfDay(new Date(2026, 10, 2, 6, 30)), 'dawn');
    assert.equal(habitatTimeOfDay(new Date(2026, 10, 2, 10, 0)), 'day');
    assert.equal(habitatTimeOfDay(new Date(2026, 10, 2, 18, 0)), 'dusk');
    assert.equal(habitatTimeOfDay(new Date(2026, 10, 2, 23, 0)), 'night');
    assert.equal(habitatSeason(new Date(2026, 3, 1)), 'spring');
    assert.equal(habitatSeason(new Date(2026, 6, 1)), 'summer');
    assert.equal(habitatSeason(new Date(2026, 10, 1)), 'autumn');
    assert.equal(habitatSeason(new Date(2027, 0, 10)), 'winter');
});

test("today's weather stays the same all day and fits the season", () => {
    const morning = habitatWeather('winter', 'seed', new Date(2027, 0, 10, 8));
    const evening = habitatWeather('winter', 'seed', new Date(2027, 0, 10, 19));
    assert.equal(morning, evening);
    assert.ok(habitatWeathers('winter').includes(morning));
});

test('the snack is always there; the toy and the home come with the forms', () => {
    assert.deepEqual(habitatSpots(1).map((s) => s.id), ['treat', 'home']);
    assert.deepEqual(habitatSpots(2).map((s) => s.id), ['treat', 'toy', 'home']);
});
