import {calendarTimes, editTimes, eventFormTimes} from './calendar';

test('event time is projected in Denver even with a different source offset', () => {
  expect(calendarTimes({start: '2026-04-18T01:00:00Z'})).toMatchObject({date: '2026-04-17', time: '7:00 PM'});
});

test('editing preserves an overnight event and its non-default duration', () => {
  const event = {start: '2026-04-17T23:00:00-06:00', end: '2026-04-18T02:45:00-06:00'};
  const result = eventFormTimes(editTimes(event), event);
  expect(new Date(result.start).getTime()).toBe(new Date(event.start).getTime());
  expect(new Date(result.end).getTime()).toBe(new Date(event.end).getTime());
});

test('supports exclusive all-day end dates and rejects invalid DST wall times', () => {
  expect(eventFormTimes({allDay: true, date: '2026-11-01'})).toEqual({start: '2026-11-01', end: '2026-11-02'});
  expect(() => eventFormTimes({date: '2026-03-08', hour: '2', minute: '30', period: 'AM'})).toThrow('daylight saving gap');
  expect(() => eventFormTimes({date: '2026-11-01', hour: '1', minute: '30', period: 'AM'})).toThrow('occurs twice');
});
