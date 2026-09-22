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
  await page.evaluate(async () => {
    const urls = new Set();
    document.querySelectorAll('.cloud-bg-asset').forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      const match = /url\(["']?([^"')]+)["']?\)/.exec(bg);
      if (match?.[1] && match[1] !== 'none') urls.add(match[1]);
    });
    await Promise.all([...urls].map((src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = src;
    })));
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
    window.__gcqCapture.hideTrialType();
    window.__gcqCapture.showCeremony('intro');
  });
  try {
    await page.locator('#ceremony-screen.capture-ceremony').waitFor({ state: 'attached', timeout: 8000 });
    await page.waitForTimeout(200);
    await shot(page.locator('#ceremony-screen'), 'ceremony-intro.png');
    await page.evaluate(() => window.__gcqCapture.showCeremony('team'));
    await page.waitForTimeout(120);
    await shot(page.locator('#ceremony-screen'), 'ceremony-team-quest.png');
    await page.evaluate(() => window.__gcqCapture.showCeremony('duel'));
    await page.waitForTimeout(120);
    await shot(page.locator('#ceremony-screen'), 'ceremony-duel.png');
    await page.evaluate(() => window.__gcqCapture.showCeremony('transition'));
    await page.waitForTimeout(120);
    await shot(page.locator('#ceremony-screen'), 'ceremony-transition.png');
    await page.evaluate(() => window.__gcqCapture.showCeremony('hero'));
    await page.waitForTimeout(120);
    await shot(page.locator('#ceremony-screen'), 'ceremony-hero.png');
    await page.evaluate(() => window.__gcqCapture.showCeremony('growth-intro'));
    await page.waitForTimeout(200);
    await waitForBgImages(page, '#ceremony-screen');
    await shot(page.locator('#ceremony-screen'), 'ceremony-growth-intro.png');
    await page.evaluate(() => window.__gcqCapture.showCeremony('growth-garden'));
    await page.waitForTimeout(200);
    await waitForBgImages(page, '#ceremony-screen');
    await shot(page.locator('#ceremony-screen'), 'ceremony-growth-garden.png');
    await page.evaluate(() => window.__gcqCapture.showCeremony('growth-bloom'));
    await page.waitForTimeout(200);
    await waitForBgImages(page, '#ceremony-screen');
    await shot(page.locator('#ceremony-screen'), 'ceremony-growth-bloom.png');
    await page.evaluate(() => window.__gcqCapture.showCeremony('growth-finale'));
    await page.waitForTimeout(450);
    await waitForBgImages(page, '#ceremony-screen');
    await shot(page.locator('#ceremony-screen'), 'ceremony-growth-finale.png');
  } catch (err) {
    console.warn('Ceremony capture skipped:', err.message);
  }

  await page.evaluate(() => {
    window.__gcqCapture.hideCeremony();
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
    window.__gcqCapture.hideAttendanceChronicle();
    window.__gcqCapture.showTrialType();
  });
  try {
    const trial = page.locator('#trial-type-modal > div');
    await trial.waitFor({ state: 'visible', timeout: 8000 });
    await shot(trial, 'trial-type.png');
  } catch (err) {
    console.warn('Trial type capture skipped:', err.message);
  }

  await page.evaluate(() => {
    window.__gcqCapture.hideTrialType();
    window.__gcqCapture.hideCeremony();
    window.__gcqCapture.hideAttendanceChronicle();
  });

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
      if (file === 'special-quest-runner.png' || file === 'special-quest-projector.png') {
        await page.evaluate(async () => {
          await Promise.all([...document.images].map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
            img.onload = img.onerror = resolve;
          }))));
        });
      }
      await page.waitForTimeout(file === 'fortune-ledger.png' || file === 'award-stars-tab.png' || file === 'projector.png' || file === 'home-tab.png' || file === 'special-quest-projector.png' || file === 'special-quest-runner.png' ? 400 : 220);
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
  await captureExtra('Adventure Log', () => window.__gcqCapture.showAdventureLog(), '#adventure-log-tab.capture-log', 'adventure-log.png');
  await captureExtra('Hall of Heroes', () => window.__gcqCapture.showHallOfHeroes(), '#history-modal.capture-hoh #history-modal-panel', 'hall-of-heroes.png');
  await captureExtra('Quiz of the Week', () => window.__gcqCapture.showQuiz(), '#capture-quiz-host.capture-quiz .weather-card', 'quiz-of-the-week.png');
  await captureExtra('Bulk trial', () => window.__gcqCapture.showBulkTrial(), '#bulk-trial-modal.capture-bulk #bulk-trial-shell', 'scroll-bulk.png');
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
  await captureExtra('Guild Sorting Quiz', () => window.__gcqCapture.showSortingQuiz(), '#sorting-quiz-modal.capture-sort .sorting-quiz-card', 'guild-sorting-quiz.png');
  await captureExtra('Guild Hall crystals', () => window.__gcqCapture.showGuildHall(), '#guilds-tab.capture-guilds', 'guild-hall.png');
  await captureExtra('Quest Calendar month', () => window.__gcqCapture.showCalendar(), '#calendar-tab.capture-calendar', 'calendar-month.png');
  await captureExtra('Day Planner schedule', () => window.__gcqCapture.showDayPlanner('schedule'), '#day-planner-modal.capture-planner > div', 'calendar-planner.png');
  await captureExtra('Day Planner event', () => window.__gcqCapture.showDayPlanner('event'), '#day-planner-modal.capture-planner > div', 'calendar-planner-event.png');
  await captureExtra('Day Planner special quest', () => window.__gcqCapture.showDayPlanner('event', 'vault'), '#day-planner-modal.capture-planner > div', 'calendar-planner-special.png');
  await captureExtra('Special Quest runner', () => window.__gcqCapture.showSpecialQuestRunner(), '#special-quest-runner-modal.capture-sq .special-quest-runner', 'special-quest-runner.png');
  await captureExtra('Special Quest projector', () => window.__gcqCapture.showSpecialQuestProjector(), '#capture-sq-projector.capture-sq-proj', 'special-quest-projector.png');
  await captureExtra('Quiz play intro', () => window.__gcqCapture.showQuizPlay('intro'), '#quiz-of-week-modal.capture-quiz-play #quiz-modal-inner', 'quiz-play-intro.png');
  await captureExtra('Quiz play question', () => window.__gcqCapture.showQuizPlay('question'), '#quiz-of-week-modal.capture-quiz-play #quiz-modal-inner', 'quiz-play-question.png');
  await captureExtra('Award Stars tab', () => window.__gcqCapture.showAwardStarsTab(), '#award-stars-tab.capture-award', 'award-stars-tab.png');
  await captureExtra("Hero's Challenge", () => window.__gcqCapture.showHerosChallenge(), '#student-leaderboard-tab.capture-hc', 'heros-challenge.png');
  await captureExtra('Team Quest', () => window.__gcqCapture.showTeamQuest(), '#class-leaderboard-tab.capture-tq', 'team-quest.png');
  await captureExtra('Fortune Ledger', () => window.__gcqCapture.showFortuneLedger(), '#fortunes-wheel-section', 'fortune-ledger.png');
  await captureExtra('Trophy Room', () => window.__gcqCapture.showTrophyRoom(), '#trophy-room-modal.capture-trophy > div', 'trophy-room.png');
  await captureExtra('Hall of Prodigies', () => window.__gcqCapture.showHallOfProdigies(), '#prodigy-modal.capture-prodigy .prodigy-hall-shell', 'hall-of-prodigies.png');
  await captureExtra('Guild Power explainer', () => window.__gcqCapture.showGuildPowerExplainer(), '#guild-power-explainer-overlay.capture-gpex .guild-power-explainer-card', 'guild-power.png');
  await captureExtra('Home tab', () => window.__gcqCapture.showHomeTab(), '#about-tab.capture-home', 'home-tab.png');
  await captureExtra('Projector wallpaper', () => window.__gcqCapture.showProjector(), '#dynamic-wallpaper-screen.capture-wall', 'projector.png');
  await captureExtra('Certificate forge', () => window.__gcqCapture.showCertificateForge(), '#certificate-modal.capture-cert-forge > div', 'certificate-forge.png');
  await captureExtra('Certificate print', () => window.__gcqCapture.showCertificatePrint(), '#certificate-template.capture-cert', 'certificate.png');
  await captureExtra('Hero class assignment', () => window.__gcqCapture.showHeroClass(), '#hero-class-select-modal.capture-hero-class #hcs-shell', 'hero-class.png');

  console.log('Captured UI chrome into', OUT);
} finally {
  await browser.close();
  await vite.close();
}
