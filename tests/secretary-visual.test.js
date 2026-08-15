import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

test('Secretary school tabs have explicit, accessible selected colors', () => {
    const shared = read('features/roles/shared.js');
    const school = read('features/secretary/school.js');
    const css = read('styles/roles.css');

    assert.match(shared, /role-subtab-btn--\$\{escapeHtml\(tone\)\}/);
    assert.match(shared, /aria-selected=/);
    assert.match(school, /tone: 'sky'/);
    assert.match(school, /tone: 'emerald'/);
    assert.match(css, /\.role-subtab-btn--sky\.options-subtab-active\s*\{[\s\S]*?background:/);
    assert.match(css, /\.role-subtab-btn--emerald\.options-subtab-active\s*\{[\s\S]*?background:/);
});

test('Secretary heading uses the teacher title face treatment', () => {
    const roles = read('templates/roles.js');
    const consoleJs = read('features/secretaryConsole.js');
    const ceremony = read('styles/ceremony2.css');

    assert.match(roles, /data-text="Loading\.\.\."/);
    assert.match(roles, /font-title text-2xl text-white sm:text-4xl/);
    assert.doesNotMatch(roles, /truncate" \$\{titleAttr\}/);
    assert.match(consoleJs, /titleEl\.dataset\.text\s*=\s*'Secretary Office'/);
    assert.match(ceremony, /header h1\.font-title::before\s*\{/);
    assert.match(ceremony, /content:\s*attr\(data-text\)/);
});

test('Secretary Home uses the teacher Horizons dashboard', () => {
    const home = read('features/secretary/home.js');
    const roles = read('templates/roles.js');

    assert.match(home, /horizons-grid/);
    assert.match(home, /greeting-panel/);
    assert.match(home, /weather-card/);
    assert.match(home, /stat-card-pop/);
    assert.match(home, /tools-grid-v2/);
    assert.match(home, /tool-btn-pop/);
    assert.match(home, /Good Morning/);
    assert.match(roles, /class="role-tab max-w-7xl mx-auto" data-secretary-section="home"/);
    assert.doesNotMatch(home, /secretary-home-hero|Your school day|secretary-home-shortcuts/);
    assert.doesNotMatch(home, /renderTabHero/);
});

test('Secretary Admin uses friendly labels and filled active navigation', () => {
    const admin = read('features/secretary/admin.js');
    const year = read('features/schoolYearConsole.js');
    const css = read('styles/roles.css');

    assert.match(admin, /Keep everything running smoothly/);
    assert.match(admin, /View plan and billing/);
    assert.match(admin, /One class can be different/);
    assert.doesNotMatch(admin, /Admin control center|Secretary permissions|Manage plan in Stripe/);
    assert.doesNotMatch(year, /Index readiness|Manifest included|Preview Year Close|Finalize September Sync/);
    assert.match(css, /\.secretary-admin-nav__item--emerald\.is-active\s*\{[\s\S]*?background:/);
});
