import {google} from "googleapis";
import {DateTime} from "luxon";

// Calendar ID extracted from the public ICS URL
const CALENDAR_ID = "c_8d4665aa1fe4810f58bcc8c8bbb4be5d6dc14824ea33016fbab9e18fb8172382@group.calendar.google.com";

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

// Helper to stringify description metadata
const stringifyDescription = (data) => {
  let desc = data.description || "";
  const meta = [];

  if (data.capacity) meta.push(`[Capacity: ${data.capacity}]`);
  if (data.imageUrl) meta.push(`[Image: ${data.imageUrl}]`);
  if (data.imagePosition) meta.push(`[ImagePosition: ${data.imagePosition}]`);
  if (data.oneTableLink) meta.push(`[OneTable: ${data.oneTableLink}]`);
  if (data.rsvpApprovalMode) meta.push(`[Approval: ${data.rsvpApprovalMode}]`);
  if (data.limitCapacity) meta.push(`[LimitCapacity: ${data.limitCapacity}]`);

  if (meta.length > 0) {
    desc += "\n\n" + meta.join(" ");
  }
  return desc;
};

export default async function handler(req, res) {
  const calendar = getCalendarClient();

  try {
    if (req.method === "GET") {
      // LIST EVENTS
      const response = await calendar.events.list({
        calendarId: CALENDAR_ID,
        timeMin: new Date().toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items.map((item) => {
        const meta = parseDescription(item.description);
        return {
          id: item.id,
          title: item.summary,
          start: item.start.dateTime || item.start.date,
          end: item.end.dateTime || item.end.date,
          location: item.location,
          ...meta,
          // Keep original description for editing if needed, or use cleaned one
          originalDescription: item.description,
        };
      });

      return res.status(200).json({events});
    } else if (req.method === "POST") {
      // CREATE EVENT
      const {title, date, hour, minute, period, location, description, ...meta} = req.body;

      // Construct DateTime
      // Note: Frontend sends date/hour/minute/period. We need to convert to ISO.
      // Assuming Mountain Time for simplicity or UTC?
      // Better to handle timezone on frontend, but let's try to parse here or expect ISO.
      // For now, let's assume the frontend sends a constructed ISO string or we build it.
      // Re-using logic from Manager.js might be needed, but let's expect ISO 'start' and 'end' from frontend for cleaner API.

      const {start, end} = req.body; // Expect ISO strings

      const fullDescription = stringifyDescription({description, ...meta});

      const event = {
        summary: title,
        location: location,
        description: fullDescription,
        start: {
          dateTime: start,
          timeZone: "America/Denver", // Hardcoded for BCB based on context
        },
        end: {
          dateTime: end,
          timeZone: "America/Denver",
        },
      };

      const response = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        resource: event,
      });

      return res.status(200).json(response.data);
    } else if (req.method === "PUT") {
      // UPDATE EVENT
      const {id, title, start, end, location, description, ...meta} = req.body;

      const fullDescription = stringifyDescription({description, ...meta});

      const event = {
        summary: title,
        location: location,
        description: fullDescription,
        start: {
          dateTime: start,
          timeZone: "America/Denver",
        },
        end: {
          dateTime: end,
          timeZone: "America/Denver",
        },
      };

      const response = await calendar.events.update({
        calendarId: CALENDAR_ID,
        eventId: id,
        resource: event,
      });

      return res.status(200).json(response.data);
    } else if (req.method === "DELETE") {
      // DELETE EVENT
      const {id} = req.query;

      await calendar.events.delete({
        calendarId: CALENDAR_ID,
        eventId: id,
      });

      return res.status(200).json({message: "Event deleted"});
    }

    return res.status(405).json({error: "Method not allowed"});
  } catch (error) {
    console.error("Google Calendar API Error:", error);
    return res.status(500).json({error: error.message});
  }
}
