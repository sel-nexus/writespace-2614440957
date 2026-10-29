/** Verify account management against real browser storage, including fail-closed mutations. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADMIN, getSession, login, saveUsers } from '../identity/auth.js';
import { createUser, deleteUser, listUsers } from './userService.js';

const writer = { id: 'writer', displayName: 'Writer', username: 'writer', password: 'demo', role: 'user', createdAt: '2025-01-02' };
const admin = { ...writer, id: 'manager', displayName: 'Manager', username: 'manager', role: 'admin' };
const valid = { displayName: ' New Writer ', username: ' NewWriter ', password: ' demo ', role: 'user' };

/** Read the actual persisted collection for state assertions. */
function stored() {
  return JSON.parse(localStorage.getItem('writespace_users') ?? '[]');
}

beforeEach(() => {
  saveUsers([writer, admin]);
  login('admin', 'admin');
});

describe('admin account population and creation', () => {
  it('includes the separate default admin exactly once and supports an absent collection', () => {
    expect(listUsers()).toEqual([DEFAULT_ADMIN, writer, admin]);
    localStorage.removeItem('writespace_users');
    expect(listUsers()).toEqual([DEFAULT_ADMIN]);
    expect(localStorage.getItem('writespace_users')).toBeNull();
    createUser(valid);
    expect(stored()).toHaveLength(1);
  });

  it.each(['admin', 'user'])('creates a %s with trimmed names, exact password, UUID, time and unchanged session', role => {
    const session = getSession();
    const account = createUser({ ...valid, role });
    expect(account).toMatchObject({ displayName: 'New Writer', username: 'NewWriter', password: ' demo ', role });
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
    expect(stored()).toEqual([writer, admin, account]);
    expect(listUsers()).toEqual([DEFAULT_ADMIN, writer, admin, account]);
    expect(getSession()).toEqual(session);
  });

  it('accepts an exact whitespace-only nonempty password', () => {
    expect(createUser({ ...valid, password: ' ' }).password).toBe(' ');
    expect(stored()[2].password).toBe(' ');
  });

  it.each([
    ['displayName', ''], ['displayName', '  '], ['displayName', 3], ['displayName', null],
    ['username', ''], ['username', '  '], ['username', {}], ['username', null],
    ['password', ''], ['password', 42], ['password', null],
    ['role', ''], ['role', undefined], ['role', 'Admin'], ['role', 'owner'], ['role', {}],
  ])('rejects invalid %s value %j with field feedback and no write', (field, value) => {
    const before = localStorage.getItem('writespace_users');
    try {
      createUser({ ...valid, [field]: value });
      throw new Error('Expected input failure');
    } catch (error) {
      expect(error.fieldErrors).toHaveProperty(field);
    }
    expect(localStorage.getItem('writespace_users')).toBe(before);
  });

  it.each([undefined, null, [], 'invalid', 12])('rejects invalid whole input %j', input => {
    expect(() => createUser(input)).toThrow('highlighted fields');
    expect(stored()).toEqual([writer, admin]);
  });

  it.each([' WRITER ', 'MaNaGeR', ' ADMIN '])('rejects case-insensitive duplicate %s including admin', username => {
    expect(() => createUser({ ...valid, username })).toThrow('Username is already taken.');
    expect(stored()).toEqual([writer, admin]);
  });

  it.each(['throw', undefined, '', ' admin ', 'admin', 'writer'])('reports UUID failure %j without saving', value => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      if (value === 'throw') throw new Error('UUID unavailable');
      return value;
    });
    expect(() => createUser(valid)).toThrow('Cannot create an account ID.');
    expect(stored()).toEqual([writer, admin]);
  });
});

describe('persisted authorization on every read and mutation', () => {
  it.each(['guest', 'user', 'deleted', 'demoted', 'forged', 'corrupt'])('denies %s sessions for all management actions', mode => {
    if (mode === 'guest') localStorage.removeItem('writespace_session');
    if (mode === 'user') login('writer', 'demo');
    if (['deleted', 'demoted'].includes(mode)) {
      login('manager', 'demo');
      saveUsers(mode === 'deleted' ? [writer] : [writer, { ...admin, role: 'user' }]);
    }
    if (mode === 'forged') {
      localStorage.setItem('writespace_session', JSON.stringify({ userId: writer.id, username: writer.username,
        displayName: writer.displayName, role: 'admin' }));
    }
    if (mode === 'corrupt') localStorage.setItem('writespace_session', '{');
    const before = localStorage.getItem('writespace_users');
    expect(() => listUsers()).toThrow();
    expect(() => createUser(valid)).toThrow();
    expect(() => deleteUser(writer.id)).toThrow();
    expect(localStorage.getItem('writespace_users')).toBe(before);
  });
});

describe('strict storage safety', () => {
  it.each([
    '{', 'null', '{}', '[null]',
    JSON.stringify([{ ...writer, password: '' }]),
    JSON.stringify([writer, { ...writer, id: 'duplicate' }]),
    JSON.stringify([writer, { ...admin, id: writer.id }]),
    JSON.stringify([DEFAULT_ADMIN]),
  ])('refuses corrupt or lossy collection %s without overwriting', raw => {
    localStorage.setItem('writespace_users', raw);
    expect(() => listUsers()).toThrow('Cannot read local accounts.');
    expect(() => createUser(valid)).toThrow('Cannot read local accounts.');
    expect(() => deleteUser(writer.id)).toThrow('Cannot read local accounts.');
    expect(localStorage.getItem('writespace_users')).toBe(raw);
  });

  it('reports account read failure separately from session read failure without writing', () => {
    const original = Storage.prototype.getItem;
    const before = localStorage.getItem('writespace_users');
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'writespace_users') throw new Error('Unavailable');
      return original.call(this, key);
    });
    expect(() => listUsers()).toThrow('Cannot read local accounts.');
    expect(() => createUser(valid)).toThrow('Cannot read local accounts.');
    expect(() => deleteUser(writer.id)).toThrow('Cannot read local accounts.');
    spy.mockRestore();
    expect(localStorage.getItem('writespace_users')).toBe(before);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
    expect(() => listUsers()).toThrow('Please log in again.');
    expect(() => createUser(valid)).toThrow('Please log in again.');
    expect(() => deleteUser(writer.id)).toThrow('Please log in again.');
  });

  it('reports write failures for creation and deletion without changing stored accounts', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    expect(() => createUser(valid)).toThrow('Cannot save local accounts.');
    expect(() => deleteUser(writer.id)).toThrow('Cannot save local accounts.');
    expect(stored()).toEqual([writer, admin]);
  });
});

describe('deletion', () => {
  it('deletes eligible users and admins, retaining historical posts and session', () => {
    const posts = '[{"id":"historical","authorId":"writer","authorName":"Writer"}]';
    localStorage.setItem('writespace_posts', posts);
    expect(deleteUser(writer.id)).toEqual(writer);
    expect(stored()).toEqual([admin]);
    expect(listUsers()).toEqual([DEFAULT_ADMIN, admin]);
    expect(deleteUser(admin.id)).toEqual(admin);
    expect(stored()).toEqual([]);
    expect(localStorage.getItem('writespace_posts')).toBe(posts);
    expect(getSession().userId).toBe('admin');
  });

  it.each([undefined, null, '', ' ', 3, {}, 'missing'])('rejects missing target %j without mutation', id => {
    expect(() => deleteUser(id)).toThrow('Account not found.');
    expect(stored()).toEqual([writer, admin]);
  });

  it('protects default and current admins without modifying accounts', () => {
    expect(() => deleteUser('admin')).toThrow('Default admin cannot be deleted.');
    login('manager', 'demo');
    expect(() => deleteUser('manager')).toThrow('You cannot delete your current account.');
    expect(() => deleteUser('admin')).toThrow('Default admin cannot be deleted.');
    expect(stored()).toEqual([writer, admin]);
  });
});
