/** Exercise real local persistence and every identity service success/failure boundary. */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADMIN, clearSession, getSession, getUsers, homeDestination, login, register, requireSession, saveUsers, setSession } from './auth.js';

const writer = { id: 'writer-1', displayName: 'Writer', username: 'writer', password: ' demo ', role: 'user', createdAt: '2025-01-01T00:00:00.000Z' };
const fields = { displayName: ' Writer ', username: ' writer ', password: ' demo ', confirmPassword: ' demo ' };
const session = { userId: writer.id, displayName: writer.displayName, username: writer.username, role: writer.role };

describe('account storage', () => {
  it('reads empty storage without persisting the separate built-in admin', () => {
    expect(getUsers()).toEqual([]);
    expect(DEFAULT_ADMIN).toEqual({ id: 'admin', displayName: 'Admin', username: 'admin', password: 'admin', role: 'admin' });
    expect(localStorage.getItem('writespace_users')).toBeNull();
  });

  it('saves and reads both lowercase roles without changing exact passwords', () => {
    const admin = { ...writer, id: 'admin-2', username: 'moderator', role: 'admin' };
    saveUsers([writer, admin]);
    expect(getUsers()).toEqual([writer, admin]);
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual([writer, admin]);
  });

  it('roundtrips a bounded large collection without losing records or exact passwords', () => {
    const accounts = Array.from({ length: 500 }, (_, index) => ({
      ...writer,
      id: `writer-${index}`,
      username: `writer${index}`,
      displayName: `Writer ${index}`,
      password: ` demo ${index} `,
      role: index % 2 === 0 ? 'user' : 'admin',
    }));
    saveUsers(accounts);
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual(accounts);
    expect(getUsers()).toEqual(accounts);
    const current = register({ ...fields, username: 'new-writer' });
    expect(getUsers().slice(0, accounts.length)).toEqual(accounts);
    expect(getUsers()).toHaveLength(accounts.length + 1);
    clearSession();
    expect(login(accounts[499].username, accounts[499].password).userId).toBe(accounts[499].id);
    expect(login('new-writer', fields.password)).toEqual(current);
  });

  it.each(['broken json', '{}', 'null', '42'])('returns an empty collection for corrupt storage %s', raw => {
    localStorage.setItem('writespace_users', raw);
    expect(getUsers()).toEqual([]);
  });

  it('ignores malformed, built-in-shadowing, and ambiguous records', () => {
    localStorage.setItem('writespace_users', JSON.stringify([
      writer, null, {}, { ...writer, id: 'admin' }, { ...writer, id: 'a', username: 'ADMIN' },
      { ...writer, id: 'b', username: 'bad', role: 'Admin' }, { ...writer, id: 'c', username: 'time', createdAt: 'bad' },
    ]));
    expect(getUsers()).toEqual([writer]);
    localStorage.setItem('writespace_users', JSON.stringify([writer, { ...writer, id: 'other', username: 'WRITER' }]));
    expect(getUsers()).toEqual([]);
    localStorage.setItem('writespace_users', JSON.stringify([writer, { ...writer, username: 'other' }]));
    expect(getUsers()).toEqual([]);
  });

  it.each(['id', 'displayName', 'username', 'password', 'role', 'createdAt'])('rejects a record missing %s and leaves state unchanged', key => {
    saveUsers([writer]);
    const invalid = { ...writer };
    delete invalid[key];
    expect(() => saveUsers([invalid])).toThrow(/invalid/);
    expect(getUsers()).toEqual([writer]);
  });

  it.each([null, {}, [writer, writer], [{ ...writer, username: ' admin ' }], [{ ...writer, displayName: ' ' }]])('rejects invalid collection %j', value => {
    expect(() => saveUsers(value)).toThrow(/invalid/);
    expect(localStorage.getItem('writespace_users')).toBeNull();
  });

  it('falls back on denied reads and surfaces write errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => saveUsers([writer])).toThrow(/Cannot save local accounts/);
  });
});

describe('sessions and authorization', () => {
  it('logs in the built-in admin first and persists only session fields', () => {
    const current = login(' admin ', 'admin');
    expect(current).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
    expect(getSession()).toEqual(current);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(current);
    expect(getUsers()).toEqual([]);
    expect(requireSession('admin')).toEqual(current);
    expect(homeDestination(current)).toBe('/admin');
  });

  it('persists writer and stored admin sessions, and denies writer admin authorization', () => {
    saveUsers([writer]);
    expect(login('writer', ' demo ')).toEqual(session);
    expect(getSession()).toEqual(session);
    expect(requireSession()).toEqual(session);
    expect(requireSession('user')).toEqual(session);
    expect(() => requireSession('admin')).toThrow(/not authorized/);
    expect(homeDestination(session)).toBe('/blogs');
    saveUsers([{ ...writer, role: 'admin' }]);
    expect(getSession()).toBeNull();
    expect(login('writer', ' demo ').role).toBe('admin');
  });

  it.each([[undefined, 'x'], ['writer', undefined], ['writer', 'demo'], ['', 'x'], ['ADMIN', 'admin'], ['admin', 'wrong']])('rejects credentials %j without creating a session', (name, password) => {
    saveUsers([writer]);
    expect(() => login(name, password)).toThrow('Invalid username or password.');
    expect(localStorage.getItem('writespace_session')).toBeNull();
  });

  it.each(['broken', 'null', '[]', '{}', '{"userId":"missing"}'])('fails closed for invalid stored session %s', raw => {
    localStorage.setItem('writespace_session', raw);
    expect(getSession()).toBeNull();
    expect(() => requireSession()).toThrow(/log in/);
  });

  it.each(['userId', 'username', 'displayName', 'role'])('rejects forged or stale %s in reads and writes', key => {
    saveUsers([writer]);
    const invalid = { ...session, [key]: 'forged' };
    localStorage.setItem('writespace_session', JSON.stringify(invalid));
    expect(getSession()).toBeNull();
    expect(() => setSession(invalid)).toThrow(/Invalid or stale/);
  });

  it('rejects deleted accounts and does not retain supplied password fields', () => {
    saveUsers([writer]);
    expect(setSession({ ...session, password: 'ignored' })).toEqual(session);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(session);
    saveUsers([]);
    expect(getSession()).toBeNull();
    expect(() => setSession(session)).toThrow(/stale/);
    expect(homeDestination(null)).toBe('/login');
    expect(homeDestination({ role: 'Admin' })).toBe('/login');
  });

  it('surfaces failed session writes and leaves previous storage unchanged', () => {
    saveUsers([writer]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => login('writer', ' demo ')).toThrow(/Cannot save your session/);
    expect(localStorage.getItem('writespace_session')).toBeNull();
  });

  it('clears existing and corrupt sessions idempotently without deleting accounts', () => {
    saveUsers([writer]);
    login('writer', ' demo ');
    clearSession();
    clearSession();
    expect(getSession()).toBeNull();
    expect(getUsers()).toEqual([writer]);
    localStorage.setItem('writespace_session', 'broken');
    clearSession();
    expect(localStorage.getItem('writespace_session')).toBeNull();
  });

  it('surfaces failed logout and preserves the persisted session', () => {
    const current = login('admin', 'admin');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => clearSession()).toThrow(/Cannot clear your session/);
    expect(getSession()).toEqual(current);
  });
});

describe('registration', () => {
  it('trims names, keeps passwords exact, ignores supplied roles and persists a UUID writer/session', () => {
    const current = register({ ...fields, role: 'admin' });
    const [account] = getUsers();
    expect(account).toMatchObject({ displayName: 'Writer', username: 'writer', password: ' demo ', role: 'user' });
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Number.isFinite(Date.parse(account.createdAt))).toBe(true);
    expect(current).toEqual({ ...session, userId: account.id });
    expect(getSession()).toEqual(current);
    clearSession();
    expect(() => login('writer', 'demo')).toThrow(/Invalid/);
    expect(login('writer', ' demo ')).toEqual(current);
  });

  it('registers bounded large fields without truncation and keeps the exact password on login', () => {
    const displayName = 'Writer'.repeat(1000);
    const username = 'writer'.repeat(1000);
    const password = ` ${'demo'.repeat(2000)} `;
    const current = register({ displayName: ` ${displayName} `, username: ` ${username} `,
      password, confirmPassword: password });
    const [account] = JSON.parse(localStorage.getItem('writespace_users'));
    expect(account).toMatchObject({ displayName, username, password, role: 'user' });
    expect(getUsers()).toEqual([account]);
    expect(getSession()).toEqual(current);
    expect(current).toEqual({ userId: account.id, displayName, username, role: 'user' });
    clearSession();
    expect(() => login(username, password.trim())).toThrow(/Invalid username or password/);
    expect(login(username, password)).toEqual(current);
  });

  it.each(['displayName', 'username', 'password', 'confirmPassword'])('requires %s in the service and keeps storage empty', key => {
    try {
      register({ ...fields, [key]: '' });
      throw new Error('Expected validation failure');
    } catch (error) {
      expect(error.fieldErrors[key]).toMatch(/required/);
    }
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });

  it.each([undefined, null, {}, { ...fields, displayName: 12 }, { ...fields, username: ' ' }, { ...fields, password: 12 }])('rejects malformed registration %j', value => {
    expect(() => register(value)).toThrow(/highlighted/);
    expect(getUsers()).toEqual([]);
  });

  it('rejects mismatched exact passwords', () => {
    expect(() => register({ ...fields, confirmPassword: 'demo' })).toThrow(/highlighted/);
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });

  it.each(['admin', ' ADMIN ', 'writer', ' WRITER '])('rejects reserved and duplicate username %s', username => {
    saveUsers([writer]);
    expect(() => register({ ...fields, username })).toThrow(/already taken/);
    expect(getUsers()).toEqual([writer]);
    expect(getSession()).toBeNull();
  });

  it.each(['broken', '{}'])('does not overwrite unreadable accounts %s', raw => {
    localStorage.setItem('writespace_users', raw);
    expect(() => register(fields)).toThrow(/Cannot read local accounts/);
    expect(localStorage.getItem('writespace_users')).toBe(raw);
    expect(getSession()).toBeNull();
  });

  it.each([
    ['null record', null],
    ['missing fields', {}],
    ...['id', 'displayName', 'username', 'password', 'role', 'createdAt'].map(key => {
      const invalid = { ...writer, id: 'invalid', username: 'invalid' };
      delete invalid[key];
      return [`missing ${key}`, invalid];
    }),
    ['invalid role', { ...writer, id: 'invalid', username: 'invalid', role: 'Admin' }],
    ['invalid timestamp', { ...writer, id: 'invalid', username: 'invalid', createdAt: 'bad' }],
    ['built-in ID', { ...writer, id: 'admin', username: 'invalid' }],
    ['built-in username', { ...writer, id: 'invalid', username: 'ADMIN' }],
    ['duplicate ID', { ...writer, username: 'other' }],
    ['duplicate username', { ...writer, id: 'other' }],
    ['case-insensitive duplicate username', { ...writer, id: 'other', username: 'WRITER' }],
  ])('refuses registration for %s and preserves all prior storage', (_description, invalid) => {
    login('admin', 'admin');
    const priorSession = localStorage.getItem('writespace_session');
    const raw = JSON.stringify([writer, invalid], null, 2);
    localStorage.setItem('writespace_users', raw);
    localStorage.setItem('unrelated-data', 'keep me');
    expect(() => register({ ...fields, username: 'new-writer' })).toThrow(/Cannot read local accounts/);
    expect(localStorage.getItem('writespace_users')).toBe(raw);
    expect(localStorage.getItem('writespace_session')).toBe(priorSession);
    expect(localStorage.getItem('unrelated-data')).toBe('keep me');
    expect(localStorage.length).toBe(3);
  });

  it('does not mutate state on denied reads, UUID failure or account write failure', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => register(fields)).toThrow(/Cannot read/);
    read.mockRestore();
    const uuid = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
    expect(() => register(fields)).toThrow(/account ID/);
    uuid.mockRestore();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => register(fields)).toThrow(/Cannot save local accounts/);
    write.mockRestore();
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });

  it('rolls back a new account when session persistence fails, preserving existing accounts', () => {
    saveUsers([writer]);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'writespace_session') throw new Error('quota');
      return original.call(this, key, value);
    });
    expect(() => register({ ...fields, username: 'second' })).toThrow(/Cannot save your session/);
    expect(getUsers()).toEqual([writer]);
    expect(getSession()).toBeNull();
  });

  it('reports incomplete rollback rather than claiming registration success', () => {
    const original = Storage.prototype.setItem;
    let accountWritten = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (accountWritten) throw new Error('denied');
      accountWritten = true;
      return original.call(this, key, value);
    });
    expect(() => register(fields)).toThrow(/undo the account/);
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toBeNull();
  });
});
