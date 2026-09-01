import { showAnimatedModal, hideModal } from './base.js';
import { startQuestRun, updateQuestProgress, completeQuestRun, reverseQuestCompletion } from '../../features/specialQuestService.js';
import { QUEST_DEFINITIONS, normalizeQuestType } from '../../features/specialQuestEngine.js';
import { showToast } from '../effects.js';
import { playSound, playWinnerFanfare } from '../../audio.js';
import * as state from '../../state.js';

let activeEvent = null;
let activeRun = null;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const QUEST_THEMES = {
  vocabulary_vault: {
    icon: '/assets/ceremony/quest-vocabulary-vault.svg',
    banner: 'bg-gradient-to-r from-purple-900 via-indigo-900 to-amber-950',
    accentColor: '#a855f7'
  },
  grammar_guardians: {
    icon: '/assets/ceremony/quest-grammar-guardians.svg',
    banner: 'bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900',
    accentColor: '#10b981'
  },
  unbroken_chain: {
    icon: '/assets/ceremony/quest-unbroken-chain.svg',
    banner: 'bg-gradient-to-r from-cyan-950 via-teal-900 to-slate-950',
    accentColor: '#06b6d4'
  },
  scribes_sketch: {
    icon: '/assets/ceremony/quest-scribes-sketch.svg',
    banner: 'bg-gradient-to-r from-amber-900 via-indigo-950 to-slate-900',
    accentColor: '#f59e0b'
  },
  five_sentence_saga: {
    icon: '/assets/ceremony/quest-five-sentence-saga.svg',
    banner: 'bg-gradient-to-r from-rose-900 via-purple-900 to-amber-950',
    accentColor: '#f43f5e'
  }
};

function renderInteractiveWidget(type, progress, target, current) {
  const host = document.getElementById('special-quest-runner-interactive');
  if (!host) return;

  if (type === 'vocabulary_vault') {
    const gemsHtml = Array.from({ length: target }, (_, i) => {
      const active = i < current;
      return `<div class="special-quest-gem ${active ? 'special-quest-gem--active' : ''}" title="Word Gem ${i + 1}">💎</div>`;
    }).join('');
    host.innerHTML = `
      <div class="space-y-1.5">
        <div class="text-xs font-black uppercase tracking-wider text-purple-700 flex items-center justify-between">
          <span>Vault Gems Collected</span>
          <span>${current} / ${target} Gems</span>
        </div>
        <div class="special-quest-gems-grid">${gemsHtml}</div>
      </div>
    `;
  } else if (type === 'grammar_guardians') {
    const runesHtml = Array.from({ length: target }, (_, i) => {
      const active = i < current;
      return `
        <div class="special-quest-rune ${active ? 'special-quest-rune--active' : ''}">
          <i class="fas ${active ? 'fa-shield-halved' : 'fa-shield'}"></i>
          <span>Rune ${i + 1}</span>
        </div>
      `;
    }).join('');
    host.innerHTML = `
      <div class="space-y-1.5">
        <div class="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center justify-between">
          <span>Grammar Runes Restored</span>
          <span>${current} / ${target} Rescued</span>
        </div>
        <div class="special-quest-shield-grid">${runesHtml}</div>
      </div>
    `;
  } else if (type === 'unbroken_chain') {
    const bestStreak = progress.bestStreak || current;
    const linksHtml = Array.from({ length: target }, (_, i) => {
      const active = i < current;
      return `
        <div class="special-quest-chain-link ${active ? 'special-quest-chain-link--active' : ''}" title="Turn ${i + 1}">
          ${active ? '⛓️' : i + 1}
        </div>
      `;
    }).join('');
    host.innerHTML = `
      <div class="space-y-1.5">
        <div class="text-xs font-black uppercase tracking-wider text-cyan-700 flex items-center justify-between">
          <span>Active Turn Chain</span>
          <span class="bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full font-black">Best: ${bestStreak} streak</span>
        </div>
        <div class="special-quest-chain-display">${linksHtml}</div>
      </div>
    `;
  } else if (type === 'scribes_sketch') {
    const stepNames = [
      '1. Listen & Visualize',
      '2. Sketch Outline',
      '3. Add Details',
      '4. Reveal & Describe'
    ];
    const stepsCompleted = progress.stepsCompleted || {};
    const cardsHtml = stepNames.map((name, i) => {
      const done = Boolean(stepsCompleted[i]);
      return `
        <div class="special-quest-step-card ${done ? 'special-quest-step-card--completed' : ''}">
          <i class="fas ${done ? 'fa-check-circle text-amber-600' : 'fa-circle text-slate-300'}"></i>
          <span>${esc(name)}</span>
        </div>
      `;
    }).join('');
    host.innerHTML = `
      <div class="space-y-1.5">
        <div class="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center justify-between">
          <span>Scribe Checklist</span>
          <span>${current} / ${target} Steps Complete</span>
        </div>
        <div class="special-quest-checklist">${cardsHtml}</div>
      </div>
    `;
  } else if (type === 'five_sentence_saga') {
    const sentences = progress.sentences || [];
    const cardsHtml = Array.from({ length: target }, (_, i) => {
      const done = i < current;
      const sentenceText = sentences[i]?.text || '';
      return `
        <div class="special-quest-saga-card ${done ? 'special-quest-saga-card--active' : ''}">
          <div class="font-black text-xs text-rose-800 mb-0.5">Page ${i + 1}</div>
          <div class="text-[11px] text-slate-600 line-clamp-2 italic">${done ? esc(sentenceText || 'Completed') : 'Pending...'}</div>
        </div>
      `;
    }).join('');
    host.innerHTML = `
      <div class="space-y-1.5">
        <div class="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center justify-between">
          <span>Storybook Saga</span>
          <span>${current} / ${target} Sentences</span>
        </div>
        <div class="special-quest-saga-cards">${cardsHtml}</div>
      </div>
    `;
  }
}

function renderRunner() {
  if (!activeEvent || !activeRun) return;
  const type = normalizeQuestType(activeEvent.type);
  const def = QUEST_DEFINITIONS[type];
  const theme = QUEST_THEMES[type] || QUEST_THEMES.vocabulary_vault;
  const progress = activeRun.progress || {};

  // 1. Update Banner & Title
  const banner = document.getElementById('special-quest-runner-banner');
  if (banner) banner.className = `relative p-5 md:p-7 ${theme.banner} text-white overflow-hidden`;

  const badgeImg = document.getElementById('special-quest-runner-badge-img');
  if (badgeImg) badgeImg.src = theme.icon;

  document.getElementById('special-quest-runner-title').textContent = def?.title || activeEvent.details?.title || activeEvent.type;
  document.getElementById('special-quest-runner-instructions').textContent = activeEvent.presentation?.instructions || activeEvent.details?.instructions || '';

  // 2. Rewards Badge — per recipient, from the scheduled event (0.5 / 1 / 1.5 / 2 Stars, same Gold)
  const starsReward = Number(activeEvent.rewardSpec?.starsPerRecipient ?? activeEvent.details?.completionBonus ?? 1);
  const goldReward = starsReward * Number(activeEvent.rewardSpec?.goldPerStar ?? 1);
  const rewardBadge = document.getElementById('special-quest-runner-reward-badge');
  if (rewardBadge) {
    rewardBadge.innerHTML = `<span>⭐ +${starsReward} Stars</span> <span>🪙 +${goldReward} Gold</span>`;
  }

  // 3. Status & Objective Progress
  const isCompleted = activeRun.status === 'completed' || progress.completed;
  const statusChip = document.getElementById('special-quest-runner-status');
  if (statusChip) {
    statusChip.textContent = isCompleted ? 'Completed' : 'Active';
    statusChip.className = isCompleted ? 'quest-status-chip quest-status-chip--completed' : 'quest-status-chip quest-status-chip--active';
  }

  const target = Number(progress.target || def?.defaultTarget || 0);
  const current = Number(progress.current || 0);
  document.getElementById('special-quest-runner-count').textContent = `${current} / ${target}`;
  document.getElementById('special-quest-runner-progress').style.width = `${target ? Math.min(100, (current / target) * 100) : 0}%`;
  document.getElementById('special-quest-runner-complete').disabled = !progress.completed || isCompleted;

  // 4. Interactive Widget for the Specific Mechanic
  renderInteractiveWidget(type, progress, target, current);

  // 5. Recipients Section with Chips & Select All
  const recipientHost = document.getElementById('special-quest-recipient-list');
  if (recipientHost) {
    const students = (state.get('allStudents') || []).filter((student) => (activeRun.eligibleStudentIds || []).includes(student.id));
    recipientHost.innerHTML = students.length
      ? students.map((student) => {
          const isSelected = (activeRun.finalRecipientIds || []).includes(student.id);
          const safeName = esc(student.name || 'Learner');
          const avatarHtml = student.avatar
            ? `<img src="${esc(student.avatar)}" class="special-quest-recipient-avatar" alt="${safeName}" />`
            : `<div class="special-quest-recipient-avatar">${safeName.slice(0, 2).toUpperCase()}</div>`;
          return `
            <label class="special-quest-recipient-chip ${isSelected ? 'special-quest-recipient-chip--selected' : ''}">
              <input type="checkbox" data-recipient-id="${esc(student.id)}" class="sr-only" ${isSelected ? 'checked' : ''}>
              ${avatarHtml}
              <span class="truncate">${safeName}</span>
              <i class="fas fa-check ml-auto text-xs ${isSelected ? 'text-indigo-600' : 'opacity-0'}"></i>
            </label>
          `;
        }).join('')
      : '<span class="text-sm text-slate-500 col-span-full">No eligible learners found for this class.</span>';

    recipientHost.querySelectorAll('[data-recipient-id]').forEach((input) => input.addEventListener('change', () => {
      const id = input.dataset.recipientId;
      const next = new Set(activeRun.finalRecipientIds || []);
      if (input.checked) next.add(id); else next.delete(id);
      activeRun.finalRecipientIds = [...next];
      renderRunner();
    }));

    const count = document.getElementById('special-quest-recipient-count');
    if (count) count.textContent = `${(activeRun.finalRecipientIds || []).length} recipients`;
  }

  // 6. Saga Input Textarea
  const saga = type === 'five_sentence_saga';
  const sagaContainer = document.getElementById('special-quest-runner-saga');
  if (sagaContainer) sagaContainer.classList.toggle('hidden', !saga || isCompleted);

  // 7. Action Controls Buttons
  const controls = document.getElementById('special-quest-runner-controls');
  if (controls) {
    if (isCompleted) {
      controls.innerHTML = `<div class="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 w-full text-center">🎉 Quest successfully accomplished!</div>`;
    } else {
      let buttons = [];
      if (type === 'unbroken_chain') {
        buttons = [
          ['success', 'Successful Turn ⛓️', 'bg-cyan-600 hover:bg-cyan-500 text-white'],
          ['break', 'Chain Broke 💥', 'bg-rose-100 hover:bg-rose-200 text-rose-800']
        ];
      } else if (type === 'scribes_sketch') {
        const stepNames = ['Listen', 'Sketch', 'Add details', 'Reveal & describe'];
        buttons = [0, 1, 2, 3].map((step) => [
          JSON.stringify({ step }),
          `Step ${step + 1}: ${stepNames[step]}`,
          'bg-amber-500 hover:bg-amber-400 text-white'
        ]);
      } else if (type === 'five_sentence_saga') {
        buttons = [['next', 'Submit Sentence ✍️', 'bg-rose-600 hover:bg-rose-500 text-white']];
      } else if (type === 'grammar_guardians') {
        buttons = [['increment', 'Rescued Sentence 🛡️', 'bg-emerald-600 hover:bg-emerald-500 text-white']];
      } else {
        buttons = [['increment', 'Add Word Gem 💎', 'bg-purple-600 hover:bg-purple-500 text-white']];
      }

      controls.innerHTML = buttons.map(([action, label, btnClass]) => `
        <button type="button" class="special-quest-action px-4 py-2.5 rounded-xl font-black text-sm transition-all shadow-sm hover:shadow active:scale-95 ${btnClass}" data-action="${esc(action)}">
          ${esc(label)}
        </button>
      `).join('');

      controls.querySelectorAll('.special-quest-action').forEach((button) => button.addEventListener('click', async () => {
        try {
          const raw = button.dataset.action;
          let action = raw.startsWith('{') ? JSON.parse(raw) : raw;
          if (action === 'next') {
            const textarea = document.getElementById('special-quest-sentence');
            action = { type: 'next', index: progress.current, text: textarea?.value || '' };
            if (textarea) textarea.value = '';
            playSound('writing');
          } else if (action === 'break') {
            playSound('star_remove');
          } else {
            playSound('star2');
          }

          activeRun = await updateQuestProgress(activeEvent.id, action, { runVersion: activeRun.runVersion });
          renderRunner();
        } catch (error) {
          showToast(error.message, 'error');
        }
      }));
    }
  }
}

export async function openSpecialQuestRunner(event) {
  activeEvent = event;
  try {
    activeRun = await startQuestRun(event);
    renderRunner();
    showAnimatedModal('special-quest-runner-modal');
  } catch (error) {
    showToast(error.message || 'Could not start quest.', 'error');
  }
}

export function setupSpecialQuestRunnerListeners() {
  document.getElementById('special-quest-runner-close')?.addEventListener('click', () => hideModal('special-quest-runner-modal'));

  // Select All & Deselect All Recipients
  document.getElementById('special-quest-select-all')?.addEventListener('click', () => {
    if (!activeRun) return;
    activeRun.finalRecipientIds = [...(activeRun.eligibleStudentIds || [])];
    renderRunner();
  });

  document.getElementById('special-quest-deselect-all')?.addEventListener('click', () => {
    if (!activeRun) return;
    activeRun.finalRecipientIds = [];
    renderRunner();
  });

  // Undo button
  document.getElementById('special-quest-runner-undo')?.addEventListener('click', async () => {
    try {
      if (activeEvent) {
        await reverseQuestCompletion(activeEvent.id);
        showToast('Quest reward reversed.', 'success');
        renderRunner();
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // Complete button
  document.getElementById('special-quest-runner-complete')?.addEventListener('click', async () => {
    try {
      const result = await completeQuestRun(activeEvent, { recipientIds: activeRun.finalRecipientIds });
      playWinnerFanfare();
      showToast(`Quest complete! +${result.totalStars} Stars awarded to ${result.awardedStudentIds.length} students!`, 'success');
      activeRun.status = 'completed';
      renderRunner();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

/** Read-only projector surface: no action buttons or teacher evidence are rendered. */
export function renderSpecialQuestProjector(container, event, run) {
  if (!container) return;
  const type = normalizeQuestType(event?.type);
  const definition = QUEST_DEFINITIONS[type];
  const theme = QUEST_THEMES[type] || QUEST_THEMES.vocabulary_vault;
  const progress = run?.progress || {};
  const target = Number(progress.target || definition?.defaultTarget || 0);
  const current = Number(progress.current || 0);
  const percent = target ? Math.min(100, Math.round((current / target) * 100)) : 0;

  container.innerHTML = `
    <section class="special-quest-projector" role="region" aria-live="polite" aria-label="Special Quest Presentation">
      <img src="${esc(theme.icon)}" class="special-quest-projector-badge" alt="${esc(definition?.title || 'Special Quest')}" />
      <h1>${esc(definition?.title || event?.type)}</h1>
      <p class="special-quest-projector-prompt">${esc(event?.presentation?.prompt || event?.details?.instructions || 'Work together as a class to complete the quest objective!')}</p>
      <div class="special-quest-progress-track">
        <div class="special-quest-progress-fill" style="width: ${percent}%;"></div>
      </div>
      <div class="special-quest-projector-counter">${current} / ${target} Completed (${percent}%)</div>
    </section>
  `;
}

