/** Read full plain-text posts and expose confirmed ownership-controlled mutations. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar.jsx';
import { DEFAULT_ADMIN, getUsers, styles } from '../identity/auth.js';
import { canManagePost, deletePost, getPost } from './postService.js';
import { formatPostDate } from './storage.js';

/** Render full text or a recoverable missing state; canceled deletion never writes.
 * @param {object} props Current app session; mutations independently revalidate storage.
 * @returns {JSX.Element} Publication and permitted actions.
 */
export default function BlogReader({ session = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const post = getPost(id);
  const canManage = Boolean(session) && canManagePost(post);

  /** Confirm intent, then delete through the authoritative local service. */
  function removePost() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      deletePost(id);
      navigate('/blogs');
    } catch (failure) {
      setError(failure.message);
    }
  }

  if (!post) {
    return (
      <section className="space-y-6">
        <h1 className={styles.heading}>
          Post not found
        </h1>
        <Link to="/blogs" className={styles.secondary}>
          Back to All Posts
        </Link>
      </section>
    );
  }
  const authorRole = post.authorId === DEFAULT_ADMIN.id ? 'admin' :
    (getUsers().find(user => user.id === post.authorId)?.role ?? post.authorRole ?? 'user');

  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
      <Link to="/blogs" className={styles.ghost}>
        Back to All Posts
      </Link>
      <h1 className="mt-6 break-words font-display text-4xl font-bold leading-tight tracking-tight text-slate-900">
        {post.title}
      </h1>
      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <Avatar role={authorRole} />
        <span className="break-words font-medium">
          {post.authorName}
        </span>
        <time dateTime={post.createdAt}>
          {formatPostDate(post.createdAt)}
        </time>
      </div>
      <p className="mt-8 whitespace-pre-wrap break-words text-lg leading-relaxed text-slate-800">
        {post.content}
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {canManage && (
        <div className="mt-10 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
          <Link to={`/edit/${encodeURIComponent(id)}`} className={styles.secondary}>
            Edit
          </Link>
          <button
            type="button" onClick={removePost}
            className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-700 hover:bg-red-100
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            Delete
          </button>
        </div>
      )}
    </article>
  );
}

BlogReader.propTypes = {
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.oneOf(['admin', 'user']) }),
};
