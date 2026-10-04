import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FAMILIAR_PALETTES,
    buildFamiliarEggSvg,
    buildFamiliarSvg,
    createFamiliarLook,
    describeFamiliar,
    familiarVoice,
    getFamiliarPresets,
    isFamiliarTrickReady,
    legacyFamiliarLook,
    resolveFamiliarLook,
    trickMonthKey
} from '../features/familiarForge.mjs';

const TYPES = ['emberfang', 'frostpaw', 'thornback', 'veilshade', 'sparkling'];
const LEGACY_VARIANTS = {
    emberfang: ['cindercrest', 'sunscale', 'lavatail', 'ashwing', 'sparkfang'],
    frostpaw: ['auroratail', 'crystalear', 'snowmask', 'glacierstep', 'winterbloom'],
    thornback: ['mosscrown', 'amberroot', 'fernback', 'stonehide', 'wildbloom'],
    veilshade: ['starveil', 'moonclaw', 'misttail', 'riftmark', 'nightspark'],
    sparkling: ['sunribbon', 'roseflare', 'haloheart', 'daybreak', 'goldsong']
};

test('every class has 30 distinct named presets', () => {
    for (const type of TYPES) {
        const presets = getFamiliarPresets(type);
        assert.equal(presets.length, 30, type);
        assert.equal(new Set(presets.map((p) => p.id)).size, 30, type);
        assert.equal(new Set(presets.map((p) => p.label)).size, 30, type);
    }
});

test('the old variant names survive as palettes, so migrated familiars keep their name', () => {
    for (const [type, keys] of Object.entries(LEGACY_VARIANTS)) {
        for (const key of keys) {
            const look = legacyFamiliarLook(type, 'student-1', key);
            assert.ok(look.preset.startsWith(`${key}-`), `${type}/${key} -> ${look.preset}`);
            assert.ok(FAMILIAR_PALETTES[type].some((p) => p.key === key));
        }
    }
});

test('a legacy familiar resolves to the same look on every screen, and a saved look wins', () => {
    const old = { typeId: 'frostpaw', state: 'alive', level: 2, variant: { key: 'snowmask', label: 'Snowmask' } };
    assert.deepEqual(resolveFamiliarLook(old, 'abc'), resolveFamiliarLook(old, 'abc'));
    const saved = { ...old, look: { v: 1, preset: 'polarnight-tundra', seed: 42 } };
    assert.deepEqual(resolveFamiliarLook(saved, 'abc'), saved.look);
    const broken = { ...old, look: { v: 1, preset: 'no-such-preset', seed: 42 } };
    assert.ok(resolveFamiliarLook(broken, 'abc').preset.startsWith('snowmask-'));
});

test('genomes are deterministic and varied', () => {
    const look = { v: 1, preset: 'lavatail-glider', seed: 1234 };
    assert.deepEqual(describeFamiliar('emberfang', look), describeFamiliar('emberfang', look));
    const seen = new Set();
    let rand = 7;
    const next = () => { rand = (rand * 16807) % 2147483647; return rand / 2147483647; };
    for (let i = 0; i < 200; i++) {
        const g = describeFamiliar('sparkling', createFamiliarLook('sparkling', next));
        seen.add([g.preset.id, g.eyes, g.marking, g.keepsake, g.blush].join('|'));
    }
    assert.ok(seen.size > 150, `only ${seen.size} distinct looks in 200 eggs`);
});

test('every preset draws cleanly at every stage, as an egg and as a chip', () => {
    for (const type of TYPES) {
        for (const preset of getFamiliarPresets(type)) {
            for (const seed of [1, 99, 123457]) {
                const genome = describeFamiliar(type, { v: 1, preset: preset.id, seed });
                for (const level of [1, 2, 3]) {
                    for (const mode of ['full', 'chip']) {
                        const svg = buildFamiliarSvg(genome, { level, mode });
                        assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
                        assert.doesNotMatch(svg, /NaN|undefined|null|\[object/, `${preset.id} L${level} ${mode}`);
                    }
                }
                const egg = buildFamiliarEggSvg(genome, { progress: 90 });
                assert.doesNotMatch(egg, /NaN|undefined|null/);
            }
        }
    }
});

test('two drawings of the same familiar never share gradient ids', () => {
    const genome = describeFamiliar('thornback', { v: 1, preset: 'mosscrown-sprout', seed: 5 });
    const ids = (svg) => [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const a = ids(buildFamiliarSvg(genome, { level: 2 }));
    const b = ids(buildFamiliarSvg(genome, { level: 2 }));
    assert.ok(a.length > 0);
    assert.equal(a.filter((id) => b.includes(id)).length, 0);
});

test('only chips skip the drifting motes', () => {
    const genome = describeFamiliar('veilshade', { v: 1, preset: 'starveil-seer', seed: 3 });
    assert.match(buildFamiliarSvg(genome, { level: 3, mode: 'full' }), /fc-mote/);
    assert.doesNotMatch(buildFamiliarSvg(genome, { level: 3, mode: 'chip' }), /fc-mote/);
});

test('the trick is ready once a month from level 3', () => {
    const june = new Date(2026, 5, 10);
    assert.equal(trickMonthKey(june), '2026-06');
    assert.equal(isFamiliarTrickReady({ state: 'alive', level: 2 }, june), false);
    assert.equal(isFamiliarTrickReady({ state: 'egg', level: 0 }, june), false);
    assert.equal(isFamiliarTrickReady({ state: 'alive', level: 3, trickMonth: null }, june), true);
    assert.equal(isFamiliarTrickReady({ state: 'alive', level: 3, trickMonth: '2026-06' }, june), false);
    assert.equal(isFamiliarTrickReady({ state: 'alive', level: 3, trickMonth: '2026-05' }, june), true);
});

test('each class has its own voice, deeper as it grows', () => {
    const genome = describeFamiliar('thornback', { v: 1, preset: 'fernback-bloom', seed: 8 });
    const young = familiarVoice(genome, 1);
    const old = familiarVoice(genome, 3);
    assert.equal(young.kind, 'croak');
    assert.ok(old.pitch < young.pitch);
});
