const { test, expect } = require('@playwright/test');

const QUEST_URL = /url\("data:image\/svg\+xml,[^)]*gcq-quest-cursor/;

async function openLogin(page) {
  await page.route(/cloudfunctions\.net\/getSecretaryBootstrapStatus$/, route =>
    route.fulfill({ json: { data: { state: 'active', requiresToken: false } } }));
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#login-form')).toBeVisible();
}

async function addSurface(page, cursor = 'default', tag = 'button') {
  // Isolate cursor semantics from auth and loading-screen exit transitions.
  await page.evaluate(({ cursor, tag }) => {
    document.getElementById('cursor-test-surface')?.remove();
    const surface = document.createElement(tag);
    surface.id = 'cursor-test-surface';
    surface.textContent = 'Cursor test surface';
    surface.style.cssText = `position:fixed;inset:0;z-index:2000000000;cursor:${cursor};user-select:none`;
    document.body.append(surface);
  }, { cursor, tag });
}

test.beforeEach(async ({ page }) => {
  await openLogin(page);
  await addSurface(page);
});

test('cursor art is always a real native cursor, never a DOM image chasing the mouse', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Native cursor states require a mouse');
  const surface = page.locator('#cursor-test-surface');
  await surface.evaluate(button => {
    const area = document.createElement('div');
    area.id = button.id;
    area.style.cssText = button.style.cssText;
    area.textContent = button.textContent;
    button.replaceWith(area);
  });
  await page.mouse.move(420, 320);
  for (const state of ['wait', 'progress', 'default', 'pointer', 'text', 'grab', 'grabbing', 'move', 'help', 'crosshair', 'zoom-in', 'zoom-out', 'not-allowed']) {
    const mode = state === 'not-allowed' ? 'blocked' : state;
    await surface.evaluate((element, cursor) => { element.style.cursor = cursor; }, state);
    await expect(surface).toHaveAttribute('data-gcq-cursor', mode);
    await expect(surface).toHaveCSS('cursor', QUEST_URL);
    await expect(surface).toHaveCSS('cursor', new RegExp(`, ${state}$`));
  }
  // No element in the page ever tracks the pointer or hides the system cursor.
  expect(await page.locator('.gcq-cursor-visual, .gcq-cursor-glyph').count()).toBe(0);
  await surface.evaluate(element => { element.style.cursor = 'ew-resize'; });
  await expect(surface).not.toHaveAttribute('data-gcq-cursor');
  await expect(surface).toHaveCSS('cursor', 'ew-resize');
});

test('the hourglass turns smoothly while the mouse rests or moves, without restarting', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Native cursor animation requires a mouse');
  await page.locator('#cursor-test-surface').evaluate(element => { element.style.cursor = 'wait'; });
  await page.mouse.move(420, 320);
  await expect(page.locator('#cursor-test-surface')).toHaveAttribute('data-gcq-cursor', 'wait');
  const samples = await page.evaluate(async () => {
    const surface = document.getElementById('cursor-test-surface');
    const frames = [];
    const start = performance.now();
    while (performance.now() - start < 2600) {
      await new Promise(requestAnimationFrame);
      frames.push({ frame: surface.dataset.gcqFrame, cursor: getComputedStyle(surface).cursor });
    }
    return frames;
  });
  const seen = new Set(samples.map(sample => sample.frame));
  expect(seen.size).toBeGreaterThan(12); // Draining and turning frames all appear.
  for (const sample of samples) {
    expect(sample.cursor).toMatch(QUEST_URL); // Never a system fallback flash.
    expect(sample.cursor).toMatch(/, wait$/);
  }
  // Frames only ever step forward (wrapping at the end of the loop).
  const order = samples.map(sample => Number(sample.frame));
  const backwards = order.filter((value, i) => i > 0 && value < order[i - 1]);
  expect(backwards.length).toBeLessThanOrEqual(2);

  // Movement does not reset the animation to its first frame.
  const before = Number(await page.locator('#cursor-test-surface').getAttribute('data-gcq-frame'));
  for (let i = 0; i < 10; i++) await page.mouse.move(420 + i * 6, 320 + i * 2);
  const after = Number(await page.locator('#cursor-test-surface').getAttribute('data-gcq-frame'));
  if (before > 2) expect(after).not.toBe(0);
});

test('the loading screen shows the hourglass and hands over without a gap', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Native cursor animation requires a mouse');
  await page.evaluate(() => document.getElementById('cursor-test-surface').remove());
  await page.evaluate(() => {
    const screen = document.getElementById('loading-screen');
    screen.classList.remove('hidden', 'loading-screen-exit', 'opacity-0', 'pointer-events-none');
    document.body.append(screen);
    screen.style.setProperty('z-index', '2000000000', 'important');
  });
  await page.mouse.move(400, 300);
  const hovered = page.locator('[data-gcq-cursor]');
  await expect(hovered).toHaveAttribute('data-gcq-cursor', 'wait');
  // Moving across the scene's many layers keeps one continuous hourglass.
  const frames = [];
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(400 + i * 9, 300 + (i % 5) * 7);
    frames.push(await page.evaluate(() => {
      const marked = document.querySelectorAll('[data-gcq-cursor]');
      return { count: marked.length, mode: marked[0]?.dataset.gcqCursor, cursor: marked[0] && getComputedStyle(marked[0]).cursor };
    }));
  }
  for (const frame of frames) {
    expect(frame.count).toBe(1);
    expect(frame.mode).toBe('wait');
    expect(frame.cursor).toMatch(QUEST_URL);
  }
  await page.evaluate(() => document.getElementById('loading-screen').classList.add('hidden'));
  await expect(page.locator('[data-gcq-cursor="wait"]')).toHaveCount(0);
});

test('state changes pop in crisply around the hotspot and presses respond instantly', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Mouse cursor poses require a mouse');
  const surface = page.locator('#cursor-test-surface');
  await page.mouse.move(420, 320);
  await expect(surface).toHaveAttribute('data-gcq-cursor', 'pointer');
  await expect(surface).not.toHaveAttribute('data-gcq-frame');
  const samples = await page.evaluate(async () => {
    const surface = document.getElementById('cursor-test-surface');
    surface.style.cursor = 'text';
    const frames = [];
    const start = performance.now();
    while (performance.now() - start < 260) {
      await new Promise(requestAnimationFrame);
      frames.push({ mode: surface.dataset.gcqCursor, frame: surface.dataset.gcqFrame ?? null, cursor: getComputedStyle(surface).cursor });
    }
    return frames;
  });
  // The new state is read on the next animation frame; sample from there on.
  const changed = samples.slice(samples.findIndex(sample => sample.mode === 'text'));
  const poses = [...new Set(changed.map(sample => sample.frame))];
  expect(poses[0]).toBe('enter');
  expect(poses).toContain('settle');
  expect(poses.at(-1)).toBe(null);
  for (const sample of changed) {
    expect(sample.mode).toBe('text');
    expect(sample.cursor).toMatch(QUEST_URL);
    expect(sample.cursor).toMatch(/ 16 16, text$/);
  }
  await surface.evaluate(element => { element.style.cursor = ''; });
  await expect(surface).not.toHaveAttribute('data-gcq-frame');
  await page.mouse.down();
  await expect(surface).toHaveAttribute('data-gcq-frame', 'press');
  await expect(surface).toHaveCSS('cursor', QUEST_URL);
  await expect(page.locator('.gcq-cursor-twinkle')).toHaveCount(1);
  await page.mouse.up();
  await expect(surface).not.toHaveAttribute('data-gcq-frame');
});

test('busy controls, reduced motion, contrast and preference keep usable cursors', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Native cursor preferences require a mouse');
  const surface = page.locator('#cursor-test-surface');
  await page.mouse.move(420, 320);
  await surface.evaluate(element => { element.disabled = true; });
  await expect(surface).toHaveAttribute('data-gcq-cursor', 'blocked');
  await surface.evaluate(element => { element.setAttribute('aria-busy', 'true'); });
  await expect(surface).toHaveAttribute('data-gcq-cursor', 'progress');
  await expect(surface).toHaveAttribute('data-gcq-frame', /^\d+$/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(surface).not.toHaveAttribute('data-gcq-frame');
  await expect(surface).toHaveCSS('cursor', /5 4, progress$/);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(surface).toHaveAttribute('data-gcq-frame', /^\d+$/);
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(page.locator('html')).not.toHaveClass(/gcq-quest-cursor/);
  await expect(surface).not.toHaveCSS('cursor', QUEST_URL);
  await page.emulateMedia({ forcedColors: 'none' });
  await page.mouse.move(430, 330);
  await expect(surface).toHaveAttribute('data-gcq-cursor', 'progress');
  await page.evaluate(() => {
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = 'quest-cursor-toggle';
    document.body.append(toggle);
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('html')).not.toHaveClass(/gcq-quest-cursor/);
  await expect(surface).not.toHaveAttribute('data-gcq-cursor');
  await expect(surface).not.toHaveCSS('cursor', QUEST_URL);
});

test('touch input never applies Quest cursors', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch behavior is checked in the mobile project');
  const surface = page.locator('#cursor-test-surface');
  await surface.evaluate(element => { element.setAttribute('aria-busy', 'true'); });
  await surface.tap();
  await expect(page.locator('html')).not.toHaveClass(/gcq-quest-cursor/);
  await expect(surface).not.toHaveAttribute('data-gcq-cursor');
});

test('steady pointer movement never queries styles', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Native pointer movement requires a mouse');
  await page.mouse.move(100, 100);
  for (const state of ['default', 'wait']) {
    await page.locator('#cursor-test-surface').evaluate((element, cursor) => { element.style.cursor = cursor; }, state);
    await expect(page.locator('#cursor-test-surface')).toHaveAttribute('data-gcq-cursor', state === 'default' ? 'pointer' : 'wait');
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.evaluate(() => {
      window.cursorQueryCount = 0;
      window.cursorOriginalGetStyle = window.getComputedStyle;
      window.getComputedStyle = (...args) => { window.cursorQueryCount++; return window.cursorOriginalGetStyle(...args); };
    });
    for (let i = 0; i < 20; i++) await page.mouse.move(100 + i * 5, 100 + i * 3);
    const queries = await page.evaluate(() => {
      window.getComputedStyle = window.cursorOriginalGetStyle;
      return window.cursorQueryCount;
    });
    expect(queries).toBe(0);
    await expect(page.locator('#cursor-test-surface')).not.toHaveCSS('cursor', 'none');
  }
});

test('native images match regular and high-DPI displays', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Mouse artwork is checked at desktop DPI scales');
  const check = async (candidate, expectedDpr) => {
    await candidate.locator('#cursor-test-surface').evaluate(element => { element.style.cursor = 'wait'; });
    await candidate.mouse.move(420.25, 320.75);
    await expect(candidate.locator('#cursor-test-surface')).toHaveAttribute('data-gcq-cursor', 'wait');
    const frame = await candidate.evaluate(() => {
      const cursor = getComputedStyle(document.getElementById('cursor-test-surface')).cursor;
      const svg = decodeURIComponent(cursor.match(/data:image\/svg\+xml,([^")]*)/)[1]);
      return { dpr: devicePixelRatio, cursor, width: Number(svg.match(/width='(\d+)'/)[1]) };
    });
    expect(frame.dpr).toBe(expectedDpr);
    expect(frame.width).toBe(32 * expectedDpr);
    if (expectedDpr > 1) expect(frame.cursor).toMatch(/image-set\(/);
  };
  await check(page, 1);
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  try {
    const retina = await context.newPage();
    await openLogin(retina);
    await addSurface(retina, 'wait', 'div');
    await check(retina, 2);
    await retina.setViewportSize({ width: 1000, height: 700 });
    await expect(retina.locator('[data-gcq-cursor]')).toHaveCount(0);
    await check(retina, 2);
  } finally {
    await context.close();
  }
});
