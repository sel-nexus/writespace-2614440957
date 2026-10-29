/** Exercise public discovery through real links; fixtures fail on browser console/page errors. */
import { test, expect } from './fixtures.js';

/** Reveal the real navbar links on mobile before following them. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
}

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
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('hero preview sends guests to login and Footer Home retains the public landing page', async ({ page }) => {
  await page.addInitScript(records => {
    localStorage.removeItem('writespace_session');
    localStorage.setItem('writespace_posts', JSON.stringify(records));
  }, posts);
  await page.goto('/');
  const hero = page.getByRole('complementary', { name: 'Blog preview' });
  await hero.getByRole('link', { name: /Discovery story 4/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('navigation', { name: 'Footer' }).getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'WriteSpace', exact: true, level: 1 })).toBeVisible();
  await expect(hero.getByRole('heading', { name: 'Discovery story 4', exact: true })).toBeVisible();
});

for (const preview of [
  { role: 'complementary', name: 'Blog preview' },
  { role: 'region', name: 'Latest from the Blog' },
]) {
  test(`${preview.name} opens the full post for an authenticated reader`, async ({ page }) => {
    await page.addInitScript(records => {
      const account = { id: 'discovery-reader', username: 'discovery-reader', displayName: 'Reader',
        password: 'demo', role: 'user', createdAt: '2025-01-01' };
      localStorage.setItem('writespace_users', JSON.stringify([account]));
      localStorage.setItem('writespace_session', JSON.stringify({ userId: account.id, username: account.username,
        displayName: account.displayName, role: account.role }));
      localStorage.setItem('writespace_posts', JSON.stringify(records));
    }, posts);
    await page.goto('/');
    await page.getByRole(preview.role, { name: preview.name }).getByRole('link', { name: /Discovery story 4/ }).click();
    await expect(page).toHaveURL(/\/blog\/discovery-4$/);
    const reader = page.getByRole('main').getByRole('article');
    await expect(reader.getByRole('heading', { name: posts[1].title, exact: true, level: 1 })).toBeVisible();
    await expect(reader.locator('p.whitespace-pre-wrap')).toHaveText(posts[1].content);
    await expect(reader.getByText('Mira', { exact: true })).toBeVisible();
    await expect(reader.getByText('Jan 04, 2025', { exact: true })).toBeVisible();
    await expect(reader.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
    await expect(reader.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  });
}

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
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await footer.getByRole('link', { name: 'All Blogs', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('navbar Get Started and footer Login and Register lead to their real forms', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  const footer = page.getByRole('navigation', { name: 'Footer' });
  await openNavigation(page);
  await navigation.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Create your space', exact: true })).toBeVisible();
  for (const name of ['Display Name', 'Username', 'Password', 'Confirm Password']) {
    await expect(page.getByLabel(name, { exact: true })).toBeVisible();
  }
  await navigation.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await footer.getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await navigation.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await footer.getByRole('link', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Create your space', exact: true })).toBeVisible();
  for (const name of ['Display Name', 'Username', 'Password', 'Confirm Password']) {
    await expect(page.getByLabel(name, { exact: true })).toBeVisible();
  }
});
