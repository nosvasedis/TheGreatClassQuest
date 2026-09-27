#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
const DEFAULT_PROJECT_ID = 'the-great-class-quest';
const DEFAULT_BUCKET = 'the-great-class-quest.firebasestorage.app';

// Must match PORTRAIT_CACHE_CONTROL in functions/avatarForge.js and
// AVATAR_IMAGE_CACHE_CONTROL in constants.js.
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const MAX_IMAGE_BYTES = 1024 * 1024;
const EXTENSION_BY_TYPE = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** Parse a legacy inline `data:image/...;base64,...` portrait. Returns null when unusable. */
function parseImageDataUrl(value) {
  const match = String(value || '').match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const contentType = match[1].toLowerCase();
  const extension = EXTENSION_BY_TYPE[contentType];
  if (!extension) return null;
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
  return { contentType, extension, bytes };
}

/** Extract { bucket, objectPath } from a Firebase Storage download URL. */
function storageObjectFromUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== 'firebasestorage.googleapis.com') return null;
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!match) return null;
    return { bucket: decodeURIComponent(match[1]), objectPath: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

function downloadUrlFor(bucket, objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

function canonicalObjectPath(studentId, extension) {
  return `avatars/${studentId}/avatar.${extension}`;
}

function parseArgs(argv) {
  const result = {
    projectId: DEFAULT_PROJECT_ID,
    bucket: DEFAULT_BUCKET,
    keyPath: '',
    execute: false,
    limit: 0,
    reportPath: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project' && argv[i + 1]) result.projectId = argv[++i];
    else if (arg === '--bucket' && argv[i + 1]) result.bucket = argv[++i];
    else if (arg === '--key' && argv[i + 1]) result.keyPath = argv[++i];
    else if (arg === '--limit' && argv[i + 1]) result.limit = Number(argv[++i]) || 0;
    else if (arg === '--report' && argv[i + 1]) result.reportPath = argv[++i];
    else if (arg.startsWith('--report=')) result.reportPath = arg.slice('--report='.length);
    else if (arg === '--execute') result.execute = true;
    else if (arg === '--dry-run') result.execute = false;
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  return result;
}

function initializeAdmin(projectId, keyPath) {
  let credential;
  if (keyPath) {
    const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(keyPath), 'utf8'));
    if (serviceAccount.project_id && serviceAccount.project_id !== projectId) {
      throw new Error(`The service-account key belongs to ${serviceAccount.project_id}, not ${projectId}.`);
    }
    credential = cert(serviceAccount);
  } else {
    credential = applicationDefault();
  }
  return initializeApp({ credential, projectId, storageBucket: DEFAULT_BUCKET }, `migrate-avatars-${Date.now()}`);
}

async function migrateStudent({ docSnap, data, args, storage }) {
  const avatar = data.avatar;
  if (!avatar || typeof avatar !== 'string') return null;

  if (avatar.startsWith('data:')) {
    const parsed = parseImageDataUrl(avatar);
    if (!parsed) return { id: docSnap.id, name: data.name, action: 'skip-invalid-data-url' };
    const objectPath = canonicalObjectPath(docSnap.id, parsed.extension);
    if (args.execute) {
      const token = crypto.randomUUID();
      await storage.bucket(args.bucket).file(objectPath).save(parsed.bytes, {
        resumable: false,
        metadata: {
          contentType: parsed.contentType,
          cacheControl: CACHE_CONTROL,
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });
      await docSnap.ref.update({ avatar: downloadUrlFor(args.bucket, objectPath, token) });
    }
    return { id: docSnap.id, name: data.name, action: 'migrate-inline-data-url', objectPath, bytes: parsed.bytes.length };
  }

  const info = storageObjectFromUrl(avatar);
  if (!info) return { id: docSnap.id, name: data.name, action: 'skip-unknown-avatar' };

  const file = storage.bucket(info.bucket).file(info.objectPath);
  let current = null;
  try {
    const [metadata] = await file.getMetadata();
    current = metadata.cacheControl || '';
  } catch (error) {
    current = null;
    if (args.execute) throw error;
  }
  if (current === CACHE_CONTROL) {
    return { id: docSnap.id, name: data.name, action: 'cache-already-ok', objectPath: info.objectPath };
  }
  if (args.execute) await file.setMetadata({ cacheControl: CACHE_CONTROL });
  return { id: docSnap.id, name: data.name, action: 'backfill-cache-control', objectPath: info.objectPath, from: current };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const app = initializeAdmin(args.projectId, args.keyPath);
  const db = getFirestore(app);
  const storage = getStorage(app);

  const studentsSnap = await db.collection(`${PUBLIC_DATA_PATH}/students`).get();
  const results = [];
  let handled = 0;

  for (const docSnap of studentsSnap.docs) {
    const data = docSnap.data() || {};
    if (!data.avatar || typeof data.avatar !== 'string') continue;
    if (args.limit && handled >= args.limit) break;
    handled += 1;
    try {
      const result = await migrateStudent({ docSnap, data, args, storage });
      if (result) results.push(result);
    } catch (error) {
      results.push({ id: docSnap.id, name: data.name, action: 'error', error: error?.message || String(error) });
    }
  }

  const summary = results.reduce((acc, item) => {
    acc[item.action] = (acc[item.action] || 0) + 1;
    return acc;
  }, {});

  console.log(`migrate-avatars: ${args.execute ? 'EXECUTE' : 'DRY-RUN'} on ${args.projectId}, ${handled} portrait(s) inspected`);
  console.log(JSON.stringify(summary, null, 2));
  for (const item of results) {
    const suffix = item.objectPath ? ` -> ${item.objectPath}` : (item.from !== undefined ? ` (was "${item.from}")` : '');
    const error = item.error ? ` ERROR: ${item.error}` : '';
    console.log(`  [${item.action}] ${item.name || item.id}${suffix}${error}`);
  }

  if (args.reportPath) {
    fs.writeFileSync(path.resolve(args.reportPath), JSON.stringify({ projectId: args.projectId, execute: args.execute, summary, results }, null, 2), 'utf8');
    console.log(`report: ${path.resolve(args.reportPath)}`);
  }

  if (!args.execute) console.log('\nDry run only. Re-run with --execute to apply.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('migrate-avatars failed:', error);
    process.exit(1);
  });
}

module.exports = { parseImageDataUrl, storageObjectFromUrl, downloadUrlFor, canonicalObjectPath };
