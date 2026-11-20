/** @jest-environment node */
jest.mock('../api/_auth', () => ({requireManager: jest.fn()}));
jest.mock(require.resolve('googleapis', {paths: [require.resolve('../api/events')]}), () => ({
  google: {auth: {GoogleAuth: jest.fn()}, calendar: jest.fn()},
}));
const {requireManager} = require('../api/_auth');
const {google} = require(require.resolve('googleapis', {paths: [require.resolve('../api/events')]}));
const handler = require('../api/events');

let events;
beforeEach(() => {
  events = {get: jest.fn(), patch: jest.fn().mockResolvedValue({data: {}}), delete: jest.fn().mockResolvedValue({})};
  google.calendar.mockReturnValue({events});
});

async function call(method, role, start, source) {
  const transaction = {
    get: jest.fn().mockResolvedValue({exists: true, data: () => ({date: start})}),
    update: jest.fn(), delete: jest.fn(),
  };
  const db = {collection: () => ({doc: () => ({})}), runTransaction: callback => callback(transaction)};
  requireManager.mockResolvedValue({role, admin: {firestore: () => db}});
  events.get.mockResolvedValue({data: {start: start.includes('T') ? {dateTime: start} : {date: start}, end: {date: "2099-01-02"}}});
  const res = {statusCode: 200, status(code) {this.statusCode = code; return this;}, json(data) {this.body = data; return this;}};
  await handler({method, query: {id: 'fixture', source}, body: {id: 'fixture', title: 'Edit', ...(source ? {} : {start: '2099-01-01', end: '2099-01-02'})}}, res);
  return {res, transaction};
}

test.each(['PUT', 'DELETE'])('manager %s cannot mutate a past Google or legacy event', async method => {
  const result = await call(method, 'manager', '2001-01-01T18:00:00-07:00');
  expect(result.res.statusCode).toBe(403);
  expect(events.patch).not.toHaveBeenCalled();
  expect(events.delete).not.toHaveBeenCalled();
  const legacy = await call(method, 'manager', '2001-01-01', 'firestore');
  expect(legacy.res.statusCode).toBe(403);
  expect(legacy.transaction.update).not.toHaveBeenCalled();
  expect(legacy.transaction.delete).not.toHaveBeenCalled();
});

test('manager can edit an upcoming event and admin can delete a past event', async () => {
  expect((await call('PUT', 'manager', '2099-01-01')).res.statusCode).toBe(200);
  expect(events.patch).toHaveBeenCalledTimes(1);
  expect((await call('DELETE', 'admin', '2001-01-01')).res.statusCode).toBe(200);
  expect(events.delete).toHaveBeenCalledTimes(1);
  const upcoming = await call('PUT', 'manager', '2099-01-01', 'firestore');
  expect(upcoming.transaction.update).toHaveBeenCalledWith(expect.anything(), {title: 'Edit'});
});

test('the public catalog follows page tokens and excludes private and canceled events', async () => {
  const item = {id: 'public', iCalUID: 'public@google.com', summary: 'Public Event', start: {date: '2099-04-01'}, end: {date: '2099-04-03'}};
  events.list = jest.fn()
    .mockResolvedValueOnce({data: {items: [item, {...item, id: 'private', visibility: 'private', location: 'Private draft'}], nextPageToken: 'next'}})
    .mockResolvedValueOnce({data: {items: [{...item, id: 'cancelled', status: 'cancelled'}, {...item, id: 'instance', recurringEventId: 'series'}]}});
  expect(await handler.readEvents()).toMatchObject([
    {id: 'public', start: '2099-04-01', end: '2099-04-03'},
    {id: 'instance', recurring: true},
  ]);
  expect(events.list).toHaveBeenNthCalledWith(2, expect.objectContaining({pageToken: 'next'}));
});

test('the subscription uses the public catalog and retains exclusive all-day end dates', async () => {
  events.list = jest.fn().mockResolvedValue({data: {items: [
    {id: 'day', iCalUID: 'day@google.com', summary: 'All-day gathering', start: {date: '2099-04-01'}, end: {date: '2099-04-03'}},
    {id: 'secret', summary: 'Private event', visibility: 'private', start: {date: '2099-04-01'}, end: {date: '2099-04-02'}},
  ]}});
  const res = {statusCode: 200, setHeader: jest.fn(), status(code) {this.statusCode = code; return this;},
    json(data) {this.body = data;}, send(data) {this.body = data;}};
  await require('../api/calendar')({method: 'GET'}, res);
  expect(res.statusCode).toBe(200);
  expect(res.body).toContain('DTSTART;VALUE=DATE:20990401');
  expect(res.body).toContain('DTEND;VALUE=DATE:20990403');
  expect(res.body).not.toContain('Private event');
});
