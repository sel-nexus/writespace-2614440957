/** Gate routes using both supplied state and revalidated local identity. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { getSession, homeDestination } from '../features/identity/auth.js';

/** Redirect guests to login and wrong roles home before rendering protected children.
 * @param {object} props Session, optional required role, and protected children.
 * @returns {JSX.Element} Children or a replacement navigation.
 */
export function ProtectedRoute({ session, role = null, children }) {
  const current = getSession();
  if (!session || !current || current.userId !== session.userId || current.role !== session.role) {
    return (
      <Navigate to="/login" replace />
    );
  }
  if (role && current.role !== role) {
    return (
      <Navigate to={homeDestination(current)} replace />
    );
  }
  return children;
}

ProtectedRoute.propTypes = {
  session: PropTypes.shape({ userId: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired }),
  role: PropTypes.oneOf(['admin', 'user']), children: PropTypes.node.isRequired,
};
