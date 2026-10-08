import { headerHTML, svgFiltersHTML } from '../../../../templates/app/header.js';
import { navHTML } from '../../../../templates/app/nav.js';
import { ceremonyHTML } from '../../../../templates/app/screens/ceremony.js';
import { grandGuildCeremonyHTML } from '../../../../templates/app/screens/grandGuildCeremony.js';
import { heroModalsHTML } from '../../../../templates/modals/hero.js';
import { attendanceModalsHTML } from '../../../../templates/modals/attendance.js';
import {
  hideAttendanceChronicle,
  hideCeremony,
  hideGrandCeremony,
  showAttendanceChronicle,
  showCeremony,
  showGrandCeremony,
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
  guideCloudCard,
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
import {
  hideRedesign,
  redesignShellHtml,
  showAdventureLogDiary as showAdventureLog,
  showAdventurersGuide,
  showAvatarForge,
  showBountyPoster,
  showClassCharter,
  showEmblemCase,
  showGuildAnthem,
  showGuildBanner,
  showOffice,
  showPassport,
  showTeacherBoon,
  showHeroBoon
} from './fill-redesign.js';
import {
  hideCampfire,
  showCampfireScene,
  showOathBoard
} from './fill-campfire.js';
import { hideRemote, showProjectorRemote, showWand } from './fill-remote.js';

const DATE_TEXT = 'Sunday, 30 August 2026';
const TIME_TEXT = '09:15';
const QUOTE = 'Courage is a star you can share.';

function awardCloudHtml() {
  const card = guideCloudCard({ id: 'guide-alex', name: 'Alex', cloud: 'a', guildId: 'dragon_flame', title: 'Sentinel', aura: '#16a34a', month: 18, total: 86, gold: 42, reason: 'teamwork', starsVisible: true });
  return `<div id="capture-cloud-frame">${card.replace('data-guide-active title=', 'title=').replace('aw-virtue--teamwork"', 'aw-virtue--teamwork active"')}</div>`;
}

function fillHeader(night) {
  const quote = document.getElementById('header-quote-container');
  const quoteText = document.getElementById('header-quote-text');
  const classText = document.getElementById('header-class-selector-text');
  const classLogo = document.getElementById('header-class-selector-logo');
  const dateEl = document.getElementById('current-date');
  const timeEl = document.getElementById('current-time');
  const header = document.querySelector('#award-header-atmosphere header');

  quote?.classList.remove('hidden');
  document.getElementById('header-class-selector-panel')?.classList.add('hidden');
  if (quoteText) quoteText.textContent = QUOTE;
  if (classText) classText.textContent = 'Junior B';
  if (classLogo) classLogo.textContent = '📚';
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
  // The shared sky palette (styles/sky_weather.css) reads the light from <html>.
  document.documentElement.dataset.wxLight = night ? 'night' : 'day';
  document.documentElement.dataset.wxNight = night ? '1' : '0';
}

document.body.insertAdjacentHTML('afterbegin', svgFiltersHTML);
document.getElementById('app-root').innerHTML = `
  <div id="app-screen" class="capture-still flex flex-1 flex-col overflow-hidden">
    <div id="award-header-atmosphere" class="award-header-atmosphere relative z-[60] flex shrink-0 flex-col overflow-visible shadow-md">
      ${headerHTML}
    </div>
    <div id="capture-cloud-stage">${awardCloudHtml()}</div>
    ${navHTML}
  </div>
`;

fillHeader(false);
document.body.insertAdjacentHTML('beforeend', heroModalsHTML);
document.body.insertAdjacentHTML('beforeend', ceremonyHTML + grandGuildCeremonyHTML);
document.body.insertAdjacentHTML('beforeend', attendanceModalsHTML);
document.body.insertAdjacentHTML('beforeend', extrasShellHtml());
document.body.insertAdjacentHTML('beforeend', deeperShellHtml());
document.body.insertAdjacentHTML('beforeend', redesignShellHtml());
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
  showGrandCeremony,
  hideGrandCeremony,
  showAttendanceChronicle,
  hideAttendanceChronicle,
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
  hideHeroClass,
  hideCampfire,
  showOathBoard,
  showWand,
  showProjectorRemote,
  hideRemote,
  showCampfireScene,
  hideRedesign,
  showBountyPoster,
  showPassport,
  showAvatarForge,
  showClassCharter,
  showEmblemCase,
  showGuildBanner,
  showGuildAnthem,
  showTeacherBoon,
  showHeroBoon,
  showOffice,
  showAdventurersGuide
};
document.documentElement.classList.add('capture-ready');
