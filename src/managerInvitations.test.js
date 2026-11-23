/** @jest-environment node */
const {createHash} = require('crypto');

jest.mock('../api/firebase-admin', () => ({admin: {auth: jest.fn(), firestore: jest.fn()}, initAdmin: jest.fn()}));
jest.mock(require.resolve('resend', {paths: [require.resolve('../api/manager-invitation')]}), () => ({Resend: jest.fn()}));
const {admin, initAdmin} = require('../api/firebase-admin');
const {Resend} = require(require.resolve('resend', {paths: [require.resolve('../api/manager-invitation')]}));
const handler = require('../api/manager-invitation');
const listUsers = require('../api/list-users');
const deleteUser = require('../api/delete-user');

let records, profiles, users, send, auth, db, clock;
const digest = value => createHash('sha256').update(value).digest('hex');
const manager = {uid: 'manager', email: 'manager@example.com', customClaims: {isManager: true}, providerData: [{providerId: 'password'}], metadata: {creationTime: '2020-01-01'}};
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
  const ref = id => ({id, delete: async () => records.delete(id), data: () => records.get(id), get: async () => ({data: () => records.get(id)})});
  const collection = name => ({
    doc: id => name === 'users' ? {id, profile: true, data: () => profiles.get(id), get: async () => ({exists: !id.startsWith('invite-') || profiles.has(id), data: () => profiles.get(id) || {role: id === 'fallback' ? 'manager' : 'user'}})} : ref(id),
    where: (_key, _op, hash) => ({limit: () => ({get: async () => {
      const docs = [...records].filter(([, record]) => record.hash === hash).map(([id]) => ({ref: ref(id)}));
      return {empty: !docs.length, docs};
    }})})
  });
  db = {collection, getAll: async (...refs) => refs.map(r => ({data: r.data})), runTransaction: async run => run({
    get: async r => ({data: r.data}),
    set: (r, value, options) => {
      const target = r.profile ? profiles : records;
      target.set(r.id, options?.merge ? {...target.get(r.id), ...value} : value);
    },
    delete: r => (r.profile ? profiles : records).delete(r.id),
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
    generatePasswordResetLink: jest.fn(async () => "https://example.firebaseapp.com/__/auth/action?oobCode=fixture"),
    getUser: jest.fn(async uid => users.find(u => u.uid === uid)),
    updateUser: jest.fn(async () => {}),
    deleteUser: jest.fn(async uid => {users = users.filter(user => user.uid !== uid);}),
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

const seedLegacyInvite = () => {
  const secret = "a".repeat(64);
  records.set("manager", {hash: digest(secret), status: "Pending", email: manager.email, expires: Date.now() + 30 * 86400000});
  return secret;
};

test('active managers cannot receive new links, but existing links remain single-use', async () => {
  expect((await call({uid: 'manager'})).statusCode).toBe(409);
  expect(send).not.toHaveBeenCalled();
  const secret = seedLegacyInvite();
  expect((await call({invite: secret}, null)).statusCode).toBe(400);
  expect((await call({invite: secret, password: 'fixture password only'}, null)).body).toEqual({token: 'token-for-manager'});
  expect(records.get('manager')).toMatchObject({hash: null, status: 'Accepted'});
  expect((await call({invite: secret}, null)).statusCode).toBe(410);
});

test('a passwordless manager following an outstanding link must set a password', async () => {
  users = [{...manager, providerData: []}];
  const invite = seedLegacyInvite();
  expect((await call({invite}, null)).statusCode).toBe(400);
  expect((await call({invite, password: "short"}, null)).statusCode).toBe(400);
  expect((await call({invite, password: "a valid test password"}, null)).statusCode).toBe(200);
  expect(auth.updateUser).toHaveBeenCalledWith("manager", {password: "a valid test password", emailVerified: true});
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

test('Firestore role fallback cannot be reinvited', async () => {
  users = [{...manager, uid: 'fallback', customClaims: {}}];
  expect((await call({uid: 'fallback'})).statusCode).toBe(409);
});

test('resending a pending invitation is throttled and invalidates the previous link', async () => {
  await call({email: 'pending@example.com'});
  const oldSecret = secretFromEmail();
  const uid = users[1].uid;
  expect((await call({uid})).statusCode).toBe(429);
  clock.mockReturnValue(Date.now() + 60000);
  expect((await call({uid})).statusCode).toBe(200);
  expect((await call({invite: oldSecret, checkProfile: true}, null)).statusCode).toBe(410);
  expect((await call({invite: secretFromEmail(), checkProfile: true}, null)).body).toEqual({profileRequired: true});
});

test.each(['expired', 'email changed', 'disabled', 'role revoked'])('redemption rejects %s', async reason => {
  const secret = seedLegacyInvite();
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
  expect((await call({email: 'pending@example.com'})).statusCode).toBe(502);
  expect(records.get(users[1].uid)).toMatchObject({hash: null, status: 'Failed', lastSent: null});
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
    expect.objectContaining({uid: 'manager', managerEligible: false, invitationStatus: 'Expired', lastSent: 123}),
    expect.objectContaining({uid: 'disabled', managerEligible: false, invitationStatus: 'Accepted'}),
    expect.objectContaining({uid: 'fallback', managerEligible: false, invitationStatus: 'Never sent'})
  ]));
});

test('email-only invitation requires and stores a profile before granting manager access', async () => {
  const createManager = require('../api/create-manager');
  expect((await call({email: ' NEW@example.com '}, 'admin', 'POST', createManager)).statusCode).toBe(200);
  expect(send.mock.calls[0][0]).toMatchObject({to: 'new@example.com', html: expect.stringContaining('Complete your manager profile')});
  const secret = secretFromEmail();
  const newUser = users[1];
  expect((await call({invite: secret, checkProfile: true}, null)).body).toEqual({profileRequired: true});
  expect(send.mock.calls[0][0]).toMatchObject({from: 'Backcountry Bayit <info@bcbayit.org>', text: expect.stringContaining('expires in 30 days')});
  expect(records.get(newUser.uid).expires).toBe(Date.now() + 30 * 86400000);
  expect(newUser.customClaims).toBeUndefined();
  expect(profiles.size).toBe(0);
  const profile = {firstName: ' Al ', lastName: 'Smith', phone: '970-555-0134', birthday: '1990-02-28'};
  for (const key of Object.keys(profile)) {
    expect((await call({invite: secret, profile: {...profile, [key]: ''}}, null)).statusCode).toBe(400);
  }
  expect((await call({invite: secret, profile: {...profile, birthday: '1990-02-30'}}, null)).statusCode).toBe(400);
  expect(auth.createCustomToken).not.toHaveBeenCalled();
  expect(records.get(newUser.uid).status).toBe('Pending');
  expect((await call({invite: secret, profile}, null)).statusCode).toBe(400);
  expect((await call({invite: secret, profile, password: 'fixture password only'}, null)).statusCode).toBe(200);
  expect(auth.createCustomToken).toHaveBeenCalledWith(newUser.uid, {isManager: true});
  expect(auth.updateUser).toHaveBeenCalledWith(newUser.uid, {displayName: 'Al Smith', password: 'fixture password only', emailVerified: true});
  expect(profiles.get(newUser.uid)).toMatchObject({...profile, firstName: 'Al', role: 'manager'});
  expect((await call({invite: secret, profile}, null)).statusCode).toBe(410);
  expect((await call({invite: secret, checkProfile: true}, null)).statusCode).toBe(410);
  clock.mockReturnValue(Date.now() + 60000);
  expect((await call({uid: newUser.uid})).statusCode).toBe(409);
  expect(send).toHaveBeenCalledTimes(1);
});

test('removing manager access keeps the account and blocks an old manager claim', async () => {
  const remove = require('../api/delete-user');
  profiles.set('manager', {role: 'manager', displayName: 'Jordan Test'});
  seedLegacyInvite();
  const writes = [];
  db.batch = () => ({
    set: (target, value) => writes.push([target, value]),
    commit: async () => writes.forEach(([target, value]) => {
      const store = target.profile ? profiles : records;
      store.set(target.id, {...store.get(target.id), ...value});
    }),
  });
  auth.setCustomUserClaims = jest.fn().mockResolvedValue();
  auth.revokeRefreshTokens = jest.fn().mockResolvedValue();
  auth.deleteUser = jest.fn();
  expect((await call({userId: 'manager'}, 'admin', 'POST', remove)).statusCode).toBe(200);
  expect(profiles.get('manager')).toMatchObject({role: 'user', displayName: 'Jordan Test'});
  expect(records.get('manager')).toMatchObject({status: 'Revoked', hash: null});
  expect(auth.deleteUser).not.toHaveBeenCalled();
  const {resolveRole}=require('../api/_auth');
  expect(await resolveRole(admin, {uid: 'manager', isManager: true})).toBe('user');
  expect(auth.setCustomUserClaims).toHaveBeenCalledWith('manager', {});
});

test('admin can reset an active invitation and the recipient chooses a password when accepting', async () => {
  const oldLink = seedLegacyInvite();
  expect((await call({uid: 'manager', reset: true}, 'manager')).statusCode).toBe(403);
  expect((await call({uid: 'manager', reset: true})).statusCode).toBe(200);
  expect((await call({invite: oldLink}, null)).statusCode).toBe(410);
  expect((await call({invite: secretFromEmail(), password: 'fixture password only'}, null)).body).toEqual({token: 'token-for-manager'});
  expect(auth.updateUser).toHaveBeenCalledWith('manager', {password: 'fixture password only', emailVerified: true});
  expect(profiles.size).toBe(0);
});

test('reinviting a revoked manager preserves their account and restores access on acceptance', async () => {
  profiles.set('manager', {role: 'user', managerRevokedAt: 123, firstName: 'Former'});
  records.set('manager', {status: 'Revoked'});
  const list = await call({}, 'admin', 'GET', listUsers);
  expect(list.body.users[0]).toMatchObject({canResetInvitation: true, canRevokeManager: false, invitationStatus: 'Revoked'});
  expect((await call({email: manager.email})).statusCode).toBe(200);
  expect(profiles.get('manager')).toMatchObject({role: 'user', managerRevokedAt: 123});
  expect(records.get('manager')).toMatchObject({status: 'Pending', restore: true});
  expect((await call({invite: secretFromEmail(), password: 'fixture password only'}, null)).body).toEqual({token: 'token-for-manager'});
  expect(profiles.get('manager')).toEqual({role: 'manager', managerRevokedAt: null, firstName: 'Former'});
  expect(auth.updateUser).toHaveBeenCalledWith('manager', {password: 'fixture password only', emailVerified: true});
});

test('permanent deletion requires an admin and prior manager revocation', async () => {
  const request = {userId: 'manager', permanent: true};
  expect((await call(request, 'manager', 'POST', deleteUser)).statusCode).toBe(403);
  expect((await call(request, 'admin', 'POST', deleteUser)).statusCode).toBe(409);
  expect(auth.deleteUser).not.toHaveBeenCalled();
  profiles.set('manager', {role: 'user', managerRevokedAt: 123, firstName: 'Former', email: manager.email});
  records.set('manager', {status: 'Revoked', email: manager.email});
  expect((await call(request, 'admin', 'POST', deleteUser)).statusCode).toBe(200);
  expect(auth.deleteUser).toHaveBeenCalledWith('manager');
  expect(profiles.get('manager')).toEqual({managerRevokedAt: 123});
  expect(records.has('manager')).toBe(false);
  expect((await call({}, 'admin', 'GET', listUsers)).body.users).toEqual([]);
});

test('deleting an ordinary account removes its profile and leaves other data alone', async () => {
  users = [{...manager, uid: 'regular', customClaims: {}}];
  profiles.set('regular', {role: 'user', firstName: 'Test'});
  profiles.set('other', {role: 'manager'});
  const res = await call({userId: 'regular', permanent: true}, 'admin', 'POST', deleteUser);
  expect(res.body).toEqual({success: true, message: 'User permanently deleted.'});
  expect(profiles.has('regular')).toBe(false);
  expect(profiles.get('other')).toEqual({role: 'manager'});
});

test('a later invite to a deleted address uses a new account and requires onboarding', async () => {
  const email = 'previous@example.com';
  const oldUid = 'invite-' + digest(email);
  profiles.set(oldUid, {managerRevokedAt: 123});
  expect((await call({email})).statusCode).toBe(200);
  const newUid = users.find(user => user.email === email).uid;
  expect(newUid).not.toBe(oldUid);
  expect((await call({invite: secretFromEmail(), checkProfile: true}, null)).body).toEqual({profileRequired: true});
  expect(profiles.get(oldUid)).toEqual({managerRevokedAt: 123});
});

test("sends a branded reset email to an eligible manager and throttles repeat requests", async () => {
  const body = {action: "requestPasswordReset", email: " MANAGER@example.com "};
  expect((await call(body, null)).statusCode).toBe(202);
  expect((await call(body, null)).statusCode).toBe(202);
  expect(auth.generatePasswordResetLink).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toMatchObject({
    to: manager.email,
    subject: "Reset your Backcountry Bayit password",
    html: expect.stringContaining("/reset-password#oobCode=fixture"),
  });
  expect((await call({action: "requestPasswordReset", email: "unknown@example.com"}, null)).body).toEqual({accepted: true});
  expect(send).toHaveBeenCalledTimes(1);
});
