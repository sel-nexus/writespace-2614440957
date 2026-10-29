/** Validate browser-local posts without turning corrupt reads into destructive writes. */
export const POSTS_KEY = 'writespace_posts';

/** Check a required text field without coercing untrusted values. */
function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validate the publication timestamp, rejecting impossible calendar dates.
 * @param {string} value ISO date or timestamp stored with a post.
 * @returns {boolean} Whether the date is usable for ordering and presentation.
 */
export function isValidPostDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day && Number.isFinite(Date.parse(value));
}

/** Check all required post fields, retaining historical author attribution.
 * @param {object} post Untrusted stored record; authorRole is optional historical metadata.
 * @returns {boolean} Whether the record can be safely consumed.
 */
export function isValidPost(post) {
  return post !== null && typeof post === 'object' && !Array.isArray(post) &&
    ['id', 'authorId'].every(key => hasText(post[key]) && post[key].trim() === post[key]) &&
    ['title', 'content', 'authorName'].every(key => hasText(post[key])) &&
    isValidPostDate(post.createdAt) &&
    (post.authorRole === undefined || ['admin', 'user'].includes(post.authorRole));
}

/** Reject invalid or ambiguous collections instead of silently dropping records. */
function validCollection(posts) {
  return Array.isArray(posts) && posts.every(isValidPost) && new Set(posts.map(post => post.id)).size === posts.length;
}

/** Read strictly before any later create/edit/delete mutation.
 * @returns {Array<object>} Complete validated collection, or an empty collection if absent.
 * @throws {Error} If storage is inaccessible or any stored record is corrupt.
 */
export function readPostsForWrite() {
  try {
    const raw = localStorage.getItem(POSTS_KEY);
    const posts = raw === null ? [] : JSON.parse(raw);
    if (!validCollection(posts)) throw new Error('Invalid collection');
    return posts;
  } catch {
    throw new Error('Cannot read local posts. Enable browser storage or reset corrupt post data.');
  }
}

/** Read public previews with graceful recovery and no storage mutations.
 * @returns {Array<object>} Valid posts, or [] for malformed or unavailable storage.
 */
export function getPosts() {
  try {
    return readPostsForWrite();
  } catch {
    return [];
  }
}

/** Persist a complete valid collection only after checking existing storage strictly.
 * @param {Array<object>} posts Replacement collection; callers must authorize mutations.
 * @returns {void}
 * @throws {Error} If incoming/existing data is invalid or the write fails; never reports false success.
 */
export function savePosts(posts) {
  if (!validCollection(posts)) throw new Error('Cannot save invalid or duplicate local posts.');
  readPostsForWrite();
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  } catch {
    throw new Error('Cannot save local posts. Enable browser storage and check available space.');
  }
}

/** Return a newest-first copy, preserving input order for matching timestamps.
 * @param {Array<object>} posts Collection to order, without mutating its source.
 * @returns {Array<object>} Sorted valid collection, or [] for invalid input.
 */
export function sortPostsLatest(posts) {
  if (!validCollection(posts)) return [];
  return [...posts].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
}

/** Format a creation date consistently across browser time zones.
 * @param {string} value Stored publication date.
 * @returns {string} English MMM DD, YYYY in UTC, or an explicit unknown-date fallback.
 */
export function formatPostDate(value) {
  if (!isValidPostDate(value)) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(value));
}
