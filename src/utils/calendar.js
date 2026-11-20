import {DateTime} from "luxon";

export const EVENT_ZONE = "America/Denver";
export const todayInMountainTime = () => DateTime.now().setZone(EVENT_ZONE).toISODate();
export const calendarTimes = event => {
  const date = DateTime.fromISO(event.start, {zone: EVENT_ZONE});
  return {...event, date: date.toISODate(), time: event.start.includes("T") ? date.toFormat("h:mm a") : "All day"};
};

export const compactCalendarTime = value => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? value.replaceAll("-", "")
  : DateTime.fromISO(value, {zone: EVENT_ZONE}).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");

export async function rsvpRequest(body, request = fetch) {
  const response = await request("/api/rsvp", {
    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The RSVP request couldn’t be completed.");
  return result;
}
export function editTimes(event) {
  const hasStart = typeof event.start === "string";
  const start = hasStart ? DateTime.fromISO(event.start, {zone: EVENT_ZONE}) : null;
  const end = typeof event.end === "string" ? DateTime.fromISO(event.end, {zone: EVENT_ZONE}) : null;
  return {
    ...(start?.isValid && {date: start.toISODate(), hour: start.toFormat("h"), minute: start.toFormat("mm"), period: start.toFormat("a")}),
    allDay: hasStart && !event.start.includes("T"),
    endDate: end?.isValid ? end.toISODate() : "",
    endTime: end?.isValid ? end.toFormat("HH:mm") : "",
    websiteRSVP: event.rsvpSources?.website !== false,
  };
}

export function eventFormTimes(form, previous) {
  const hour = Number(form.hour) % 12 + (form.period === "PM" ? 12 : 0);
  const startClock = String(hour).padStart(2, "0") + ":" + form.minute;
  const local = (date, clock, original) => {
    const value = DateTime.fromISO(date + "T" + clock, {zone: EVENT_ZONE});
    if (!value.isValid || value.toFormat("yyyy-MM-dd'T'HH:mm") !== date + "T" + clock) {
      throw new Error("Choose a valid Mountain Time. This time may fall in a daylight saving gap.");
    }
    const originalValue = original && DateTime.fromISO(original, {zone: EVENT_ZONE});
    if (originalValue?.isValid && originalValue.toFormat("yyyy-MM-dd'T'HH:mm") === date + "T" + clock) return originalValue;
    if (value.getPossibleOffsets().length > 1) throw new Error("That time occurs twice during the daylight saving change. Choose another time.");
    return value;
  };
  if (form.allDay) {
    const start = DateTime.fromISO(form.date, {zone: EVENT_ZONE});
    const end = form.endDate || start.plus({days: 1}).toISODate();
    if (!start.isValid || end <= form.date) throw new Error("An all-day event must end after its start date.");
    return {start: form.date, end};
  }
  const start = local(form.date, startClock, previous?.start);
  const end = form.endDate || form.endTime
    ? local(form.endDate || form.date, form.endTime || start.plus({hours: 2}).toFormat("HH:mm"), previous?.end)
    : start.plus({hours: 2});
  if (end <= start) throw new Error("End time must be later than start time.");
  return {start: start.toISO(), end: end.toISO()};
}
