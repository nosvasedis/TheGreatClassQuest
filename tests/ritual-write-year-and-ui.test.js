import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

function welcomeBackBlock() {
  const src = read('ui/core/listeners.js');
  const block = src.split("dataset.action === 'welcome-back'")[1];
  assert.ok(block, 'welcome-back handler is missing');
  return block.split('// 3. Handle Undo Button')[0];
}

function teacherBoonAwardFn() {
  const src = read('features/boons.js');
  const fn = src.split('export async function awardTeacherBoon')[1];
  assert.ok(fn, 'awardTeacherBoon is missing');
  return fn.split('\nexport ')[0];
}

function lockInSentenceFn() {
  const src = read('features/storyWeaver.js');
  const fn = src.split('export async function handleLockInSentence')[1];
  assert.ok(fn, 'handleLockInSentence is missing');
  return fn.split('\nexport ')[0];
}

test('Welcome Back tags award_log and today_stars with the active school year', () => {
  const block = welcomeBackBlock();
  assert.match(block, /transaction\.set\(\s*newLogRef\s*,\s*withSchoolYear\(/);
  assert.match(block, /transaction\.set\(\s*todayStarsRef\s*,\s*withSchoolYear\(/);
  assert.match(read('ui/core/listeners.js'), /withSchoolYear/);
});

test('Teacher Boon tags its award_log with the active school year', () => {
  const fn = teacherBoonAwardFn();
  assert.match(fn, /transaction\.set\(\s*logRef\s*,\s*withSchoolYear\(/);
});

test('ceremony.js imports getDoc from the Firebase adapter', () => {
  const ceremony = read('features/ceremony.js');
  assert.match(
    ceremony,
    /import \{[^}]*\bgetDoc\b[^}]*\} from '\.\.\/firebase\.js'/
  );
});

test('Story Weaver creates the class story parent before the first chapter', () => {
  const fn = lockInSentenceFn();
  assert.match(fn, /storyDocExists/);
  assert.match(
    fn,
    /if\s*\(\s*!storyDocExists\s*\)[\s\S]*await setDoc\(\s*storyDocRef[\s\S]*await setDoc\(\s*newHistoryDoc/
  );
});

test('saving an avatar refreshes Award Stars, Students, and Home', () => {
  const avatar = read('features/avatar.js');
  const saveFn = avatar.split('export async function handleSaveAvatar')[1]?.split('export async function handleDeleteAvatar')[0];
  assert.ok(saveFn, 'handleSaveAvatar is missing');
  assert.match(avatar, /renderAwardStarsStudentList/);
  assert.match(avatar, /renderManageStudentsTab/);
  assert.match(avatar, /renderHomeTab/);
  assert.match(saveFn, /refreshVisibleStudentPortraits\(/);
});
