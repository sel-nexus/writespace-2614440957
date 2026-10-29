/** Manage demo accounts locally; plaintext passwords are intentional, never use real passwords. */
import { DEFAULT_ADMIN, getUsers, saveUsers, requireSession } from '../identity/auth.js';

/** Read the complete collection without dropping malformed or ambiguous records.
 * @returns {Array<object>} All persisted accounts, excluding the built-in identity.
 * @throws {Error} If storage cannot be read or any record would be silently discarded.
 */
function readAccounts() {
  try {
    const raw = localStorage.getItem('writespace_users');
    const accounts = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(accounts) || JSON.stringify(accounts) !== JSON.stringify(getUsers())) {
      throw new Error('Invalid collection');
    }
    return accounts;
  } catch {
    throw new Error('Cannot read local accounts. Enable browser storage or repair corrupt account data before retrying.');
  }
}

/** Return the full admin-visible population, including the separate built-in admin.
 * @returns {Array<object>} Accounts with the built-in admin first; its creation date is unavailable.
 * @throws {Error} If persisted authorization or the account collection is invalid.
 */
export function listUsers() {
  requireSession('admin');
  return [DEFAULT_ADMIN, ...readAccounts()];
}

/** Create either role without changing the administrator's session.
 * @param {object} fields Display name, username, exact nonempty password and lowercase role.
 * @returns {object} The persisted account with UUID and ISO creation time.
 * @throws {Error} With fieldErrors for input errors, or storage/UUID failure details.
 */
export function createUser(fields = {}) {
  requireSession('admin');
  const { displayName, username, password, role } = fields ?? {};
  const errors = {};
  if (typeof displayName !== 'string' || !displayName.trim()) errors.displayName = 'Display Name is required.';
  if (typeof username !== 'string' || !username.trim()) errors.username = 'Username is required.';
  if (typeof password !== 'string' || !password.length) errors.password = 'Password is required.';
  if (!role) errors.role = 'Role is required.';
  else if (!['admin', 'user'].includes(role)) errors.role = 'Choose Admin or User.';
  if (Object.keys(errors).length) {
    throw Object.assign(new Error('Please correct the highlighted fields.'), { fieldErrors: errors });
  }
  const accounts = readAccounts();
  const name = username.trim();
  if (name.toLowerCase() === DEFAULT_ADMIN.username ||
      accounts.some(account => account.username.toLowerCase() === name.toLowerCase())) {
    throw Object.assign(new Error('Username is already taken.'), { fieldErrors: { username: 'Username is already taken.' } });
  }
  let id;
  try {
    id = crypto.randomUUID();
    if (typeof id !== 'string' || !id.trim() || id.trim() !== id ||
        id === DEFAULT_ADMIN.id || accounts.some(account => account.id === id)) throw new Error('Invalid ID');
  } catch {
    throw new Error('Cannot create an account ID. Use a browser with secure UUID support.');
  }
  // Demo-only plaintext storage, not secure authentication or a place for sensitive credentials.
  const account = { id, displayName: displayName.trim(), username: name, password, role, createdAt: new Date().toISOString() };
  saveUsers([...accounts, account]);
  return account;
}

/** Delete an eligible account while retaining all historical posts and attribution.
 * @param {string} id Account identifier to remove.
 * @returns {object} The deleted account.
 * @throws {Error} For unauthorized, missing, protected or unpersistable deletion.
 */
export function deleteUser(id) {
  const session = requireSession('admin');
  if (typeof id !== 'string' || !id.trim()) throw new Error('Account not found.');
  if (id === DEFAULT_ADMIN.id) throw new Error('Default admin cannot be deleted.');
  if (id === session.userId) throw new Error('You cannot delete your current account.');
  const accounts = readAccounts();
  const account = accounts.find(user => user.id === id);
  if (!account) throw new Error('Account not found.');
  saveUsers(accounts.filter(user => user.id !== id));
  return account;
}
