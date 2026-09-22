import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

function closeSchoolYearSource() {
    const functions = read('functions/index.js');
    return functions.split('exports.closeSchoolYear')[1].split('exports.archiveCarriedYearGold')[0];
}

test('Fortune Ledger listener is scoped to the active school year', () => {
    const listeners = read('db/listeners.js');
    const wheelQuery = listeners.split('fortune_wheel_log`)')[1]?.split('state.setUnsubscribeFortuneWheelLog')[0] || '';
    assert.match(
        listeners,
        /fortune_wheel_log`\)[\s\S]{0,280}yearScopeClauses\(enforceActiveYearQueries,\s*activeYearKey\)/,
    );
    assert.doesNotMatch(wheelQuery, /orderBy\(/);
    assert.match(listeners, /isActiveYearDoc\(item,\s*activeYearKey/);
    assert.match(listeners, /setFortuneWheelLog\(log\)/);
});

test('wheel spin checks and class history stay in the active school year', () => {
    const guilds = read('db/actions/guilds.js');
    const hasSpun = guilds.split('export async function hasSpunThisWeek')[1].split('export async function getRecentWheelResults')[0];
    const recent = guilds.split('export async function getRecentWheelResults')[1].split('export async function applyGloryModifier')[0];
    assert.match(hasSpun, /schoolYearKey/);
    assert.match(hasSpun, /getActiveSchoolYearKey/);
    assert.match(recent, /schoolYearKey/);
    assert.match(recent, /getActiveSchoolYearKey/);
});

test('year close keeps Fortune Ledger entries in the closed year instead of deleting them', () => {
    const closeFn = closeSchoolYearSource();
    const functions = read('functions/index.js');
    assert.match(functions.split('const yearCollections')[1].split('];')[0], /fortune_wheel_log/);
    assert.match(closeFn, /today_stars/);
    assert.doesNotMatch(closeFn, /fortune_wheel_log/);
    assert.doesNotMatch(closeFn, /clearedFortuneWheelLogs/);
});

test('Fortune Ledger active-year queries have composite indexes', () => {
    const indexes = JSON.parse(read('firestore.indexes.json'));
    const fortuneIndexes = (indexes.indexes || []).filter((index) => index.collectionGroup === 'fortune_wheel_log');
    const hasYearClassWeek = fortuneIndexes.some((index) => {
        const fields = index.fields || [];
        return fields.length === 3
            && fields[0].fieldPath === 'schoolYearKey'
            && fields[1].fieldPath === 'classId'
            && fields[2].fieldPath === 'weekKey';
    });
    assert.equal(hasYearClassWeek, true);
});
