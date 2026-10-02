import test from 'node:test';
import assert from 'node:assert/strict';
import { HOURGLASS_FRAMES, POSE_SCALES, getQuestCursorAssets, getQuestCursorFrameSet, questCursorFrames,
    resolveQuestCursor } from '../ui/questCursorCore.mjs';

const svgOf = url => decodeURIComponent(url.slice(url.indexOf(',') + 1));

test('cursor policy follows semantic controls and editable or selectable text', () => {
    assert.equal(resolveQuestCursor(), 'default');
    assert.equal(resolveQuestCursor({ interactive: true, text: true }), 'pointer');
    assert.equal(resolveQuestCursor({ text: true }), 'text');
    for (const cursor of ['pointer', 'text', 'grab', 'grabbing', 'move', 'help', 'crosshair', 'zoom-in', 'zoom-out']) {
        assert.equal(resolveQuestCursor({ cursor }), cursor);
    }
});

test('loading wins over disabled state but does not turn every disabled control into loading', () => {
    assert.equal(resolveQuestCursor({ disabled: true, interactive: true }), 'blocked');
    assert.equal(resolveQuestCursor({ disabled: true, busy: true }), 'progress');
    assert.equal(resolveQuestCursor({ busy: 'wait', interactive: true }), 'wait');
    assert.equal(resolveQuestCursor({ cursor: 'wait', disabled: true }), 'wait');
    assert.equal(resolveQuestCursor({ cursor: 'progress', disabled: true }), 'progress');
    assert.equal(resolveQuestCursor({ cursor: 'no-drop' }), 'blocked');
});

test('OS resize, precision, invisible and application-supplied cursors survive', () => {
    for (const cursor of ['none', 'ew-resize', 'ns-resize', 'nwse-resize', 'nesw-resize', 'col-resize', 'row-resize', 'vertical-text', 'copy', 'alias', 'cell', 'url("custom.svg") 2 2, pointer']) {
        assert.equal(resolveQuestCursor({ cursor, interactive: true, busy: true }), 'native', cursor);
    }
    assert.equal(resolveQuestCursor({ native: true, interactive: true }), 'native');
});

test('every native frame can be read again without changing its meaning', () => {
    for (const [mode, { rest, frames }] of Object.entries(getQuestCursorFrameSet())) {
        for (const asset of [rest, ...Object.values(frames)]) {
            assert.equal(resolveQuestCursor({ cursor: asset.css }), mode);
            assert.match(asset.css, /url\("data:image\/svg\+xml,/);
            assert.doesNotMatch(asset.url, /["#<>]/, 'data URI stays valid inside url("…")');
            const svg = svgOf(asset.url);
            assert.match(svg, /width='32' height='32'/);
            assert.match(svg, /id='gcq-quest-cursor'/);
            assert.match(asset.css, /\) \d+ \d+, [a-z-]+$/);
        }
    }
    assert.deepEqual(Object.keys(getQuestCursorAssets()), Object.keys(getQuestCursorFrameSet()));
});

test('poses scale around the hotspot so the aiming point never moves', () => {
    for (const [mode, { rest, frames }] of Object.entries(getQuestCursorFrameSet())) {
        for (const [pose, asset] of Object.entries(frames)) {
            assert.equal(asset.x, rest.x);
            assert.equal(asset.y, rest.y);
            if (!POSE_SCALES[pose]) continue;
            assert.match(svgOf(asset.url), new RegExp(`translate\\(${rest.x} ${rest.y}\\) scale\\(${POSE_SCALES[pose]}\\) translate\\(${-rest.x} ${-rest.y}\\)`), mode);
        }
    }
});

test('the hourglass loops seamlessly: sand drains, then the glass turns over', () => {
    const frames = questCursorFrames('wait');
    assert.equal(frames.length, HOURGLASS_FRAMES.length);
    assert.deepEqual(questCursorFrames('progress'), frames);
    const sand = HOURGLASS_FRAMES.map(frame => frame.sand);
    assert.equal(sand[0], 0);
    assert.ok(sand.every((value, i) => i === 0 || value >= sand[i - 1]), 'sand only ever drains');
    const angles = HOURGLASS_FRAMES.map(frame => frame.angle);
    assert.ok(angles.every((value, i) => i === 0 || value >= angles[i - 1]), 'the glass turns one way');
    assert.ok(angles.at(-1) < 180 && angles.at(-1) > 135, 'the last turn frame leads straight back to the start');
    // No abrupt jumps: the turn is spread across several frames.
    assert.ok(angles.every((value, i) => i === 0 || value - angles[i - 1] <= 50));
    const cycle = HOURGLASS_FRAMES.reduce((sum, frame) => sum + frame.duration, 0);
    assert.ok(cycle >= 1500 && cycle <= 2600, `calm cycle (${cycle}ms)`);
});

test('high-DPI native artwork increases resolution while preserving logical size and hotspots', () => {
    for (const ratio of [1.25, 2, 3]) {
        for (const [mode, { rest, frames }] of Object.entries(getQuestCursorFrameSet(ratio))) {
            for (const asset of [rest, ...Object.values(frames)]) {
                const nativeSvg = svgOf(asset.nativeUrl);
                assert.match(nativeSvg, new RegExp(`width='${32 * ratio}' height='${32 * ratio}'`));
                assert.match(nativeSvg, /viewBox='0 0 32 32'/);
                assert.match(asset.css, new RegExp(`\\) ${ratio}x\\) ${asset.x} ${asset.y},`));
                assert.equal(resolveQuestCursor({ cursor: asset.css }), mode);
            }
        }
    }
});
