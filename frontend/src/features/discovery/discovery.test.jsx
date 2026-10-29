/** Verify discovery presentation and shared post cards using real storage and accessible queries. */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Landing from './Landing.jsx';
import { BlogCard } from '../posts/BlogCard.jsx';
import { POSTS_KEY } from '../posts/storage.js';

const post = { id: 'post-1', title: 'Morning pages', content: 'A little space to think.',
  createdAt: '2025-01-02T12:00:00Z', authorId: 'writer-1', authorName: 'Mira' };
const session = { userId: 'writer-1', role: 'user' };

/** Render one component with real navigation destinations for click assertions. */
function renderPage(element) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={element} />
        <Route path="/login" element={<h1>Login destination</h1>} />
        <Route path="/register" element={<h1>Registration destination</h1>} />
        <Route path="/blogs" element={<h1>Blogs destination</h1>} />
        <Route path="/blog/:id" element={<h1>Post destination</h1>} />
        <Route path="/edit/:id" element={<h1>Edit destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Landing', () => {
  it('shows required public content, footer links/year, and no invented persisted posts', () => {
    renderPage(<Landing />);
    expect(screen.getByRole('heading', { name: 'WriteSpace', level: 1 })).toBeVisible();
    expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
    for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
      expect(screen.getByRole('heading', { name })).toBeVisible();
    }
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
    const footer = within(screen.getByRole('navigation', { name: 'Footer' }));
    for (const [name, href] of [['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']]) {
      expect(footer.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(screen.getByText(`© ${new Date().getFullYear()} WriteSpace`)).toBeVisible();
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });

  it('takes guests to login through Start Reading', async () => {
    const user = userEvent.setup();
    renderPage(<Landing />);
    await user.click(screen.getByRole('link', { name: 'Start Reading' }));
    expect(screen.getByRole('heading', { name: 'Login destination' })).toBeVisible();
  });

  it.each(['user', 'admin'])('takes a signed-in %s to all blogs', async role => {
    const user = userEvent.setup();
    renderPage(<Landing session={{ ...session, role }} />);
    await user.click(screen.getByRole('link', { name: 'Start Reading' }));
    expect(screen.getByRole('heading', { name: 'Blogs destination' })).toBeVisible();
  });

  it('offers free registration through a real link', async () => {
    const user = userEvent.setup();
    renderPage(<Landing />);
    await user.click(screen.getByRole('link', { name: 'Get Started Free' }));
    expect(screen.getByRole('heading', { name: 'Registration destination' })).toBeVisible();
  });

  it('caps the latest section at three newest posts and uses a real hero BlogCard', () => {
    const posts = [1, 4, 2, 3].map(day => ({ ...post, id: `p${day}`, title: `Story ${day}`, createdAt: `2025-01-0${day}` }));
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
    renderPage(<Landing />);
    const latest = within(screen.getByRole('region', { name: 'Latest from the Blog' }));
    expect(latest.getAllByRole('heading', { level: 3 }).map(item => item.textContent)).toEqual(['Story 4', 'Story 3', 'Story 2']);
    expect(latest.getAllByRole('article')).toHaveLength(3);
    expect(screen.queryByText('Story 1')).not.toBeInTheDocument();
    const preview = screen.getByRole('complementary', { name: 'Blog preview' });
    expect(within(preview).getByRole('heading', { name: 'Story 4' })).toBeVisible();
    expect(preview.firstElementChild).toHaveClass('motion-safe:animate-float');
  });

  it.each(['{broken', '{}', '[null]'])('shows a graceful empty state for corrupt storage %s', raw => {
    localStorage.setItem(POSTS_KEY, raw);
    renderPage(<Landing />);
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });

  it('shows an empty public page when storage reads fail', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    renderPage(<Landing />);
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
  });

  it('refreshes relevant storage/focus changes, ignores unrelated storage, and removes listeners on unmount', () => {
    const { unmount } = renderPage(<Landing />);
    localStorage.setItem(POSTS_KEY, JSON.stringify([post]));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' })));
    expect(screen.queryByText(post.title)).not.toBeInTheDocument();
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: POSTS_KEY })));
    expect(screen.getAllByText(post.title)).toHaveLength(2);
    localStorage.setItem(POSTS_KEY, '[]');
    act(() => window.dispatchEvent(new Event('focus')));
    expect(screen.queryByText(post.title)).not.toBeInTheDocument();
    localStorage.setItem(POSTS_KEY, JSON.stringify([post]));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
    expect(screen.getAllByText(post.title)).toHaveLength(2);
    unmount();
    const read = vi.spyOn(Storage.prototype, 'getItem');
    act(() => window.dispatchEvent(new Event('focus')));
    expect(read).not.toHaveBeenCalled();
  });
});

describe('BlogCard', () => {
  it('shows author/avatar/date and exactly the first 120 content characters', async () => {
    const user = userEvent.setup();
    const content = 'x'.repeat(120) + 'HIDDEN';
    renderPage(<BlogCard post={{ ...post, content }} />);
    expect(screen.getByText('x'.repeat(120))).toBeVisible();
    expect(screen.queryByText(/HIDDEN/)).not.toBeInTheDocument();
    expect(screen.getByText('Jan 02, 2025')).toHaveAttribute('dateTime', post.createdAt);
    expect(screen.getByText('Mira')).toBeVisible();
    expect(screen.getByRole('img', { name: 'User avatar' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: /Morning pages/ }));
    expect(screen.getByRole('heading', { name: 'Post destination' })).toBeVisible();
  });

  it.each([null, { userId: 'other', role: 'user' }])('hides editing for a guest or non-owner %j', identity => {
    renderPage(<BlogCard post={post} session={identity} />);
    expect(screen.queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
  });

  it.each([session, { userId: 'admin', role: 'admin' }])('offers separate editing to an owner/admin %j', async identity => {
    const user = userEvent.setup();
    const { container } = renderPage(<BlogCard post={post} session={identity} />);
    expect(container.querySelector('a a')).toBeNull();
    await user.click(screen.getByRole('link', { name: 'Edit Morning pages' }));
    expect(screen.getByRole('heading', { name: 'Edit destination' })).toBeVisible();
  });

  it('shows the built-in admin avatar without needing a stored account', () => {
    renderPage(<BlogCard post={{ ...post, authorId: 'admin', authorName: 'Admin' }} />);
    expect(screen.getByRole('img', { name: 'Admin avatar' })).toBeVisible();
  });

  it('resolves a created admin role and retains historical attribution when that account disappears', () => {
    localStorage.setItem('writespace_users', JSON.stringify([{ id: post.authorId, displayName: 'Mira', username: 'mira',
      password: 'demo', role: 'admin', createdAt: post.createdAt }]));
    const { rerender } = renderPage(<BlogCard post={post} />);
    expect(screen.getByRole('img', { name: 'Admin avatar' })).toBeVisible();
    localStorage.removeItem('writespace_users');
    rerender(
      <MemoryRouter>
        <BlogCard post={{ ...post, authorRole: 'admin' }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('img', { name: 'Admin avatar' })).toBeVisible();
    expect(screen.getByText('Mira')).toBeVisible();
  });

  it('renders malicious title/content/author as literal text, not executable markup', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const { container } = renderPage(<BlogCard post={{ ...post, title: payload, content: payload, authorName: payload }} />);
    expect(screen.getAllByText(payload)).toHaveLength(3);
    expect(container.querySelector('img, script')).toBeNull();
  });

  it('escapes path IDs and cycles all four border accents', () => {
    const { container } = renderPage(
      <div>
        {[0, 1, 2, 3, 4].map(index => (
          <BlogCard key={index} post={{ ...post, id: 'a/b' }} index={index} />
        ))}
      </div>,
    );
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/blog/a%2Fb');
    const cards = container.querySelectorAll('article');
    ['indigo-600', 'violet-600', 'pink-500', 'teal-500', 'indigo-600'].forEach((accent, index) => {
      expect(cards[index]).toHaveClass(`border-t-${accent}`);
    });
  });

  it('omits invalid records rather than crashing the page', () => {
    renderPage(<BlogCard post={{ ...post, content: '' }} />);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
