import test from 'node:test';
import assert from 'node:assert/strict';
import { getQuestCursorAssets, resolveQuestCursor } from '../ui/questCursorCore.mjs';

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

test('our native cursor fallback can be read again without changing its meaning', () => {
    for (const [mode, asset] of Object.entries(getQuestCursorAssets())) {
        assert.equal(resolveQuestCursor({ cursor: asset.css }), mode);
        assert.match(asset.css, /url\("data:image\/svg\+xml,/);
        const svg = decodeURIComponent(asset.url.split(',')[1]);
        assert.match(svg, /width="32" height="32"/);
        assert.match(svg, /id="gcq-quest-cursor"/);
        assert.match(asset.css, /\) \d+ \d+, [a-z-]+$/);
    }
});
