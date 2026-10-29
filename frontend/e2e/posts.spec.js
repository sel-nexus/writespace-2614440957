/** Exercise real local publication journeys with console/page errors captured by fixtures. */
import { test, expect } from './fixtures.js';

/** Open the existing mobile disclosure only when necessary. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
}

/** Navigate using the authenticated Write control on either viewport. */
async function write(page) {
  await openNavigation(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
}

/** Log out through the account disclosure, leaving posts intact. */
async function logout(page) {
  await openNavigation(page);
  await page.getByRole('button', { name: /Account options/ }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
}

/** Sign in through the real login form without programmatic route changes. */
async function login(page, username, password) {
  await openNavigation(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

/** Read persisted publications for assertions, never substitute a mocked service. */
async function storedPosts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts') ?? '[]'));
}

test('register, create, read literal text, reload, edit, cancel and confirmed delete persist correctly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await page.getByLabel('Display Name').fill('Post Writer');
  await page.getByLabel('Username', { exact: true }).fill('post-writer');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password').fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await write(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Title is required.')).toBeVisible();
  await expect(page.getByText('Content is required.')).toBeVisible();
  expect(await storedPosts(page)).toEqual([]);
  const content = '<script>alert(1)</script>\n\n  Second line';
  await page.getByLabel('Title', { exact: true }).fill('My first post');
  await page.getByLabel('Content', { exact: true }).fill(content);
  await expect(page.getByText(`${content.length} characters`)).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/[0-9a-f-]{36}$/i);
  await expect(page.getByRole('heading', { name: 'My first post' })).toBeVisible();
  expect(await page.locator('article p.whitespace-pre-wrap').textContent()).toBe(content);
  const [original] = await storedPosts(page);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(original).toMatchObject({ title: 'My first post', content, authorId: session.userId, authorName: 'Post Writer', authorRole: 'user' });
  expect(original.id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(Number.isFinite(Date.parse(original.createdAt))).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'My first post' })).toBeVisible();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue(original.title);
  await expect(page.getByLabel('Content')).toHaveValue(content);
  await page.getByLabel('Title').fill('Unsaved edit');
  await page.getByRole('link', { name: 'Cancel' }).click();
  expect(await storedPosts(page)).toEqual([original]);
  await expect(page.getByRole('heading', { name: original.title })).toBeVisible();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title').fill('Revised post');
  await page.getByLabel('Content').fill('Revised\n\n  text');
  await page.getByRole('button', { name: 'Save' }).click();
  const updated = { ...original, title: 'Revised post', content: 'Revised\n\n  text' };
  expect(await storedPosts(page)).toEqual([updated]);
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await page.getByRole('link', { name: /Revised post/ }).first().click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete' }).click();
  expect(await storedPosts(page)).toEqual([updated]);
  await expect(page.getByRole('heading', { name: 'Revised post' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await storedPosts(page)).toEqual([]);
  await page.reload();
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await write(page);
  await page.getByLabel('Title').fill('Canceled creation');
  await page.getByLabel('Content').fill('Do not publish');
  await page.getByRole('link', { name: 'Cancel' }).click();
  expect(await storedPosts(page)).toEqual([]);
});

test('another author cannot manage a post, while admin can moderate without rewriting attribution', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await page.getByLabel('Display Name').fill('Original Author');
  await page.getByLabel('Username', { exact: true }).fill('original-author');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password').fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await write(page);
  await page.getByLabel('Title').fill('Owned publication');
  await page.getByLabel('Content').fill('Original content');
  await page.getByRole('button', { name: 'Save' }).click();
  const [original] = await storedPosts(page);
  await logout(page);
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await page.getByLabel('Display Name').fill('Other Author');
  await page.getByLabel('Username', { exact: true }).fill('other-author');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password').fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Edit Owned publication' })).toHaveCount(0);
  await page.getByRole('link', { name: /Owned publication/ }).click();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  expect(await storedPosts(page)).toEqual([original]);
  await logout(page);
  await login(page, 'admin', 'admin');
  await openNavigation(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'All Blogs' }).click();
  await page.getByRole('link', { name: 'Edit Owned publication' }).click();
  await page.getByLabel('Title').fill('Admin moderated');
  await page.getByRole('button', { name: 'Save' }).click();
  const moderated = { ...original, title: 'Admin moderated' };
  expect(await storedPosts(page)).toEqual([moderated]);
  await expect(page.getByRole('heading', { name: 'Admin moderated' })).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete' }).click();
  expect(await storedPosts(page)).toEqual([moderated]);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  expect(await storedPosts(page)).toEqual([]);
});

const seededAccount = { id: 'reader', username: 'reader', displayName: 'Reader', password: 'demo', role: 'user', createdAt: '2025-01-01' };
const seededPost = { id: 'foreign', title: 'Another writer', content: 'Read only', authorId: 'removed', authorName: 'Historical author',
  createdAt: '2025-01-01', authorRole: 'user' };

test('All Blogs main Write link opens an empty editor without publishing', async ({ page }) => {
  await page.addInitScript(({ account, post }) => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    localStorage.setItem('writespace_session', JSON.stringify({ userId: account.id, username: account.username,
      displayName: account.displayName, role: account.role }));
    localStorage.setItem('writespace_posts', JSON.stringify([post]));
  }, { account: seededAccount, post: seededPost });
  await page.goto('/blogs');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'All Blogs', exact: true, level: 1 })).toBeVisible();
  await expect(main.getByRole('heading', { name: seededPost.title, exact: true })).toBeVisible();
  await main.getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  await expect(main.getByLabel('Title', { exact: true })).toBeVisible();
  await expect(main.getByLabel('Title', { exact: true })).toHaveValue('');
  await expect(main.getByLabel('Content', { exact: true })).toBeVisible();
  await expect(main.getByLabel('Content', { exact: true })).toHaveValue('');
  await expect(main.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  expect(await storedPosts(page)).toEqual([seededPost]);
});

test('direct unauthorized edit redirects to blogs without a write', async ({ page }) => {
  await page.addInitScript(({ account, post }) => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    localStorage.setItem('writespace_session', JSON.stringify({ userId: account.id, username: account.username,
      displayName: account.displayName, role: account.role }));
    localStorage.setItem('writespace_posts', JSON.stringify([post]));
  }, { account: seededAccount, post: seededPost });
  await page.goto('/edit/foreign');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  expect(await storedPosts(page)).toEqual([seededPost]);
  await page.getByRole('link', { name: /Another writer/ }).click();
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
});

test('missing post has a working back link and empty writing invitation', async ({ page }) => {
  await page.addInitScript(account => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    localStorage.setItem('writespace_session', JSON.stringify({ userId: account.id, username: account.username,
      displayName: account.displayName, role: account.role }));
  }, seededAccount);
  await page.goto('/blog/missing');
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  expect(await storedPosts(page)).toEqual([]);
});
