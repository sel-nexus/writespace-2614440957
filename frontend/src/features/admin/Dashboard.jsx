/** Show the browser-local administrator overview using strict reads and persisted permissions. */
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getSession, requireSession, styles } from '../identity/auth.js';
import { readPostsForWrite, sortPostsLatest, formatPostDate } from '../posts/storage.js';
import { canManagePost, deletePost } from '../posts/postService.js';
import { listUsers } from './userService.js';
import { StatCard } from './StatCard.jsx';

const destructive = 'min-h-11 rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-700 ' +
  'hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2';

/** Render verified counts, shortcuts and the newest five posts, or a recoverable error.
 * @returns {JSX.Element} Admin overview or a role-appropriate redirect for stale identity.
 */
export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const session = getSession();

  /** Re-read both complete collections atomically, hiding unverifiable totals on failure.
   * @returns {boolean} Whether the overview was refreshed successfully.
   */
  function refresh() {
    try {
      const accounts = listUsers();
      const posts = readPostsForWrite();
      setOverview({ accounts, posts: sortPostsLatest(posts) });
      setError('');
      return true;
    } catch (failure) {
      setOverview(null);
      setSuccess('');
      setError(failure.message);
      return false;
    }
  }

  useEffect(() => {
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  /** Confirm deletion without changing canceled state; revalidate admin even after the dialog.
   * @param {object} post Recent publication selected for deletion.
   */
  function remove(post) {
    try {
      requireSession('admin');
      if (!canManagePost(post)) throw new Error('You are not authorized to manage this post.');
      if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
      requireSession('admin');
      setSuccess('');
      deletePost(post.id);
      if (refresh()) setSuccess(`Post "${post.title}" deleted.`);
    } catch (failure) {
      setSuccess('');
      setOverview(null);
      setError(failure.message);
    }
  }

  if (!session) return (
    <Navigate to="/login" replace />
  );
  if (session.role !== 'admin') return (
    <Navigate to="/blogs" replace />
  );

  return (
    <div className="space-y-8">
      <header className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white sm:p-8">
        <p className="text-sm font-medium uppercase tracking-widest">
          Administration
        </p>
        <h1 className="mt-3 font-['Georgia'] text-3xl font-bold tracking-tight sm:text-4xl">
          Dashboard
        </h1>
        <p className="mt-3 max-w-2xl">
          Your writing and accounts, at a glance. These totals reflect data stored in this browser only.
        </p>
      </header>
      <section aria-labelledby="quick-actions-heading" className="space-y-4">
        <h2 id="quick-actions-heading" className="text-xl font-semibold text-slate-900">
          Quick actions
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/write" className={styles.primary}>
            Write New Post
          </Link>
          <Link to="/users" className={styles.secondary}>
            Manage Users
          </Link>
        </div>
      </section>
      {error && (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p role="alert" className="text-red-700">
            {error} Overview unavailable until local data can be verified. Retry after fixing storage; no data is reset here.
          </p>
          <button type="button" onClick={refresh} className={styles.secondary}>
            Retry overview
          </button>
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm font-medium text-indigo-700">
        {success}
      </p>
      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              id="total-posts"
              label="Total Posts"
              count={overview.posts.length}
              description="All published posts in this browser."
            />
            <StatCard
              id="total-accounts"
              label="Total Users"
              count={overview.accounts.length}
              description="All accounts, including the built-in admin."
              accent="violet"
            />
            <StatCard
              id="total-admins"
              label="Total Admins"
              count={overview.accounts.filter(account => account.role === 'admin').length}
              description="Admin accounts, including the built-in admin."
              accent="pink"
            />
            <StatCard
              id="total-writers"
              label="Total users"
              count={overview.accounts.filter(account => account.role === 'user').length}
              description="Non-admin writer accounts only."
              accent="teal"
            />
          </div>
          <section aria-labelledby="recent-posts-heading" className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 id="recent-posts-heading" className="text-xl font-semibold text-slate-900">
              Recent Posts
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              The five newest publications, with the latest first.
            </p>
            {overview.posts.length === 0 ? (
              <p className="mt-6 text-slate-600">
                No posts yet. Use Write New Post to publish your first post.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-200">
                {overview.posts.slice(0, 5).map(post => (
                  <li key={post.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-semibold text-slate-900">
                        <Link to={`/blog/${encodeURIComponent(post.id)}`} className="rounded hover:underline focus-visible:ring-2">
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        {post.authorName} · {formatPostDate(post.createdAt)}
                      </p>
                    </div>
                    {canManagePost(post) && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link
                          to={`/edit/${encodeURIComponent(post.id)}`}
                          aria-label={`Edit ${post.title}`}
                          className={styles.secondary}
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          aria-label={`Delete ${post.title}`}
                          onClick={() => remove(post)}
                          className={destructive}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
