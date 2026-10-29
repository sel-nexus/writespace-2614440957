/** Exercise real localStorage state, validation, recovery, ordering, and write failures. */
import { describe, expect, it, vi } from 'vitest';
import {
  formatPostDate, getPosts, isValidPost, isValidPostDate, POSTS_KEY, readPostsForWrite, savePosts, sortPostsLatest,
} from './storage.js';

const post = { id: 'post-1', title: 'Morning pages', content: 'A little space to think.',
  createdAt: '2025-01-02T12:00:00.000Z', authorId: 'writer-1', authorName: 'Mira' };

const corrupt = ['{broken', 'null', '{}', '"posts"', '[null]', JSON.stringify([{ ...post, content: '' }]),
  JSON.stringify([post, post]), JSON.stringify([post, { ...post, id: 'bad', authorId: null }])];

describe('post storage', () => {
  it('reads absent and explicitly empty collections without creating seed data', () => {
    expect(getPosts()).toEqual([]);
    expect(readPostsForWrite()).toEqual([]);
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
    localStorage.setItem(POSTS_KEY, '[]');
    expect(getPosts()).toEqual([]);
  });

  it('persists, reads, replaces, and clears valid posts with historical attribution', () => {
    savePosts([post]);
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([post]);
    expect(getPosts()).toEqual([post]);
    savePosts([{ ...post, title: 'Edited' }]);
    expect(getPosts()[0].title).toBe('Edited');
    savePosts([]);
    expect(getPosts()).toEqual([]);
  });

  it.each(corrupt)('recovers visibly but refuses destructive writes over %s', raw => {
    localStorage.setItem(POSTS_KEY, raw);
    expect(getPosts()).toEqual([]);
    expect(() => readPostsForWrite()).toThrow('Cannot read local posts');
    expect(() => savePosts([post])).toThrow('Cannot read local posts');
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });

  it('returns empty on read failure and refuses a later write without changing state', () => {
    localStorage.setItem(POSTS_KEY, JSON.stringify([post]));
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    expect(getPosts()).toEqual([]);
    expect(() => savePosts([])).toThrow('Cannot read local posts');
    read.mockRestore();
    expect(getPosts()).toEqual([post]);
  });

  it('throws on write failure and leaves previous posts intact', () => {
    localStorage.setItem(POSTS_KEY, JSON.stringify([post]));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    expect(() => savePosts([])).toThrow('Cannot save local posts');
    expect(getPosts()).toEqual([post]);
  });

  it.each([null, {}, [post, post], [{ ...post, title: ' ' }], [{ ...post, createdAt: 'bad' }]])(
    'rejects invalid replacement %j without changing the stored collection', value => {
      localStorage.setItem(POSTS_KEY, JSON.stringify([post]));
      expect(() => savePosts(value)).toThrow('Cannot save invalid');
      expect(getPosts()).toEqual([post]);
    },
  );
});

describe('post record and date validation', () => {
  it('accepts valid required fields and optional historical roles', () => {
    expect(isValidPost(post)).toBe(true);
    expect(isValidPost({ ...post, authorId: 'admin', authorRole: 'admin' })).toBe(true);
  });

  it.each(['id', 'title', 'content', 'createdAt', 'authorId', 'authorName'])(
    'rejects missing, non-string, and blank %s', field => {
      for (const value of [undefined, null, 7, ' ']) expect(isValidPost({ ...post, [field]: value })).toBe(false);
    },
  );

  it('rejects arrays, padded IDs, invalid roles, and impossible dates', () => {
    expect(isValidPost(null)).toBe(false);
    expect(isValidPost([])).toBe(false);
    expect(isValidPost({ ...post, id: ' padded ' })).toBe(false);
    expect(isValidPost({ ...post, authorId: ' padded ' })).toBe(false);
    expect(isValidPost({ ...post, authorRole: 'owner' })).toBe(false);
    expect(isValidPost({ ...post, createdAt: '2025-02-30' })).toBe(false);
  });

  it.each(['2024-02-29', '2025-01-02T00:00:00Z', '2025-01-02T01:00:00+01:00'])(
    'accepts an ISO publication date %s', value => expect(isValidPostDate(value)).toBe(true),
  );

  it.each([null, 0, '', 'bad', '2025-02-29', '2025-13-01', '2025-01-02T25:00:00Z'])(
    'returns an explicit fallback for invalid date %s', value => {
      expect(isValidPostDate(value)).toBe(false);
      expect(formatPostDate(value)).toBe('Unknown date');
    },
  );

  it('formats padded days in English and UTC rather than the browser timezone', () => {
    expect(formatPostDate(post.createdAt)).toBe('Jan 02, 2025');
    expect(formatPostDate('2025-01-01T23:00:00-02:00')).toBe('Jan 02, 2025');
  });
});

describe('latest ordering', () => {
  it('orders by timestamp, handles offsets and ties, and leaves the original untouched', () => {
    const tied = { ...post, id: 'tied' };
    const newest = { ...post, id: 'newest', createdAt: '2025-01-02T11:30:00-02:00' };
    const old = { ...post, id: 'old', createdAt: '2024-12-31' };
    const input = [old, post, newest, tied];
    expect(sortPostsLatest(input).map(item => item.id)).toEqual(['newest', 'post-1', 'tied', 'old']);
    expect(input.map(item => item.id)).toEqual(['old', 'post-1', 'newest', 'tied']);
  });

  it.each([[], null, {}, [{ ...post, createdAt: 'bad' }]])('degrades invalid or empty input %j to []', value => {
    expect(sortPostsLatest(value)).toEqual([]);
  });
});
