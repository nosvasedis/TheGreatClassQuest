import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    AWARD_CLOUD_BOARDS, AWARD_CLOUD_FAMILIES, awardCloudInsetCss, buildAwardCloudArtSvg, getAwardCloudShape, isOnAwardCloud
} from '../features/awardCloudShape.mjs';

test('there are ten cloud families', () => {
    assert.equal(AWARD_CLOUD_FAMILIES.length, 10);
    assert.equal(new Set(AWARD_CLOUD_FAMILIES).size, 10);
});

for (const board of Object.keys(AWARD_CLOUD_BOARDS)) {
    const B = AWARD_CLOUD_BOARDS[board];
    for (const family of AWARD_CLOUD_FAMILIES) {
        test(`${family} (${board}) covers the middle of its content box`, () => {
            const shape = getAwardCloudShape(family, board);
            const x0 = B.w * (B.sx || 0) + B.h * 0.05; const x1 = B.w - x0;
            for (let x = x0; x <= x1; x += 10) {
                for (const y of [B.h * 0.05, B.h / 2, B.h * 0.95]) assert.ok(isOnAwardCloud(shape, x, y), `${x},${y} off cloud`);
            }
        });
        test(`${family} (${board}) is a ring of round puffs that reaches past the box`, () => {
            const shape = getAwardCloudShape(family, board);
            assert.ok(shape.puffs.length >= 8);
            assert.ok(shape.puffs.every(([, , r]) => r > 20));
            const [top, right, bottom, left] = awardCloudInsetCss(family, board).split(' ').map(parseFloat);
            for (const v of [top, right, bottom, left]) assert.ok(v < 0 && v > -60, `inset ${v}`);
        });
    }
}

test('every cloud svg has its own ids', () => {
    const a = buildAwardCloudArtSvg('cumulus', 'wide', 'h1');
    const b = buildAwardCloudArtSvg('cumulus', 'wide', 'h2');
    assert.match(a, /id="awc-h1-s"/);
    assert.match(b, /href="#awc-h2-s"/);
    assert.ok(!b.includes('awc-h1'));
    assert.match(a, /var\(--awc-top\)/);
});
