/** Provide admin-only local account management with field-associated feedback. */
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getSession, styles } from '../identity/auth.js';
import { createUser, deleteUser, listUsers } from './userService.js';
import { UserRow } from './UserRow.jsx';

const initialFields = { displayName: '', username: '', password: '', role: 'user' };
const fields = [
  { key: 'displayName', label: 'Display Name', type: 'text', autoComplete: 'off' },
  { key: 'username', label: 'Username', type: 'text', autoComplete: 'off' },
  { key: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
];

/** Render the form and account population, re-reading persisted authorization on every operation.
 * @returns {JSX.Element} Accessible management surface or the appropriate role redirect.
 */
export default function Users() {
  const [accounts, setAccounts] = useState([]);
  const [values, setValues] = useState(initialFields);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const session = getSession();

  /** Refresh only after a successful strict read, preserving displayed state on failure. */
  function refresh() {
    setAccounts(listUsers());
  }

  useEffect(() => {
    /** Reconcile other-tab account changes and report storage failures without overwriting data. */
    function reloadAccounts() {
      try {
        refresh();
        setError('');
      } catch (failure) {
        setError(failure.message);
      }
    }
    reloadAccounts();
    window.addEventListener('storage', reloadAccounts);
    window.addEventListener('focus', reloadAccounts);
    return () => {
      window.removeEventListener('storage', reloadAccounts);
      window.removeEventListener('focus', reloadAccounts);
    };
  }, []);

  /** Validate and persist the account before resetting fields or announcing success. */
  function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});
    try {
      const account = createUser(values);
      refresh();
      setValues(initialFields);
      setSuccess(`Account ${account.username} created.`);
    } catch (failure) {
      setFieldErrors(failure.fieldErrors ?? {});
      setError(failure.message);
    }
  }

  /** Leave state untouched on cancellation and announce only persisted, re-read deletion. */
  function remove(account) {
    if (!window.confirm(`Delete account ${account.username}? Historical posts will be retained.`)) return;
    setError('');
    setSuccess('');
    try {
      deleteUser(account.id);
      refresh();
      setSuccess(`Account ${account.username} deleted. Historical posts retained.`);
    } catch (failure) {
      setError(failure.message);
    }
  }

  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== 'admin') return <Navigate to="/blogs" replace />;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-700">
          Administration
        </p>
        <h1 className={styles.heading}>
          Users
        </h1>
        <p className="max-w-2xl text-slate-600">
          Create local accounts for writers and administrators. Deleting an account keeps its historical posts.
        </p>
      </header>
      <section aria-labelledby="create-user-heading" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 id="create-user-heading" className="text-xl font-semibold text-slate-900">
          Create User
        </h2>
        <p id="account-safety" className="mt-2 max-w-2xl text-sm text-slate-600">
          Local demo only: passwords are stored in plaintext in this browser. Never use real passwords or sensitive information.
        </p>
        <form onSubmit={submit} noValidate aria-describedby="account-safety" className="mt-6 space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map(field => (
              <div key={field.key}>
                <label htmlFor={`account-${field.key}`} className="font-medium">
                  {field.label}
                </label>
                <input
                  id={`account-${field.key}`}
                  name={field.key}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  className={styles.input}
                  value={values[field.key]}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors[field.key])}
                  aria-describedby={fieldErrors[field.key] ? `account-${field.key}-error` : undefined}
                  onChange={event => setValues({ ...values, [field.key]: event.target.value })}
                />
                {fieldErrors[field.key] && (
                  <p id={`account-${field.key}-error`} role="alert" className={styles.error}>
                    {fieldErrors[field.key]}
                  </p>
                )}
              </div>
            ))}
            <div>
              <label htmlFor="account-role" className="font-medium">
                Role
              </label>
              <select
                id="account-role"
                name="role"
                className={styles.input}
                value={values.role}
                required
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.role)}
                aria-describedby={fieldErrors.role ? 'account-role-error' : undefined}
                onChange={event => setValues({ ...values, role: event.target.value })}
              >
                <option value="">
                  Choose a role
                </option>
                <option value="user">
                  User
                </option>
                <option value="admin">
                  Admin
                </option>
              </select>
              {fieldErrors.role && (
                <p id="account-role-error" role="alert" className={styles.error}>
                  {fieldErrors.role}
                </p>
              )}
            </div>
          </div>
          <button type="submit" className={styles.primary}>
            Create User
          </button>
        </form>
      </section>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="text-sm font-medium text-indigo-700">
        {success}
      </p>
      <section aria-labelledby="all-accounts-heading" className="space-y-4">
        <h2 id="all-accounts-heading" className="text-xl font-semibold text-slate-900">
          All accounts ({accounts.length})
        </h2>
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
          <table className="w-full text-left">
            <caption className="sr-only">
              Local accounts including the built-in admin
            </caption>
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                {['Display name', 'Username', 'Role', 'Created', 'Actions'].map(label => (
                  <th key={label} scope="col" className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map(user => (
                <UserRow key={user.id} user={user} currentUserId={session.userId} onDelete={remove} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 sm:hidden">
          {accounts.map(user => (
            <UserRow key={user.id} user={user} currentUserId={session.userId} onDelete={remove} mobile />
          ))}
        </div>
      </section>
    </div>
  );
}
