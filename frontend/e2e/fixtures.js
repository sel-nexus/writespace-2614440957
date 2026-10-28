import { test as base, expect } from '@playwright/test';
/** Fail every browser journey on errors captured before its first navigation. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await use(page);
    expect(errors).toEqual([]);
  },
});
export { expect };
