/** Verify click-driven identity journeys with the shared console-error capturing fixture. */
import { test, expect } from './fixtures.js';

/** Open mobile navigation when its trigger is visible. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
}

/** Clear the session via the actual account disclosure and logout button. */
async function logout(page) {
  await openNavigation(page);
  await page.getByRole('button', { name: /Account options/ }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
}

test('guest guard, invalid login, default admin persistence and desktop/mobile logout', async ({ page }) => {
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Demo safety notice')).toContainText('never use real passwords');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('Username is required.', { exact: true })).toBeVisible();
  await expect(page.getByText('Password is required.', { exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  await page.reload();
  await openNavigation(page);
  await expect(page.getByRole('img', { name: 'Admin avatar' })).toContainText('👑');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await openNavigation(page);
  const adminHome = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Go to Dashboard' });
  await expect(adminHome).toHaveAttribute('href', '/admin');
  await adminHome.click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await openNavigation(page);
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Users', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole('button', { name: 'Create User', exact: true })).toBeVisible();
  await expect(page.getByLabel('Display Name', { exact: true })).toBeVisible();
  await logout(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openNavigation(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await logout(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openNavigation(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await logout(page);
});

test('registration validation, writer persistence, duplicate rejection and exact-password login', async ({ page }) => {
  await page.goto('/');
  await openNavigation(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  for (const name of ['Display Name', 'Username', 'Password', 'Confirm Password']) {
    await expect(page.getByLabel(name, { exact: true })).toHaveAttribute('aria-invalid', 'true');
  }
  await page.getByLabel('Display Name').fill(' Demo Writer ');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill(' demo ');
  await page.getByLabel('Confirm Password').fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('Passwords must match.', { exact: true })).toBeVisible();
  await page.getByLabel('Confirm Password').fill(' demo ');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('Username is already taken.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  await page.getByLabel('Username', { exact: true }).fill(' demo-writer ');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByText('No blogs yet. Be the first to write one!', { exact: true })).toBeVisible();
  const accounts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(accounts).toHaveLength(1);
  expect(accounts[0]).toMatchObject({ displayName: 'Demo Writer', username: 'demo-writer', password: ' demo ', role: 'user' });
  expect(accounts[0].id).toMatch(/^[0-9a-f-]{36}$/i);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(session).toEqual({ userId: accounts[0].id, displayName: 'Demo Writer', username: 'demo-writer', role: 'user' });
  await page.reload();
  await openNavigation(page);
  await expect(page.getByRole('img', { name: 'User avatar' })).toContainText('📖');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await openNavigation(page);
  const writerHome = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Go to Dashboard' });
  await expect(writerHome).toHaveAttribute('href', '/blogs');
  await writerHome.click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByText('No blogs yet. Be the first to write one!', { exact: true })).toBeVisible();
  await openNavigation(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'All Blogs', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await logout(page);
  await openNavigation(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await page.getByLabel('Display Name').fill('Duplicate');
  await page.getByLabel('Username', { exact: true }).fill('demo-writer');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm Password').fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('Username is already taken.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(accounts);
  await page.getByRole('region', { name: 'Create your space' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('demo-writer');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  await page.getByLabel('Password', { exact: true }).fill(' demo ');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
  await logout(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(accounts);
});
