import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStateHtml } from '../ui/emptyStateView.mjs';

test('empty state shows an icon, a title and the next step', () => {
    const html = emptyStateHtml({ icon: 'fa-users', title: 'No adventurers yet', line: 'Add your first student.' });
    assert.match(html, /class="gcq-empty" role="status"/);
    assert.match(html, /<i class="fas fa-users" aria-hidden="true"><\/i>/);
    assert.match(html, /gcq-empty__title">No adventurers yet</);
    assert.match(html, /gcq-empty__line">Add your first student\.</);
});

test('empty state escapes text and accepts an emoji icon', () => {
    const html = emptyStateHtml({ icon: '🏕️', title: '<b>Tom</b>', size: 'sm' });
    assert.match(html, /gcq-empty gcq-empty--sm/);
    assert.match(html, /<span aria-hidden="true">🏕️<\/span>/);
    assert.match(html, /&lt;b&gt;Tom&lt;\/b&gt;/);
    assert.doesNotMatch(html, /gcq-empty__line/);
});
