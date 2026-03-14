import { db } from '../../firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import * as state from '../../state.js';
import { showToast } from '../../ui/effects.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';

export async function handleSaveSchoolNameFromOptions() {
    const input = document.getElementById('options-school-name-input');
    if (!input) return;

    const newName = input.value.trim();
    const current = state.get('schoolName') || 'Prodigies Language School';

    if (!newName) {
        showToast('School name cannot be empty.', 'error');
        return;
    }
    if (newName === current) {
        showToast('School name is already set to this.', 'info');
        return;
    }

    const btn = document.getElementById('save-school-name-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class=\"fas fa-spinner fa-spin mr-2\"></i> Saving...';
    }

    const settingsRef = doc(db, `${PUBLIC_DATA_PATH}/school_settings`, 'holidays');

    try {
        await setDoc(settingsRef, { schoolName: newName }, { merge: true });
        state.setSchoolName(newName);
        showToast('School name updated!', 'success');
    } catch (e) {
        console.error('Error saving school name from options:', e);
        showToast('Could not save school name. Please try again.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class=\"fas fa-save mr-2\"></i> Save School Name';
        }
    }
}

