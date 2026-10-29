/** Present an account consistently in the desktop table and mobile cards. */
import PropTypes from 'prop-types';
import { Avatar } from '../../components/Avatar.jsx';
import { DEFAULT_ADMIN } from '../identity/auth.js';

const badges = {
  admin: 'bg-violet-100 text-violet-700 ring-violet-300',
  user: 'bg-indigo-100 text-indigo-700 ring-indigo-300',
};
const destructive = 'min-h-11 rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600 ' +
  'hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ' +
  'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/** Render an account and explain why protected delete actions are disabled.
 * @param {object} props Account, current session ID, deletion callback, and mobile presentation flag.
 * @returns {JSX.Element} A table row or stacked account card; passwords are never displayed.
 */
export function UserRow({ user, currentUserId, onDelete, mobile = false }) {
  const protection = user.id === DEFAULT_ADMIN.id ? 'Default admin cannot be deleted.' :
    user.id === currentUserId ? 'You cannot delete your current account.' : undefined;
  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar role={user.role} size="md" />
      <span className="break-words font-medium text-slate-900">
        {user.displayName}
      </span>
    </div>
  );
  const badge = (
    <span className={`inline-flex rounded-full px-3 py-0.5 text-sm font-medium ring-1 ${badges[user.role]}`}>
      {user.role === 'admin' ? 'Admin' : 'User'}
    </span>
  );
  const date = user.createdAt ? (
    <time dateTime={user.createdAt}>
      {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
    </time>
  ) : 'Built-in account';
  const action = (
    <button
      type="button"
      className={destructive}
      disabled={Boolean(protection)}
      title={protection}
      aria-label={`Delete ${user.username}`}
      onClick={() => onDelete(user)}
    >
      Delete
    </button>
  );
  if (mobile) {
    return (
      <article aria-label={`Account ${user.username}`} className="rounded-xl border border-slate-200 bg-white p-4">
        {identity}
        <dl className="my-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
          <dt className="text-slate-600">
            Username
          </dt>
          <dd className="break-all">
            {user.username}
          </dd>
          <dt className="text-slate-600">
            Role
          </dt>
          <dd>
            {badge}
          </dd>
          <dt className="text-slate-600">
            Created
          </dt>
          <dd className="text-slate-600">
            {date}
          </dd>
        </dl>
        {action}
      </article>
    );
  }
  return (
    <tr className="border-t border-slate-200">
      <th scope="row" className="px-4 py-4 text-left">
        {identity}
      </th>
      <td className="break-all px-4 py-4">
        {user.username}
      </td>
      <td className="px-4 py-4">
        {badge}
      </td>
      <td className="px-4 py-4 text-sm text-slate-600">
        {date}
      </td>
      <td className="px-4 py-4 text-right">
        {action}
      </td>
    </tr>
  );
}

UserRow.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
    createdAt: PropTypes.string,
  }).isRequired,
  currentUserId: PropTypes.string,
  onDelete: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};
