/** @jest-environment node */
jest.mock('../api/firebase-admin', () => ({initAdmin: jest.fn()}));
jest.mock('../api/events', () => ({readEvent: jest.fn()}));
jest.mock(require.resolve('resend', {paths: [require.resolve('../api/rsvp')]}), () => ({Resend: jest.fn()}));
const {initAdmin} = require('../api/firebase-admin');
const {readEvent} = require('../api/events');
const {Resend} = require(require.resolve('resend', {paths: [require.resolve('../api/rsvp')]}));
const handler = require('../api/rsvp');

let send;
beforeEach(() => {
  const store = new Map();
  const doc = path => ({id: path.split('/').pop(), path, async get() {
    return {data: () => store.get(path)};
  }});
  let counter = 0;
  let tail = Promise.resolve();
  const db = {
    collection: name => ({
      doc: (id = String(++counter)) => doc(name + '/' + id),
      where: (_field, _comparison, id) => ({async get() {
        return {docs: [...store].filter(([path, data]) => path.startsWith(name + '/') && data.eventId === id)
          .map(([path, value]) => ({...doc(path), ref: doc(path), data: () => value}))};
      }}),
    }),
    runTransaction: callback => {
      const task = tail.then(() => callback({
        get: query => query.get(),
        set: (ref, data) => store.set(ref.path, data),
        update: (ref, data) => store.set(ref.path, {...store.get(ref.path), ...data}),
        delete: ref => store.delete(ref.path),
      }));
      tail = task.catch(() => {});
      return task;
    },
  };
  initAdmin.mockReturnValue({firestore: () => db});
  readEvent.mockResolvedValue({
    id: 'dinner', title: 'Test dinner', start: '2099-05-22T18:30:00-06:00',
    end: '2099-05-22T20:30:00-06:00', capacity: 1, limitCapacity: true,
  });
  send = jest.fn().mockResolvedValue({data: {id: 'message-id'}});
  Resend.mockImplementation(() => ({emails: {send}}));
});

async function request(body) {
  const response = {
    statusCode: 200, setHeader: jest.fn(),
    status(code) {this.statusCode = code; return this;},
    json(data) {this.data = data; return this;},
  };
  await handler({method: 'POST', body}, response);
  return response;
}
const register = email => request({action: 'register', eventId: 'dinner', guest: {firstName: 'Alex', lastName: 'Test', email}});
const accessToken = () => send.mock.calls[0][0].text.match(/#rsvp=([a-f0-9]{64})/)[1];

test('concurrent registration preserves capacity and exposes only aggregate availability', async () => {
  const first = await Promise.all([register('first@example.test'), register('second@example.test')]);
  expect(first.map(item => item.data.status).sort()).toEqual(['approved', 'waitlist']);
  expect((await request({action: 'availability', eventId: 'dinner'})).data).toEqual({remaining: 0});
  expect((await request({action: 'read', token: 'a'.repeat(64)})).statusCode).toBe(410);
});

test('guest access comes from a private emailed link and cancel releases their seat', async () => {
  await register('guest@example.test');
  const duplicate = await register('GUEST@EXAMPLE.TEST');
  expect(duplicate.data).toEqual({accepted: true});
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0].to).toBe('guest@example.test');
  const token = accessToken();
  expect((await request({action: 'read', token})).data.guest.email).toBe('guest@example.test');
  await request({action: 'update', token, guest: {firstName: 'Updated', lastName: 'Test', email: 'other@example.test'}});
  expect((await request({action: 'read', token})).data.guest).toMatchObject({firstName: 'Updated', email: 'guest@example.test'});
  expect((await request({action: 'cancel', token})).statusCode).toBe(200);
  expect((await request({action: 'read', token})).statusCode).toBe(410);
  expect((await request({action: 'availability', eventId: 'dinner'})).data).toEqual({remaining: 1});
});

test('requesting a link does not disclose whether an address has an RSVP', async () => {
  const response = await request({action: 'request', eventId: 'dinner', email: 'unknown@example.test'});
  expect(response.data).toEqual({accepted: true});
  expect(send).not.toHaveBeenCalled();
});
