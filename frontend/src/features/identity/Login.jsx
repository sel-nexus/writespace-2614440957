/** Provide local demo login with prominently disclosed security limitations. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getSession, homeDestination, login, styles } from './auth.js';

/** Authenticate exact demo credentials and notify the root of persisted session changes.
 * @param {object} props Current session and onSessionChange callback.
 * @returns {JSX.Element} Login form or role-home redirect for validated signed-in accounts.
 */
export default function Login({ session, onSessionChange }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const current = getSession();
  if (session && current) {
    return (
      <Navigate to={homeDestination(current)} replace />
    );
  }

  /** Associate required-field and credential/storage failures with the inputs. */
  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!username.trim()) nextErrors.username = 'Username is required.';
    if (!password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    setError('');
    if (Object.keys(nextErrors).length) return;
    try {
      const next = login(username, password);
      onSessionChange(next);
      navigate(homeDestination(next), { replace: true });
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="login-heading">
      <Link to="/" className="font-['Georgia'] text-lg font-bold text-indigo-600 underline-offset-4 hover:underline">
        WriteSpace
      </Link>
      <h1 id="login-heading" className={`${styles.heading} mt-6`}>
        Welcome back
      </h1>
      <p className="mt-3 text-slate-600">
        Log in to your local writing space.
      </p>
      <aside className="my-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900" aria-label="Demo safety notice">
        <strong>
          Demo only — never use real passwords.
        </strong>
        <p className="mt-2">
          Passwords are stored in plain text in this browser. Access checks are client-side only; do not store sensitive information. Built-in demo login: admin / admin.
        </p>
      </aside>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <label htmlFor="login-username" className="font-medium">
            Username
          </label>
          <input id="login-username" name="username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} aria-required="true" aria-invalid={Boolean(errors.username || error)} aria-describedby={errors.username ? 'login-username-error' : error ? 'login-error' : undefined} className={styles.input} />
          {errors.username && (
            <p id="login-username-error" role="alert" className={styles.error}>
              {errors.username}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="login-password" className="font-medium">
            Password
          </label>
          <input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} aria-required="true" aria-invalid={Boolean(errors.password || error)} aria-describedby={errors.password ? 'login-password-error' : error ? 'login-error' : undefined} className={styles.input} />
          {errors.password && (
            <p id="login-password-error" role="alert" className={styles.error}>
              {errors.password}
            </p>
          )}
        </div>
        {error && (
          <p id="login-error" role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <button type="submit" className={`${styles.primary} w-full`}>
          Login
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-600">
        New to WriteSpace?{' '}
        <Link to="/register" className="font-medium text-indigo-600 underline underline-offset-4">
          Register
        </Link>
      </p>
    </section>
  );
}

Login.propTypes = { session: PropTypes.object, onSessionChange: PropTypes.func.isRequired };
