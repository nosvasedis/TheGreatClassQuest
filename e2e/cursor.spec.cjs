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
    await expect(surface).toHaveCSS('cursor', new RegExp(`, ${state}$`));
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
    expect(frame.visible || frame.nativeCursor !== 'none').toBe(true);
    // Incoming and outgoing artwork overlap; rapid changes must never leave a gap.
    if (frame.visible) expect(frame.opacity).toBeGreaterThanOrEqual(.95);
  }
});

test('stationary state changes use a short opaque reveal without scaling or ghosting', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Mouse cursor reveals require a mouse');
  await page.mouse.move(420, 320);
  await page.waitForTimeout(110); // Let the pointer become stationary.
  const samples = await page.evaluate(async () => {
    const surface = document.getElementById('cursor-test-surface');
    surface.style.cursor = 'text';
    const frames = [];
    const insets = value => {
      const parts = (value.match(/[\d.]+px/g) || []).map(parseFloat);
      return { right: parts[1] ?? parts[0] ?? 0, left: parts[3] ?? parts[1] ?? parts[0] ?? 0 };
    };
    for (let i = 0; i < 10; i++) {
      await new Promise(requestAnimationFrame);
      if (document.querySelector('.gcq-cursor-visual').hidden) continue;
      const next = document.querySelector('.gcq-cursor-glyph.is-active');
      const previous = document.querySelector('.gcq-cursor-glyph.is-leaving');
      if (!previous) continue;
      const incoming = getComputedStyle(next);
      const outgoing = getComputedStyle(previous);
      const rect = next.getBoundingClientRect();
      frames.push({
        opacity: [incoming.opacity, outgoing.opacity],
        transform: [incoming.transform, outgoing.transform],
        filter: [incoming.filter, outgoing.filter],
        boundary: insets(incoming.clipPath).left + insets(outgoing.clipPath).right,
        reveal: insets(incoming.clipPath).left,
        x: rect.left + 16, y: rect.top + 16,
      });
    }
    return frames;
  });
  expect(samples.some(frame => frame.reveal > 0 && frame.reveal < 48)).toBe(true);
  for (const frame of samples) {
    expect(frame.opacity).toEqual(['1', '1']);
    expect(frame.transform).toEqual(['none', 'none']);
    expect(frame.filter).toEqual(['none', 'none']);
    expect(frame.boundary).toBeCloseTo(48, 2);
    expect(frame.x).toBe(420);
    expect(frame.y).toBe(320);
  }
  await expect(page.locator('.gcq-cursor-visual')).toBeHidden();
  await expect(page.locator('#cursor-test-surface')).toHaveCSS('cursor', /, text$/);
});

test('steady pointer movement uses the native cursor without style lookups', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Native pointer movement requires a mouse');
  await expect(page.locator('#loading-screen')).toBeHidden();
  await page.mouse.move(100, 100);
  for (const state of ['default', 'wait']) {
    await page.locator('#cursor-test-surface').evaluate((element, cursor) => { element.style.cursor = cursor; }, state);
    if (state === 'default') await expect(page.locator('#cursor-test-surface')).toHaveCSS('cursor', /, pointer$/);
    else await expect(page.locator('.gcq-cursor-hourglass')).toBeVisible();
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
    if (state === 'default') {
      await expect(page.locator('.gcq-cursor-visual')).toBeHidden();
      await expect(page.locator('#cursor-test-surface')).not.toHaveCSS('cursor', 'none');
    } else {
      await expect(page.locator('.gcq-cursor-hourglass')).toBeVisible();
      const rect = await page.locator('.gcq-cursor-hourglass').boundingBox();
      expect(rect.x).toBe(179);
      expect(rect.y).toBe(141);
    }
  }
});

test('continuous movement across states never uses a scaled or translucent overlay', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Native cursor movement requires a mouse');
  await page.locator('#cursor-test-surface').evaluate(button => {
    const panel = document.createElement('div');
    panel.id = button.id;
    panel.style.cssText = button.style.cssText + ';display:grid;grid-template-columns:repeat(6,1fr)';
    for (const state of ['default', 'pointer', 'text', 'grab', 'wait', 'progress']) {
      const cell = document.createElement('div');
      cell.style.cursor = state;
      cell.textContent = state;
      panel.append(cell);
    }
    button.replaceWith(panel);
  });
  for (let i = 0; i < 24; i++) {
    const state = i % 6;
    const width = page.viewportSize().width;
    await page.mouse.move(width * (state + .5) / 6, 100 + i);
    const frame = await page.evaluate(() => {
      const target = document.querySelector('[data-gcq-cursor]');
      return {
        cursor: getComputedStyle(target).cursor,
        overlay: !document.querySelector('.gcq-cursor-visual').hidden,
      };
    });
    expect(frame.cursor).not.toBe('none');
    expect(frame.overlay).toBe(false);
  }
});

test('idle artwork is opaque and native images match regular and high-DPI displays', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Mouse artwork is checked at desktop DPI scales');
  const check = async (candidate, expectedDpr) => {
    await candidate.locator('#cursor-test-surface').evaluate(element => { element.style.cursor = 'wait'; });
    await candidate.mouse.move(420.25, 320.75);
    await expect(candidate.locator('.gcq-cursor-hourglass')).toBeVisible();
    const frame = await candidate.evaluate(() => {
      const visual = document.querySelector('.gcq-cursor-visual');
      const glyph = document.querySelector('.gcq-cursor-hourglass');
      const style = getComputedStyle(glyph);
      const native = document.documentElement.style.getPropertyValue('--gcq-cursor-wait');
      const svg = decodeURIComponent(native.match(/data:image\/svg\+xml,([^"]*)/)[1]);
      return {
        dpr: devicePixelRatio,
        x: parseFloat(visual.style.left) * devicePixelRatio,
        y: parseFloat(visual.style.top) * devicePixelRatio,
        transform: style.transform, filter: style.filter, opacity: style.opacity,
        promote: getComputedStyle(visual).willChange,
        native, width: Number(svg.match(/width="(\d+)"/)[1]),
      };
    });
    expect(frame.dpr).toBe(expectedDpr);
    expect(frame.x).toBe(Math.round(frame.x));
    expect(frame.y).toBe(Math.round(frame.y));
    expect(frame.transform).toBe('none');
    expect(frame.filter).toBe('none');
    expect(frame.opacity).toBe('1');
    expect(frame.promote).toBe('auto');
    expect(frame.width).toBe(32 * expectedDpr);
    if (expectedDpr > 1) expect(frame.native).toMatch(/^image-set\(/);
  };
  await check(page, 1);
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  try {
    const retina = await context.newPage();
    await retina.route(/cloudfunctions\.net\/getSecretaryBootstrapStatus$/, route =>
      route.fulfill({ json: { data: { state: 'active', requiresToken: false } } }));
    await retina.goto(page.url(), { waitUntil: 'networkidle' });
    await expect(retina.locator('#login-form')).toBeVisible();
    await retina.evaluate(() => {
      const surface = document.createElement('div');
      surface.id = 'cursor-test-surface';
      surface.style.cssText = 'position:fixed;inset:0;z-index:2000000000;cursor:wait';
      document.body.append(surface);
    });
    await check(retina, 2);
    await retina.setViewportSize({ width: 1000, height: 700 });
    await expect(retina.locator('.gcq-cursor-visual')).toBeHidden();
    await check(retina, 2);
  } finally {
    await context.close();
  }
});
