import test from 'node:test';
import assert from 'node:assert/strict';
import { legendaryArtSvg, hasLegendaryArt } from '../features/legendaryArt.mjs';

const SOLD = ['leg_aurum_silver', 'leg_gilded', 'leg_aurum', 'leg_bulwark', 'leg_glory_banner', 'leg_glory_chalice',
    'leg_glory_crown', 'leg_hourglass', 'leg_pathfinder', 'leg_quill', 'leg_protagonist', 'leg_kindness', 'leg_compassion'];

test('every Legendary Artifact on sale has drawn art; retired ones keep their emoji', () => {
    SOLD.forEach((id) => {
        assert.ok(hasLegendaryArt(id), id);
        const svg = legendaryArtSvg(id);
        assert.match(svg, /^<svg class="lg-art" viewBox="0 0 64 64"/);
        assert.ok(svg.endsWith('</svg>'));
        assert.doesNotMatch(svg, /NaN|undefined/);
    });
    ['leg_clarity', 'leg_luck', 'leg_banner', 'leg_catalyst', ''].forEach((id) => assert.equal(legendaryArtSvg(id), ''));
});

test('two copies of the same art on one page never share gradient ids', () => {
    const ids = (svg) => [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const a = ids(legendaryArtSvg('leg_aurum'));
    const b = ids(legendaryArtSvg('leg_aurum'));
    assert.ok(a.length > 0);
    assert.equal(a.filter((id) => b.includes(id)).length, 0);
});

test('the catalog: five relics, each with forms, every form drawn and priced', async () => {
    const { LEGENDARY_FAMILIES, LEGENDARY_ARTIFACTS, RETIRED_ARTIFACTS, legendaryFamilyVariants } = await import('../features/legendaryCatalog.mjs');
    assert.equal(LEGENDARY_FAMILIES.length, 5);
    const ids = [...LEGENDARY_ARTIFACTS, ...RETIRED_ARTIFACTS].map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
    LEGENDARY_FAMILIES.forEach((f) => {
        const forms = legendaryFamilyVariants(f.id);
        assert.ok(forms.length >= 2, f.id);
        forms.forEach((v, i) => {
            assert.ok(hasLegendaryArt(v.id), v.id);
            assert.ok(v.price > 0 && v.form && v.description);
            if (i > 0) assert.ok(v.price >= forms[i - 1].price);
        });
    });
    assert.deepEqual(LEGENDARY_ARTIFACTS.map((a) => a.id).sort(), SOLD.slice().sort());
});
