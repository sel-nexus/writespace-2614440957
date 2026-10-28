/** Own routes and local session state without introducing Context or another router. */
import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Navigation } from './components/Navigation.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import Login from './features/identity/Login.jsx';
import Register from './features/identity/Register.jsx';
import { getSession, styles } from './features/identity/auth.js';

/** Render identity routes and guards; unfinished feature destinations safely return to root.
 * @returns {JSX.Element} The identity application shell.
 */
export default function App() {
  const [session, setSessionState] = useState(getSession);

  useEffect(() => {
    /** Reconcile account deletion, role changes, and other-tab logout with persisted identity. */
    function refreshSession() {
      setSessionState(getSession());
    }
    window.addEventListener('storage', refreshSession);
    window.addEventListener('focus', refreshSession);
    return () => {
      window.removeEventListener('storage', refreshSession);
      window.removeEventListener('focus', refreshSession);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-['Arial'] text-slate-800">
      <Navigation session={session} onSessionChange={setSessionState} />
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <Routes>
          <Route path="/" element={
            <Link to="/login" className={styles.secondary}>
              Login to WriteSpace
            </Link>
          } />
          <Route path="/login" element={
            <Login session={session} onSessionChange={setSessionState} />
          } />
          <Route path="/register" element={
            <Register session={session} onSessionChange={setSessionState} />
          } />
          {['/blogs', '/blog/:id', '/write', '/edit/:id'].map(path => (
            <Route key={path} path={path} element={
              <ProtectedRoute session={session}>
                <Navigate to="/" replace />
              </ProtectedRoute>
            } />
          ))}
          {['/admin', '/users'].map(path => (
            <Route key={path} path={path} element={
              <ProtectedRoute session={session} role="admin">
                <Navigate to="/" replace />
              </ProtectedRoute>
            } />
          ))}
          <Route path="*" element={
            <Navigate to="/" replace />
          } />
        </Routes>
      </main>
    </div>
  );
}
