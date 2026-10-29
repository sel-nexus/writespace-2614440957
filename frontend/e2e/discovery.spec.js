/** Exercise public discovery through real links; fixtures fail on browser console/page errors. */
import { test, expect } from './fixtures.js';

const posts = [1, 4, 2, 3].map(day => ({
  id: `discovery-${day}`,
  title: `Discovery story ${day}`,
  content: `Browser-local preview ${day}. ` + 'Writing gives thoughts room. '.repeat(6),
  createdAt: `2025-01-0${day}T12:00:00Z`,
  authorId: 'discovery-writer',
  authorName: 'Mira',
}));

test('shows newest three real previews and redirects guest reading to login', async ({ page }) => {
  await page.addInitScript(records => {
    localStorage.removeItem('writespace_session');
    localStorage.setItem('writespace_posts', JSON.stringify(records));
  }, posts);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('article')).toHaveCount(3);
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText([
    'Discovery story 4', 'Discovery story 3', 'Discovery story 2',
  ]);
  await expect(page.getByText('Discovery story 1', { exact: true })).toHaveCount(0);
  const newest = latest.getByRole('article').first();
  await expect(newest.getByText(posts[1].content.slice(0, 120), { exact: true })).toBeVisible();
  await expect(newest.getByText('Jan 04, 2025', { exact: true })).toBeVisible();
  await expect(newest.getByText('Mira', { exact: true })).toBeVisible();
  const hero = page.getByRole('complementary', { name: 'Blog preview' });
  await expect(hero.getByRole('heading', { name: 'Discovery story 4' })).toBeVisible();
  await newest.getByRole('link', { name: /Discovery story 4/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('keeps the empty public page usable and offers registration through links', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('writespace_session');
    localStorage.removeItem('writespace_posts');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'WriteSpace', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText('Your thoughts. Your space. Beautifully simple.', { exact: true })).toBeVisible();
  for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText('No posts yet — check back soon!', { exact: true })).toBeVisible();
  const footer = page.getByRole('navigation', { name: 'Footer' });
  for (const name of ['Home', 'All Blogs', 'Login', 'Register']) {
    await expect(footer.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText(`© ${new Date().getFullYear()} WriteSpace`, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBeNull();
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('textbox', { name: 'Display Name' })).toBeVisible();
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await footer.getByRole('link', { name: 'All Blogs', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
