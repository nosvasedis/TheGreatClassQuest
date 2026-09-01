import { showAnimatedModal, hideModal } from './base.js';
import { startQuestRun, updateQuestProgress, completeQuestRun, reverseQuestCompletion } from '../../features/specialQuestService.js';
import { QUEST_DEFINITIONS, normalizeQuestType } from '../../features/specialQuestEngine.js';
import { showToast } from '../effects.js';
import * as state from '../../state.js';

let activeEvent = null;
let activeRun = null;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function renderRunner() {
  if (!activeEvent || !activeRun) return;
  const type = normalizeQuestType(activeEvent.type); const def = QUEST_DEFINITIONS[type]; const progress = activeRun.progress || {};
  document.getElementById('special-quest-runner-title').textContent = def?.title || activeEvent.details?.title || activeEvent.type;
  document.getElementById('special-quest-runner-instructions').textContent = activeEvent.presentation?.instructions || activeEvent.details?.instructions || '';
  const target = Number(progress.target || def?.defaultTarget || 0); const current = Number(progress.current || 0);
  document.getElementById('special-quest-runner-count').textContent = `${current}/${target}`;
  document.getElementById('special-quest-runner-progress').style.width = `${target ? Math.min(100, current / target * 100) : 0}%`;
  document.getElementById('special-quest-runner-complete').disabled = !progress.completed;
  const recipientHost = document.getElementById('special-quest-recipient-list');
  if (recipientHost) {
    const students = (state.get('allStudents') || []).filter((student) => (activeRun.eligibleStudentIds || []).includes(student.id));
    recipientHost.innerHTML = students.length
      ? students.map((student) => `<label class="special-quest-recipient"><input type="checkbox" data-recipient-id="${esc(student.id)}" ${activeRun.finalRecipientIds?.includes(student.id) ? 'checked' : ''}><span>${esc(student.name || 'Learner')}</span></label>`).join('')
      : '<span class="text-sm text-slate-500">No eligible learners.</span>';
    recipientHost.querySelectorAll('[data-recipient-id]').forEach((input) => input.addEventListener('change', () => {
      const id = input.dataset.recipientId;
      const next = new Set(activeRun.finalRecipientIds || []);
      if (input.checked) next.add(id); else next.delete(id);
      activeRun.finalRecipientIds = [...next];
      const count = document.getElementById('special-quest-recipient-count');
      if (count) count.textContent = `${activeRun.finalRecipientIds.length} recipients`;
    }));
    const count = document.getElementById('special-quest-recipient-count');
    if (count) count.textContent = `${(activeRun.finalRecipientIds || []).length} recipients`;
  }
  const saga = type === 'five_sentence_saga'; document.getElementById('special-quest-runner-saga').classList.toggle('hidden', !saga);
  const controls = document.getElementById('special-quest-runner-controls');
  const buttons = type === 'unbroken_chain' ? [['success', 'Successful Turn'], ['break', 'Chain Broke']] : type === 'scribes_sketch' ? [0, 1, 2, 3].map((step) => [JSON.stringify({ step }), ['Listen', 'Sketch', 'Add details', 'Reveal & describe'][step]]) : type === 'five_sentence_saga' ? [['next', 'Next Sentence']] : [['increment', type === 'grammar_guardians' ? 'Rescued Sentence' : 'Use Added']];
  controls.innerHTML = buttons.map(([action, label]) => `<button type="button" class="special-quest-action px-3 py-3 rounded-xl bg-white border border-indigo-200 font-black text-indigo-700 hover:bg-indigo-50" data-action="${esc(action)}">${esc(label)}</button>`).join('');
  controls.querySelectorAll('.special-quest-action').forEach((button) => button.addEventListener('click', async () => {
    try {
      const raw = button.dataset.action; let action = raw.startsWith('{') ? JSON.parse(raw) : raw;
      if (action === 'next') action = { type: 'next', index: progress.current, text: document.getElementById('special-quest-sentence').value };
      activeRun = await updateQuestProgress(activeEvent.id, action, { runVersion: activeRun.runVersion }); renderRunner();
    } catch (error) { showToast(error.message, 'error'); }
  }));
}

export async function openSpecialQuestRunner(event) {
  activeEvent = event;
  try { activeRun = await startQuestRun(event); renderRunner(); showAnimatedModal('special-quest-runner-modal'); }
  catch (error) { showToast(error.message || 'Could not start quest.', 'error'); }
}

export function setupSpecialQuestRunnerListeners() {
  document.getElementById('special-quest-runner-close')?.addEventListener('click', () => hideModal('special-quest-runner-modal'));
  document.getElementById('special-quest-runner-undo')?.addEventListener('click', async () => { try { if (activeEvent) { await reverseQuestCompletion(activeEvent.id); showToast('Quest reward reversed.', 'success'); } } catch (error) { showToast(error.message, 'error'); } });
  document.getElementById('special-quest-runner-complete')?.addEventListener('click', async () => { try { const result = await completeQuestRun(activeEvent, { recipientIds: activeRun.finalRecipientIds }); showToast(`Quest complete! +${result.totalStars} Stars awarded.`, 'success'); document.getElementById('special-quest-runner-status').textContent = 'Completed'; document.getElementById('special-quest-runner-complete').disabled = true; } catch (error) { showToast(error.message, 'error'); } });
}

/** Read-only projector surface: no action buttons or teacher evidence are rendered. */
export function renderSpecialQuestProjector(container, event, run) {
  if (!container) return;
  const type = normalizeQuestType(event?.type); const definition = QUEST_DEFINITIONS[type];
  const progress = run?.progress || {}; const target = Number(progress.target || definition?.defaultTarget || 0); const current = Number(progress.current || 0);
  container.innerHTML = `<section class="special-quest-projector" aria-live="polite"><h1>${esc(definition?.title || event?.type)}</h1><p>${esc(event?.presentation?.prompt || '')}</p><div class="special-quest-progress"><i style="width:${target ? Math.min(100, current / target * 100) : 0}%"></i></div><strong>${current} / ${target}</strong></section>`;
}
