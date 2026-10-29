/** Exercise dashboard journeys through real navigation; fixtures fail on console and page errors. */
import { test, expect } from './fixtures.js';

/** Open responsive navigation only on viewports that need its disclosure. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
}

/** Return through the logo and existing public dashboard link rather than teleporting. */
async function dashboard(page) {
  await page.getByRole('navigation').getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await openNavigation(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Sign in as the built-in admin using the public login link and real form. */
async function loginAdmin(page) {
  await page.getByRole('link', { name: 'Login to WriteSpace' }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Verify exact-label statistics, distinguishing the two account populations. */
async function counts(page, posts, accounts, admins, writers) {
  for (const [label, value] of [['Total Posts', posts], ['Total Users', accounts], ['Total Admins', admins], ['Total users', writers]]) {
    await expect(page.getByRole('region', { name: label, exact: true }).getByText(String(value), { exact: true })).toBeVisible();
  }
}

/** Create an account through the Users form with a demo-only password. */
async function createAccount(page, name, role) {
  await page.getByLabel('Display Name').fill(name);
  await page.getByLabel('Username', { exact: true }).fill(name.toLowerCase());
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Role', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(`Account ${name.toLowerCase()} created.`);
}

/** Read persisted posts only for assertions, never substitute a service. */
async function storedPosts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts') ?? '[]'));
}

test('admin creates accounts and posts via quick links, returns through Home, edits, cancels and confirms recent deletion', async ({ page }) => {
  await page.goto('/');
  await loginAdmin(page);
  await counts(page, 0, 1, 1, 0);
  await expect(page.getByText('No posts yet. Use Write New Post to publish your first post.')).toBeVisible();
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(page).toHaveURL(/\/users$/);
  await createAccount(page, 'Writer', 'user');
  await createAccount(page, 'Manager', 'admin');
  const accounts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(accounts.map(account => account.role)).toEqual(['user', 'admin']);
  await dashboard(page);
  await counts(page, 0, 3, 2, 1);
  for (const title of ['First publication', 'Second publication']) {
    await page.getByRole('link', { name: 'Write New Post' }).click();
    await expect(page).toHaveURL(/\/write$/);
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Content', { exact: true }).fill(`Content for ${title}`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await dashboard(page);
  }
  await counts(page, 2, 3, 2, 1);
  const original = await storedPosts(page);
  expect(original).toHaveLength(2);
  expect(original.every(post => post.authorId === 'admin')).toBe(true);
  const recent = page.getByRole('region', { name: 'Recent Posts' });
  await expect(recent.getByRole('heading', { level: 3 })).toHaveText(['Second publication', 'First publication']);
  await page.getByRole('link', { name: 'Edit Second publication' }).click();
  await expect(page).toHaveURL(new RegExp(`/edit/${original[1].id}$`));
  await expect(page.getByLabel('Title')).toHaveValue('Second publication');
  await page.getByLabel('Title').fill('Revised publication');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await dashboard(page);
  const updated = await storedPosts(page);
  expect(updated[1]).toEqual({ ...original[1], title: 'Revised publication' });
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Revised publication' }).click();
  expect(await storedPosts(page)).toEqual(updated);
  await counts(page, 2, 3, 2, 1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete Revised publication' }).click();
  await expect(page.getByRole('status')).toHaveText('Post "Revised publication" deleted.');
  expect(await storedPosts(page)).toEqual([original[0]]);
  await counts(page, 1, 3, 2, 1);
  await expect(recent.getByRole('heading', { level: 3 })).toHaveText(['First publication']);
  await page.reload();
  await counts(page, 1, 3, 2, 1);
  expect(await storedPosts(page)).toEqual([original[0]]);
});

test('fixture publications are capped at newest five and confirmed deletion brings the sixth into view', async ({ page }) => {
  const posts = Array.from({ length: 7 }, (_, index) => ({ id: `seed-${index}`, title: `Seed ${index}`,
    content: 'Fixture publication', authorId: 'historical', authorName: 'Historical writer', createdAt: `2025-01-0${index + 1}` }));
  await page.addInitScript(collection => localStorage.setItem('writespace_posts', JSON.stringify(collection)), posts);
  await page.goto('/');
  await loginAdmin(page);
  await dashboard(page);
  await counts(page, 7, 1, 1, 0);
  const recent = page.getByRole('region', { name: 'Recent Posts' });
  await expect(recent.getByRole('heading', { level: 3 })).toHaveText(['Seed 6', 'Seed 5', 'Seed 4', 'Seed 3', 'Seed 2']);
  await expect(recent.getByText('Historical writer · Jan 07, 2025')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await recent.getByRole('button', { name: 'Delete Seed 6', exact: true }).click();
  await counts(page, 6, 1, 1, 0);
  expect(await storedPosts(page)).toEqual(posts.slice(0, 6));
  await expect(recent.getByRole('heading', { level: 3 })).toHaveText(['Seed 5', 'Seed 4', 'Seed 3', 'Seed 2', 'Seed 1']);
});

test('initial guest /admin request is guarded and the login form leads to the default-only dashboard', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toHaveCount(0);
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await counts(page, 0, 1, 1, 0);
});

test('initial non-admin /admin request redirects without overview or delete controls', async ({ page }) => {
  await page.addInitScript(() => {
    const account = { id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo-only', role: 'user', createdAt: '2025-01-01' };
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    localStorage.setItem('writespace_session', JSON.stringify({ userId: account.id, username: account.username,
      displayName: account.displayName, role: account.role }));
  });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('region', { name: 'Total Users', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
  expect(await storedPosts(page)).toEqual([]);
});
