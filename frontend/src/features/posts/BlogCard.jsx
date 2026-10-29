/** Share the real plain-text publication preview across discovery and later post lists. */
import PropTypes from 'prop-types';
import { PencilSimple } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/Avatar.jsx';
import { DEFAULT_ADMIN, getUsers, styles } from '../identity/auth.js';
import { formatPostDate, isValidPost } from './storage.js';

const accents = ['border-t-indigo-600', 'border-t-violet-600', 'border-t-pink-500', 'border-t-teal-500'];

/** Render one preview with separate reading and permitted editing links.
 * @param {object} props Post, optional session, and zero-based accent index.
 * @returns {JSX.Element|null} An accessible card, or nothing for an invalid record.
 * Notes: Edit visibility is demo UI permission, not authorization for the mutation service.
 */
export function BlogCard({ post, session = null, index = 0 }) {
  if (!isValidPost(post)) return null;
  const canEdit = session?.role === 'admin' ||
    (session?.role === 'user' && session.userId === post.authorId);
  const authorRole = post.authorId === DEFAULT_ADMIN.id ? 'admin' :
    (getUsers().find(user => user.id === post.authorId)?.role ?? post.authorRole ?? 'user');
  const destination = encodeURIComponent(post.id);

  return (
    <article
      className={`flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 border-t-4 bg-white p-6 ${accents[index % 4]}`}
    >
      <time dateTime={post.createdAt} className="text-sm text-slate-600">
        {formatPostDate(post.createdAt)}
      </time>
      <Link
        to={`/blog/${destination}`}
        className="mt-3 block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <h3 className="break-words font-display text-2xl font-bold leading-tight text-slate-900 hover:text-indigo-700">
          {post.title}
        </h3>
        <p className="mt-4 break-words text-base leading-relaxed text-slate-600">
          {post.content.slice(0, 120)}
        </p>
      </Link>
      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar role={authorRole} size="sm" />
          <span className="break-words text-sm font-medium text-slate-700">
            {post.authorName}
          </span>
        </div>
        {canEdit && (
          <Link to={`/edit/${destination}`} aria-label={`Edit ${post.title}`} className={`${styles.ghost} shrink-0`}>
            <PencilSimple size={20} aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}

BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    authorId: PropTypes.string.isRequired,
    authorName: PropTypes.string.isRequired,
    authorRole: PropTypes.oneOf(['admin', 'user']),
  }).isRequired,
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.oneOf(['admin', 'user']) }),
  index: PropTypes.number,
};
