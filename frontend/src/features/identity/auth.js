/** Manage demo-only local identity. Plaintext passwords are intentional: never use real passwords. */
const USERS_KEY = 'writespace_users';
const SESSION_KEY = 'writespace_session';

/** The built-in demo account exists separately from persisted user records. */
export const DEFAULT_ADMIN = Object.freeze({
  id: 'admin', displayName: 'Admin', username: 'admin', password: 'admin', role: 'admin',
});

/** Shared inline Tailwind treatments for identity controls and later slices. */
export const styles = Object.freeze({
  primary: 'inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
  secondary: 'inline-flex min-h-11 items-center justify-center rounded-lg border border-indigo-200 bg-white px-4 py-2 font-medium text-indigo-600 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
  ghost: 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
  input: 'mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500',
  card: 'mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8',
  heading: "font-['Georgia'] text-3xl font-bold tracking-tight text-slate-900",
  error: 'mt-2 text-sm text-red-700',
});

/** Check that a value is a nonempty string without changing passwords. */
function nonempty(value) {
  return typeof value === 'string' && value.length > 0;
}

/** Validate a persisted account, excluding records that shadow the built-in identity. */
function validUser(user) {
  return user !== null && typeof user === 'object' &&
    nonempty(user.id) && user.id.trim() === user.id && user.id !== 'admin' &&
    nonempty(user.displayName) && user.displayName.trim() === user.displayName &&
    nonempty(user.username) && user.username.trim() === user.username &&
    user.username.toLowerCase() !== 'admin' && nonempty(user.password) &&
    ['admin', 'user'].includes(user.role) && nonempty(user.createdAt) &&
    Number.isFinite(Date.parse(user.createdAt));
}

/** Keep only valid, unambiguous accounts from an untrusted collection. */
function sanitizeUsers(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(user => validUser(user) &&
    value.filter(other => validUser(other) &&
      (other.id === user.id || other.username.toLowerCase() === user.username.toLowerCase())).length === 1);
}

/** Read accounts strictly before a mutation so unreadable data is never overwritten. */
function readUsersForWrite() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const value = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(value) || sanitizeUsers(value).length !== value.length) {
      throw new Error('Invalid or duplicate accounts');
    }
    return value;
  } catch {
    throw new Error('Cannot read local accounts. Enable browser storage or reset corrupt account data.');
  }
}

/** Return valid stored accounts, or an empty array when storage is corrupt or unavailable.
 * @returns {Array<object>} Accounts excluding the built-in admin and ambiguous records.
 */
export function getUsers() {
  try {
    return sanitizeUsers(JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

/** Persist a validated account collection; callers must authorize account-management actions.
 * @param {Array<object>} users Complete stored account collection, excluding the built-in admin.
 * @throws {Error} If records are invalid, duplicated, or browser storage cannot be written.
 */
export function saveUsers(users) {
  if (!Array.isArray(users) || sanitizeUsers(users).length !== users.length) {
    throw new Error('Cannot save invalid or duplicate local accounts.');
  }
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    throw new Error('Cannot save local accounts. Enable browser storage and check available space.');
  }
}

/** Derive the password-free session fields from a validated account. */
function sessionFor(account) {
  return { userId: account.id, username: account.username, displayName: account.displayName, role: account.role };
}

/** Resolve an untrusted session against current account data, rejecting stale or forged fields. */
function validateSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return null;
  const account = session.userId === 'admin' ? DEFAULT_ADMIN : getUsers().find(user => user.id === session.userId);
  if (!account) return null;
  const canonical = sessionFor(account);
  return Object.keys(canonical).every(key => session[key] === canonical[key]) ? canonical : null;
}

/** Return the current password-free session, or null for missing, invalid, or stale storage.
 * @returns {object|null} A session revalidated against the current account.
 */
export function getSession() {
  try {
    return validateSession(JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

/** Persist only a session matching an existing account; this is demo client-side authorization.
 * @param {object} session Identity fields to validate and persist.
 * @returns {object} The canonical password-free session.
 * @throws {Error} If identity is stale/invalid or storage cannot be written.
 */
export function setSession(session) {
  const canonical = validateSession(session);
  if (!canonical) throw new Error('Invalid or stale session. Please log in again.');
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(canonical));
  } catch {
    throw new Error('Cannot save your session. Enable browser storage and check available space.');
  }
  return canonical;
}

/** Remove the session, including corrupt data; do not report logout success on storage failure.
 * @throws {Error} If browser storage cannot remove the session.
 */
export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    throw new Error('Cannot clear your session. Enable browser storage and try logging out again.');
  }
}

/** Revalidate persisted authorization for later services rather than trusting UI props.
 * @param {string|null} role Optional required lowercase role.
 * @returns {object} Current validated session.
 * @throws {Error} If signed out, stale, or not authorized for the requested role.
 */
export function requireSession(role = null) {
  const session = getSession();
  if (!session) throw new Error('Please log in again.');
  if (role !== null && session.role !== role) throw new Error('You are not authorized for this action.');
  return session;
}

/** Return the role-specific route; invalid identities safely return login.
 * @param {object|null} session Identity with a lowercase role.
 * @returns {string} Home route for that role.
 */
export function homeDestination(session) {
  if (session?.role === 'admin') return '/admin';
  if (session?.role === 'user') return '/blogs';
  return '/login';
}

/** Check exact demo credentials, then persist the matching account's session.
 * @param {string} username Account username (surrounding whitespace is ignored).
 * @param {string} password Exact plaintext demo password, never trimmed.
 * @returns {object} Persisted password-free session.
 * @throws {Error} If credentials are invalid or session persistence fails.
 */
export function login(username, password) {
  if (typeof username !== 'string' || !nonempty(password)) throw new Error('Invalid username or password.');
  const name = username.trim();
  const account = name === 'admin' && password === 'admin' ? DEFAULT_ADMIN :
    getUsers().find(user => user.username === name && user.password === password);
  if (!account) throw new Error('Invalid username or password.');
  return setSession(sessionFor(account));
}

/** Create a writer account and session, rolling back the account when session persistence fails.
 * @param {object} fields Display name, username, exact password, and confirmPassword.
 * @returns {object} Persisted writer session.
 * @throws {Error} With fieldErrors for invalid input, or useful storage/UUID failure details.
 */
export function register(fields = {}) {
  const { displayName, username, password, confirmPassword } = fields ?? {};
  const errors = {};
  if (typeof displayName !== 'string' || !displayName.trim()) errors.displayName = 'Display Name is required.';
  if (typeof username !== 'string' || !username.trim()) errors.username = 'Username is required.';
  if (!nonempty(password)) errors.password = 'Password is required.';
  if (!nonempty(confirmPassword)) errors.confirmPassword = 'Confirm Password is required.';
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords must match.';
  if (Object.keys(errors).length) throw Object.assign(new Error('Please correct the highlighted fields.'), { fieldErrors: errors });
  const users = readUsersForWrite();
  const name = username.trim();
  if (name.toLowerCase() === 'admin' || users.some(user => user.username.toLowerCase() === name.toLowerCase())) {
    throw Object.assign(new Error('Username is already taken.'), { fieldErrors: { username: 'Username is already taken.' } });
  }
  let id;
  try {
    id = crypto.randomUUID();
  } catch {
    throw new Error('Cannot create an account ID. Use a browser with secure UUID support.');
  }
  // Passwords are deliberately stored as plaintext for this local demo, not production authentication.
  const account = { id, displayName: displayName.trim(), username: name, password, role: 'user', createdAt: new Date().toISOString() };
  saveUsers([...users, account]);
  try {
    return setSession(sessionFor(account));
  } catch (error) {
    try {
      saveUsers(users);
    } catch {
      throw new Error('Registration could not save a session or undo the account. Check local storage before retrying.');
    }
    throw error;
  }
}
