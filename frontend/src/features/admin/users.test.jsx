/** Exercise the real account service through accessible React controls and browser storage. */
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Users from './Users.jsx';
import { UserRow } from './UserRow.jsx';
import App from '../../App.jsx';
import { login, saveUsers } from '../identity/auth.js';

const writer = { id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo', role: 'user', createdAt: '2025-01-02' };
const admin = { ...writer, id: 'manager', username: 'manager', displayName: 'Manager', role: 'admin' };

/** Read actual storage rather than mocking a repository. */
function stored() {
  return JSON.parse(localStorage.getItem('writespace_users') ?? '[]');
}

/** Render the management route with observable redirect destinations. */
function mount() {
  return render(
    <MemoryRouter initialEntries={['/users']}>
      <Routes>
        <Route path="/users" element={
          <Users />
        } />
        <Route path="/login" element={
          <h1>
            Login destination
          </h1>
        } />
        <Route path="/blogs" element={
          <h1>
            Blogs destination
          </h1>
        } />
      </Routes>
    </MemoryRouter>,
  );
}

/** Enter valid account fields with real user interactions. */
async function fill(user, role = 'user', username = 'new-writer') {
  await user.type(screen.getByLabelText('Display Name'), ' New Writer ');
  await user.type(screen.getByLabelText('Username', { exact: true }), username);
  await user.type(screen.getByLabelText('Password', { exact: true }), ' demo ');
  await user.selectOptions(screen.getByLabelText('Role', { exact: true }), role);
}

beforeEach(() => {
  saveUsers([writer, admin]);
  login('admin', 'admin');
});

it('shows all accounts, desktop table/mobile cards, role avatars, badges, dates and safety notice', () => {
  mount();
  expect(screen.getByRole('heading', { name: 'All accounts (3)' })).toBeInTheDocument();
  const table = screen.getByRole('table');
  expect(table.parentElement).toHaveClass('hidden', 'sm:block');
  const card = screen.getByRole('article', { name: 'Account writer' });
  expect(card.parentElement).toHaveClass('sm:hidden');
  expect(within(card).getByRole('img', { name: 'User avatar' })).toBeInTheDocument();
  expect(within(card).getByText('User')).toHaveClass('bg-indigo-100');
  const manager = screen.getByRole('article', { name: 'Account manager' });
  expect(within(manager).getByRole('img', { name: 'Admin avatar' })).toBeInTheDocument();
  expect(within(manager).getByText('Admin')).toHaveClass('bg-violet-100');
  expect(within(card).getByText('Jan 02, 2025')).toBeInTheDocument();
  expect(screen.getByText(/passwords are stored in plaintext/)).toBeInTheDocument();
  expect(table).not.toHaveTextContent('demo');
  screen.getAllByRole('button', { name: 'Delete admin' }).forEach(button => {
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Default admin cannot be deleted.');
  });
});

it.each(['admin', 'user'])('creates and re-reads a persisted %s with success and cleared form', async role => {
  mount();
  const user = userEvent.setup();
  await fill(user, role);
  await user.click(screen.getByRole('button', { name: 'Create User' }));
  const account = stored()[2];
  expect(account).toMatchObject({ displayName: 'New Writer', username: 'new-writer', password: ' demo ', role });
  expect(account.id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(screen.getByRole('status')).toHaveTextContent('Account new-writer created.');
  expect(screen.getByRole('heading', { name: 'All accounts (4)' })).toBeInTheDocument();
  expect(screen.getByRole('article', { name: 'Account new-writer' })).toHaveTextContent('New Writer');
  expect(screen.getByLabelText('Username', { exact: true })).toHaveValue('');
  expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('');
  expect(JSON.parse(localStorage.getItem('writespace_session')).userId).toBe('admin');
});

it.each(['displayName', 'username', 'password', 'role'])('associates missing %s errors without saving', async field => {
  mount();
  const user = userEvent.setup();
  await fill(user);
  const labels = { displayName: 'Display Name', username: 'Username', password: 'Password', role: 'Role' };
  const input = screen.getByLabelText(labels[field], { exact: true });
  if (field === 'role') await user.selectOptions(input, '');
  else await user.clear(input);
  await user.click(screen.getByRole('button', { name: 'Create User' }));
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAttribute('aria-describedby', `account-${field}-error`);
  expect(document.getElementById(`account-${field}-error`)).toHaveTextContent(`${labels[field]} is required.`);
  expect(stored()).toEqual([writer, admin]);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

it('shows all required errors together and rejects an invalid role', async () => {
  mount();
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('Role'), '');
  await user.click(screen.getByRole('button', { name: 'Create User' }));
  ['Display Name', 'Username', 'Password', 'Role'].forEach(label => {
    expect(screen.getByText(`${label} is required.`)).toBeInTheDocument();
  });
  await fill(user);
  const role = screen.getByLabelText('Role');
  const option = document.createElement('option');
  option.value = 'owner';
  option.textContent = 'Owner';
  role.append(option);
  fireEvent.change(role, { target: { value: 'owner' } });
  await user.click(screen.getByRole('button', { name: 'Create User' }));
  expect(screen.getByText('Choose Admin or User.')).toBeInTheDocument();
  expect(stored()).toEqual([writer, admin]);
});

it.each(['WRITER', ' ADMIN '])('shows field-associated duplicate %s error and retains entered values', async username => {
  mount();
  const user = userEvent.setup();
  await fill(user, 'admin', username);
  await user.click(screen.getByRole('button', { name: 'Create User' }));
  expect(screen.getByLabelText('Username', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Username', { exact: true })).toHaveValue(username);
  expect(document.getElementById('account-username-error')).toHaveTextContent('Username is already taken.');
  expect(stored()).toEqual([writer, admin]);
});

it.each(['uuid', 'write', 'read', 'corrupt'])('reports %s creation failure with no false success or data loss', async mode => {
  mount();
  const user = userEvent.setup();
  await fill(user);
  if (mode === 'uuid') vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('No UUID'); });
  if (mode === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  if (mode === 'read') {
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'writespace_users') throw new Error('Unavailable');
      return original.call(this, key);
    });
  }
  if (mode === 'corrupt') localStorage.setItem('writespace_users', '{');
  await user.click(screen.getByRole('button', { name: 'Create User' }));
  const message = mode === 'uuid' ? 'Cannot create an account ID.' :
    mode === 'write' ? 'Cannot save local accounts.' : 'Cannot read local accounts.';
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(screen.getByLabelText('Username', { exact: true })).toHaveValue('new-writer');
  vi.restoreAllMocks();
  expect(localStorage.getItem('writespace_users')).toBe(mode === 'corrupt' ? '{' : JSON.stringify([writer, admin]));
});

it.each(['corrupt', 'unavailable'])('reports initial %s accounts and can recover on focus', mode => {
  if (mode === 'corrupt') localStorage.setItem('writespace_users', '{}');
  else {
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'writespace_users') throw new Error('Unavailable');
      return original.call(this, key);
    });
  }
  mount();
  expect(screen.getByRole('alert')).toHaveTextContent('Cannot read local accounts.');
  expect(screen.getByRole('heading', { name: 'All accounts (0)' })).toBeInTheDocument();
  vi.restoreAllMocks();
  saveUsers([writer, admin]);
  fireEvent.focus(window);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'All accounts (3)' })).toBeInTheDocument();
});

it('keeps state and storage unchanged on cancel, then deletes persistently and retains posts', async () => {
  mount();
  const user = userEvent.setup();
  const posts = '[{"authorId":"writer","authorName":"Writer"}]';
  localStorage.setItem('writespace_posts', posts);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await user.click(within(screen.getByRole('article', { name: 'Account writer' })).getByRole('button'));
  expect(stored()).toEqual([writer, admin]);
  expect(screen.getByRole('article', { name: 'Account writer' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  confirm.mockReturnValue(true);
  await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Delete writer' }));
  expect(stored()).toEqual([admin]);
  expect(screen.queryByRole('article', { name: 'Account writer' })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Account writer deleted. Historical posts retained.');
  expect(localStorage.getItem('writespace_posts')).toBe(posts);
});

it.each(['write', 'read', 'missing'])('reports %s deletion failures without success', async mode => {
  mount();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  if (mode === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  if (mode === 'read') localStorage.setItem('writespace_users', '{');
  if (mode === 'missing') saveUsers([admin]);
  await userEvent.setup().click(screen.getAllByRole('button', { name: 'Delete writer' })[0]);
  expect(screen.getByRole('alert')).toHaveTextContent(mode === 'write' ? 'Cannot save local accounts.' :
    mode === 'read' ? 'Cannot read local accounts.' : 'Account not found.');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(screen.getByRole('article', { name: 'Account writer' })).toBeInTheDocument();
  expect(localStorage.getItem('writespace_users')).toBe(mode === 'read' ? '{' :
    JSON.stringify(mode === 'missing' ? [admin] : [writer, admin]));
});

it('protects current and default accounts for an additional administrator in both layouts', async () => {
  login('manager', 'demo');
  mount();
  const confirm = vi.spyOn(window, 'confirm');
  for (const username of ['admin', 'manager']) {
    for (const button of screen.getAllByRole('button', { name: `Delete ${username}` })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', username === 'admin' ? 'Default admin cannot be deleted.' :
        'You cannot delete your current account.');
      await userEvent.setup().click(button);
    }
  }
  expect(confirm).not.toHaveBeenCalled();
  expect(stored()).toEqual([writer, admin]);
});

it.each(['guest', 'user', 'stale'])('redirects %s access without showing account management', mode => {
  if (mode === 'guest') localStorage.removeItem('writespace_session');
  if (mode === 'user') login('writer', 'demo');
  if (mode === 'stale') {
    login('manager', 'demo');
    saveUsers([writer, { ...admin, role: 'user' }]);
  }
  mount();
  expect(screen.getByRole('heading', { name: mode === 'user' ? 'Blogs destination' : 'Login destination' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create User' })).not.toBeInTheDocument();
});

it.each(['create', 'delete'])('revalidates a stale session at %s time without saving', async action => {
  login('manager', 'demo');
  mount();
  const user = userEvent.setup();
  await fill(user);
  saveUsers([writer, { ...admin, role: 'user' }]);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  if (action === 'create') await user.click(screen.getByRole('button', { name: 'Create User' }));
  else await user.click(screen.getAllByRole('button', { name: 'Delete writer' })[0]);
  expect(stored()).toEqual([writer, { ...admin, role: 'user' }]);
  expect(screen.getByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
});

it('renders the shared row as a card and invokes deletion only for an eligible account', async () => {
  const onDelete = vi.fn();
  render(
    <UserRow user={writer} currentUserId="admin" onDelete={onDelete} mobile />,
  );
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete writer' }));
  expect(onDelete).toHaveBeenCalledWith(writer);
});

it('wires only the Users route in the real application', () => {
  render(
    <MemoryRouter initialEntries={['/users']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Users', exact: true })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Create User' })).toBeInTheDocument();
});

it('preserves success and unsaved fields when deletion is canceled', async () => {
  mount();
  const user = userEvent.setup();
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Create User' }));
  const before = stored();
  await user.type(screen.getByLabelText('Display Name'), 'Unsaved name');
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  await user.click(screen.getAllByRole('button', { name: 'Delete writer' })[0]);
  expect(stored()).toEqual(before);
  expect(screen.getByLabelText('Display Name')).toHaveValue('Unsaved name');
  expect(screen.getByRole('status')).toHaveTextContent('Account new-writer created.');
});

it('reconciles the account population after a storage event', () => {
  mount();
  saveUsers([writer]);
  fireEvent(window, new Event('storage'));
  expect(screen.getByRole('heading', { name: 'All accounts (2)' })).toBeInTheDocument();
  expect(screen.queryByRole('article', { name: 'Account manager' })).not.toBeInTheDocument();
});

it.each(['create', 'delete'])('does not announce %s success if the post-mutation re-read fails', async action => {
  mount();
  const user = userEvent.setup();
  await fill(user);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const originalGet = Storage.prototype.getItem;
  const originalSet = Storage.prototype.setItem;
  let saved = false;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    originalSet.call(this, key, value);
    saved = true;
  });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    if (saved && key === 'writespace_users') throw new Error('Read unavailable after save');
    return originalGet.call(this, key);
  });
  if (action === 'create') await user.click(screen.getByRole('button', { name: 'Create User' }));
  else await user.click(screen.getAllByRole('button', { name: 'Delete writer' })[0]);
  expect(screen.getByRole('alert')).toHaveTextContent('Cannot read local accounts.');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  vi.restoreAllMocks();
  expect(stored()).toHaveLength(action === 'create' ? 3 : 1);
});

it.each(['guest', 'user'])('the real Users route redirects %s access', mode => {
  if (mode === 'guest') localStorage.removeItem('writespace_session');
  else login('writer', 'demo');
  render(
    <MemoryRouter initialEntries={['/users']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('button', { name: 'Create User' })).not.toBeInTheDocument();
  if (mode === 'guest') expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  else expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeInTheDocument();
  expect(stored()).toEqual([writer, admin]);
});
