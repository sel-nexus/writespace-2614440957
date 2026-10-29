/** Browse all locally persisted publications in newest-first order. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { styles } from '../identity/auth.js';
import { BlogCard } from './BlogCard.jsx';
import { getPosts, sortPostsLatest } from './storage.js';

/** Render a responsive publication grid or a first-writing invitation.
 * @param {object} props Current session for preview editing affordances.
 * @returns {JSX.Element} Publication list with empty-state navigation.
 */
export default function BlogList({ session = null }) {
  const posts = sortPostsLatest(getPosts());
  return (
    <section aria-labelledby="blogs-heading">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-700">
            The publication
          </p>
          <h1 id="blogs-heading" className={styles.heading}>
            All Blogs
          </h1>
        </div>
        <Link to="/write" className={styles.primary}>
          Write
        </Link>
      </div>
      {posts.length ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <BlogCard key={post.id} post={post} index={index} session={session} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-lg text-slate-600">
          No blogs yet. Be the first to write one!
        </p>
      )}
    </section>
  );
}

BlogList.propTypes = {
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.oneOf(['admin', 'user']) }),
};
