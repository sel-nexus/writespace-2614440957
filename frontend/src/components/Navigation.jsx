/** Render public and role-aware navigation with React-state mobile and account disclosures. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { List, X } from '@phosphor-icons/react';
import { Avatar } from './Avatar.jsx';
import { clearSession, homeDestination, styles } from '../features/identity/auth.js';

/** Render navigation and clear persisted identity before notifying the app of logout.
 * @param {object} props Current session and onSessionChange callback accepting session or null.
 * @returns {JSX.Element} Responsive navigation with accessible disclosures and logout errors.
 */
export function Navigation({ session, onSessionChange }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
    setError('');
  }, [location.pathname]);

  /** Keep the signed-in state intact when session removal fails. */
  function logout() {
    try {
      clearSession();
      onSessionChange(null);
      setAccountOpen(false);
      setMobileOpen(false);
      navigate('/');
    } catch (failure) {
      setError(failure.message);
    }
  }

  /** Close disclosures with Escape and return focus to their trigger. */
  function closeOnEscape(event) {
    if (event.key === 'Escape') {
      setMobileOpen(false);
      setAccountOpen(false);
      const trigger = document.getElementById(accountOpen ? 'account-toggle' : 'navigation-toggle');
      trigger?.focus();
    }
  }

  const links = session ? [
    { to: '/blogs', label: 'All Blogs' }, { to: '/write', label: 'Write' },
    ...(session.role === 'admin' ? [{ to: '/users', label: 'Users' }] : []),
  ] : [];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm" onKeyDown={closeOnEscape}>
      <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="mr-auto rounded font-['Georgia'] text-2xl font-bold text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          WriteSpace
        </Link>
        <button
          id="navigation-toggle"
          type="button"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          aria-controls="navigation-links"
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`${styles.ghost} sm:hidden`}
        >
          {mobileOpen ? <X size={24} aria-hidden="true" /> : <List size={24} aria-hidden="true" />}
        </button>
        <div
          id="navigation-links"
          className={`${mobileOpen ? 'flex' : 'hidden'} w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center`}
        >
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `${styles.ghost} ${isActive ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
          {session ? (
            <>
              {location.pathname === '/' && (
                <Link to={homeDestination(session)} className={styles.secondary}>
                  Go to Dashboard
                </Link>
              )}
              <div className="relative">
                <button
                  id="account-toggle"
                  type="button"
                  aria-expanded={accountOpen}
                  aria-controls="account-actions"
                  onClick={() => setAccountOpen(!accountOpen)}
                  className={`${styles.ghost} w-full gap-2 sm:w-auto`}
                >
                  <Avatar role={session.role} />
                  <span className="max-w-40 truncate">
                    {session.displayName}
                  </span>
                  <span className="sr-only">
                    Account options
                  </span>
                </button>
                {accountOpen && (
                  <div id="account-actions" className="mt-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm sm:absolute sm:right-0 sm:min-w-48">
                    <button type="button" onClick={logout} className={`${styles.ghost} w-full`}>
                      Logout
                    </button>
                    {error && (
                      <p role="alert" className={styles.error}>
                        {error}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className={styles.ghost}>
                Login
              </Link>
              <Link to="/register" className={styles.primary}>
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

Navigation.propTypes = {
  session: PropTypes.shape({ userId: PropTypes.string.isRequired, displayName: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired }),
  onSessionChange: PropTypes.func.isRequired,
};
