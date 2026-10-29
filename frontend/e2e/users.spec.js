/** Exercise real local account journeys; the shared fixture fails on browser console errors. */
import { test, expect } from './fixtures.js';

/** Open the mobile disclosure when the viewport requires it. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
}

/** Follow the actual administrator Users navigation link. */
async function manageUsers(page) {
  await openNavigation(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
}

/** Log in through the public link and real form. */
async function login(page, username, password) {
  await page.getByRole('link', { name: 'Login to WriteSpace' }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
}

/** Log out through the current account disclosure. */
async function logout(page) {
  await openNavigation(page);
  await page.getByRole('button', { name: /Account options/ }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
}

/** Return the actual persisted collection for assertions. */
async function storedUsers(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users') ?? '[]'));
}

/** Fill and submit the account form without bypassing the UI. */
async function create(page, displayName, username, role) {
  await page.getByLabel('Display Name').fill(displayName);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Role', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(`Account ${username.trim()} created.`);
}

test('default admin creates both roles, reloads, cancels and confirms deletion with persisted results', async ({ page }) => {
  await page.goto('/');
  await login(page, 'admin', 'admin');
  await manageUsers(page);
  await expect(page.getByText(/passwords are stored in plaintext/)).toBeVisible();
  const defaultDelete = page.getByRole('button', { name: 'Delete admin', exact: true });
  await expect(defaultDelete).toBeDisabled();
  await expect(defaultDelete).toHaveAttribute('title', 'Default admin cannot be deleted.');
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByText('Display Name is required.')).toBeVisible();
  await expect(page.getByText('Username is required.')).toBeVisible();
  await expect(page.getByText('Password is required.')).toBeVisible();
  expect(await storedUsers(page)).toEqual([]);
  await create(page, ' Writer One ', 'writer-one', 'user');
  await create(page, 'Manager One', 'manager-one', 'admin');
  const accounts = await storedUsers(page);
  expect(accounts).toHaveLength(2);
  expect(accounts[0]).toMatchObject({ displayName: 'Writer One', username: 'writer-one', password: 'demo-only', role: 'user' });
  expect(accounts[1]).toMatchObject({ displayName: 'Manager One', username: 'manager-one', password: 'demo-only', role: 'admin' });
  for (const account of accounts) {
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'All accounts (3)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete writer-one', exact: true })).toBeVisible();
  await page.getByLabel('Display Name').fill('Duplicate');
  await page.getByLabel('Username', { exact: true }).fill('WRITER-ONE');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  expect(await storedUsers(page)).toEqual(accounts);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete writer-one', exact: true }).click();
  expect(await storedUsers(page)).toEqual(accounts);
  await expect(page.getByRole('heading', { name: 'All accounts (3)' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete writer-one', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Account writer-one deleted. Historical posts retained.');
  expect(await storedUsers(page)).toEqual([accounts[1]]);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Delete writer-one', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'All accounts (2)' })).toBeVisible();
  await logout(page);
  await login(page, 'manager-one', 'demo-only');
  await manageUsers(page);
  const selfDelete = page.getByRole('button', { name: 'Delete manager-one', exact: true });
  await expect(selfDelete).toBeDisabled();
  await expect(selfDelete).toHaveAttribute('title', 'You cannot delete your current account.');
  await expect(page.getByRole('button', { name: 'Delete admin', exact: true })).toBeDisabled();
  expect(await storedUsers(page)).toEqual([accounts[1]]);
  await logout(page);
  await login(page, 'admin', 'admin');
  await manageUsers(page);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete manager-one', exact: true }).click();
  expect(await storedUsers(page)).toEqual([]);
  await expect(page.getByRole('heading', { name: 'All accounts (1)' })).toBeVisible();
});

test('a non-admin initial Users request redirects without exposing account controls', async ({ page }) => {
  const account = { id: 'writer', displayName: 'Writer', username: 'writer', password: 'demo-only',
    role: 'user', createdAt: '2025-01-02T00:00:00.000Z' };
  await page.addInitScript(user => {
    localStorage.setItem('writespace_users', JSON.stringify([user]));
    localStorage.setItem('writespace_session', JSON.stringify({ userId: user.id, username: user.username,
      displayName: user.displayName, role: user.role }));
  }, account);
  await page.goto('/users');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('button', { name: 'Create User' })).toHaveCount(0);
  await openNavigation(page);
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  expect(await storedUsers(page)).toEqual([account]);
});

test('a guest initial Users request redirects to the login form', async ({ page }) => {
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create User' })).toHaveCount(0);
  expect(await storedUsers(page)).toEqual([]);
});
