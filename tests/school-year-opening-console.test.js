import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('the School Year console exposes an Opening day control', () => {
    const console = read('features/schoolYearConsole.js');
    assert.match(console, /id="school-year-opening-day-input"/);
    assert.match(console, /id="school-year-save-opening-day-btn"/);
    assert.match(console, /function renderOpeningDayCard/);
    // The save path writes the year's startsAt and refreshes the active year in state.
    assert.match(console, /school_years\/\$\{activeYearKey\}/);
    assert.match(console, /startsAt/);
});

test('the click handler routes the Opening day save button', () => {
    const console = read('features/schoolYearConsole.js');
    assert.match(console, /closest\('#school-year-save-opening-day-btn'\)/);
    assert.match(console, /saveSchoolYearOpeningDay\(/);
});

test('class-day predicates consult the shared opening-day bound', () => {
    const utils = read('utils.js');
    const state = read('state.js');
    assert.match(utils, /import \{ isBeforeSchoolYearOpening \} from '\.\/utils\/schoolYearOpening\.mjs'/);
    assert.match(utils, /if \(isBeforeSchoolYearOpening\(targetDate\)\) \{[\s\S]*?return false;/);
    assert.match(utils, /if \(isBeforeSchoolYearOpening\(targetDate\)\) \{[\s\S]*?return \{ kind: 'before_term' \};/);
    assert.match(state, /_syncSchoolYearOpeningDay\(\)/);
});
