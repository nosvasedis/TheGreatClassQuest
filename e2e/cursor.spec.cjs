const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route(/cloudfunctions\.net\/getSecretaryBootstrapStatus$/, route =>
    route.fulfill({ json: { data: { state: 'active', requiresToken: false } } }));
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#login-form')).toBeVisible();
  // Isolate cursor semantics from auth and loading-screen exit transitions.
  await page.evaluate(() => {
    const surface = document.createElement('button');
    surface.id = 'cursor-test-surface';
    surface.textContent = 'Cursor test surface';
    surface.style.cssText = 'position:fixed;inset:0;z-index:2000000000;cursor:default;user-select:none';
    document.body.append(surface);
  });
});

test('loading uses one animated hourglass and smoothly restores every cursor state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Native cursor states require a mouse');
  const surface = page.locator('#cursor-test-surface');
  const hourglass = page.locator('.gcq-cursor-hourglass');
  await surface.evaluate(button => {
    const area = document.createElement('div');
    area.id = button.id;
    area.style.cssText = button.style.cssText;
    area.textContent = button.textContent;
    button.replaceWith(area);
  });
  await page.mouse.move(420, 320);
  for (const state of ['wait', 'progress']) {
    await surface.evaluate((element, cursor) => { element.style.cursor = cursor; }, state);
    await expect(surface).toHaveAttribute('data-gcq-cursor', state);
    await expect(hourglass).toBeVisible();
    await expect(hourglass).toHaveClass(/is-active/);
    await expect(hourglass).toHaveCSS('opacity', '1');
    await expect(surface).toHaveCSS('cursor', 'none');
    const rect = await hourglass.boundingBox();
    expect(rect.x).toBe(404);
    expect(rect.y).toBe(304);
    const animation = await hourglass.locator('svg').evaluate(svg => {
      const turn = svg.getAnimations()[0];
      turn.pause();
      turn.currentTime = 0;
      const start = getComputedStyle(svg).transform;
      turn.currentTime = 2400;
      return { start, end: getComputedStyle(svg).transform };
    });
    expect(animation.end).not.toBe(animation.start);
  }
  for (const state of ['default', 'pointer', 'text', 'grab', 'grabbing', 'move', 'help', 'crosshair', 'zoom-in', 'zoom-out', 'not-allowed']) {
    await surface.evaluate((element, cursor) => { element.style.cursor = cursor; }, state);
    await expect(surface).toHaveAttribute('data-gcq-cursor', state === 'not-allowed' ? 'blocked' : state);
    await expect(hourglass).not.toHaveClass(/is-active/);
    await expect(page.locator(`.gcq-cursor-glyph[data-cursor-art="${state === 'not-allowed' ? 'blocked' : state}"]`)).toHaveClass(/is-active/);
    await expect(surface).toHaveCSS('cursor', 'none');
  }
  await surface.evaluate(element => { element.style.cursor = 'ew-resize'; });
  await expect(surface).not.toHaveAttribute('data-gcq-cursor');
  await expect(surface).toHaveCSS('cursor', 'ew-resize');
});

test('busy controls, reduced motion, contrast and preference keep usable cursors', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Native cursor preferences require a mouse');
  const surface = page.locator('#cursor-test-surface');
  const hourglass = page.locator('.gcq-cursor-hourglass');
  await page.mouse.move(420, 320);
  await surface.evaluate(element => { element.disabled = true; });
  await expect(surface).toHaveAttribute('data-gcq-cursor', 'blocked');
  await surface.evaluate(element => { element.setAttribute('aria-busy', 'true'); });
  await expect(surface).toHaveAttribute('data-gcq-cursor', 'progress');
  await expect(hourglass).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(hourglass).toBeHidden();
  await expect(surface).toHaveCSS('cursor', /16 16, progress$/);
  await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
  await expect(page.locator('html')).not.toHaveClass(/gcq-quest-cursor/);
  await expect(hourglass).toBeHidden();
  await page.emulateMedia({ forcedColors: 'none' });
  await page.mouse.move(430, 330);
  await expect(hourglass).toBeVisible();
  await page.evaluate(() => {
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = 'quest-cursor-toggle';
    document.body.append(toggle);
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('html')).not.toHaveClass(/gcq-quest-cursor/);
  await expect(hourglass).toBeHidden();
});

test('touch input never hides the system cursor or shows the animated hourglass', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch behavior is checked in the mobile project');
  const surface = page.locator('#cursor-test-surface');
  await surface.evaluate(element => { element.setAttribute('aria-busy', 'true'); });
  await surface.tap();
  await expect(page.locator('.gcq-cursor-hourglass')).toBeHidden();
  await expect(page.locator('html')).not.toHaveClass(/gcq-cursor-overlay/);
  await expect(surface).not.toHaveCSS('cursor', 'none');
});

test('rapid state transitions retain visible artwork on every frame', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Continuous mouse transitions require a mouse');
  await page.mouse.move(420, 320);
  await expect(page.locator('.gcq-cursor-glyph.is-active')).toHaveCSS('opacity', '1');
  const samples = await page.evaluate(async () => {
    const surface = document.getElementById('cursor-test-surface');
    const visual = document.querySelector('.gcq-cursor-visual');
    const frames = [];
    for (const state of ['wait', 'pointer', 'text', 'progress', 'grab', 'not-allowed', 'wait', 'progress', 'pointer']) {
      surface.style.cursor = state;
      for (let i = 0; i < 4; i++) {
        await new Promise(requestAnimationFrame);
        frames.push({
          visible: !visual.hidden,
          nativeCursor: getComputedStyle(surface).cursor,
          opacity: [...visual.children].reduce((sum, glyph) => sum + Number(getComputedStyle(glyph).opacity), 0),
        });
      }
    }
    return frames;
  });
  for (const frame of samples) {
    expect(frame.visible).toBe(true);
    expect(frame.nativeCursor).toBe('none');
    // Incoming and outgoing artwork overlap; rapid changes must never leave a gap.
    expect(frame.opacity).toBeGreaterThanOrEqual(.95);
  }
});
