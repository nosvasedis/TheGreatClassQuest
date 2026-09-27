import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseCardPlacement, computeFreeRegions, rectsOverlap } from '../utils/wallpaperLayout.mjs';

const hub = { left: 610, right: 1310, top: 180, bottom: 900 };
const viewport = { width: 1920, height: 1080 };

function placedRect(placement, card) {
    return {
        left: placement.left,
        top: placement.top,
        right: placement.left + card.width * placement.scale,
        bottom: placement.top + card.height * placement.scale
    };
}

test('cards never overlap the clock hub on a wide projector', () => {
    const card = { width: 400, height: 420 };
    for (let i = 0; i < 50; i++) {
        const placement = chooseCardPlacement({ viewport, hub, cardSize: card, topReserve: 100, bottomLimit: 1000 });
        const rect = placedRect(placement, card);
        assert.equal(rectsOverlap(rect, hub), false, `run ${i} overlapped (${placement.region})`);
        assert.ok(rect.left >= 0 && rect.right <= viewport.width, 'stays on screen horizontally');
        assert.ok(rect.top >= 100 && rect.bottom <= 1000, 'stays clear of controls and quote dock');
    }
});

test('on a small projector the card shrinks instead of covering the hub or leaving the screen', () => {
    const smallViewport = { width: 1366, height: 768 };
    const smallHub = { left: 358, right: 1008, top: 60, bottom: 700 };
    const card = { width: 400, height: 460 };
    const placement = chooseCardPlacement({ viewport: smallViewport, hub: smallHub, cardSize: card, topReserve: 90, bottomLimit: 720 });
    assert.ok(placement.scale < 1);
    const rect = placedRect(placement, card);
    assert.equal(rectsOverlap(rect, smallHub), false);
    assert.ok(rect.left >= 0 && rect.right <= smallViewport.width);
});

test('free regions respect the reserved top strip and bottom dock', () => {
    const regions = computeFreeRegions(viewport, hub, { topReserve: 120, bottomLimit: 1000, margin: 24 });
    const left = regions.find((region) => region.name === 'left');
    assert.equal(left.top, 144);
    assert.equal(left.bottom, 976);
    assert.ok(regions.every((region) => region.right > region.left && region.bottom > region.top));
});

test('the previous region is avoided when another full-size spot exists', () => {
    const card = { width: 300, height: 300 };
    for (let i = 0; i < 20; i++) {
        const placement = chooseCardPlacement({ viewport, hub, cardSize: card, avoidRegion: 'left' });
        assert.notEqual(placement.region, 'left');
    }
});

test('returns null without a measurable card', () => {
    assert.equal(chooseCardPlacement({ viewport, hub, cardSize: { width: 0, height: 0 } }), null);
});
