const {createHash} = require("node:crypto");
const {google} = require("googleapis");
const {DateTime} = require("luxon");
const {requireManager} = require("./_auth");

// Calendar ID extracted from the public ICS URL
const CALENDAR_ID = process.env.BCB_CALENDAR_ID || "c_8d4665aa1fe4810f58bcc8c8bbb4be5d6dc14824ea33016fbab9e18fb8172382@group.calendar.google.com";

// Initialize Google Calendar API
const getCalendarClient = () => {
  const credentials = {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") : undefined,
    project_id: process.env.FIREBASE_PROJECT_ID,
  };

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({version: "v3", auth});
};

// Helper to parse description metadata
const parseDescription = (description = "") => {
  const metadata = {
    description: description,
    capacity: 40,
    imageUrl: "",
    imagePosition: 50,
    oneTableLink: "",
    rsvpSources: {website: true, oneTable: false},
    rsvpApprovalMode: "immediate",
    limitCapacity: false,
  };

  if (!description) return metadata;

  // Extract metadata fields
  const capacityMatch = description.match(/\[Capacity:\s*(\d+)\]/i);
  if (capacityMatch) metadata.capacity = parseInt(capacityMatch[1], 10);

  const imageMatch = description.match(/\[Image:\s*(https?:\/\/[^\]]+)\]/i);
  if (imageMatch) metadata.imageUrl = imageMatch[1];

  const posMatch = description.match(/\[ImagePosition:\s*(\d+)\]/i);
  if (posMatch) metadata.imagePosition = parseInt(posMatch[1], 10);

  const oneTableMatch = description.match(/\[OneTable:\s*(https?:\/\/[^\]]+)\]/i);
  if (oneTableMatch) {
    metadata.oneTableLink = oneTableMatch[1];
    metadata.rsvpSources.oneTable = true;
  }

  const approvalMatch = description.match(/\[Approval:\s*(\w+)\]/i);
  if (approvalMatch) metadata.rsvpApprovalMode = approvalMatch[1];

  const limitMatch = description.match(/\[LimitCapacity:\s*(true|false)\]/i);
  if (limitMatch) metadata.limitCapacity = limitMatch[1].toLowerCase() === "true";

  // Clean description by removing metadata tags
  metadata.description = description
    .replace(/\[Capacity:\s*\d+\]/gi, "")
    .replace(/\[Image:\s*https?:\/\/[^\]]+\]/gi, "")
    .replace(/\[ImagePosition:\s*\d+\]/gi, "")
    .replace(/\[OneTable:\s*https?:\/\/[^\]]+\]/gi, "")
    .replace(/\[Approval:\s*\w+\]/gi, "")
    .replace(/\[LimitCapacity:\s*(true|false)\]/gi, "")
    .trim();

  return metadata;
};

const EVENT_ZONE = "America/Denver";
const legacyFields = [
  "title", "date", "time", "start", "end", "location", "description", "capacity",
  "rsvpSources", "oneTableLink", "rsvpApprovalMode", "limitCapacity", "imageUrl", "imagePosition",
];

function canModifyEvent(role, start) {
  if (role === "admin") return true;
  const eventTime = typeof start === "string"
    ? DateTime.fromISO(start, {zone: EVENT_ZONE})
    : DateTime.fromJSDate(start?.toDate?.() ?? new Date(NaN), {zone: EVENT_ZONE});
  return eventTime.isValid && eventTime.startOf("day") >= DateTime.now().setZone(EVENT_ZONE).startOf("day");
}

async function modifyLegacyEvent(req, res, ctx) {
  const id = req.method === "PUT" ? req.body?.id : req.query.id;
  if (typeof id !== "string" || !id || id.includes("/")) {
    return res.status(400).json({error: "A valid event ID is required."});
  }
  const db = ctx.admin.firestore();
  const ref = db.collection("events").doc(id);
  const result = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return 404;
    const event = snapshot.data();
    if (!canModifyEvent(ctx.role, event.start || event.date)) return 403;
    if (req.method === "DELETE") {
      transaction.delete(ref);
    } else {
      const changes = Object.fromEntries(legacyFields.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));
      if (!Object.keys(changes).length) return 400;
      transaction.update(ref, changes);
    }
    return 200;
  });
  if (result === 403) return res.status(403).json({error: "Only admins can edit or delete past events."});
  if (result === 404) return res.status(404).json({error: "Event not found."});
  if (result === 400) return res.status(400).json({error: "No event changes provided."});
  return res.status(200).json({success: true});
}

function eventResource(body, existing) {
  const {title, start, end, location, description} = body || {};
  if (typeof title !== "string" || !title.trim() || typeof start !== "string" || typeof end !== "string") return null;
  const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const allDay = dateOnly(start);
  const from = DateTime.fromISO(start, {zone: EVENT_ZONE});
  const to = DateTime.fromISO(end, {zone: EVENT_ZONE});
  if (!from.isValid || !to.isValid || allDay !== dateOnly(end) || from >= to) return null;
  const when = (raw, time) => allDay ? {date: raw} : {dateTime: time.toISO(), timeZone: EVENT_ZONE};
  const link = value => typeof value === "string" && /^https?:\/\//i.test(value) ? value.slice(0, 1000) : "";
  return {
    summary: title.trim(),
    location: typeof location === "string" ? location : "",
    description: typeof description === "string" ? description : "",
    start: when(start, from), end: when(end, to),
    extendedProperties: {
      ...existing?.extendedProperties,
      private: {
        ...existing?.extendedProperties?.private,
        bcbWebsite: String(body.rsvpSources?.website !== false),
        bcbOneTable: body.rsvpSources?.oneTable === false ? "" : link(body.oneTableLink),
        bcbCapacity: String(Math.max(1, Number(body.capacity) || 40)),
        bcbLimit: String(Boolean(body.limitCapacity)),
        bcbApproval: body.rsvpApprovalMode === "approval" ? "approval" : "immediate",
        bcbImage: link(body.imageUrl),
        bcbImagePosition: String(body.imagePosition ?? 50),
      },
    },
  };
}

module.exports = async function handler(req, res) {
  let ctx;
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    try {
      ctx = await requireManager(req);
    } catch (error) {
      return res.status(error.status || 401).json({error: error.message || "Unauthorized"});
    }
  }

  try {
    if (ctx && ["PUT", "DELETE"].includes(req.method) && req.query?.source === "firestore") {
      return await modifyLegacyEvent(req, res, ctx);
    }
    const calendar = getCalendarClient();
    if (req.method === "GET") return res.status(200).json({events: await readEvents(calendar), calendarId: CALENDAR_ID});
    if (req.method === "POST") {
      const event = eventResource(req.body);
      if (!event) return res.status(400).json({error: "Enter a valid title, start and end time."});
      const key = req.body.createKey;
      if (typeof key === "string" && /^[a-f0-9-]{36}$/i.test(key)) {
        event.id = createHash("sha256").update(ctx.decoded.uid + ":" + key).digest("hex");
      }
      try {
        const {data} = await calendar.events.insert({calendarId: CALENDAR_ID, resource: event});
        return res.status(200).json(publicEvent(data));
      } catch (error) {
        if (Number(error.code) !== 409 || !event.id) throw error;
        const {data} = await calendar.events.get({calendarId: CALENDAR_ID, eventId: event.id});
        if (!publicEvent(data)) return res.status(409).json({error: "This event has already been removed."});
        return res.status(200).json(publicEvent(data));
      }
    }
    if (req.method === "PUT" || req.method === "DELETE") {
      const id = req.method === "PUT" ? req.body?.id : req.query?.id;
      if (typeof id !== "string" || !id) return res.status(400).json({error: "A valid event ID is required."});
      const params = {calendarId: CALENDAR_ID, eventId: id};
      const {data: existing} = await calendar.events.get(params);
      if (!canModifyEvent(ctx.role, existing.start?.dateTime || existing.start?.date)) {
        return res.status(403).json({error: "Only admins can edit or delete past events."});
      }
      if (!publicEvent(existing)) return res.status(404).json({error: "This event is unavailable."});
      if (existing.recurringEventId || existing.recurrence?.length) {
        return res.status(409).json({error: "Edit or cancel recurring events in Google Calendar."});
      }
      const version = req.method === "PUT" ? req.body.version : req.query?.version;
      if (version && version !== existing.etag) return res.status(409).json({error: "This event changed. Reload before saving."});
      const options = existing.etag ? {headers: {"If-Match": existing.etag}} : undefined;
      if (req.method === "DELETE") {
        await calendar.events.delete(params, options);
        return res.status(200).json({message: "Event deleted"});
      }
      const event = eventResource(req.body, existing);
      if (!event) return res.status(400).json({error: "Enter a valid title, start and end time."});
      const {data} = await calendar.events.patch({...params, resource: event}, options);
      return res.status(200).json(publicEvent(data));
    }
    return res.status(405).json({error: "Method not allowed"});
  } catch (error) {
    if (Number(error.code) === 412) return res.status(409).json({error: "This event changed. Reload before saving."});
    if ([404, 410].includes(Number(error.code))) return res.status(404).json({error: "This event is unavailable."});
    console.error("Calendar request failed:", error.code);
    return res.status(500).json({error: "Failed to process the event request"});
  }
};

function publicEvent(item) {
  if (!item?.start || !item.end || item.status === "cancelled" ||
      ["private", "confidential"].includes(item.visibility) ||
      item.extendedProperties?.private?.bcbPrivate === "true") return null;
  const meta = parseDescription(item.description);
  const settings = item.extendedProperties?.private || {};
  const link = settings.bcbOneTable ?? meta.oneTableLink;
  return {
    ...meta, id: item.id, uid: item.iCalUID, title: item.summary || "Community event",
    start: item.start.dateTime || item.start.date, end: item.end.dateTime || item.end.date,
    location: item.location || "", status: item.status || "confirmed", version: item.etag,
    recurring: Boolean(item.recurringEventId || item.recurrence?.length), updated: item.updated,
    capacity: Number(settings.bcbCapacity) || meta.capacity,
    imageUrl: settings.bcbImage ?? meta.imageUrl,
    imagePosition: Number(settings.bcbImagePosition ?? meta.imagePosition),
    limitCapacity: settings.bcbLimit === undefined ? meta.limitCapacity : settings.bcbLimit === "true",
    rsvpApprovalMode: settings.bcbApproval ?? meta.rsvpApprovalMode,
    rsvpSources: {website: settings.bcbWebsite !== "false", oneTable: Boolean(link)},
    oneTableLink: /^https?:\/\//i.test(link) ? link : "",
  };
}

async function readEvents(calendar = getCalendarClient()) {
  const events = [];
  let pageToken;
  do {
    const {data} = await calendar.events.list({
      calendarId: CALENDAR_ID, maxResults: 250, singleEvents: true, orderBy: "startTime",
      timeMin: process.env.BCB_CALENDAR_ARCHIVE_START || "2024-01-01T00:00:00Z", pageToken,
    });
    events.push(...(data.items || []).map(publicEvent).filter(Boolean));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return events;
}

async function readEvent(id) {
  try {
    const {data} = await getCalendarClient().events.get({calendarId: CALENDAR_ID, eventId: id});
    return publicEvent(data);
  } catch (error) {
    if ([404, 410].includes(Number(error.code))) return null;
    throw error;
  }
}

module.exports.readEvents = readEvents;
module.exports.readEvent = readEvent;
