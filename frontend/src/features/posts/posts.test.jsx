/** Verify post screens using real services, browser storage and route navigation. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { login, saveUsers } from '../identity/auth.js';
import BlogList from './BlogList.jsx';
import BlogReader from './BlogReader.jsx';
import PostEditor from './PostEditor.jsx';
import { getPosts, POSTS_KEY, savePosts } from './storage.js';
import App from '../../App.jsx';

const account = { id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo', role: 'user', createdAt: '2025-01-01' };
const post = { id: 'one', title: 'First post', content: 'Line one\n\n  Line two', createdAt: '2025-01-01',
  authorId: 'writer', authorName: 'Writer', authorRole: 'user' };
let session;

beforeEach(() => {
  saveUsers([account, { ...account, id: 'other', username: 'other' }]);
  session = login('writer', 'demo');
  savePosts([post]);
});

/** Render the actual three post routes with a supplied app session. */
function renderPosts(path, current = session) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/blogs" element={<BlogList session={current} />} />
        <Route path="/blog/:id" element={<BlogReader session={current} />} />
        <Route path="/write" element={<PostEditor session={current} />} />
        <Route path="/edit/:id" element={<PostEditor session={current} mode="edit" />} />
        <Route path="/edit" element={<PostEditor session={current} mode="edit" />} />
      </Routes>
    </MemoryRouter>,
  );
}

it('lists newest first with 120-character excerpts, role avatars and owner-only card edit links', async () => {
  savePosts([post, { ...post, id: 'two', title: 'Latest', content: 'x'.repeat(130), createdAt: '2025-02-02', authorId: 'other' }]);
  const user = userEvent.setup();
  renderPosts('/blogs');
  const cards = screen.getAllByRole('article');
  expect(within(cards[0]).getByRole('heading')).toHaveTextContent('Latest');
  expect(within(cards[0]).getByText('x'.repeat(120))).toBeInTheDocument();
  expect(within(cards[0]).getByText('Feb 02, 2025')).toBeInTheDocument();
  expect(within(cards[0]).queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
  expect(within(cards[1]).getByRole('link', { name: 'Edit First post' })).toHaveAttribute('href', '/edit/one');
  expect(screen.getAllByRole('img', { name: 'User avatar' })).toHaveLength(2);
  await user.click(within(cards[0]).getByRole('link'));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Latest');
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
});

it.each(['empty', 'corrupt', 'unavailable'])('shows a Write invitation for %s lists without changing storage', async kind => {
  if (kind === 'empty') savePosts([]);
  if (kind === 'corrupt') localStorage.setItem(POSTS_KEY, '{bad');
  const before = localStorage.getItem(POSTS_KEY);
  if (kind === 'unavailable') {
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === POSTS_KEY) throw new Error('blocked');
      return read.call(this, key);
    });
  }
  renderPosts('/blogs');
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
  if (kind !== 'unavailable') expect(localStorage.getItem(POSTS_KEY)).toBe(before);
});

it('lets admins edit every list card', () => {
  renderPosts('/blogs', login('admin', 'admin'));
  expect(screen.getByRole('link', { name: 'Edit First post' })).toBeInTheDocument();
});

it('renders literal XSS title/content as full text with preserved whitespace and historical admin avatar', () => {
  const content = '<img src=x onerror=alert(1)>\n\n  spaced';
  savePosts([{ ...post, title: '<script>alert(1)</script>', content, authorId: 'removed', authorRole: 'admin' }]);
  const { container } = renderPosts('/blog/one');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('<script>alert(1)</script>');
  const body = container.querySelector('p.whitespace-pre-wrap');
  expect(body.textContent).toBe(content);
  expect(container.querySelector('script, img')).toBeNull();
  expect(screen.getByRole('img', { name: 'Admin avatar' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to All Posts' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit', exact: true })).not.toBeInTheDocument();
});

it.each(['/blog/missing', '/edit/missing', '/edit'])('shows missing post with a working Back link at %s', async path => {
  const user = userEvent.setup();
  renderPosts(path);
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Back to All Posts' }));
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
});

it('keeps reader and stored records unchanged on canceled confirmation then deletes on confirmation', async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderPosts('/blog/one');
  const before = localStorage.getItem(POSTS_KEY);
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('heading', { name: post.title })).toBeInTheDocument();
  expect(localStorage.getItem(POSTS_KEY)).toBe(before);
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeInTheDocument();
  expect(getPosts()).toEqual([]);
});

it('supports administrator reader moderation and built-in author avatar', async () => {
  savePosts([post, { ...post, id: 'admin-post', authorId: 'admin', authorName: 'Admin' }]);
  const user = userEvent.setup();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderPosts('/blog/one', login('admin', 'admin'));
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(getPosts()).toEqual([{ ...post, id: 'admin-post', authorId: 'admin', authorName: 'Admin' }]);
  expect(screen.getByRole('img', { name: 'Admin avatar' })).toBeInTheDocument();
});

it.each(['write', 'stale', 'missing'])('surfaces reader delete %s errors without false navigation or data loss', async kind => {
  const user = userEvent.setup();
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    if (kind === 'stale') localStorage.removeItem('writespace_session');
    if (kind === 'missing') savePosts([]);
    return true;
  });
  renderPosts('/blog/one');
  const before = localStorage.getItem(POSTS_KEY);
  if (kind === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  if (kind === 'missing') {
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to All Posts' })).toBeInTheDocument();
  } else {
    expect(screen.getByRole('alert')).toHaveTextContent(kind === 'write' ? 'Cannot save local posts' : 'Please log in again');
  }
  expect(localStorage.getItem(POSTS_KEY)).toBe(kind === 'missing' ? '[]' : before);
  expect(screen.queryByRole('heading', { name: 'All Blogs' })).not.toBeInTheDocument();
});

it.each(['other', 'stale', 'guest'])('redirects %s unauthorized editing to blogs', kind => {
  if (kind === 'other') session = login('other', 'demo');
  if (kind === 'stale') saveUsers([]);
  if (kind === 'guest') session = null;
  renderPosts('/edit/one');
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(getPosts()).toEqual([post]);
});

it('creates through the form with associated required errors, live counter and reader navigation', async () => {
  const user = userEvent.setup();
  renderPosts('/write');
  expect(screen.getByLabelText('Content')).toHaveClass('min-h-64');
  expect(screen.getByText('0 characters')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  for (const field of ['Title', 'Content']) {
    expect(screen.getByLabelText(field)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(`${field} is required.`)).toHaveAttribute('role', 'alert');
  }
  expect(getPosts()).toEqual([post]);
  await user.type(screen.getByLabelText('Title'), ' New publication ');
  await user.type(screen.getByLabelText('Content'), 'New text');
  expect(screen.getByText('8 characters')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('heading', { name: 'New publication' })).toBeInTheDocument();
  expect(getPosts()[1]).toMatchObject({ title: 'New publication', content: 'New text', authorId: 'writer', authorName: 'Writer' });
});

it.each(['create', 'edit'])('cancels %s without saving changed form fields', async mode => {
  const user = userEvent.setup();
  renderPosts(mode === 'edit' ? '/edit/one' : '/write');
  if (mode === 'edit') {
    expect(screen.getByLabelText('Title')).toHaveValue(post.title);
    expect(screen.getByLabelText('Content')).toHaveValue(post.content);
  }
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'Unsaved');
  const before = localStorage.getItem(POSTS_KEY);
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(localStorage.getItem(POSTS_KEY)).toBe(before);
  expect(screen.getByRole('heading', { name: mode === 'edit' ? post.title : 'All Blogs' })).toBeInTheDocument();
});

it('prefills and saves admin edits without changing original attribution or date', async () => {
  const user = userEvent.setup();
  renderPosts('/edit/one', login('admin', 'admin'));
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'Moderated');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(getPosts()).toEqual([{ ...post, title: 'Moderated' }]);
  expect(screen.getByRole('heading', { name: 'Moderated' })).toBeInTheDocument();
});

it.each(['create', 'edit'])('shows blank field errors on %s without saving', async mode => {
  const user = userEvent.setup();
  renderPosts(mode === 'edit' ? '/edit/one' : '/write');
  for (const field of ['Title', 'Content']) {
    await user.clear(screen.getByLabelText(field));
    await user.type(screen.getByLabelText(field), '   ');
  }
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(getPosts()).toEqual([post]);
});

it.each(['write', 'uuid', 'stale', 'corrupt'])('retains entered creation text on %s failures', async kind => {
  const user = userEvent.setup();
  renderPosts('/write');
  await user.type(screen.getByLabelText('Title'), 'New title');
  await user.type(screen.getByLabelText('Content'), 'New text');
  if (kind === 'corrupt') localStorage.setItem(POSTS_KEY, '{bad');
  if (kind === 'stale') localStorage.removeItem('writespace_session');
  const before = localStorage.getItem(POSTS_KEY);
  if (kind === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  if (kind === 'uuid') vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('alert')).toHaveTextContent(kind === 'write' ? 'Cannot save local posts' :
    kind === 'uuid' ? 'Cannot create a post ID' : kind === 'stale' ? 'Please log in again' : 'Cannot read local posts');
  expect(screen.getByLabelText('Title')).toHaveValue('New title');
  expect(screen.getByLabelText('Content')).toHaveValue('New text');
  expect(localStorage.getItem(POSTS_KEY)).toBe(before);
});

it('keeps edited text and original post on write failure', async () => {
  const user = userEvent.setup();
  renderPosts('/edit/one');
  await user.type(screen.getByLabelText('Title'), ' changed');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Cannot save local posts');
  expect(screen.getByLabelText('Title')).toHaveValue('First post changed');
  expect(getPosts()).toEqual([post]);
});

it('wires App content routes and guards guests without another router', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/blogs']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('link', { name: 'Edit First post' }));
  expect(screen.getByRole('heading', { name: 'Edit Post' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(screen.getByRole('heading', { name: post.title })).toBeInTheDocument();
});

it.each(['/blogs', '/blog/one', '/write', '/edit/one'])('guards guest App route %s', path => {
  localStorage.removeItem('writespace_session');
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: 'Login', exact: true })).toBeInTheDocument();
  expect(getPosts()).toEqual([post]);
});
