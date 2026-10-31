import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the confirmation card keeps the ids showModal fills', () => {
    const template = read('templates/modals/base.js');
    for (const id of ['confirmation-modal', 'modal-icon-container', 'modal-title', 'modal-message', 'modal-cancel-btn', 'modal-confirm-btn']) {
        assert.match(template, new RegExp(`id="${id}"`), id);
    }
    assert.match(template, /class="gcq-confirm pop-in" data-tone="default" role="alertdialog"/);
});

test('every dialog starts clean: tone, icon and an enabled Confirm button', () => {
    const base = read('ui/modals/base.js');
    const body = base.slice(base.indexOf('export function showModal('), base.indexOf('export function showTypedConfirmationModal('));
    assert.match(body, /card\.dataset\.tone = tone;/);
    assert.match(body, /iconContainer\.classList\.toggle\('hidden', !icon\);/);
    // a cancelled typed confirmation must not leave the next dialog's Confirm disabled
    assert.match(body, /confirmBtn\.disabled = false;/);
    assert.ok(body.indexOf('confirmBtn.disabled = false;') < body.indexOf('cloneNode'), 'reset before the button is cloned');
    assert.match(base, /import '\.\.\/\.\.\/styles\/confirm_dialog\.css';/);
});

test('the confirmation tones exist in the stylesheet', () => {
    const css = read('styles/confirm_dialog.css');
    assert.match(css, /\.gcq-confirm\[data-tone="danger"\]/);
    assert.match(css, /\.gcq-confirm\[data-tone="milestone"\]/);
    assert.match(css, /\.gcq-confirm__btn:disabled/);
});
