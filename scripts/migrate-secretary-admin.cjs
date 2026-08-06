#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { createSecretaryActivation } = require('../tools/onboarding-console/lib.js');

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
const ROLE_PATH = `${PUBLIC_DATA_PATH}/school_roles/secretary`;
const PROFILE_COLLECTION = 'user_profiles';
const BOOTSTRAP_PATH = `${PUBLIC_DATA_PATH}/admin_bootstrap/secretary`;

function parseArgs(argv) {
  const result = { projectId: 'the-great-class-quest', execute: false, dryRun: true, keyPath: '', siteUrl: '', reportPath: '', confirm: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project' && argv[i + 1]) result.projectId = argv[++i];
    else if (arg === '--key' && argv[i + 1]) result.keyPath = argv[++i];
    else if (arg === '--site-url' && argv[i + 1]) result.siteUrl = argv[++i];
    else if (arg === '--report' && argv[i + 1]) result.reportPath = argv[++i];
    else if (arg === '--confirm' && argv[i + 1]) result.confirm = argv[++i];
    else if (arg.startsWith('--confirm=')) result.confirm = arg.slice('--confirm='.length);
    else if (arg === '--execute') { result.execute = true; result.dryRun = false; }
    else if (arg === '--dry-run') { result.execute = false; result.dryRun = true; }
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  return result;
}

function initializeAdmin(projectId, keyPath) {
  let credential;
  if (keyPath) {
    const absoluteKeyPath = path.resolve(keyPath);
    const serviceAccount = JSON.parse(fs.readFileSync(absoluteKeyPath, 'utf8'));
    if (serviceAccount.project_id && serviceAccount.project_id !== projectId) {
      throw new Error(`The service-account key belongs to ${serviceAccount.project_id}, not ${projectId}.`);
    }
    credential = cert(serviceAccount);
  } else {
    credential = applicationDefault();
  }
  return initializeApp({ credential, projectId }, `secretary-handover-${Date.now()}`);
}

function getDefaultReportPath(projectId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(`secretary-handover-audit-${projectId}-${stamp}.json`);
}

async function getAuthUserOrNull(auth, uid) {
  try {
    return await auth.getUser(uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}

async function inspectCurrentState(db, auth) {
  const [roleSnap, secretaryProfilesSnap, legacyAdminSnap] = await Promise.all([
    db.doc(ROLE_PATH).get(),
    db.collection(PROFILE_COLLECTION).where('role', '==', 'secretary').get(),
    db.collection(PROFILE_COLLECTION).where('schoolAdmin', '==', true).get(),
  ]);
  const role = roleSnap.exists ? roleSnap.data() : null;
  const roleUid = String(role?.uid || '').trim();
  const linkedProfileSnap = roleUid ? await db.doc(`${PROFILE_COLLECTION}/${roleUid}`).get() : null;
  const linkedProfile = linkedProfileSnap?.exists ? linkedProfileSnap.data() : null;
  const linkedAuthUser = roleUid ? await getAuthUserOrNull(auth, roleUid) : null;
  const secretaryProfiles = secretaryProfilesSnap.docs.map((snap) => ({ uid: snap.id, role: snap.data()?.role || null }));
  const legacyTeacherAdmins = legacyAdminSnap.docs
    .filter((snap) => snap.id !== roleUid)
    .map((snap) => ({ uid: snap.id, role: snap.data()?.role || null, displayName: snap.data()?.displayName || snap.data()?.name || null }));
  const problems = [];
  if (!roleSnap.exists) problems.push('The canonical school_roles/secretary record is missing.');
  if (role?.status !== 'active') problems.push('The canonical Secretary role is not active.');
  if (!roleUid) problems.push('The canonical Secretary role has no UID.');
  if (!linkedProfileSnap?.exists || linkedProfile?.role !== 'secretary') problems.push('The linked Secretary profile is missing or has the wrong role.');
  if (!linkedAuthUser) problems.push('The linked Secretary Firebase Auth user is missing.');
  if (secretaryProfiles.length !== 1 || secretaryProfiles[0]?.uid !== roleUid) problems.push('Secretary profiles are ambiguous; expected exactly one profile matching the canonical UID.');
  if (legacyTeacherAdmins.some((entry) => entry.role !== 'teacher')) problems.push('A legacy schoolAdmin flag is attached to a non-teacher profile.');
  return {
    unambiguous: problems.length === 0,
    problems,
    role: role ? { uid: roleUid, status: role.status || null, username: role.username || null } : null,
    linkedProfile: linkedProfile ? { uid: roleUid, role: linkedProfile.role, displayName: linkedProfile.displayName || linkedProfile.name || null } : null,
    linkedAuth: linkedAuthUser ? { uid: linkedAuthUser.uid, disabled: linkedAuthUser.disabled, providerCount: linkedAuthUser.providerData.length } : null,
    secretaryProfiles,
    legacyTeacherAdmins,
  };
}

function writeAudit(reportPath, payload) {
  fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'w' });
}

async function executeHandover({ db, auth, inspection, projectId, siteUrl }) {
  const oldUid = inspection.role.uid;
  await auth.deleteUser(oldUid);

  const legacySnap = await db.collection(PROFILE_COLLECTION).where('schoolAdmin', '==', true).get();
  const batch = db.batch();
  batch.delete(db.doc(`${PROFILE_COLLECTION}/${oldUid}`));
  batch.delete(db.doc(ROLE_PATH));
  legacySnap.docs.forEach((snap) => {
    if (snap.id !== oldUid) batch.update(snap.ref, { schoolAdmin: FieldValue.delete() });
  });
  await batch.commit();

  const activation = await createSecretaryActivation(db, {
    purpose: 'handover',
    expiresInHours: 24,
    siteUrl: siteUrl || `https://${projectId}.web.app`,
  });

  const [roleAfter, oldProfileAfter, bootstrapAfter, legacyAfter] = await Promise.all([
    db.doc(ROLE_PATH).get(),
    db.doc(`${PROFILE_COLLECTION}/${oldUid}`).get(),
    db.doc(BOOTSTRAP_PATH).get(),
    db.collection(PROFILE_COLLECTION).where('schoolAdmin', '==', true).get(),
  ]);
  const oldAuthAfter = await getAuthUserOrNull(auth, oldUid);
  const verified = !roleAfter.exists
    && !oldProfileAfter.exists
    && !oldAuthAfter
    && legacyAfter.empty
    && bootstrapAfter.exists
    && bootstrapAfter.data()?.status === 'pending'
    && bootstrapAfter.data()?.purpose === 'handover';
  if (!verified) throw new Error('Post-migration verification failed. Inspect the project before using the activation link.');
  return {
    oldSecretaryUid: oldUid,
    legacyTeacherFlagsRemoved: legacySnap.docs.filter((snap) => snap.id !== oldUid).length,
    activationUrl: activation.activationUrl,
    activationExpiresAt: activation.expiresAt,
    postMigrationVerified: true,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!/^[-a-z0-9]+$/.test(options.projectId)) throw new Error('Invalid Firebase project ID.');
  const requiredPhrase = `HANDOVER-${options.projectId}`;
  if (options.execute && options.confirm !== requiredPhrase) {
    throw new Error(`Execution requires --confirm=${requiredPhrase}`);
  }

  const app = initializeAdmin(options.projectId, options.keyPath);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const inspection = await inspectCurrentState(db, auth);
  const reportPath = options.reportPath ? path.resolve(options.reportPath) : getDefaultReportPath(options.projectId);
  const audit = {
    schemaVersion: 1,
    projectId: options.projectId,
    mode: options.execute ? 'execute' : 'dry-run',
    inspectedAt: new Date().toISOString(),
    inspection,
  };
  writeAudit(reportPath, audit);
  console.log(`Audit report: ${reportPath}`);
  console.log(JSON.stringify(inspection, null, 2));
  if (!inspection.unambiguous) throw new Error('Migration aborted because the live state is ambiguous. No data was changed.');
  if (!options.execute) {
    console.log(`Dry-run complete. To execute, rerun with --execute --confirm=${requiredPhrase}`);
    return;
  }

  const result = await executeHandover({ db, auth, inspection, projectId: options.projectId, siteUrl: options.siteUrl });
  audit.executedAt = new Date().toISOString();
  audit.result = { ...result, activationUrl: '[REDACTED: printed once to the operator console]' };
  writeAudit(reportPath, audit);
  console.log('Handover database/auth cleanup verified. The existing school settings, years, classes, students, and teacher ownership were not modified.');
  console.log(`Activation expires: ${result.activationExpiresAt}`);
  console.log('One-time activation link:');
  console.log(result.activationUrl);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
