const {DateTime} = require("luxon");
const {createEvents} = require("ics");
const {SITE} = require("./_emailTemplates");
const {readEvents} = require("./events");

function parts(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").map(Number);
  const date = DateTime.fromISO(value, {zone: "America/Denver"}).toUTC();
  return [date.year, date.month, date.day, date.hour, date.minute];
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({error: "Method not allowed"});
  try {
    const events = await readEvents();
    const values = events.map(event => ({
      uid: event.recurring ? event.id + "@backcountrybayit.com" : event.uid || event.id + "@backcountrybayit.com",
      title: event.title, description: event.description, location: event.location,
      start: parts(event.start), end: parts(event.end), startInputType: "utc", endInputType: "utc",
      ...(event.updated ? {lastModified: parts(event.updated)} : {}),
      url: SITE + "/events?event=" + encodeURIComponent(event.id),
    }));
    const {error, value} = values.length ? createEvents(values) : {value: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n"};
    if (error) throw error;
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    return res.status(200).send(value);
  } catch {
    return res.status(503).json({error: "Calendar feed temporarily unavailable."});
  }
};
