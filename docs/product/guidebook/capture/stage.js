import { headerHTML, svgFiltersHTML } from '../../../../templates/app/header.js';
import { navHTML } from '../../../../templates/app/nav.js';
import { ceremonyHTML } from '../../../../templates/app/screens/ceremony.js';
import { heroModalsHTML } from '../../../../templates/modals/hero.js';
import { attendanceModalsHTML } from '../../../../templates/modals/attendance.js';
import { getGuildBadgeHtml } from '../../../../features/guilds.js';
import {
  hideAttendanceChronicle,
  hideCeremony,
  hideTrialType,
  showAttendanceChronicle,
  showCeremony,
  showTrialType
} from './fill-stage.js';
import {
  extrasShellHtml,
  hideAdventureLog,
  hideExtras,
  hideFortuneWheel,
  hideHallOfHeroes,
  hideQuiz,
  hideShop,
  hideSkillTree,
  showAdventureLog,
  showFortuneWheel,
  showHallOfHeroes,
  showQuiz,
  showShop,
  showSkillTree
} from './fill-extras.js';
import {
  deeperShellHtml,
  hideBulkTrial,
  hideCalendar,
  hideChronicle,
  hideDayPlanner,
  hideDeeper,
  hideGuildHall,
  hideQuizPlay,
  hideRoster,
  hideSettings,
  hideSortingQuiz,
  hideSpecialQuestProjector,
  hideSpecialQuestRunner,
  hideStarfall,
  hideStoryWeavers,
  showBulkTrial,
  showCalendar,
  showChronicle,
  showDayPlanner,
  showGuildHall,
  showQuizPlay,
  showRoster,
  showSettings,
  showSortingQuiz,
  showSpecialQuestProjector,
  showSpecialQuestRunner,
  showStarfall,
  showStoryWeavers
} from './fill-deeper.js';
import {
  hideAwardStarsTab,
  hideFortuneLedger,
  hideGuildPowerExplainer,
  hideHallOfProdigies,
  hideHerosChallenge,
  hideTeamQuest,
  hideTrophyRoom,
  showAwardStarsTab,
  showFortuneLedger,
  showGuildPowerExplainer,
  showHallOfProdigies,
  showHerosChallenge,
  showTeamQuest,
  showTrophyRoom
} from './fill-classroom.js';
import {
  hideCertificateForge,
  hideCertificatePrint,
  hideHeroClass,
  hideHomeTab,
  hideProjector,
  showCertificateForge,
  showCertificatePrint,
  showHeroClass,
  showHomeTab,
  showProjector
} from './fill-surfaces.js';

const AURA = '#16a34a';
const DATE_TEXT = 'Sunday, 30 August 2026';
const TIME_TEXT = '09:15';
const QUOTE = 'Courage is a star you can share.';

function guildBadge() {
  return getGuildBadgeHtml('dragon_flame', 'w-5 h-5')
    .replace('guild-badge ', 'guild-badge award-guild-corner ')
    .replace(' border-2', '')
    .replace('./assets/', '/assets/');
}

function awardCloudHtml() {
  return `
    <div id="capture-cloud-frame">
      <div class="award-card-mount">
        <div class="student-cloud-card" data-studentid="guide-alex">
          <div class="cloud-bg-svg cloud-bg-asset award-cloud-a" aria-hidden="true"></div>
          <div class="absence-controls">
            <button class="absence-btn absence-btn--absent" type="button" title="Mark as Absent">
              <i class="fas fa-user-slash pointer-events-none"></i>
            </button>
          </div>
          <div class="student-avatar-cloud-placeholder">A</div>
          ${guildBadge()}
          <div class="coin-pill" title="Current Gold">
            <i class="fas fa-coins text-yellow-400"></i>
            <span>42</span>
          </div>
          <button class="boon-btn boon-btn--eligible absolute top-2 left-14 w-8 h-8 rounded-full z-30" type="button" title="Bestow Hero's Boon">
            <i class="fas fa-heart pointer-events-none"></i>
          </button>
          <div class="card-content-wrapper">
            <h3 class="font-title text-2xl text-gray-800 text-center">
              <div class="flex flex-wrap items-center justify-center gap-1.5 mb-1">
                <span class="hero-title-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-sm border border-white/30" style="background: linear-gradient(135deg, ${AURA}, ${AURA}dd); box-shadow: 0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.25) inset;" title="Hero rank"><span class="opacity-90">🛡️</span><span>Sentinel</span></span>
              </div>
              Alex
            </h3>
            <div class="award-counters-row">
              <div class="counter-bubble counter-bubble--today">
                <span class="counter-bubble__ring"></span>
                <span class="counter-bubble__label">TODAY</span>
                <span class="counter-bubble__value font-title">0</span>
                <i class="fas fa-star counter-bubble__icon"></i>
              </div>
              <div class="counter-bubble counter-bubble--month">
                <span class="counter-bubble__ring"></span>
                <span class="counter-bubble__label">MONTH</span>
                <span class="counter-bubble__value font-title">18</span>
                <i class="fas fa-star counter-bubble__icon"></i>
              </div>
              <div class="counter-bubble counter-bubble--total">
                <span class="counter-bubble__ring"></span>
                <span class="counter-bubble__label">TOTAL</span>
                <span class="counter-bubble__value font-title">86</span>
                <i class="fas fa-star counter-bubble__icon"></i>
              </div>
            </div>
            <div class="reason-selector flex justify-center items-center gap-2">
              <button class="reason-btn bubbly-button reason-btn--teamwork active" data-reason="teamwork" type="button" title="Teamwork">
                <span class="reason-btn__shimmer" aria-hidden="true"></span>
                <i class="fas fa-users pointer-events-none"></i>
                <span class="reason-btn__label">Teamwork</span>
              </button>
              <button class="reason-btn bubbly-button reason-btn--creativity" data-reason="creativity" type="button" title="Creativity">
                <span class="reason-btn__shimmer" aria-hidden="true"></span>
                <i class="fas fa-lightbulb pointer-events-none"></i>
                <span class="reason-btn__label">Creativity</span>
              </button>
              <button class="reason-btn bubbly-button reason-btn--respect" data-reason="respect" type="button" title="Respect">
                <span class="reason-btn__shimmer" aria-hidden="true"></span>
                <i class="fas fa-hands-helping pointer-events-none"></i>
                <span class="reason-btn__label">Respect</span>
              </button>
              <button class="reason-btn bubbly-button reason-btn--focus" data-reason="focus" type="button" title="Focus/Effort">
                <span class="reason-btn__shimmer" aria-hidden="true"></span>
                <i class="fas fa-brain pointer-events-none"></i>
                <span class="reason-btn__label">Focus</span>
              </button>
            </div>
            <div class="star-selector-container visible flex items-center justify-center" data-aura="teamwork">
              <button data-stars="1" class="star-award-btn star-btn-1" type="button" aria-label="Award 1 star">
                <span class="star-btn__shine" aria-hidden="true"></span>
                <span class="star-btn__badge">1</span>
                <i class="fas fa-star"></i>
              </button>
              <span class="star-divider" aria-hidden="true"></span>
              <button data-stars="2" class="star-award-btn star-btn-2" type="button" aria-label="Award 2 stars">
                <span class="star-btn__shine" aria-hidden="true"></span>
                <span class="star-btn__badge">2</span>
                <i class="fas fa-star"></i><i class="fas fa-star"></i>
              </button>
              <span class="star-divider" aria-hidden="true"></span>
              <button data-stars="3" class="star-award-btn star-btn-3" type="button" aria-label="Award 3 stars">
                <span class="star-btn__shine" aria-hidden="true"></span>
                <span class="star-btn__badge">3</span>
                <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function fillHeader(night) {
  const quote = document.getElementById('header-quote-container');
  const quoteText = document.getElementById('header-quote-text');
  const classText = document.getElementById('header-class-selector-text');
  const classLogo = document.getElementById('header-class-selector-logo');
  const office = document.getElementById('secretary-console-btn');
  const dateEl = document.getElementById('current-date');
  const timeEl = document.getElementById('current-time');
  const header = document.querySelector('#award-header-atmosphere header');

  quote?.classList.remove('hidden');
  document.getElementById('header-class-selector-panel')?.classList.add('hidden');
  if (quoteText) quoteText.textContent = QUOTE;
  if (classText) classText.textContent = 'Junior B';
  if (classLogo) classLogo.textContent = '📚';
  office?.classList.remove('hidden');
  if (dateEl) {
    dateEl.dataset.text = DATE_TEXT;
    dateEl.textContent = DATE_TEXT;
  }
  if (timeEl) {
    timeEl.dataset.text = TIME_TEXT;
    timeEl.textContent = TIME_TEXT;
  }

  document.body.classList.toggle('night-mode', night);
  header?.classList.toggle('header-night', night);
}

document.body.insertAdjacentHTML('afterbegin', svgFiltersHTML);
document.getElementById('app-root').innerHTML = `
  <div id="app-screen" class="capture-still flex flex-1 flex-col overflow-hidden">
    <div id="award-header-atmosphere" class="award-header-atmosphere relative z-[60] flex shrink-0 flex-col overflow-visible shadow-md"
         style="background: linear-gradient(to right, #89f7fe 0%, #66a6ff 100%);">
      ${headerHTML}
    </div>
    <div id="capture-cloud-stage">${awardCloudHtml()}</div>
    ${navHTML}
  </div>
`;

fillHeader(false);
document.body.insertAdjacentHTML('beforeend', heroModalsHTML);
document.body.insertAdjacentHTML('beforeend', ceremonyHTML);
document.body.insertAdjacentHTML('beforeend', attendanceModalsHTML);
document.body.insertAdjacentHTML('beforeend', extrasShellHtml());
document.body.insertAdjacentHTML('beforeend', deeperShellHtml());
document.getElementById('about-tab')?.classList.add('hidden');
{
  const modal = document.getElementById('hero-celebration-modal');
  const name = document.getElementById('hero-celebration-name');
  const reason = document.getElementById('hero-celebration-reason');
  const avatar = document.getElementById('hero-celebration-avatar');
  modal?.classList.remove('hidden');
  modal?.classList.add('capture-hcd');
  if (name) name.textContent = 'Alex';
  if (reason) reason.textContent = 'For outstanding Teamwork today';
  if (avatar) avatar.textContent = 'A';
}
document.documentElement.dataset.captureMode = 'day';
window.__gcqCapture = {
  fillHeader,
  showCeremony,
  hideCeremony,
  showAttendanceChronicle,
  hideAttendanceChronicle,
  showTrialType,
  hideTrialType,
  hideExtras,
  showShop,
  hideShop,
  showFortuneWheel,
  hideFortuneWheel,
  showSkillTree,
  hideSkillTree,
  showAdventureLog,
  hideAdventureLog,
  showHallOfHeroes,
  hideHallOfHeroes,
  showQuiz,
  hideQuiz,
  hideDeeper,
  showBulkTrial,
  hideBulkTrial,
  showStarfall,
  hideStarfall,
  showStoryWeavers,
  hideStoryWeavers,
  showSettings,
  hideSettings,
  showRoster,
  hideRoster,
  showChronicle,
  hideChronicle,
  showSortingQuiz,
  hideSortingQuiz,
  showGuildHall,
  hideGuildHall,
  showCalendar,
  hideCalendar,
  showDayPlanner,
  hideDayPlanner,
  showSpecialQuestRunner,
  hideSpecialQuestRunner,
  showSpecialQuestProjector,
  hideSpecialQuestProjector,
  showQuizPlay,
  hideQuizPlay,
  showAwardStarsTab,
  hideAwardStarsTab,
  showHerosChallenge,
  hideHerosChallenge,
  showTeamQuest,
  hideTeamQuest,
  showFortuneLedger,
  hideFortuneLedger,
  showTrophyRoom,
  hideTrophyRoom,
  showHallOfProdigies,
  hideHallOfProdigies,
  showGuildPowerExplainer,
  hideGuildPowerExplainer,
  showHomeTab,
  hideHomeTab,
  showProjector,
  hideProjector,
  showCertificateForge,
  hideCertificateForge,
  showCertificatePrint,
  hideCertificatePrint,
  showHeroClass,
  hideHeroClass
};
document.documentElement.classList.add('capture-ready');
