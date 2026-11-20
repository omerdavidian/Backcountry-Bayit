const {createHash, randomBytes} = require("node:crypto");
const {DateTime} = require("luxon");
const {Resend} = require("resend");
const {initAdmin} = require("./firebase-admin");
const {requireManager} = require("./_auth");
const {readEvent} = require("./events");
const {SITE, emailLayout} = require("./_emailTemplates");

const hash = value => createHash("sha256").update(value).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), {status});
const emailOf = value => typeof value === "string" ? value.trim().toLowerCase() : "";
const validEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const day = () => DateTime.now().setZone("America/Denver").toISODate();
const count = data => 1 + (Array.isArray(data.attendees) ? data.attendees.length : 0);
const occupied = data => !data.status || data.status === "approved";
const privateFields = ({firstName, lastName, email, phone, attendees, dietaryRestrictions}) =>
  ({firstName, lastName, email, phone: phone || "", attendees: attendees || [], dietaryRestrictions: dietaryRestrictions || ""});

function guestFields(value) {
  const clean = (input, size) => typeof input === "string" ? input.trim().slice(0, size) : "";
  const guest = record => {
    const firstName = clean(record?.firstName, 80), lastName = clean(record?.lastName, 80), email = emailOf(record?.email);
    if (!firstName || !lastName || !validEmail(email)) throw fail(400, "Enter a first name, last name and valid email for every guest.");
    return {firstName, lastName, email, phone: clean(record?.phone, 40)};
  };
  const attendees = value?.attendees || [];
  if (!Array.isArray(attendees) || attendees.length > 11) throw fail(400, "An RSVP can include up to 12 guests.");
  const result = {...guest(value), attendees: attendees.map(guest), dietaryRestrictions: clean(value?.dietaryRestrictions, 1000)};
  if (new Set([result.email, ...result.attendees.map(member => member.email)]).size !== attendees.length + 1) {
    throw fail(400, "Use a different email for each guest.");
  }
  return result;
}

async function eventFor(id) {
  if (typeof id !== "string" || !id || id.length > 256 || id.includes("/")) throw fail(400, "Select a valid event.");
  const event = await readEvent(id);
  if (!event || event.status === "cancelled") throw fail(404, "This event is unavailable.");
  return {...event, date: DateTime.fromISO(event.start, {zone: "America/Denver"}).toISODate()};
}

async function forEvent(db, eventId, operation) {
  const lock = db.collection("rsvpLocks").doc(hash(eventId));
  return db.runTransaction(async tx => {
    await tx.get(lock);
    const snapshot = await tx.get(db.collection("rsvps").where("eventId", "==", eventId));
    const result = await operation(tx, snapshot.docs);
    if (result.changed) tx.set(lock, {updatedAt: Date.now()});
    return result;
  });
}

async function limitPublicRequests(db, req) {
  const address = req.headers?.["x-vercel-forwarded-for"] || req.socket?.remoteAddress;
  if (typeof address !== "string" || !address) return;
  const now = Date.now();
  const key = db.collection("rsvpRequestLimits").doc(hash(address));
  await db.runTransaction(async tx => {
    const previous = (await tx.get(key)).data();
    const current = previous?.endsAt > now ? previous : {count: 0, endsAt: now + 600000};
    if (current.count >= 20) throw fail(429, "Please wait before making more RSVP requests.");
    tx.set(key, {...current, count: current.count + 1});
  });
}

async function sendLink(db, owner, event, status) {
  const key = db.collection("rsvpLinkLimits").doc(hash(owner.email));
  const now = Date.now(), token = randomBytes(32).toString("hex");
  const access = db.collection("rsvpAccess").doc(hash(token));
  const allowed = await db.runTransaction(async tx => {
    const limit = (await tx.get(key)).data();
    if (limit?.nextAt > now) return false;
    tx.set(key, {nextAt: now + 120000});
    tx.set(access, {id: owner.id, email: owner.email, eventId: event.id, expires: now + 86400000});
    return true;
  });
  if (!allowed) return false;
  const heading = status === "approved" ? "Your RSVP is confirmed" : status === "pending" ? "Your RSVP is awaiting approval" :
    status === "waitlist" ? "You’re on the waitlist" : "Manage your RSVP";
  try {
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: "Backcountry Bayit <noreply@bcbayit.org>", to: owner.email, replyTo: "info@bcbayit.org",
      subject: heading,
      ...emailLayout({
        category: "Community events", heading, details: [["Event", event.title]],
        paragraphs: ["Use this private link to view, update or cancel your RSVP."],
        action: {label: "Manage my RSVP", url: SITE + "/events#rsvp=" + token},
        note: "This link expires in 24 hours. If you didn’t request it, you can ignore this email.",
      }),
    });
    if (!result.data?.id || result.error) throw new Error("Email unavailable");
    return true;
  } catch {
    await db.runTransaction(async tx => {
      if ((await tx.get(key)).data()?.nextAt === now + 120000) tx.delete(key);
      tx.delete(access);
    });
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({error: "Method not allowed"});
  try {
    const {action, eventId, token, guest, email, confirmOneTable, rsvpId, status} = req.body || {};
    const db = initAdmin().firestore();
    const tickets = db.collection("rsvps");
    if (action === "availability") {
      const event = await eventFor(eventId);
      const snapshot = await tickets.where("eventId", "==", event.id).get();
      const reserved = snapshot.docs.reduce((sum, row) => sum + (occupied(row.data()) ? count(row.data()) : 0), 0);
      return res.json({remaining: event.limitCapacity ? Math.max(0, event.capacity - reserved) : null});
    }
    if (action === "request" || action === "register") {
      const fields = action === "register" ? guestFields(guest) : null;
      const recipient = fields?.email || emailOf(email);
      if (!validEmail(recipient)) throw fail(400, "Enter a valid email address.");
      await limitPublicRequests(db, req);
      const event = await eventFor(eventId);
      if (action === "request") {
        const snapshot = await tickets.where("eventId", "==", event.id).get();
        const row = snapshot.docs.find(entry => emailOf(entry.data().email) === recipient);
        if (row) await sendLink(db, {id: row.id, email: recipient}, event);
        return res.json({accepted: true});
      }
      if (!event.date || event.date < day() || event.rsvpSources?.website === false) throw fail(409, "Website RSVP is closed for this event.");
      if (event.rsvpSources?.oneTable && event.oneTableLink && confirmOneTable !== true) throw fail(400, "Confirm your OneTable registration.");
      const result = await forEvent(db, event.id, (tx, docs) => {
        const existing = docs.find(row => emailOf(row.data().email) === recipient);
        if (existing) return {id: existing.id};
        const emails = new Set([recipient, ...fields.attendees.map(entry => entry.email)]);
        const hasOverlap = docs.some(row => {
          const saved = row.data();
          return saved.status !== "rejected" && [saved.email, ...(saved.attendees || []).map(entry => entry.email)]
            .some(value => emails.has(emailOf(value)));
        });
        if (hasOverlap) throw fail(409, "A guest in this party may already have an RSVP. Use Manage my RSVP or contact us.");
        const reserved = docs.reduce((sum, row) => sum + (occupied(row.data()) ? count(row.data()) : 0), 0);
        const status = event.rsvpApprovalMode === "approval" ? "pending" :
          event.limitCapacity && reserved + count(fields) > event.capacity ? "waitlist" : "approved";
        const ref = tickets.doc();
        const timestamp = new Date();
        tx.set(ref, {...fields, status, timestamp, updatedAt: timestamp, eventId: event.id, eventTitle: event.title, eventDate: event.date});
        return {id: ref.id, status, changed: true};
      });
      const emailed = await sendLink(db, {id: result.id, email: recipient}, event, result.status);
      return res.json(result.changed ? {status: result.status, emailed} : {accepted: true});
    }
    if (action === "staff-status") {
      await requireManager(req);
      if (!["approved", "rejected"].includes(status) || typeof rsvpId !== "string" || !rsvpId || rsvpId.includes("/")) {
        throw fail(400, "Invalid RSVP status change.");
      }
      const current = await tickets.doc(rsvpId).get();
      if (!current.exists) throw fail(404, "RSVP not found.");
      const eventId = current.data().eventId;
      let event = null;
      if (status === "approved") {
        try {
          event = await eventFor(eventId);
        } catch (error) {
          if (error.status !== 404) throw error;
          const legacy = await db.collection("events").doc(eventId).get();
          if (!legacy.exists) throw error;
          event = legacy.data();
        }
      }
      await forEvent(db, eventId, (tx, docs) => {
        const target = docs.find(row => row.id === rsvpId);
        if (!target) throw fail(404, "RSVP not found.");
        const reserved = docs.reduce((sum, row) => sum + (row.id !== rsvpId && occupied(row.data()) ? count(row.data()) : 0), 0);
        if (event?.limitCapacity && reserved + count(target.data()) > event.capacity) throw fail(409, "Approving this RSVP would exceed the event capacity.");
        tx.update(target.ref, {status, updatedAt: new Date()});
        return {changed: true};
      });
      return res.json({success: true});
    }
    if (!["read", "update", "cancel"].includes(action) || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      throw fail(400, "Invalid RSVP request.");
    }
    const access = (await db.collection("rsvpAccess").doc(hash(token)).get()).data();
    if (!access || access.expires <= Date.now()) throw fail(410, "This link has expired. Request a new link from the event page.");
    const event = await eventFor(access.eventId);
    const result = await forEvent(db, event.id, (tx, docs) => {
      const target = docs.find(row => row.id === access.id);
      const current = target?.data();
      if (!current || emailOf(current.email) !== access.email) throw fail(410, "This RSVP is no longer available.");
      if (action === "read") return {event, guest: privateFields(current), status: current.status || "approved"};
      if (action === "cancel") {
        tx.delete(target.ref);
        return {changed: true};
      }
      const fields = guestFields({...guest, email: access.email});
      const emails = new Set(fields.attendees.map(entry => entry.email));
      if (docs.some(row => row.id !== target.id && row.data().status !== "rejected" &&
          [row.data().email, ...(row.data().attendees || []).map(entry => entry.email)].some(value => emails.has(emailOf(value))))) {
        throw fail(409, "An additional guest already has an RSVP.");
      }
      const reserved = docs.reduce((sum, row) => sum + (row.id !== target.id && occupied(row.data()) ? count(row.data()) : 0), 0);
      if (occupied(current) && event.limitCapacity && reserved + count(fields) > event.capacity && count(fields) > count(current)) {
        throw fail(409, "There are not enough seats to add these guests.");
      }
      tx.update(target.ref, {...fields, updatedAt: new Date()});
      return {changed: true, status: current.status || "approved"};
    });
    return res.json(result);
  } catch (error) {
    if (!error.status) console.error("RSVP request failed", error.code);
    return res.status(error.status || 500).json({error: error.status ? error.message : "We couldn’t process the RSVP. Please try again."});
  }
};
