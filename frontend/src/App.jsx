/** Own routes and local session state without introducing Context or another router. */
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Navigation } from './components/Navigation.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import Login from './features/identity/Login.jsx';
import Register from './features/identity/Register.jsx';
import { getSession } from './features/identity/auth.js';
import Landing from './features/discovery/Landing.jsx';
import BlogList from './features/posts/BlogList.jsx';
import BlogReader from './features/posts/BlogReader.jsx';
import PostEditor from './features/posts/PostEditor.jsx';

/** Render identity routes and guards; unfinished feature destinations safely return to root.
 * @returns {JSX.Element} The identity application shell.
 */
export default function App() {
  const [session, setSessionState] = useState(getSession);
  const { pathname } = useLocation();

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
      <main
        id="main-content"
        className={pathname === '/' ? 'w-full' : 'mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16'}
      >
        <Routes>
          <Route path="/" element={
            <Landing session={session} />
          } />
          <Route path="/login" element={
            <Login session={session} onSessionChange={setSessionState} />
          } />
          <Route path="/register" element={
            <Register session={session} onSessionChange={setSessionState} />
          } />
          <Route path="/blogs" element={
            <ProtectedRoute session={session}>
              <BlogList session={session} />
            </ProtectedRoute>
          } />
          <Route path="/blog/:id" element={
            <ProtectedRoute session={session}>
              <BlogReader session={session} />
            </ProtectedRoute>
          } />
          {['/write', '/edit/:id'].map(path => (
            <Route key={path} path={path} element={
              <ProtectedRoute session={session}>
                <PostEditor session={session} mode={path === '/write' ? 'create' : 'edit'} />
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
