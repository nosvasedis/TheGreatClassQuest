// /db/actions/officeNotes.js — notes the Secretary Office keeps on a student's file.
// They live beside the teachers' Hero's Chronicle notes (same collection, marked authorRole: 'office'),
// so the Office already receives them through its chronicle listener. A teacher's chronicle only
// lists notes that teacher wrote, so office notes never appear in the classroom.
import { db, doc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from '../../firebase.js';
import * as state from '../../state.js';
import { withSchoolYear } from '../../utils/schoolYear.js';
import { dataPath } from '../../utils/tenant.mjs';


export async function saveOfficeNote({ studentId, text, category, noteId = null }) {
    const noteText = String(text || '').trim();
    if (!studentId || !noteText) throw new Error('Write something before saving the note.');
    const payload = {
        studentId,
        teacherId: state.get('currentUserId'),
        authorRole: 'office',
        authorName: state.get('currentUserProfile')?.displayName || state.get('currentTeacherName') || 'School office',
        noteText,
        category: category || 'General',
        updatedAt: serverTimestamp()
    };
    if (noteId) {
        await updateDoc(doc(db, dataPath('hero_chronicle_notes'), noteId), payload);
        return noteId;
    }
    const ref = await addDoc(collection(db, dataPath('hero_chronicle_notes')), withSchoolYear({ ...payload, createdAt: serverTimestamp() }, state.getActiveSchoolYearKey()));
    return ref?.id || null;
}

export async function deleteOfficeNote(noteId) {
    if (!noteId) return;
    await deleteDoc(doc(db, dataPath('hero_chronicle_notes'), noteId));
}
