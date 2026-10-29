/** Exercise real identity and post storage across successful and rejected mutations. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, saveUsers } from '../identity/auth.js';
import { canManagePost, createPost, deletePost, getPost, updatePost } from './postService.js';
import { getPosts, POSTS_KEY, savePosts } from './storage.js';

const user = { id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo', role: 'user', createdAt: '2025-01-01' };
const other = { ...user, id: 'other', username: 'other', displayName: 'Other' };
const original = {
  id: 'post', title: 'Original', content: 'First line\n\n  Second line', createdAt: '2025-01-01T00:00:00.000Z',
  authorId: user.id, authorName: user.displayName, authorRole: 'user',
};

beforeEach(() => {
  saveUsers([user, other]);
  login('writer', 'demo');
  savePosts([original]);
});

describe('post lifecycle', () => {
  it('creates trimmed text with UUID, current creation time and canonical attribution, ignoring supplied metadata', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-post');
    const before = Date.now();
    const post = createPost({ title: ' Title ', content: ' Text\n  more ', authorId: 'other', authorName: 'Fake', createdAt: '1900-01-01' });
    expect(post).toMatchObject({ id: 'new-post', title: 'Title', content: 'Text\n  more', authorId: 'writer', authorName: 'Writer', authorRole: 'user' });
    expect(Date.parse(post.createdAt)).toBeGreaterThanOrEqual(before);
    expect(getPosts()).toEqual([original, post]);
    expect(getPost(post.id)).toEqual(post);
  });

  it('allows administrator creation and preserves all original attribution when moderating edits', () => {
    login('admin', 'admin');
    const post = createPost({ title: 'Admin text', content: 'Content' });
    expect(post).toMatchObject({ authorId: 'admin', authorName: 'Admin', authorRole: 'admin' });
    const updated = updatePost('post', { title: ' Changed ', content: ' New ', id: 'fake', authorId: 'admin', authorName: 'Fake' });
    expect(updated).toEqual({ ...original, title: 'Changed', content: 'New' });
    expect(getPost('post')).toEqual(updated);
    expect(deletePost('post')).toEqual(updated);
    expect(getPost('post')).toBeNull();
    expect(getPosts()).toEqual([post]);
  });

  it('lets the owner update and delete while keeping other posts intact', () => {
    savePosts([original, { ...original, id: 'second', authorId: 'other' }]);
    expect(canManagePost(original)).toBe(true);
    expect(updatePost('post', { title: 'Edited', content: '<script>alert(1)</script>' }))
      .toEqual({ ...original, title: 'Edited', content: '<script>alert(1)</script>' });
    deletePost('post');
    expect(getPosts()).toEqual([{ ...original, id: 'second', authorId: 'other' }]);
  });

  it('reads missing or invalid ids and corrupt storage as null without changing storage', () => {
    for (const id of ['missing', undefined, null, 123, {}]) expect(getPost(id)).toBeNull();
    localStorage.setItem(POSTS_KEY, '{broken');
    expect(getPost('post')).toBeNull();
    expect(localStorage.getItem(POSTS_KEY)).toBe('{broken');
  });

  it('re-reads the collection before writes rather than overwriting a previously read snapshot', () => {
    getPost('post');
    const added = { ...original, id: 'added' };
    savePosts([original, added]);
    updatePost('post', { title: 'Updated', content: 'Text' });
    expect(getPost('added')).toEqual(added);
    createPost({ title: 'New', content: 'Text' });
    deletePost('post');
    expect(getPosts()).toHaveLength(2);
    expect(getPost('added')).toEqual(added);
  });
});

describe('required text validation', () => {
  it.each([undefined, null, {}, { title: 'ok' }, { content: 'ok' }, { title: '', content: '' },
    { title: ' \n ', content: '\t' }, { title: 4, content: false }, { title: [], content: {} }])
  ('rejects missing, blank and non-string fields for create and edit: %j', fields => {
    const before = localStorage.getItem(POSTS_KEY);
    for (const action of [() => createPost(fields), () => updatePost('post', fields)]) {
      expect(action).toThrow();
      expect(localStorage.getItem(POSTS_KEY)).toBe(before);
    }
  });

  it.each(['title', 'content'])('provides the exact required field error for %s', field => {
    try {
      createPost({ title: 'ok', content: 'ok', [field]: ' ' });
      throw new Error('Expected validation failure');
    } catch (error) {
      expect(error.fieldErrors).toEqual({ [field]: `${field === 'title' ? 'Title' : 'Content'} is required.` });
    }
  });
});

describe('authorization and missing resources', () => {
  it('denies another writer, including UI-supplied owner/admin identities', () => {
    login('other', 'demo');
    const before = localStorage.getItem(POSTS_KEY);
    expect(canManagePost(original, { userId: 'writer', role: 'admin' })).toBe(false);
    expect(() => updatePost('post', { title: 'Attack', content: 'Text', role: 'admin', userId: 'writer' })).toThrow('not authorized');
    expect(() => deletePost('post', { userId: 'writer', role: 'admin' })).toThrow('not authorized');
    expect(localStorage.getItem(POSTS_KEY)).toBe(before);
  });

  it.each(['guest', 'deleted', 'role-changed', 'foreign-role', 'forged-admin', 'renamed', 'corrupt'])
  ('denies %s sessions for every mutation without changing posts', kind => {
    if (kind === 'guest') localStorage.removeItem('writespace_session');
    if (kind === 'deleted') saveUsers([other]);
    if (kind === 'role-changed') saveUsers([{ ...user, role: 'admin' }, other]);
    if (kind === 'renamed') saveUsers([{ ...user, displayName: 'Renamed' }, other]);
    if (kind === 'foreign-role' || kind === 'forged-admin') {
      localStorage.setItem('writespace_session', JSON.stringify({ userId: 'writer', username: 'writer', displayName: 'Writer',
        role: kind === 'foreign-role' ? 'Admin' : 'admin' }));
    }
    if (kind === 'corrupt') localStorage.setItem('writespace_session', '{bad');
    const before = localStorage.getItem(POSTS_KEY);
    expect(canManagePost(original)).toBe(false);
    for (const action of [() => createPost({ title: 'New', content: 'Text' }),
      () => updatePost('post', { title: 'New', content: 'Text' }), () => deletePost('post')]) {
      expect(action).toThrow('log in');
      expect(localStorage.getItem(POSTS_KEY)).toBe(before);
    }
  });

  it('returns false for invalid posts and permits admin management of any valid post', () => {
    for (const post of [null, {}, [], { ...original, authorRole: 'foreign' }]) expect(canManagePost(post)).toBe(false);
    login('admin', 'admin');
    expect(canManagePost(original)).toBe(true);
  });

  it.each(['missing', undefined, null, 3])('reports missing resource explicitly for update and delete: %s', id => {
    const before = localStorage.getItem(POSTS_KEY);
    expect(() => updatePost(id, { title: 'New', content: 'Text' })).toThrow('Post not found');
    expect(() => deletePost(id)).toThrow('Post not found');
    expect(localStorage.getItem(POSTS_KEY)).toBe(before);
  });
});

describe('failure preservation', () => {
  it.each(['{bad', '{}', '[{}]'])('refuses to overwrite corrupt post storage: %s', raw => {
    localStorage.setItem(POSTS_KEY, raw);
    for (const action of [() => createPost({ title: 'New', content: 'Text' }),
      () => updatePost('post', { title: 'New', content: 'Text' }), () => deletePost('post')]) {
      expect(action).toThrow('Cannot read local posts');
      expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
    }
  });

  it('propagates unavailable post reads and leaves existing storage intact', () => {
    const before = localStorage.getItem(POSTS_KEY);
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === POSTS_KEY) throw new Error('blocked');
      return read.call(this, key);
    });
    expect(getPost('post')).toBeNull();
    for (const action of [() => createPost({ title: 'New', content: 'Text' }),
      () => updatePost('post', { title: 'New', content: 'Text' }), () => deletePost('post')]) {
      expect(action).toThrow('Cannot read local posts');
    }
    expect(read.call(localStorage, POSTS_KEY)).toBe(before);
  });

  it('propagates write failures for every mutation without modifying persisted data', () => {
    const before = localStorage.getItem(POSTS_KEY);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    for (const action of [() => createPost({ title: 'New', content: 'Text' }),
      () => updatePost('post', { title: 'New', content: 'Text' }), () => deletePost('post')]) {
      expect(action).toThrow('Cannot save local posts');
      expect(localStorage.getItem(POSTS_KEY)).toBe(before);
    }
  });

  it('reports unavailable UUID generation and invalid/duplicate UUID outputs without changing state', () => {
    const before = localStorage.getItem(POSTS_KEY);
    const uuid = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
    expect(() => createPost({ title: 'New', content: 'Text' })).toThrow('Cannot create a post ID');
    for (const id of [undefined, '', 'post']) {
      uuid.mockReturnValue(id);
      expect(() => createPost({ title: 'New', content: 'Text' })).toThrow('Cannot save invalid');
      expect(localStorage.getItem(POSTS_KEY)).toBe(before);
    }
  });
});
