#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const projectId = process.env.FIREBASE_PROJECT || 'the-great-class-quest';
const maxAttempts = Number(process.env.INDEX_WAIT_ATTEMPTS || 40);
const delayMs = Number(process.env.INDEX_WAIT_DELAY_MS || 15000);
const firebaseBin = path.join(
  repoRoot,
  'node_modules',
  'firebase-tools',
  'lib',
  'bin',
  'firebase.js',
);

const TARGET_INDEXES = [
  { collectionGroup: 'attendance', fields: ['schoolYearKey', 'createdAt'] },
  { collectionGroup: 'written_scores', fields: ['schoolYearKey', 'date'] },
  { collectionGroup: 'quest_assignments', fields: ['schoolYearKey', 'createdBy.uid'] },
  { collectionGroup: 'hero_chronicle_notes', fields: ['schoolYearKey', 'teacherId'] },
  { collectionGroup: 'quest_bounties', fields: ['schoolYearKey', 'createdBy.uid'] },
  { collectionGroup: 'shop_items', fields: ['schoolYearKey', 'teacherId'] },
  { collectionGroup: 'completed_stories', fields: ['schoolYearKey', 'completedAt'] },
  { collectionGroup: 'award_log', fields: ['schoolYearKey', 'studentId', 'reason'] },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function listPrettyIndexLines() {
  const result = spawnSync(
    process.execPath,
    [firebaseBin, 'firestore:indexes', '--pretty', '--project', projectId, '--non-interactive'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to list Firestore indexes.');
  }
  return String(result.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePrettyLine(line) {
  const match = line.match(/^\[(READY|CREATING|NEEDS_REPAIR|UNKNOWN)\]\s+\(([^)]+)\)\s+--\s+(.+)$/);
  if (!match) return null;
  const [, state, collectionGroup, fieldSection] = match;
  const fields = [...fieldSection.matchAll(/\(([^,]+),/g)].map((part) => part[1]);
  return { state, collectionGroup, fields };
}

function findTargetState(lines, target) {
  for (const line of lines) {
    const parsed = parsePrettyLine(line);
    if (!parsed) continue;
    if (parsed.collectionGroup !== target.collectionGroup) continue;
    if (parsed.fields.length !== target.fields.length) continue;
    if (parsed.fields.every((field, index) => field === target.fields[index])) {
      return parsed.state;
    }
  }
  return 'MISSING';
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const lines = listPrettyIndexLines();
    const statuses = TARGET_INDEXES.map((target) => ({
      target,
      state: findTargetState(lines, target),
    }));
    const pending = statuses.filter((item) => item.state !== 'READY');

    console.log(
      `[indexes] attempt ${attempt}/${maxAttempts}: ready=${statuses.length - pending.length}/${statuses.length}, pending=${pending.length}`,
    );
    for (const item of statuses) {
      console.log(
        `  - ${item.target.collectionGroup} [${item.target.fields.join(', ')}]: ${item.state}`,
      );
    }

    if (pending.length === 0) {
      console.log('All target Firestore indexes are ready.');
      return;
    }

    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }

  throw new Error('Timed out waiting for Firestore indexes to become READY.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
