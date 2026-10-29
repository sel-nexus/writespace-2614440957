/** Verify dashboard populations and actions against real browser-local services. */
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard.jsx';
import { StatCard } from './StatCard.jsx';
import App from '../../App.jsx';
import { login, saveUsers } from '../identity/auth.js';
import { savePosts } from '../posts/storage.js';

const writer = { id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo', role: 'user', createdAt: '2025-01-01' };
const manager = { ...writer, id: 'manager', username: 'manager', displayName: 'Manager', role: 'admin' };
const posts = Array.from({ length: 7 }, (_, index) => ({
  id: `post-${index + 1}`, title: `Publication ${index + 1}`, content: 'Plain text',
  authorId: 'removed-author', authorName: 'Historical Author', createdAt: `2025-01-0${index + 1}T23:00:00Z`,
}));

/** Read actual publication persistence for state-transition assertions. */
function storedPosts() {
  return JSON.parse(localStorage.getItem('writespace_posts') ?? '[]');
}

/** Mount the overview with observable routing destinations, not mocked services. */
function mount() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={
          <Dashboard />
        } />
        {['login', 'blogs', 'write', 'users', 'edit/:id'].map(path => (
          <Route key={path} path={`/${path}`} element={
            <h1>
              {path} destination
            </h1>
          } />
        ))}
      </Routes>
    </MemoryRouter>,
  );
}

/** Assert the visible number in the precisely named statistic. */
function count(label, value) {
  expect(within(screen.getByRole('region', { name: label, exact: true })).getByText(String(value), { exact: true }))
    .toBeInTheDocument();
}

beforeEach(() => {
  saveUsers([writer, manager]);
  login('admin', 'admin');
  savePosts(posts);
});

it('uses exact labels and distinct explained populations, including the built-in admin without a creation date', () => {
  mount();
  count('Total Posts', 7);
  count('Total Users', 3);
  count('Total Admins', 2);
  count('Total users', 1);
  expect(screen.getByRole('region', { name: 'Total Users', exact: true }))
    .toHaveAccessibleDescription('All accounts, including the built-in admin.');
  expect(screen.getByRole('region', { name: 'Total users', exact: true }))
    .toHaveAccessibleDescription('Non-admin writer accounts only.');
  expect(screen.getByRole('region', { name: 'Total Admins' }))
    .toHaveAccessibleDescription('Admin accounts, including the built-in admin.');
  expect(screen.queryByText('Unknown date')).not.toBeInTheDocument();
});

it.each([0, 1, 5, 6, 7])('shows newest-first recent posts capped at five from %s publications, with dates and inline actions', size => {
  savePosts(posts.slice(0, size));
  mount();
  count('Total Posts', size);
  const recent = screen.getByRole('region', { name: 'Recent Posts' });
  const items = within(recent).queryAllByRole('listitem');
  expect(items).toHaveLength(Math.min(size, 5));
  items.forEach((item, index) => {
    const number = size - index;
    expect(item).toHaveTextContent(`Publication ${number}`);
    expect(item).toHaveTextContent(`Historical Author · Jan 0${number}, 2025`);
    expect(within(item).getByRole('link', { name: `Edit Publication ${number}` })).toHaveAttribute('href', `/edit/post-${number}`);
    expect(within(item).getByRole('button', { name: `Delete Publication ${number}` })).toHaveTextContent('Delete');
  });
});

it.each(['Write New Post', 'Manage Users', 'Edit Publication 7'])('follows the %s link', async label => {
  mount();
  const destination = label === 'Write New Post' ? 'write' : label === 'Manage Users' ? 'users' : 'edit/:id';
  await userEvent.setup().click(screen.getByRole('link', { name: label }));
  expect(screen.getByRole('heading', { name: `${destination} destination` })).toBeInTheDocument();
  expect(storedPosts()).toEqual(posts);
});

it('cancels without changing state, then persists deletion and replenishes recent five with re-read populations', async () => {
  mount();
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await user.click(screen.getByRole('button', { name: 'Delete Publication 7' }));
  expect(confirm).toHaveBeenCalledWith('Delete "Publication 7"? This cannot be undone.');
  expect(storedPosts()).toEqual(posts);
  count('Total Posts', 7);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  saveUsers([writer]);
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Delete Publication 7' }));
  expect(storedPosts()).toEqual(posts.slice(0, 6));
  count('Total Posts', 6);
  count('Total Users', 2);
  count('Total Admins', 1);
  count('Total users', 1);
  expect(screen.queryByRole('button', { name: 'Delete Publication 7' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete Publication 2' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Post "Publication 7" deleted.');
  await user.click(screen.getByRole('button', { name: 'Delete Publication 6' }));
  confirm.mockReturnValue(false);
  await user.click(screen.getByRole('button', { name: 'Delete Publication 5' }));
  expect(screen.getByRole('status')).toHaveTextContent('Post "Publication 6" deleted.');
  expect(storedPosts()).toEqual(posts.slice(0, 5));
});

it('shows default-only counts and an empty state, including after deleting the last post', async () => {
  saveUsers([]);
  savePosts([posts[0]]);
  mount();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Publication 1' }));
  count('Total Posts', 0);
  count('Total Users', 1);
  count('Total Admins', 1);
  count('Total users', 0);
  expect(screen.getByText('No posts yet. Use Write New Post to publish your first post.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  expect(storedPosts()).toEqual([]);
});

it.each(['writespace_users', 'writespace_posts'])('does not fabricate zero counts for corrupt %s and recovers on retry', async key => {
  const original = localStorage.getItem(key);
  localStorage.setItem(key, '[{}]');
  mount();
  expect(screen.getByRole('alert')).toHaveTextContent(key === 'writespace_users' ? 'Cannot read local accounts.' : 'Cannot read local posts.');
  expect(screen.queryByRole('region', { name: 'Total Posts' })).not.toBeInTheDocument();
  expect(localStorage.getItem(key)).toBe('[{}]');
  localStorage.setItem(key, original);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry overview' }));
  count('Total Posts', 7);
  count('Total Users', 3);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it.each(['writespace_users', 'writespace_posts'])('reports unavailable %s, keeps quick links and recovers on focus', key => {
  const original = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (name) {
    if (name === key) throw new Error('Blocked');
    return original.call(this, name);
  });
  mount();
  expect(screen.getByRole('alert')).toHaveTextContent('Enable browser storage');
  expect(screen.getByRole('link', { name: 'Write New Post' })).toHaveAttribute('href', '/write');
  expect(screen.getByRole('link', { name: 'Manage Users' })).toHaveAttribute('href', '/users');
  vi.restoreAllMocks();
  fireEvent.focus(window);
  count('Total Posts', 7);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it.each(['write', 'corrupt', 'missing', 'accounts'])('reports %s deletion failure without false success and recovers with retry', async mode => {
  mount();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  if (mode === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  if (mode === 'corrupt') localStorage.setItem('writespace_posts', '{');
  if (mode === 'missing') savePosts(posts.slice(0, 6));
  if (mode === 'accounts') localStorage.setItem('writespace_users', '{');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Publication 7' }));
  const message = { write: 'Cannot save local posts.', corrupt: 'Cannot read local posts.',
    missing: 'Post not found.', accounts: 'Cannot read local accounts.' }[mode];
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  vi.restoreAllMocks();
  expect(localStorage.getItem('writespace_posts')).toBe(mode === 'corrupt' ? '{' :
    JSON.stringify(['missing', 'accounts'].includes(mode) ? posts.slice(0, 6) : posts));
  localStorage.setItem('writespace_posts', JSON.stringify(posts.slice(0, 6)));
  saveUsers([writer, manager]);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry overview' }));
  count('Total Posts', 6);
});

it('does not announce success when post-deletion re-read fails, and retry reflects the persisted deletion', async () => {
  mount();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const originalSet = Storage.prototype.setItem;
  const originalGet = Storage.prototype.getItem;
  let saved = false;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    originalSet.call(this, key, value);
    saved = true;
  });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    if (saved && key === 'writespace_posts') throw new Error('Unavailable after write');
    return originalGet.call(this, key);
  });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Publication 7' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Cannot read local posts.');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  vi.restoreAllMocks();
  expect(storedPosts()).toEqual(posts.slice(0, 6));
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry overview' }));
  count('Total Posts', 6);
});

it.each(['guest', 'user', 'stale'])('redirects %s identity without exposing overview or mutation', mode => {
  if (mode === 'guest') localStorage.removeItem('writespace_session');
  if (mode === 'user') login('writer', 'demo');
  if (mode === 'stale') {
    login('manager', 'demo');
    saveUsers([writer]);
  }
  mount();
  expect(screen.getByRole('heading', { name: `${mode === 'user' ? 'blogs' : 'login'} destination` })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Total Users', exact: true })).not.toBeInTheDocument();
  expect(storedPosts()).toEqual(posts);
});

it.each(['before', 'during'])('revalidates admin identity %s confirmation even if the new writer owns the post', async timing => {
  savePosts([{ ...posts[6], authorId: writer.id }]);
  mount();
  const confirm = vi.spyOn(window, 'confirm').mockImplementation(() => {
    if (timing === 'during') login('writer', 'demo');
    return true;
  });
  if (timing === 'before') login('writer', 'demo');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Publication 7' }));
  expect(storedPosts()).toEqual([{ ...posts[6], authorId: writer.id }]);
  expect(screen.getByRole('heading', { name: 'blogs destination' })).toBeInTheDocument();
  if (timing === 'before') expect(confirm).not.toHaveBeenCalled();
});

it('reconciles posts and accounts on storage events and removes listeners on unmount', () => {
  const view = mount();
  saveUsers([writer]);
  savePosts(posts.slice(0, 2));
  fireEvent(window, new Event('storage'));
  count('Total Posts', 2);
  count('Total Users', 2);
  const remove = vi.spyOn(window, 'removeEventListener');
  view.unmount();
  expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
  expect(remove).toHaveBeenCalledWith('focus', expect.any(Function));
});

it('renders a zero StatCard with its default accent and accessible explanation', () => {
  render(
    <StatCard id="empty-count" label="Empty count" count={0} description="Verified empty population." />,
  );
  const card = screen.getByRole('region', { name: 'Empty count' });
  expect(card).toHaveAccessibleDescription('Verified empty population.');
  expect(card).toHaveClass('border-t-indigo-500');
  expect(within(card).getByText('0')).toHaveClass('tabular-nums');
});

it.each(['admin', 'guest', 'user'])('wires the real protected /admin route for %s', mode => {
  if (mode === 'guest') localStorage.removeItem('writespace_session');
  if (mode === 'user') login('writer', 'demo');
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <App />
    </MemoryRouter>,
  );
  if (mode === 'admin') count('Total Posts', 7);
  else {
    expect(screen.queryByRole('heading', { name: 'Dashboard', exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole(mode === 'guest' ? 'button' : 'heading', { name: mode === 'guest' ? 'Login' : 'All Blogs' }))
      .toBeInTheDocument();
  }
});
