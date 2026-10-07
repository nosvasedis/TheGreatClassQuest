import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.join(__dirname, 'media', 'ui');
const PORTS = [4178, 4179, 4180];

fs.mkdirSync(OUT, { recursive: true });

async function startVite() {
  let lastErr;
  for (const port of PORTS) {
    try {
      const vite = await createServer({
        configFile: path.join(ROOT, 'vite.config.mjs'),
        root: ROOT,
        base: '/',
        server: { port, strictPort: true, host: '127.0.0.1' }
      });
      await vite.listen();
      return { vite, port };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Could not start Vite for UI capture');
}

async function waitForCloudArt(page) {
  // Award clouds are inline SVG; only the portraits and guild emblems need to load.
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('.aw-card img')].map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
      img.onload = img.onerror = resolve;
    }))));
  });
}

async function waitForBgImages(page, selector) {
  await page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (!root) return;
    const urls = new Set();
    const collect = (el) => {
      const bg = getComputedStyle(el).backgroundImage;
      for (const match of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        if (match[1] && match[1] !== 'none') urls.add(match[1]);
      }
    };
    collect(root);
    root.querySelectorAll('*').forEach(collect);
    await Promise.all([...urls].map((src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = src;
    })));
  }, selector);
}

async function shot(locator, file) {
  await locator.screenshot({
    path: path.join(OUT, file),
    animations: 'disabled',
    type: 'png'
  });
}

const { vite, port } = await startVite();
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 980 },
    deviceScaleFactor: 2
  });
  await page.goto(`http://127.0.0.1:${port}/docs/product/guidebook/capture/stage.html`, {
    waitUntil: 'load',
    timeout: 90000
  });
  await page.waitForSelector('html.capture-ready');
  await page.waitForSelector('#main-app-title');
  if (await page.locator('vite-error-overlay').count()) {
    const detail = await page.locator('vite-error-overlay').innerText();
    throw new Error(`Vite error overlay on capture stage:\n${detail.slice(0, 800)}`);
  }
  await page.waitForFunction(() => {
    const title = document.getElementById('main-app-title');
    if (!title) return false;
    const family = getComputedStyle(title).fontFamily.toLowerCase();
    const display = getComputedStyle(document.getElementById('app-screen')).display;
    return family.includes('fredoka') && display.includes('flex');
  }, null, { timeout: 30000 });

  await shot(page.locator('#award-header-atmosphere'), 'header-day.png');

  await page.evaluate(() => window.__gcqCapture.fillHeader(true));
  await page.waitForTimeout(200);
  await shot(page.locator('#award-header-atmosphere'), 'header-night.png');

  await page.evaluate(() => window.__gcqCapture.fillHeader(false));
  await page.waitForTimeout(150);

  // The cloud dock sinks away when idle on a mouse PC; always shoot it awake.
  await page.evaluate(() => document.getElementById('bottom-nav-bar')?.classList.remove('cloud-dock--asleep'));
  await shot(page.locator('#bottom-nav-bar'), 'nav-dock.png');
  await waitForCloudArt(page);
  await shot(page.locator('#capture-cloud-frame'), 'award-cloud.png');

  await page.evaluate(() => {
    document.getElementById('app-screen')?.classList.add('hidden');
  });
  const hcd = page.locator('#hero-celebration-modal .hcd-card');
  try {
    await hcd.waitFor({ state: 'visible', timeout: 8000 });
    await shot(hcd, 'hero-of-the-day.png');
  } catch (err) {
    console.warn('Hero of the Day capture skipped:', err.message);
  }

  await page.evaluate(() => {
    const hcdModal = document.getElementById('hero-celebration-modal');
    hcdModal?.classList.add('hidden');
    hcdModal?.classList.remove('capture-hcd');
    window.__gcqCapture.hideAttendanceChronicle();
    window.__gcqCapture.showCeremony('intro');
  });
  try {
    await page.locator('#ceremony-screen.capture-ceremony').waitFor({ state: 'attached', timeout: 8000 });
    await page.waitForTimeout(200);
    await shot(page.locator('#ceremony-screen'), 'ceremony-intro.png');
    const ceremonyShots = [
      ['team', 'ceremony-team-quest.png'],
      ['duel', 'ceremony-duel.png'],
      ['transition', 'ceremony-transition.png'],
      ['hero', 'ceremony-hero.png'],
      ['standings', 'ceremony-standings.png'],
      ['growth-intro', 'ceremony-growth-intro.png'],
      ['growth-garden', 'ceremony-growth-garden.png'],
      ['growth-bloom', 'ceremony-growth-bloom.png'],
      ['growth-finale', 'ceremony-growth-finale.png']
    ];
    for (const [mode, file] of ceremonyShots) {
      await page.evaluate((m) => window.__gcqCapture.showCeremony(m), mode);
      await page.waitForTimeout(200);
      await shot(page.locator('#ceremony-screen'), file);
    }
    await page.evaluate(() => window.__gcqCapture.hideCeremony());
    for (const mode of ['opening', 'prodigies', 'crowning', 'champion']) {
      await page.evaluate((m) => window.__gcqCapture.showGrandCeremony(m), mode);
      await page.evaluate(async () => {
        await Promise.all([...document.images].map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
          img.onload = img.onerror = resolve;
        }))));
      });
      await page.waitForTimeout(200);
      await shot(page.locator('#grand-guild-ceremony-screen'), `grand-ceremony-${mode}.png`);
    }
  } catch (err) {
    console.warn('Ceremony capture skipped:', err.message);
  }

  await page.evaluate(() => {
    window.__gcqCapture.hideCeremony();
    window.__gcqCapture.hideGrandCeremony();
    window.__gcqCapture.showAttendanceChronicle();
  });
  try {
    const ac = page.locator('#attendance-chronicle-modal .attendance-chronicle-modal-panel');
    await ac.waitFor({ state: 'visible', timeout: 8000 });
    await shot(ac, 'attendance-chronicle.png');
  } catch (err) {
    console.warn('Attendance Chronicle capture skipped:', err.message);
  }

  await page.evaluate(() => {
    window.__gcqCapture.hideCeremony();
    window.__gcqCapture.hideAttendanceChronicle();
  });

  const REDESIGN_SHOTS = new Set([
    'adventure-log.png', 'campfire-entry.png', 'bounty-poster.png', 'bounty-poster-timer.png',
    'adventurers-passport.png', 'avatar-forge.png', 'class-charter.png', 'class-emblem-case.png',
    'guild-banner.png', 'guild-anthem.png', 'teacher-boon-modal.png', 'heros-boon-modal.png', 'office-home.png', 'office-registry.png', 'adventurers-guide.png'
  ]);

  async function captureExtra(label, run, locator, file) {
    try {
      if (await page.locator('vite-error-overlay').count()) {
        const detail = await page.locator('vite-error-overlay').innerText();
        throw new Error(`Vite error overlay during ${label}:\n${detail.slice(0, 800)}`);
      }
      await page.evaluate(run);
      const el = page.locator(locator);
      await el.waitFor({ state: 'visible', timeout: 12000 });
      if (file === 'award-stars-tab.png' || file === 'award-cloud.png') {
        await waitForCloudArt(page);
      }
      if (file === 'special-quest-runner.png' || file === 'special-quest-projector.png' || REDESIGN_SHOTS.has(file)) {
        await page.evaluate(async () => {
          await Promise.all([...document.images].map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
            img.onload = img.onerror = resolve;
          }))));
        });
      }
      if (REDESIGN_SHOTS.has(file)) await waitForBgImages(page, locator);
      await page.waitForTimeout(file === 'fortune-ledger.png' || file === 'award-stars-tab.png' || file === 'projector.png' || file === 'home-tab.png' || file === 'special-quest-projector.png' || file === 'special-quest-runner.png' || file === 'campfire-scene.png' || file === 'campfire-words.png' || file === 'ember-oaths.png' || file === 'campfire-entry.png' ? 400 : 220);
      await shot(el, file);
    } catch (err) {
      console.warn(`${label} capture skipped:`, err.message);
    }
  }

  await captureExtra('Market legendaries', () => window.__gcqCapture.showShop('legendaries'), '#shop-tab.capture-shop', 'market-legendaries.png');
  await captureExtra('Market seasonal', () => window.__gcqCapture.showShop('seasonal'), '#shop-tab.capture-shop', 'market-seasonal.png');
  await captureExtra('Market eggs', () => window.__gcqCapture.showShop('eggs'), '#shop-tab.capture-shop', 'market-eggs.png');
  await captureExtra("Fortune's Wheel", () => window.__gcqCapture.showFortuneWheel(), '#fortunes-wheel-modal.capture-fw .fw-card', 'fortunes-wheel.png');
  await captureExtra('Skill Tree', () => window.__gcqCapture.showSkillTree(), '#skill-tree-modal.capture-skill #skill-tree-modal-panel', 'skill-tree.png');
  await captureExtra('Hall of Heroes', () => window.__gcqCapture.showHallOfHeroes(), '#history-modal.capture-hoh #history-modal-panel', 'hall-of-heroes.png');
  await captureExtra('Quiz of the Week', () => window.__gcqCapture.showQuiz(), '#capture-quiz-host.capture-quiz .weather-card', 'quiz-of-the-week.png');
  await captureExtra('Bulk trial', () => window.__gcqCapture.showBulkTrial('dictation'), '#bulk-trial-modal.capture-bulk #bulk-trial-shell', 'scroll-bulk.png');
  await captureExtra('Bulk trial test', () => window.__gcqCapture.showBulkTrial('test'), '#bulk-trial-modal.capture-bulk #bulk-trial-shell', 'scroll-bulk-test.png');
  await captureExtra('Starfall', () => window.__gcqCapture.showStarfall(), '#starfall-modal.capture-starfall #starfall-modal-content', 'starfall.png');
  await captureExtra('Story Weavers', () => window.__gcqCapture.showStoryWeavers(), '#reward-ideas-tab.capture-story', 'story-weavers.png');
  await captureExtra('Settings Student Tools', () => window.__gcqCapture.showSettings('manage'), '#options-tab.capture-settings', 'settings-tools.png');
  await captureExtra('Settings My Classes', () => window.__gcqCapture.showSettings('classes'), '#options-tab.capture-settings', 'settings-classes.png');
  await captureExtra('Settings Profile', () => window.__gcqCapture.showSettings('profile'), '#options-tab.capture-settings', 'settings-profile.png');
  await captureExtra('Settings Planning', () => window.__gcqCapture.showSettings('planning'), '#options-tab.capture-settings', 'settings-planning.png');
  await captureExtra('Settings Grading', () => window.__gcqCapture.showSettings('assessments'), '#options-tab.capture-settings', 'settings-grading.png');
  await captureExtra('Settings Family Access', () => window.__gcqCapture.showSettings('access'), '#options-tab.capture-settings', 'settings-family.png');
  await captureExtra('Settings Quiz', () => window.__gcqCapture.showSettings('quiz'), '#options-tab.capture-settings', 'settings-quiz.png');
  await captureExtra('Manage Students', () => window.__gcqCapture.showRoster(), '#manage-students-tab.capture-roster', 'settings-roster.png');
  await captureExtra("Hero's Chronicle", () => window.__gcqCapture.showChronicle(), '#hero-chronicle-modal.capture-chronicle > div', 'settings-chronicle.png');
  await captureExtra('Guild Sorting Quiz', () => window.__gcqCapture.showSortingQuiz(), '#sorting-quiz-modal.capture-sort', 'guild-sorting-quiz.png');
  await captureExtra('Guild Hall', () => window.__gcqCapture.showGuildHall(), '#guilds-tab.capture-guilds', 'guild-hall.png');
  await captureExtra('Quest Calendar month', () => window.__gcqCapture.showCalendar(), '#calendar-tab.capture-calendar', 'calendar-month.png');
  await captureExtra('Day Planner schedule', () => window.__gcqCapture.showDayPlanner('schedule'), '#day-planner-modal.capture-planner > div', 'calendar-planner.png');
  await captureExtra('Day Planner event', () => window.__gcqCapture.showDayPlanner('event'), '#day-planner-modal.capture-planner > div', 'calendar-planner-event.png');
  await captureExtra('Day Planner special quest', () => window.__gcqCapture.showDayPlanner('event', 'vault'), '#day-planner-modal.capture-planner > div', 'calendar-planner-special.png');
  await captureExtra('Special Quest runner', () => window.__gcqCapture.showSpecialQuestRunner(), '#special-quest-runner-modal.capture-sq .special-quest-runner', 'special-quest-runner.png');
  await captureExtra('Special Quest projector', () => window.__gcqCapture.showSpecialQuestProjector(), '#capture-sq-projector.capture-sq-proj', 'special-quest-projector.png');
  await captureExtra('Quiz play intro', () => window.__gcqCapture.showQuizPlay('intro'), '#quiz-of-week-modal.capture-quiz-play #quiz-modal-inner', 'quiz-play-intro.png');
  await captureExtra('Quiz play question', () => window.__gcqCapture.showQuizPlay('question'), '#quiz-of-week-modal.capture-quiz-play #quiz-modal-inner', 'quiz-play-question.png');
  await captureExtra('Quiz play results', () => window.__gcqCapture.showQuizPlay('results'), '#quiz-of-week-modal.capture-quiz-play #quiz-modal-inner', 'quiz-play-results.png');
  await captureExtra('Award Stars tab', () => window.__gcqCapture.showAwardStarsTab(), '#award-stars-tab.capture-award', 'award-stars-tab.png');
  await captureExtra("Hero's Challenge", () => window.__gcqCapture.showHerosChallenge(), '#student-leaderboard-tab.capture-hc', 'heros-challenge.png');
  await captureExtra('Team Quest', () => window.__gcqCapture.showTeamQuest(), '#class-leaderboard-tab.capture-tq', 'team-quest.png');
  await captureExtra('Fortune Ledger', () => window.__gcqCapture.showFortuneLedger(), '#fortunes-wheel-section', 'fortune-ledger.png');
  await captureExtra('Trophy Room', () => window.__gcqCapture.showTrophyRoom(), '#trophy-room-modal.capture-trophy > div', 'trophy-room.png');
  await captureExtra('Hall of Prodigies', () => window.__gcqCapture.showHallOfProdigies(), '#prodigy-modal.capture-prodigy .prodigy-hall-shell', 'hall-of-prodigies.png');
  await captureExtra('Crown Race explainer', () => window.__gcqCapture.showGuildPowerExplainer(), '#guild-power-explainer-overlay.capture-gpex .guild-power-explainer-card', 'guild-power.png');
  await captureExtra('Home tab', () => window.__gcqCapture.showHomeTab(), '#about-tab.capture-home', 'home-tab.png');
  await captureExtra('Projector wallpaper', () => window.__gcqCapture.showProjector(), '#dynamic-wallpaper-screen.capture-wall', 'projector.png');
  await captureExtra('Certificate forge', () => window.__gcqCapture.showCertificateForge(), '#certificate-modal.capture-cert-forge > div', 'certificate-forge.png');
  await captureExtra('Certificate print', () => window.__gcqCapture.showCertificatePrint(), '#certificate-template.capture-cert', 'certificate.png');
  await captureExtra('Hero class assignment', () => window.__gcqCapture.showHeroClass(), '#hero-class-select-modal.capture-hero-class #hcs-shell', 'hero-class.png');
  await captureExtra('Ember Oaths board', () => window.__gcqCapture.showOathBoard(), '#ember-oaths-modal.capture-eo .eo-shell', 'ember-oaths.png');
  await captureExtra('Campfire word embers', () => window.__gcqCapture.showCampfireScene('words'), '#hero-campfire-scene.capture-cf', 'campfire-words.png');
  await captureExtra('Campfire oath circle', () => window.__gcqCapture.showCampfireScene('circle'), '#hero-campfire-scene.capture-cf', 'campfire-scene.png');

  // From here on "today" is Monday 28 September 2026, 10:15: the diary, the Teacher Boon window
  // (last 7 days of the month), the bounty bell and the office greeting all read the clock.
  await page.clock.setFixedTime(new Date(2026, 8, 28, 10, 15));
  await captureExtra('Adventure Log', () => window.__gcqCapture.showAdventureLog(), '#adventure-log-tab.capture-log', 'adventure-log.png');
  await captureExtra('Adventure Log campfire', () => window.__gcqCapture.showAdventureLog('gather'), '#adventure-log-tab.capture-log', 'campfire-entry.png');
  await captureExtra('Post a Bounty: Star Hunt', () => window.__gcqCapture.showBountyPoster('standard'), '#create-bounty-modal.capture-bp', 'bounty-poster.png');
  await captureExtra('Post a Bounty: Race the Clock', () => window.__gcqCapture.showBountyPoster('timer'), '#create-bounty-modal.capture-bp', 'bounty-poster-timer.png');
  await captureExtra("Adventurer's Passport", () => window.__gcqCapture.showPassport(), '#edit-student-modal.capture-sp', 'adventurers-passport.png');
  await captureExtra('Avatar Forge', () => window.__gcqCapture.showAvatarForge(), '#avatar-maker-modal.capture-af', 'avatar-forge.png');
  await captureExtra('Class charter', () => window.__gcqCapture.showClassCharter(), '#create-class-modal.capture-cc', 'class-charter.png');
  await captureExtra('Class emblem case', () => window.__gcqCapture.showEmblemCase(), '#logo-picker-modal.capture-lp', 'class-emblem-case.png');
  await captureExtra('Guild banner', () => window.__gcqCapture.showGuildBanner(), '#guild-lore-overlay.capture-lore', 'guild-banner.png');
  await captureExtra('Guild anthem', () => window.__gcqCapture.showGuildAnthem(), '#guild-anthem-overlay.capture-anthem', 'guild-anthem.png');
  await captureExtra('Teacher Boon', () => window.__gcqCapture.showTeacherBoon(), '#teacher-boon-modal.capture-tb', 'teacher-boon-modal.png');
  await captureExtra("Hero's Boon", () => window.__gcqCapture.showHeroBoon(), '#bestow-boon-modal.capture-hb', 'heros-boon-modal.png');
  await captureExtra('Office front desk', () => window.__gcqCapture.showOffice('home'), '#secretary-screen.capture-office', 'office-home.png');
  await captureExtra('Office Students & Classes', () => window.__gcqCapture.showOffice('registry'), '#secretary-screen.capture-office', 'office-registry.png');
  await captureExtra("Adventurer's Guide", () => window.__gcqCapture.showAdventurersGuide(), '#app-info-modal.capture-ag .ag-book', 'adventurers-guide.png');
  // Quest Remote last: its capture layer sits above everything until the shoot ends.
  await captureExtra('Quest Remote binding circle', () => window.__gcqCapture.showProjectorRemote('bind'), '#capture-quest-remote .qr-bind', 'quest-remote-bind.png');
  await captureExtra('Quest Remote Showdown', () => window.__gcqCapture.showProjectorRemote('showdown'), '#capture-quest-remote .qr-sd', 'quest-remote-showdown.png');
  await captureExtra('Quest Remote timer', () => window.__gcqCapture.showProjectorRemote('timer'), '#capture-quest-remote .capture-qr-timer-stage', 'quest-remote-timer.png');
  await captureExtra('Wand: stars', () => window.__gcqCapture.showWand('stars'), '#capture-quest-remote .qw', 'wand-stars.png');
  await captureExtra('Wand: several', () => window.__gcqCapture.showWand('several'), '#capture-quest-remote .qw', 'wand-several.png');
  await captureExtra('Wand: award', () => window.__gcqCapture.showWand('award'), '#capture-quest-remote .qw', 'wand-award.png');
  await captureExtra('Quest Remote star ribbon', () => window.__gcqCapture.showProjectorRemote('ribbon'), '#capture-quest-remote .capture-qr-ribbon-stage', 'quest-remote-ribbon.png');
  await captureExtra('Wand: stage', () => window.__gcqCapture.showWand('stage'), '#capture-quest-remote .qw', 'wand-stage.png');
  await captureExtra('Wand: magic', () => window.__gcqCapture.showWand('magic'), '#capture-quest-remote .qw', 'wand-magic.png');
  await captureExtra('Wand: show', () => window.__gcqCapture.showWand('show'), '#capture-quest-remote .qw', 'wand-show.png');
  await page.evaluate(() => window.__gcqCapture.hideRemote());

  console.log('Captured UI chrome into', OUT);
} finally {
  await browser.close();
  await vite.close();
}
