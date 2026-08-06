const { test, expect } = require('@playwright/test');
const axe = require('axe-core');
const fs = require('node:fs');
const path = require('node:path');

const screenshotDir = path.resolve(__dirname, '..', 'artifacts', 'screenshots');

test.beforeAll(() => {
  fs.mkdirSync(screenshotDir, { recursive: true });
});

test('authentication shell is fast, clean, accessible, and signup remains available', async ({ page }, testInfo) => {
  const consoleErrors = [];
  const warnings = [];
  const requests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('request', (request) => requests.push(request.url()));

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#signup-form')).toBeHidden();
  expect(requests.length, requests.join('\n')).toBeLessThanOrEqual(30);
  expect(consoleErrors).toEqual([]);
  expect(warnings.filter((text) => /tailwind.*cdn|production.*tailwind/i.test(text))).toEqual([]);

  await page.addScriptTag({ content: axe.source });
  const accessibility = await page.evaluate(async () => axe.run(document, {
    resultTypes: ['violations'],
  }));
  const serious = accessibility.violations.filter((item) => ['serious', 'critical'].includes(item.impact));
  expect(serious, serious.map((item) => `${item.id}: ${item.help}`).join('\n')).toEqual([]);

  await page.locator('#toggle-auth-mode').click();
  await expect(page.locator('#signup-form')).toBeVisible();
  await expect(page.locator('#signup-name')).toBeVisible();
  await expect(page.locator('#signup-email')).toBeVisible();
  await expect(page.locator('#signup-password')).toBeVisible();

  const suffix = testInfo.project.name === 'mobile' ? 'mobile' : 'desktop';
  await page.screenshot({ path: path.join(screenshotDir, `login-${suffix}.png`), fullPage: true });
});
