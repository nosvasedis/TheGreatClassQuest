import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

test('guild house display keeps membership and never looks up a missing allGuilds state list', async () => {
    const { getGuildHouseDisplay } = await import('../features/guilds.js');

    const assigned = getGuildHouseDisplay('grizzly_might');
    assert.equal(assigned.assigned, true);
    assert.equal(assigned.name, 'Grizzly Might');
    assert.match(assigned.label, /Grizzly Might/);
    assert.equal(assigned.description, 'Active House Member');

    const empty = getGuildHouseDisplay(null);
    assert.equal(empty.assigned, false);
    assert.equal(empty.label, 'Unassigned');
    assert.equal(empty.description, 'No guild assigned yet');

    const modal = read('ui/modals/student.js');
    assert.match(modal, /getGuildHouseDisplay\(/);
    assert.doesNotMatch(modal, /allGuilds/);
});

test('edit-student header avatar enlarges instead of opening Avatar Forge', () => {
    const template = read('templates/modals/student.js');
    const modal = read('ui/modals/student.js');

    assert.match(template, /id="edit-student-header-avatar"/);
    assert.match(template, /edit-student-header-avatar[\s\S]*enlargeable-avatar/);
    assert.doesNotMatch(modal, /headerAvatarWrap\) headerAvatarWrap\.onclick = handleOpenAvatar/);
    assert.match(modal, /el\.dataset\.studentId = studentId/);
    assert.match(modal, /handleAvatarClick\(event\)/);
});

test('avatar forge control sits left of the student name on Profile', () => {
    const template = read('templates/modals/student.js');
    const modal = read('ui/modals/student.js');
    const profilePanel = template.split('id="edit-student-panel-profile"')[1].split('id="edit-student-panel-dates"')[0];
    const hubPanel = template.split('id="edit-student-panel-actions"')[1].split('Sticky Modal Footer')[0];
    const nameCardStart = profilePanel.indexOf('id="edit-student-open-avatar-btn"');
    const nameInputStart = profilePanel.indexOf('id="edit-student-name-input-full"');

    assert.notEqual(nameCardStart, -1);
    assert.ok(nameCardStart < nameInputStart);
    assert.match(profilePanel, /edit-student-avatar-preview-box/);
    assert.match(profilePanel, /edit-student-forge-btn/);
    assert.match(profilePanel, /aria-label="Open Avatar Forge"/);
    assert.doesNotMatch(profilePanel, /Visual Identity|Chibi Hero Avatar|Hero Portrait/);
    assert.match(hubPanel, /edit-student-hub-avatar-btn/);
    assert.doesNotMatch(hubPanel, /edit-student-avatar-preview-box|Hero Portrait/);
    assert.match(modal, /edit-student-open-avatar-btn/);
    assert.match(modal, /edit-student-hub-avatar-btn/);
    assert.doesNotMatch(template, /chibi/i);
    assert.doesNotMatch(modal, /Chibi/);
});
