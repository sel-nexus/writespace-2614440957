/** Enforce demo post ownership using persisted identity, never caller-supplied attribution. */
import { requireSession } from '../identity/auth.js';
import { getPosts, isValidPost, readPostsForWrite, savePosts } from './storage.js';

/** Check UI permission against the current stored session, failing closed.
 * @param {object} post Publication to manage.
 * @returns {boolean} Whether the revalidated reader owns it or is an administrator.
 */
export function canManagePost(post) {
  if (!isValidPost(post)) return false;
  try {
    const session = requireSession();
    return session.role === 'admin' || (session.role === 'user' && session.userId === post.authorId);
  } catch {
    return false;
  }
}

/** Find a readable publication without changing corrupt storage.
 * @param {string} id Exact publication identifier.
 * @returns {object|null} Matching post, or null when missing/unreadable.
 */
export function getPost(id) {
  return getPosts().find(post => post.id === id) ?? null;
}

/** Validate required plain text without coercing values.
 * @param {object} fields Submitted title and content.
 * @returns {object} Trimmed required text.
 * @throws {Error} With fieldErrors when required text is absent or invalid.
 */
function validateFields(fields) {
  const { title, content } = fields ?? {};
  const fieldErrors = {};
  if (typeof title !== 'string' || !title.trim()) fieldErrors.title = 'Title is required.';
  if (typeof content !== 'string' || !content.trim()) fieldErrors.content = 'Content is required.';
  if (Object.keys(fieldErrors).length) {
    throw Object.assign(new Error('Please correct the highlighted fields.'), { fieldErrors });
  }
  return { title: title.trim(), content: content.trim() };
}

/** Resolve a strict collection entry and enforce the current session's ownership.
 * @param {Array<object>} posts Freshly read collection.
 * @param {string} id Publication identifier.
 * @param {object} session Revalidated stored identity.
 * @returns {object} Authorized publication.
 * @throws {Error} When missing or owned by someone else.
 */
function managedPost(posts, id, session) {
  const post = posts.find(item => item.id === id);
  if (!post) throw new Error('Post not found.');
  if (session.role !== 'admin' && !(session.role === 'user' && session.userId === post.authorId)) {
    throw new Error('You are not authorized to manage this post.');
  }
  return post;
}

/** Publish required text with a new UUID and canonical session attribution.
 * @param {object} fields Title and content; identity fields are ignored.
 * @returns {object} Persisted publication.
 * @throws {Error} For invalid identity/text, unreadable storage, UUID or write failures.
 */
export function createPost(fields) {
  const session = requireSession();
  const text = validateFields(fields);
  const posts = readPostsForWrite();
  let id;
  try {
    id = crypto.randomUUID();
  } catch {
    throw new Error('Cannot create a post ID. Use a browser with secure UUID support.');
  }
  const post = {
    ...text, id, createdAt: new Date().toISOString(), authorId: session.userId,
    authorName: session.displayName, authorRole: session.role,
  };
  savePosts([...posts, post]);
  return post;
}

/** Replace required text while preserving creation metadata and historical attribution.
 * @param {string} id Publication identifier.
 * @param {object} fields Title and content; metadata fields are ignored.
 * @returns {object} Persisted updated publication.
 * @throws {Error} For stale/unauthorized identity, missing post, invalid text or storage failure.
 */
export function updatePost(id, fields) {
  const session = requireSession();
  const posts = readPostsForWrite();
  const post = managedPost(posts, id, session);
  const updated = { ...post, ...validateFields(fields) };
  savePosts(posts.map(item => item.id === id ? updated : item));
  return updated;
}

/** Remove an owned publication or moderate any publication as an administrator.
 * @param {string} id Publication identifier.
 * @returns {object} Removed publication.
 * @throws {Error} For stale/unauthorized identity, missing post or storage failure.
 */
export function deletePost(id) {
  const session = requireSession();
  const posts = readPostsForWrite();
  const post = managedPost(posts, id, session);
  savePosts(posts.filter(item => item.id !== id));
  return post;
}
