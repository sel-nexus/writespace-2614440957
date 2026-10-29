/** Capture review evidence through real journeys with inherited console/page-error checks. */
import { test, expect } from './fixtures.js';

/** Reveal responsive navigation only when necessary. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
}

/** Attach text-readable evidence and unique screenshots, without aesthetic pass/fail thresholds. */
async function capture(page, testInfo, state) {
  await page.evaluate(() => document.fonts.ready);
  const name = `${testInfo.project.name}-${state}`;
  const accessibility = await page.accessibility.snapshot();
  const styles = await page.evaluate(() => {
    const selectors = ['body', 'nav[aria-label="Main navigation"]', '#navigation-links', 'main',
      'h1', 'h2', 'section', 'article', 'aside', 'form', 'input', 'textarea', 'select',
      'button', 'a', '[role="alert"]', '[role="status"]', 'table', 'footer'];
    return {
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      documentWidth: document.documentElement.scrollWidth,
      elements: selectors.flatMap(selector => Array.from(document.querySelectorAll(selector), element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          selector, tag: element.tagName, text: element.textContent.trim(),
          accessibleLabel: element.getAttribute('aria-label'),
          fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
          lineHeight: style.lineHeight, color: style.color, backgroundColor: style.backgroundColor,
          display: style.display, width: style.width, maxWidth: style.maxWidth,
          padding: style.padding, gap: style.gap, border: style.border, borderRadius: style.borderRadius,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        };
      })),
    };
  });
  await testInfo.attach(`${name}-evidence`, {
    body: Buffer.from(JSON.stringify({ url: page.url(), accessibility, styles }, null, 2)),
    contentType: 'application/json',
  });
  await testInfo.attach(`${name}-html`, { body: Buffer.from(await page.content()), contentType: 'text/html' });
  const screenshot = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach(`${name}-screenshot`, { path: screenshot, contentType: 'image/png' });
}

test('preflight public empty, responsive navigation and login validation evidence', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByText('No posts yet — check back soon!', { exact: true })).toBeVisible();
  await capture(page, testInfo, 'public-empty');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  const toggle = navigation.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) {
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(navigation.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    await expect(navigation.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Get Started', exact: true })).toBeVisible();
    await capture(page, testInfo, 'public-menu-open');
  }
  await navigation.getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('Username is required.', { exact: true })).toBeVisible();
  await expect(page.getByText('Password is required.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await capture(page, testInfo, 'login-validation');
});

test('preflight populated public preview and guest reader guard evidence', async ({ page }, testInfo) => {
  const posts = [1, 2, 3].map(day => ({
    id: `preflight-${day}`, title: `Room for a story ${day}`,
    content: 'A quiet space to write.\n\n' + 'Thoughts become stories when we give them room. '.repeat(5),
    authorId: 'historical', authorName: 'Mira', authorRole: 'user', createdAt: `2025-01-0${day}T12:00:00Z`,
  }));
  await page.addInitScript(records => localStorage.setItem('writespace_posts', JSON.stringify(records)), posts);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('article')).toHaveCount(3);
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText([
    'Room for a story 3', 'Room for a story 2', 'Room for a story 1',
  ]);
  await capture(page, testInfo, 'public-populated');
  await latest.getByRole('article').first().getByRole('link', { name: /Room for a story 3/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
  await capture(page, testInfo, 'guest-reader-login');
});

test('preflight admin writing, reader and responsive users evidence through UI', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await capture(page, testInfo, 'dashboard-empty');
  await page.getByRole('link', { name: 'Write New Post', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  await expect(page.getByRole('heading', { name: 'Write a Post', exact: true })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('A space for words');
  const content = 'A first paragraph.\n\n  A second paragraph with room to breathe.';
  await page.getByLabel('Content', { exact: true }).fill(content);
  await capture(page, testInfo, 'writing-filled');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/[0-9a-f-]{36}$/i);
  await expect(page.getByRole('heading', { name: 'A space for words', exact: true })).toBeVisible();
  expect(await page.locator('article p.whitespace-pre-wrap').textContent()).toBe(content);
  await capture(page, testInfo, 'reader');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A space for words', exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await openNavigation(page);
  await navigation.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole('heading', { name: 'All accounts (1)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete admin', exact: true })).toBeDisabled();
  await capture(page, testInfo, 'users-default');
  await page.getByLabel('Display Name', { exact: true }).fill('Preflight Writer');
  await page.getByLabel('Username', { exact: true }).fill('preflight-writer');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Role', { exact: true }).selectOption('user');
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Account preflight-writer created.');
  await expect(page.getByRole('heading', { name: 'All accounts (2)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete preflight-writer', exact: true })).toBeVisible();
  await capture(page, testInfo, 'users-populated');
  await openNavigation(page);
  await navigation.getByRole('button', { name: /Account options/ }).click();
  await expect(navigation.getByRole('button', { name: 'Logout', exact: true })).toBeVisible();
  await capture(page, testInfo, 'users-account-menu-open');
});
