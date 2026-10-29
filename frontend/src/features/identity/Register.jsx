/** Provide local writer registration with field-associated validation. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getSession, homeDestination, register, styles } from './auth.js';

/** Create only writer accounts and notify the app after account/session persistence succeeds.
 * @param {object} props Current session and onSessionChange callback.
 * @returns {JSX.Element} Registration form or validated role-home redirect.
 */
export default function Register({ session, onSessionChange }) {
  const [fields, setFields] = useState({ displayName: '', username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const current = getSession();
  if (session && current) {
    return (
      <Navigate to={homeDestination(current)} replace />
    );
  }

  /** Show service validation and persistence failures without claiming successful registration. */
  function submit(event) {
    event.preventDefault();
    setErrors({});
    setError('');
    try {
      const next = register(fields);
      onSessionChange(next);
      navigate(homeDestination(next), { replace: true });
    } catch (failure) {
      if (failure.fieldErrors) setErrors(failure.fieldErrors);
      else setError(failure.message);
    }
  }

  const inputs = [
    { name: 'displayName', label: 'Display Name', type: 'text', autocomplete: 'name' },
    { name: 'username', label: 'Username', type: 'text', autocomplete: 'username' },
    { name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password' },
    { name: 'confirmPassword', label: 'Confirm Password', type: 'password', autocomplete: 'new-password' },
  ];

  return (
    <section className={styles.card} aria-labelledby="register-heading">
      <Link to="/" className="font-['Georgia'] text-lg font-bold text-indigo-600 underline-offset-4 hover:underline">
        WriteSpace
      </Link>
      <h1 id="register-heading" className={`${styles.heading} mt-6`}>
        Create your space
      </h1>
      <p className="mt-3 text-slate-600">
        Join as a writer. Your account stays in this browser.
      </p>
      <aside className="my-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900" aria-label="Demo safety notice">
        <strong>
          Demo only — never use real passwords.
        </strong>
        <p className="mt-2">
          Passwords are stored in plain text. Client-side access checks are not secure authentication. Do not store sensitive information.
        </p>
      </aside>
      <form onSubmit={submit} noValidate className="space-y-5">
        {inputs.map(input => (
          <div key={input.name}>
            <label htmlFor={`register-${input.name}`} className="font-medium">
              {input.label}
            </label>
            <input
              id={`register-${input.name}`}
              name={input.name}
              type={input.type}
              autoComplete={input.autocomplete}
              value={fields[input.name]}
              onChange={event => setFields({ ...fields, [input.name]: event.target.value })}
              aria-required="true"
              aria-invalid={Boolean(errors[input.name])}
              aria-describedby={errors[input.name] ? `register-${input.name}-error` : undefined}
              className={styles.input}
            />
            {errors[input.name] && (
              <p id={`register-${input.name}-error`} role="alert" className={styles.error}>
                {errors[input.name]}
              </p>
            )}
          </div>
        ))}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <button type="submit" className={`${styles.primary} w-full`}>
          Register
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-600">
        Already have a local account?{' '}
        <Link to="/login" className="font-medium text-indigo-600 underline underline-offset-4">
          Login
        </Link>
      </p>
    </section>
  );
}

Register.propTypes = { session: PropTypes.object, onSessionChange: PropTypes.func.isRequired };
