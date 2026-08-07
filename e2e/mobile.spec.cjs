const { test, expect } = require('@playwright/test');

test.describe('mobile experience layer', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/cloudfunctions\.net\/getSecretaryBootstrapStatus$/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { state: 'active', requiresToken: false } }) });
    });
  });

  test('swaps the shell according to viewport and keeps tab wiring valid', async ({ page }, testInfo) => {
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    const isMobileProject = testInfo.project.name === 'mobile';

    const state = await page.evaluate(() => ({
      mobileActive: document.body.classList.contains('gcq-mobile'),
      teacherDockDisplay: getComputedStyle(document.getElementById('m-teacher-dock')).display,
      desktopNavDisplay: getComputedStyle(document.getElementById('bottom-nav-bar')).display,
      teacherHeaderDisplay: getComputedStyle(document.getElementById('m-teacher-header')).display
    }));

    expect(state.mobileActive).toBe(isMobileProject);
    expect(state.teacherDockDisplay).toBe(isMobileProject ? 'grid' : 'none');
    expect(state.desktopNavDisplay).toBe(isMobileProject ? 'none' : 'grid');
    expect(state.teacherHeaderDisplay).toBe(isMobileProject ? 'flex' : 'none');

    const shellsPresent = await page.evaluate(() => ({
      parentHeader: !!document.getElementById('m-parent-header'),
      parentDock: !!document.getElementById('m-parent-dock'),
      secretaryHeader: !!document.getElementById('m-secretary-header'),
      secretaryDock: !!document.getElementById('m-secretary-dock'),
      moreSheet: !!document.getElementById('m-more-sheet'),
      classPicker: !!document.getElementById('m-class-picker-sheet'),
      optionsSubtabDropdown: !!document.getElementById('m-options-subtab-dropdown'),
      optionsSubtabSheet: !!document.getElementById('m-options-subtab-sheet'),
      mobileHome: !!document.getElementById('home-dashboard-mobile'),
      clock: !!document.getElementById('m-current-time'),
      headerGlow: !!document.querySelector('#m-teacher-header .m-header__glow'),
      headerLogo: !!document.querySelector('#m-teacher-header .m-header__logo')
    }));
    expect(shellsPresent).toEqual({
      parentHeader: true,
      parentDock: true,
      secretaryHeader: true,
      secretaryDock: true,
      moreSheet: true,
      classPicker: true,
      optionsSubtabDropdown: true,
      optionsSubtabSheet: true,
      mobileHome: true,
      clock: true,
      headerGlow: true,
      headerLogo: true
    });

    const tabWiringValid = await page.evaluate(() => {
      const ids = new Set([...document.querySelectorAll('.app-tab')].map((el) => el.id));
      const buttons = document.querySelectorAll('#m-teacher-dock .nav-button[data-tab], #m-more-sheet .nav-button[data-tab]');
      return [...buttons].every((btn) => ids.has(btn.dataset.tab));
    });
    expect(tabWiringValid).toBe(true);

    const roleDockWiringValid = await page.evaluate(() => {
      const parentKeys = [...document.querySelectorAll('#m-parent-dock .nav-button[data-parent-tab]')].map((b) => b.dataset.parentTab);
      const secretaryKeys = [...document.querySelectorAll('#m-secretary-dock .nav-button[data-secretary-tab]')].map((b) => b.dataset.secretaryTab);
      const parentSections = [...document.querySelectorAll('[data-parent-section]')].map((el) => el.dataset.parentSection);
      const secretarySections = [...document.querySelectorAll('[data-secretary-section]')].map((el) => el.dataset.secretarySection);
      return parentKeys.every((k) => parentSections.includes(k)) && secretaryKeys.every((k) => secretarySections.includes(k));
    });
    expect(roleDockWiringValid).toBe(true);

    expect(consoleErrors).toEqual([]);
  });

  test('more sheet and class picker sheets open and close cleanly', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile shell interactions only exist in the mobile project');
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-screen').classList.remove('hidden');
    });

    const dockVisible = await page.locator('#m-teacher-dock').isVisible();
    expect(dockVisible).toBe(true);

    await page.locator('#m-more-btn').click();
    await expect(page.locator('#m-more-sheet')).toHaveClass(/m-sheet--open/);
    await expect(page.locator('#m-more-sheet .m-sheet__panel')).toBeVisible();
    await expect(page.locator('#m-more-sheet .m-more-item')).toHaveCount(9);
    await expect(page.locator('#m-more-sheet .m-sheet__title')).toHaveText('Jump to…');
    await page.keyboard.press('Escape');
    await expect(page.locator('#m-more-sheet')).not.toHaveClass(/m-sheet--open/);
    await expect(page.locator('#m-more-sheet')).not.toHaveClass(/m-sheet--closing/, { timeout: 2000 });
    await expect(page.locator('#m-more-sheet .m-sheet__panel')).toBeHidden();

    await page.locator('#m-class-selector-btn').click();
    await expect(page.locator('#m-class-picker-sheet')).toHaveClass(/m-sheet--open/);
    await expect(page.locator('#m-class-picker-sheet .m-sheet__panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#m-class-picker-sheet')).not.toHaveClass(/m-sheet--open/);
    await expect(page.locator('#m-class-picker-sheet')).not.toHaveClass(/m-sheet--closing/, { timeout: 2000 });
    await expect(page.locator('#m-class-picker-sheet .m-sheet__panel')).toBeHidden();

    const clockRunning = await page.evaluate(() => {
      const el = document.getElementById('m-current-time');
      return Boolean(el && /^\d{2}:\d{2}$/.test(el.textContent));
    });
    expect(clockRunning).toBe(true);
  });

  test('home has no duplicate class pill, displays daily quote chip, and follow schedule marks header pill', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile shell interactions only exist in the mobile project');
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-screen').classList.remove('hidden');
      document.dispatchEvent(new CustomEvent('gcq-mobile-mode', { detail: { active: true } }));
      document.dispatchEvent(new Event('home:rendered'));
    });

    await page.waitForTimeout(120);
    await expect(page.locator('.m-home-hero__class-pill')).toHaveCount(0);
    await expect(page.locator('#m-class-selector-btn')).toBeVisible();
    await expect(page.locator('#m-daily-quote-card')).toBeVisible();

    await page.locator('#m-class-selector-btn').click();
    await expect(page.locator('#m-class-picker-sheet')).toHaveClass(/m-sheet--open/);
    await page.locator('#m-class-follow-schedule').click();
    await expect(page.locator('#m-class-picker-sheet')).not.toHaveClass(/m-sheet--open/);
    await expect(page.locator('#m-class-selector-btn')).toHaveClass(/m-class-pill--follow/);
  });

  test('SW update mirror proxies clicks to the desktop mount', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile shell interactions only exist in the mobile project');
    await page.goto('/', { waitUntil: 'networkidle' });

    const clicked = await page.evaluate(async () => {
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-screen').classList.remove('hidden');

      const source = document.getElementById('gcq-update-ready-mount');
      const target = document.getElementById('m-gcq-update-ready-mount');
      if (!source || !target) return { ok: false, reason: 'missing mounts' };

      let fired = false;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'gcq-update-ready-btn';
      btn.textContent = 'Update ready';
      btn.addEventListener('click', () => { fired = true; });
      source.appendChild(btn);
      source.classList.remove('hidden');

      await new Promise((r) => setTimeout(r, 80));
      const mirrored = target.querySelector('button');
      if (!mirrored) return { ok: false, reason: 'no mirrored button', hasUpdate: target.classList.contains('has-update') };
      mirrored.click();
      return { ok: fired, reason: fired ? 'ok' : 'proxy miss', hasUpdate: target.classList.contains('has-update') };
    });

    expect(clicked.ok).toBe(true);
    expect(clicked.hasUpdate).toBe(true);
  });

  test('FAB clusters keep left/right sides above the dock when revealed', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile shell interactions only exist in the mobile project');
    await page.goto('/', { waitUntil: 'networkidle' });

    const layout = await page.evaluate(() => {
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-screen').classList.remove('hidden');

      const left = document.createElement('div');
      left.className = 'tab-fab-cluster tab-fab-cluster--left revealed';
      left.id = 'm-test-fab-left';
      document.body.appendChild(left);

      const right = document.createElement('div');
      right.className = 'tab-fab-cluster tab-fab-cluster--right revealed';
      right.id = 'm-test-fab-right';
      document.body.appendChild(right);

      const dock = document.getElementById('m-teacher-dock');
      const leftStyle = getComputedStyle(left);
      const rightStyle = getComputedStyle(right);
      const dockRect = dock.getBoundingClientRect();

      return {
        leftLeft: leftStyle.left,
        rightRight: rightStyle.right,
        leftBottom: Number.parseFloat(leftStyle.bottom),
        dockTopFromBottom: window.innerHeight - dockRect.top,
        opacityLeft: leftStyle.opacity,
        opacityRight: rightStyle.opacity
      };
    });

    expect(layout.opacityLeft).toBe('1');
    expect(layout.opacityRight).toBe('1');
    expect(layout.leftLeft).not.toBe('auto');
    expect(layout.rightRight).not.toBe('auto');
    expect(layout.leftBottom).toBeGreaterThan(40);
    // CSS bottom is distance from viewport bottom — FAB must sit above the dock top
    expect(layout.leftBottom).toBeGreaterThanOrEqual(layout.dockTopFromBottom - 4);
  });

  test('settings subtab dropdown sheet opens and switches sections cleanly', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile shell interactions only exist in the mobile project');
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-screen').classList.remove('hidden');
    });

    await page.locator('#m-header-settings-btn').click();
    await expect(page.locator('#m-options-subtab-trigger')).toBeVisible();

    await page.locator('#m-options-subtab-trigger').click();
    await expect(page.locator('#m-options-subtab-sheet')).toHaveClass(/m-sheet--open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#m-options-subtab-sheet')).not.toHaveClass(/m-sheet--open/);
  });
});
