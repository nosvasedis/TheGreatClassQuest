import { db, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '../firebase.js';
import * as state from '../state.js';
import { buildCeremonySnapshot } from './ceremonyDomain.js';

const PATH = 'artifacts/great-class-quest/public/data/ceremony_snapshots';
export const ceremonySnapshotId = (classId, monthKey) => `${classId}__${monthKey}`;

export async function prepareCeremonySnapshot(input) {
  const snapshot = buildCeremonySnapshot({ ...input, createdBy: input.createdBy || state.get('currentUserId') });
  const ref = doc(db, PATH, input.snapshotId || ceremonySnapshotId(input.classId, input.monthKey));
  const existing = await getDoc(ref);
  if (existing.exists() && ['locked', 'completed'].includes(existing.data().status)) return { id: ref.id, ...existing.data() };
  await setDoc(ref, { ...snapshot, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  return { id: ref.id, ...snapshot };
}

export async function lockCeremonySnapshot(classId, monthKey, lockedBy = state.get('currentUserId')) {
  const ref = doc(db, PATH, ceremonySnapshotId(classId, monthKey)); const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Prepare the ceremony before locking it.');
  if (snapshot.data().status === 'completed') return { id: ref.id, ...snapshot.data() };
  await updateDoc(ref, { status: 'locked', lockedBy, lockedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const updated = await getDoc(ref); return { id: ref.id, ...updated.data() };
}

export async function saveCeremonyPlayback(classId, monthKey, playback) {
  const ref = doc(db, PATH, ceremonySnapshotId(classId, monthKey)); const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Snapshot not found.');
  if (!['locked', 'completed'].includes(snapshot.data().status)) throw new Error('Snapshot must be locked before playback.');
  await updateDoc(ref, { playback: { ...playback, updatedAt: serverTimestamp() } });
}

export async function createCeremonyCorrection(input, correctionReason) {
  if (!String(correctionReason || '').trim()) throw new Error('A correction reason is required.');
  const previousId = ceremonySnapshotId(input.classId, input.monthKey); const previous = await getDoc(doc(db, PATH, previousId));
  const version = Number(previous.data()?.snapshotVersion || 1) + 1;
  return prepareCeremonySnapshot({ ...input, snapshotVersion: version, correctionReason, snapshotId: `${previousId}__v${version}` });
}
