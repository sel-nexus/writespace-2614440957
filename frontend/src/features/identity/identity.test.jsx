/** Exercise identity UI, role guards, navigation disclosures and persisted state with real services. */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import App from '../../App.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { Navigation } from '../../components/Navigation.jsx';
import { ProtectedRoute } from '../../components/ProtectedRoute.jsx';
import Login from './Login.jsx';
import Register from './Register.jsx';
import { getSession, getUsers, login, register, saveUsers } from './auth.js';

/** Expose the current route as an observable test harness output. */
function Location() {
  const location = useLocation();
  return (
    <output aria-label="Current route">
      {location.pathname}
    </output>
  );
}

/** Render a component with actual in-memory routing rather than mocking navigation. */
function mount(element, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {element}
      <Location />
    </MemoryRouter>,
  );
}

/** Fill the registration form using its accessible labels. */
async function fillRegistration(user, username = 'writer', confirmation = 'demo') {
  await user.type(screen.getByLabelText('Display Name'), ' Writer ');
  await user.type(screen.getByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Password', { exact: true }), 'demo');
  await user.type(screen.getByLabelText('Confirm Password'), confirmation);
}

describe('login UI', () => {
  it('shows the safety notice and associates each required-field error', async () => {
    const user = userEvent.setup();
    mount(<Login session={null} onSessionChange={() => {}} />, '/login');
    expect(screen.getByLabelText('Demo safety notice')).toHaveTextContent(/never use real passwords/);
    expect(screen.getByLabelText('Demo safety notice')).toHaveTextContent('admin / admin');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Username is required.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password is required.');
    expect(getSession()).toBeNull();
  });

  it('displays invalid credentials without changing storage, then permits correction and admin login', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    mount(<Login session={null} onSessionChange={changed} />, '/login');
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Invalid username or password.');
    expect(changed).not.toHaveBeenCalled();
    expect(getSession()).toBeNull();
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
    expect(changed).toHaveBeenCalledWith(getSession());
    expect(getSession().userId).toBe('admin');
  });

  it('logs a registered writer into blogs using an exact password', async () => {
    register({ displayName: 'Writer', username: 'writer', password: ' demo ', confirmPassword: ' demo ' });
    localStorage.removeItem('writespace_session');
    const user = userEvent.setup();
    mount(<Login session={null} onSessionChange={() => {}} />, '/login');
    await user.type(screen.getByLabelText('Username'), 'writer');
    await user.type(screen.getByLabelText('Password'), ' demo ');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(getSession().role).toBe('user');
  });

  it('surfaces session write failures without invoking successful login', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    mount(<Login session={null} onSessionChange={changed} />, '/login');
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'admin');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Cannot save your session/);
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });
});

describe('registration UI', () => {
  it('shows four associated required errors without persisting an account', async () => {
    const user = userEvent.setup();
    mount(<Register session={null} onSessionChange={() => {}} />, '/register');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    for (const label of ['Display Name', 'Username', 'Password', 'Confirm Password']) {
      const input = screen.getByLabelText(label, { exact: true });
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAccessibleDescription(`${label} is required.`);
    }
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });

  it('rejects mismatches then reserved usernames with associated errors', async () => {
    const user = userEvent.setup();
    mount(<Register session={null} onSessionChange={() => {}} />, '/register');
    await fillRegistration(user, 'admin', 'other');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Confirm Password')).toHaveAccessibleDescription('Passwords must match.');
    await user.clear(screen.getByLabelText('Confirm Password'));
    await user.type(screen.getByLabelText('Confirm Password'), 'demo');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Username is already taken.');
    expect(getUsers()).toEqual([]);
  });

  it('rejects a duplicate stored account without changing it', async () => {
    register({ displayName: 'Existing', username: 'writer', password: 'old', confirmPassword: 'old' });
    localStorage.removeItem('writespace_session');
    const before = getUsers();
    const user = userEvent.setup();
    mount(<Register session={null} onSessionChange={() => {}} />, '/register');
    await fillRegistration(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Username is already taken.');
    expect(getUsers()).toEqual(before);
    expect(getSession()).toBeNull();
  });

  it('creates a trimmed writer, persists the session and navigates to blogs', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    mount(<Register session={null} onSessionChange={changed} />, '/register');
    await fillRegistration(user, ' writer ');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(getUsers()[0]).toMatchObject({ displayName: 'Writer', username: 'writer', role: 'user', password: 'demo' });
    expect(changed).toHaveBeenCalledWith(getSession());
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  });

  it('surfaces storage failures and stays on registration without reporting success', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    mount(<Register session={null} onSessionChange={changed} />, '/register');
    await fillRegistration(user);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Cannot save local accounts/);
    expect(changed).not.toHaveBeenCalled();
    expect(getUsers()).toEqual([]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
  });

  it.each([Login, Register])('redirects authenticated pages to a validated role destination', Component => {
    const current = login('admin', 'admin');
    mount(<Component session={current} onSessionChange={() => {}} />, '/login');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
  });

  it('does not redirect a stale supplied session', () => {
    mount(<Register session={{ userId: 'deleted', role: 'user' }} onSessionChange={() => {}} />, '/register');
    expect(screen.getByRole('heading', { name: 'Create your space' })).toBeInTheDocument();
  });

  it.each([Login, Register])('redirects a validated writer away from guest identity forms', Component => {
    const current = register({ displayName: 'Writer', username: 'writer', password: 'demo', confirmPassword: 'demo' });
    mount(<Component session={current} onSessionChange={() => {}} />, '/register');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  });
});

describe('route guards', () => {
  it.each(['/blogs', '/blog/example', '/write', '/edit/example', '/admin', '/users'])('redirects guest entry %s to login', path => {
    mount(<App />, path);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });

  it('allows a validated session, denies wrong roles, then denies account deletion', () => {
    const current = register({ displayName: 'Writer', username: 'writer', password: 'demo', confirmPassword: 'demo' });
    const view = mount(
      <Routes>
        <Route path="/users" element={
          <ProtectedRoute session={current} role="admin">
            <p>Protected users</p>
          </ProtectedRoute>
        } />
        <Route path="/blogs" element={
          <ProtectedRoute session={current}>
            <p>Allowed writer</p>
          </ProtectedRoute>
        } />
        <Route path="/login" element={
          <p>Guest destination</p>
        } />
      </Routes>, '/users');
    expect(screen.getByText('Allowed writer')).toBeInTheDocument();
    expect(screen.queryByText('Protected users')).not.toBeInTheDocument();
    saveUsers([]);
    view.rerender(
      <MemoryRouter initialEntries={['/blogs']}>
        <ProtectedRoute session={current}>
          <p>Never allowed</p>
        </ProtectedRoute>
        <Location />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Never allowed')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });

  it('renders admin children and denies spoofed role or user props', () => {
    const current = login('admin', 'admin');
    const view = mount(
      <ProtectedRoute session={current} role="admin">
        <p>Admin permitted</p>
      </ProtectedRoute>, '/users');
    expect(screen.getByText('Admin permitted')).toBeInTheDocument();
    view.rerender(
      <MemoryRouter>
        <ProtectedRoute session={{ ...current, role: 'user' }}>
          <p>Denied</p>
        </ProtectedRoute>
        <Location />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Denied')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });
});

describe('guard identity matching', () => {
  it('rejects supplied identity belonging to a different persisted account', () => {
    const current = login('admin', 'admin');
    mount(
      <ProtectedRoute session={{ ...current, userId: 'other-admin' }}>
        <p>Not permitted</p>
      </ProtectedRoute>, '/users');
    expect(screen.queryByText('Not permitted')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });
});

describe('navigation and avatars', () => {
  it('supports guest mobile disclosure, actual links and Escape focus restoration', async () => {
    const user = userEvent.setup();
    mount(<Navigation session={null} onSessionChange={() => {}} />);
    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    await user.click(screen.getByRole('link', { name: 'Get Started' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it.each(['admin', 'user'])('shows %s role avatar and correct home link', role => {
    const current = role === 'admin' ? login('admin', 'admin') : register({ displayName: 'Writer', username: 'writer', password: 'demo', confirmPassword: 'demo' });
    mount(<Navigation session={current} onSessionChange={() => {}} />);
    expect(screen.getByRole('img', { name: role === 'admin' ? 'Admin avatar' : 'User avatar' })).toHaveTextContent(role === 'admin' ? '👑' : '📖');
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', role === 'admin' ? '/admin' : '/blogs');
    expect(screen.getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
    expect(screen.queryByRole('link', { name: 'Users' }) !== null).toBe(role === 'admin');
  });

  it('marks active links, supports account Escape, and logs out to root with cleared storage', async () => {
    const current = login('admin', 'admin');
    const changed = vi.fn();
    const user = userEvent.setup();
    mount(<Navigation session={current} onSessionChange={changed} />, '/blogs');
    expect(screen.getByRole('link', { name: 'All Blogs' })).toHaveAttribute('aria-current', 'page');
    const account = screen.getByRole('button', { name: /Admin.*Account options/ });
    await user.click(account);
    await user.keyboard('{Escape}');
    expect(account).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    await user.click(account);
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(changed).toHaveBeenCalledWith(null);
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(screen.getByLabelText('Current route').textContent).toBe('/');
  });

  it('retains identity and location on failed logout', async () => {
    const current = login('admin', 'admin');
    const changed = vi.fn();
    const user = userEvent.setup();
    mount(<Navigation session={current} onSessionChange={changed} />, '/blogs');
    await user.click(screen.getByRole('button', { name: /Account options/ }));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Cannot clear your session/);
    expect(getSession()).toEqual(current);
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  });

  it.each(['sm', 'md', 'lg'])('retains role emoji at avatar size %s', size => {
    render(<Avatar role="admin" size={size} />);
    expect(screen.getByRole('img', { name: 'Admin avatar' })).toHaveTextContent('👑');
    expect(screen.getByRole('img')).toHaveClass('bg-violet-600');
  });

  it('defaults to a user book avatar', () => {
    render(<Avatar />);
    expect(screen.getByRole('img', { name: 'User avatar' })).toHaveTextContent('📖');
    expect(screen.getByRole('img')).toHaveClass('bg-indigo-500');
  });
});

describe('app state wiring', () => {
  it('uses actual guest links and preserves identity across remount and logout', async () => {
    const user = userEvent.setup();
    const view = mount(<App />);
    await user.click(screen.getByRole('link', { name: 'Login to WriteSpace' }));
    await user.click(screen.getByRole('link', { name: 'Register', exact: true }));
    await fillRegistration(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('button', { name: /Writer.*Account options/ })).toBeInTheDocument();
    const current = getSession();
    view.unmount();
    mount(<App />);
    expect(getSession()).toEqual(current);
    await user.click(screen.getByRole('button', { name: /Account options/ }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(getSession()).toBeNull();
    expect(screen.getByRole('link', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('revalidates storage and focus events without retaining stale identity', () => {
    login('admin', 'admin');
    mount(<App />);
    localStorage.removeItem('writespace_session');
    act(() => window.dispatchEvent(new Event('storage')));
    expect(screen.queryByRole('button', { name: /Account options/ })).not.toBeInTheDocument();
    login('admin', 'admin');
    act(() => window.dispatchEvent(new Event('focus')));
    expect(screen.getByRole('button', { name: /Account options/ })).toBeInTheDocument();
  });

  it('returns unknown routes to the temporary root without fake destination pages', () => {
    mount(<App />, '/unknown');
    expect(screen.getByLabelText('Current route').textContent).toBe('/');
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Login to WriteSpace' })).toBeInTheDocument();
  });
});
