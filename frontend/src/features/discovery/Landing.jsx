/** Introduce local writing and show only real, browser-resident publication previews. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Lightning, LockKey, PencilLine } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { styles } from '../identity/auth.js';
import { BlogCard } from '../posts/BlogCard.jsx';
import { getPosts, POSTS_KEY, sortPostsLatest } from '../posts/storage.js';

const features = [
  { title: 'Write Freely', copy: 'Plain-text, distraction-free writing. Make room for your thoughts.', icon: PencilLine,
    style: 'bg-indigo-600 text-white md:row-span-2', iconStyle: 'bg-white/15 text-white' },
  { title: 'Private & Local', copy: 'Your data stays in this browser. No server, no syncing, just your space.', icon: LockKey,
    style: 'bg-violet-50 text-slate-900', iconStyle: 'bg-violet-100 text-violet-700' },
  { title: 'Instant & Fast', copy: 'Open, read, and write without waiting for a server.', icon: Lightning,
    style: 'bg-teal-50 text-slate-900', iconStyle: 'bg-teal-100 text-teal-800' },
];

/** Render the public page while retaining role-aware reading destinations.
 * @param {object} props Optional validated session supplied by App.
 * @returns {JSX.Element} Hero, features, newest three posts, and public footer.
 */
export default function Landing({ session = null }) {
  const [posts, setPosts] = useState(getPosts);
  const latest = sortPostsLatest(posts).slice(0, 3);

  useEffect(() => {
    /** Refresh previews on browser focus or a relevant other-tab storage change. */
    function refreshPosts(event) {
      if (event.type !== 'storage' || event.key === POSTS_KEY || event.key === null) setPosts(getPosts());
    }
    window.addEventListener('storage', refreshPosts);
    window.addEventListener('focus', refreshPosts);
    return () => {
      window.removeEventListener('storage', refreshPosts);
      window.removeEventListener('focus', refreshPosts);
    };
  }, []);

  return (
    <>
      <section aria-labelledby="landing-title" className="flex min-h-[100dvh] items-center bg-slate-50 px-4 py-16 sm:px-6">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 md:grid-cols-2 lg:gap-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">
              A home for your writing
            </p>
            <h1 id="landing-title" className="mt-5 font-display text-[clamp(2.75rem,6vw,5.5rem)] font-bold tracking-tight text-slate-900">
              WriteSpace
            </h1>
            <p className="mt-6 max-w-md text-xl leading-relaxed text-slate-600 sm:text-2xl">
              Your thoughts. Your space. Beautifully simple.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/register" className={`${styles.primary} whitespace-nowrap`}>
                Get Started Free
              </Link>
              <Link to={session ? '/blogs' : '/login'} className={`${styles.secondary} whitespace-nowrap`}>
                Start Reading
              </Link>
            </div>
          </div>
          <aside aria-label="Blog preview" className="w-full min-w-0 rounded-2xl bg-indigo-100 p-5 sm:p-8">
            <div className="motion-safe:animate-float">
              {latest.length > 0 ? (
                <BlogCard post={latest[0]} session={session} />
              ) : (
                <div className="rounded-2xl bg-white p-8 shadow-sm">
                  <PencilLine size={40} aria-hidden="true" className="text-indigo-600" />
                  <h2 className="mt-6 font-display text-3xl font-bold text-slate-900">
                    Your next story starts here.
                  </h2>
                  <p className="mt-4 leading-relaxed text-slate-600">
                    A simple space for plain-text writing. Published posts will appear here when you add them.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 id="features-title" className={`${styles.heading} mb-8`}>
          Less friction. More writing.
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {features.map(({ title, copy, icon: Icon, style, iconStyle }) => (
            <article key={title} className={`flex flex-col justify-center rounded-2xl p-8 sm:p-10 ${style}`}>
              <span className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl ${iconStyle}`}>
                <Icon size={24} aria-hidden="true" />
              </span>
              <h3 className="font-display text-3xl font-bold">
                {title}
              </h3>
              <p className="mt-4 max-w-sm text-base leading-relaxed">
                {copy}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="latest-title" className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <h2 id="latest-title" className={`${styles.heading} mb-8`}>
          Latest from the Blog
        </h2>
        {latest.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {latest.map((post, index) => (
              <BlogCard key={post.id} post={post} session={session} index={index} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">
            No posts yet — check back soon!
          </p>
        )}
      </section>

      <footer className="bg-slate-900 px-4 py-10 text-slate-100 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} WriteSpace
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-2">
            {[['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']].map(([label, to]) => (
              <Link key={to} to={to} className="inline-flex min-h-11 items-center rounded-lg px-3 hover:bg-slate-800 focus-visible:ring-2">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}

Landing.propTypes = {
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.oneOf(['admin', 'user']) }),
};
