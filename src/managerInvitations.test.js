/** @jest-environment node */
const {createHash} = require('crypto');

jest.mock('../api/firebase-admin', () => ({admin: {auth: jest.fn(), firestore: jest.fn()}, initAdmin: jest.fn()}));
jest.mock(require.resolve('resend', {paths: [require.resolve('../api/manager-invitation')]}), () => ({Resend: jest.fn()}));
const {admin, initAdmin} = require('../api/firebase-admin');
const {Resend} = require(require.resolve('resend', {paths: [require.resolve('../api/manager-invitation')]}));
const handler = require('../api/manager-invitation');
const listUsers = require('../api/list-users');

let records, profiles, users, send, auth, db, clock;
const digest = value => createHash('sha256').update(value).digest('hex');
const manager = {uid: 'manager', email: 'manager@example.com', customClaims: {isManager: true}, metadata: {creationTime: '2020-01-01'}};
const call = async (body, role = 'admin', method = 'POST', route = handler) => {
  const req = {method, body, headers: role ? {authorization: `Bearer ${role}`} : {}};
  const res = {statusCode: 200, setHeader: jest.fn(), status(code) {this.statusCode = code; return this;}, json(data) {this.body = data; return this;}, end() {return this;}};
  await route(req, res);
  return res;
};
const secretFromEmail = () => send.mock.calls[send.mock.calls.length - 1][0].text.split('#invite=')[1];

beforeEach(() => {
  jest.clearAllMocks();
  clock = jest.spyOn(Date, 'now').mockReturnValue(1800000000000);
  records = new Map();
  profiles = new Map();
  users = [manager];
  const ref = id => ({id, data: () => records.get(id), get: async () => ({data: () => records.get(id)})});
  const collection = name => ({
    doc: id => name === 'users' ? {id, profile: true, get: async () => ({exists: !id.startsWith('invite-') || profiles.has(id), data: () => profiles.get(id) || {role: id === 'fallback' ? 'manager' : 'user'}})} : ref(id),
    where: (_key, _op, hash) => ({limit: () => ({get: async () => {
      const docs = [...records].filter(([, record]) => record.hash === hash).map(([id]) => ({ref: ref(id)}));
      return {empty: !docs.length, docs};
    }})})
  });
  db = {collection, getAll: async (...refs) => refs.map(r => ({data: r.data})), runTransaction: async run => run({
    get: async r => ({data: r.data}),
    set: (r, value) => (r.profile ? profiles : records).set(r.id, value),
    update: (r, value) => records.set(r.id, {...records.get(r.id), ...value})
  })};
  auth = {
    verifyIdToken: jest.fn(async token => ({uid: token, admin: token === 'admin', isManager: token === 'manager'})),
    createUser: jest.fn(async data => {
      if (users.some(user => user.email === data.email)) throw Object.assign(new Error(), {code: "auth/email-already-exists"});
      users.push({...data, metadata: {creationTime: "2020-01-01"}});
      return data;
    }),
    getUserByEmail: async email => users.find(user => user.email === email),
    getUser: jest.fn(async uid => users.find(u => u.uid === uid)),
    updateUser: jest.fn(async () => {}),
    createCustomToken: jest.fn(async uid => `token-for-${uid}`),
    listUsers: async () => ({users})
  };
  admin.auth.mockReturnValue(auth);
  admin.firestore.mockReturnValue(db);
  initAdmin.mockReturnValue(admin);
  send = jest.fn().mockResolvedValue({data: {id: 'email-id'}});
  Resend.mockImplementation(() => ({emails: {send}}));
});
afterEach(() => clock.mockRestore());

test('admin sends a hashed, expiring invitation; manager redeems it exactly once', async () => {
  expect((await call({uid: 'manager'})).statusCode).toBe(200);
  expect(send.mock.calls[0][0]).toMatchObject({
    from: 'Backcountry Bayit <info@bcbayit.org>', to: manager.email,
    text: expect.stringContaining('expires in 30 days'), html: expect.stringContaining('expires in 30 days'),
  });
  const secret = secretFromEmail();
  expect(secret).toMatch(/^[a-f0-9]{64}$/);
  expect(records.get('manager')).toMatchObject({hash: digest(secret), status: 'Pending', expires: Date.now() + 30 * 86400000, lastSent: Date.now()});
  expect((await call({invite: secret}, null)).body).toEqual({token: 'token-for-manager'});
  expect(records.get('manager')).toMatchObject({hash: null, status: 'Accepted'});
  expect((await call({invite: secret}, null)).statusCode).toBe(410);
});

test.each([[null, 401], ['manager', 403], ['user', 403]])('caller %s cannot send invitations', async (role, status) => {
  expect((await call({uid: 'manager'}, role)).statusCode).toBe(status);
  expect(send).not.toHaveBeenCalled();
  expect(records.size).toBe(0);
});

test.each([{disabled: true}, {customClaims: {admin: true}}, {customClaims: {}}, {email: ''}])('ineligible accounts cannot receive invitations: %j', async changes => {
  users = [{...manager, ...changes}];
  expect((await call({uid: 'manager'})).statusCode).toBe(403);
  expect(send).not.toHaveBeenCalled();
});

test('Firestore role fallback is eligible', async () => {
  users = [{...manager, uid: 'fallback', customClaims: {}}];
  expect((await call({uid: 'fallback'})).statusCode).toBe(200);
});

test('resending is throttled and replaces the previous link after one minute', async () => {
  await call({uid: 'manager'});
  const oldSecret = secretFromEmail();
  expect((await call({uid: 'manager'})).statusCode).toBe(429);
  clock.mockReturnValue(Date.now() + 60000);
  expect((await call({uid: 'manager'})).statusCode).toBe(200);
  expect((await call({invite: oldSecret}, null)).statusCode).toBe(410);
  expect((await call({invite: secretFromEmail()}, null)).statusCode).toBe(200);
});

test.each(['expired', 'email changed', 'disabled', 'role revoked'])('redemption rejects %s', async reason => {
  await call({uid: 'manager'});
  const secret = secretFromEmail();
  if (reason === 'expired') clock.mockReturnValue(Date.now() + 30 * 86400000);
  if (reason === 'email changed') users = [{...manager, email: 'changed@example.com'}];
  if (reason === 'disabled') users = [{...manager, disabled: true}];
  if (reason === 'role revoked') users = [{...manager, customClaims: {}}];
  const response = await call({invite: secret}, null);
  expect(response.statusCode).toBe(['disabled', 'role revoked'].includes(reason) ? 403 : 410);
  expect(response.body.token).toBeUndefined();
});

test('email delivery failure invalidates the link', async () => {
  send.mockResolvedValue({error: {message: 'delivery failed'}});
  expect((await call({uid: 'manager'})).statusCode).toBe(502);
  expect(records.get('manager')).toMatchObject({hash: null, status: 'Failed', lastSent: null});
});

test('invalid requests and methods are rejected', async () => {
  expect((await call({}, 'admin', 'GET')).statusCode).toBe(405);
  expect((await call({uid: 'bad/id'})).statusCode).toBe(400);
  expect((await call({invite: 'bad'}, null)).statusCode).toBe(400);
  expect((await call({invite: 'a'.repeat(64)}, null)).statusCode).toBe(410);
});

test('list-users reports invitation statuses and manager eligibility', async () => {
  users = [manager, {...manager, uid: 'disabled', disabled: true}, {...manager, uid: 'fallback', customClaims: {}}];
  records.set('manager', {status: 'Pending', expires: Date.now() - 1, lastSent: 123});
  records.set('disabled', {status: 'Accepted'});
  const res = await call({}, 'admin', 'GET', listUsers);
  expect(res.statusCode).toBe(200);
  expect(res.body.users).toEqual(expect.arrayContaining([
    expect.objectContaining({uid: 'manager', managerEligible: true, invitationStatus: 'Expired', lastSent: 123}),
    expect.objectContaining({uid: 'disabled', managerEligible: false, invitationStatus: 'Accepted'}),
    expect.objectContaining({uid: 'fallback', managerEligible: true, invitationStatus: 'Never sent'})
  ]));
});

test('email-only invitation requires and stores a profile before granting manager access', async () => {
  const createManager = require('../api/create-manager');
  expect((await call({email: ' NEW@example.com '}, 'admin', 'POST', createManager)).statusCode).toBe(200);
  expect(send.mock.calls[0][0]).toMatchObject({to: 'new@example.com', html: expect.stringContaining('Complete your manager profile')});
  const secret = secretFromEmail();
  const newUser = users[1];
  expect((await call({invite: secret, checkProfile: true}, null)).body).toEqual({profileRequired: true});
  expect(newUser.customClaims).toBeUndefined();
  expect(profiles.size).toBe(0);
  const profile = {firstName: ' Al ', lastName: 'Smith', phone: '970-555-0134', birthday: '1990-02-28'};
  for (const key of Object.keys(profile)) {
    expect((await call({invite: secret, profile: {...profile, [key]: ''}}, null)).statusCode).toBe(400);
  }
  expect((await call({invite: secret, profile: {...profile, birthday: '1990-02-30'}}, null)).statusCode).toBe(400);
  expect(auth.createCustomToken).not.toHaveBeenCalled();
  expect(records.get(newUser.uid).status).toBe('Pending');
  expect((await call({invite: secret, profile}, null)).statusCode).toBe(200);
  expect(auth.createCustomToken).toHaveBeenCalledWith(newUser.uid, {isManager: true});
  expect(auth.updateUser).toHaveBeenCalledWith(newUser.uid, {displayName: 'Al Smith'});
  expect(profiles.get(newUser.uid)).toMatchObject({...profile, firstName: 'Al', role: 'manager'});
  expect((await call({invite: secret, profile}, null)).statusCode).toBe(410);
  expect((await call({invite: secret, checkProfile: true}, null)).statusCode).toBe(410);
  clock.mockReturnValue(Date.now() + 60000);
  expect((await call({uid: newUser.uid})).statusCode).toBe(200);
  expect(send.mock.calls[1][0].html).toContain('Sign in to the dashboard');
});
