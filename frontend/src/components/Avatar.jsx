/** Present the product's required static role avatars without image uploads. */
import PropTypes from 'prop-types';

/** Render a labeled crown for admins or book for writers.
 * @param {object} props Lowercase role and optional small/medium/large size.
 * @returns {JSX.Element} Accessible circular role avatar.
 */
export function Avatar({ role = 'user', size = 'md' }) {
  const sizes = { sm: 'h-8 w-8 text-sm', md: 'h-10 w-10 text-lg', lg: 'h-12 w-12 text-xl' };
  const roles = { admin: { color: 'bg-violet-600', emoji: '👑', label: 'Admin avatar' }, user: { color: 'bg-indigo-500', emoji: '📖', label: 'User avatar' } };
  const avatar = roles[role] ?? roles.user;
  return (
    <span role="img" aria-label={avatar.label} className={`inline-flex shrink-0 items-center justify-center rounded-full ${avatar.color} ${sizes[size] ?? sizes.md}`}>
      {avatar.emoji}
    </span>
  );
}

Avatar.propTypes = { role: PropTypes.oneOf(['admin', 'user']), size: PropTypes.oneOf(['sm', 'md', 'lg']) };
