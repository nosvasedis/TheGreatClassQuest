import test from 'node:test';
import assert from 'node:assert/strict';
import { AWARD_CLOUD_FAMILIES, buildAwardCloudGeometry, buildAwardCloudShapeHtml } from '../features/awardCloudShape.mjs';

function inside(g, x, y) {
    const [rx, ry, rw, rh, rr] = g.core;
    if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
        const dx = Math.max(rx + rr - x, 0, x - (rx + rw - rr));
        const dy = Math.max(ry + rr - y, 0, y - (ry + rh - rr));
        if (dx * dx + dy * dy <= rr * rr) return true;
    }
    return g.puffs.some(([cx, cy, r]) => (cx - x) ** 2 + (cy - y) ** 2 <= r * r);
}

test('every family keeps all content on cloud, desktop and phone sizes', () => {
    for (const family of AWARD_CLOUD_FAMILIES) {
        for (const [w, h, sideMax] of [[333, 386, 30], [305, 405, 22], [290, 470, 10]]) {
            const blocks = [[0, 30, 40, 40], [w - 40, 30, 40, 40], [w / 2 - 47, 10, 140, 94], [0, 120, w, h - 200], [10, h - 80, w - 20, 80]];
            for (const seed of ['a', 'b', 'stu-9']) {
                const g = buildAwardCloudGeometry(family, seed, { w, h, sideMax, blocks });
                for (const [bx, by, bw, bh] of blocks) {
                    for (let i = 0; i <= 10; i += 1) {
                        for (const [x, y] of [[bx + (bw * i) / 10, by], [bx + (bw * i) / 10, by + bh], [bx, by + (bh * i) / 10], [bx + bw, by + (bh * i) / 10]]) {
                            assert.ok(inside(g, x, y), `${family}/${seed} ${w}x${h}: ${x},${y} off cloud`);
                        }
                    }
                }
            }
        }
    }
});

test('the same hero always gets the same cloud, families differ', () => {
    const a = buildAwardCloudShapeHtml('twin', 'stu-1', { w: 333, h: 390 }, 'stu-1');
    assert.equal(a, buildAwardCloudShapeHtml('twin', 'stu-1', { w: 333, h: 390 }, 'stu-1'));
    assert.notEqual(a, buildAwardCloudShapeHtml('tower', 'stu-1', { w: 333, h: 390 }, 'stu-1'));
    assert.ok(!buildAwardCloudShapeHtml('twin', 'x', {}, 'stu-2').includes('awc-stu-1'));
});
