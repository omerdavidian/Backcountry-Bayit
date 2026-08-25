// RSVP email sending is a privileged action. Keeping it behind manager
// authentication prevents this API from being abused as a phishing relay.
const {applyCors, requireManager} = require("./_auth");

const escapeHtml = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#39;");

const validEmail = (value) => typeof value === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({error: "Method not allowed"});

  try {
    await requireManager(req);
  } catch (error) {
    return res.status(error.status || 401).json({error: error.message || "Unauthorized"});
  }

  const {rsvpData, eventData, status} = req.body || {};
  if (!rsvpData || !eventData || !["approved", "pending", "waitlist"].includes(status)) {
    return res.status(400).json({error: "Invalid RSVP email request"});
  }

  const recipients = new Set([rsvpData.email]);
  if (Array.isArray(rsvpData.attendees)) {
    rsvpData.attendees.forEach((attendee) => recipients.add(attendee && attendee.email));
  }
  const to = [...recipients].filter(validEmail);
  if (to.length === 0 || to.length > 12) {
    return res.status(400).json({error: "A valid recipient list is required"});
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({error: "Email service not configured"});
  }

  const name = `${rsvpData.firstName || ""} ${rsvpData.lastName || ""}`.trim() || "Guest";
  const event = {
    title: escapeHtml(eventData.title), date: escapeHtml(eventData.date),
    time: escapeHtml(eventData.time), location: escapeHtml(eventData.location),
  };
  const labels = {
    approved: ["RSVP Confirmed", "Your RSVP has been confirmed."],
    pending: ["RSVP Received", "Your RSVP is awaiting approval."],
    waitlist: ["Waitlist Confirmation", "This event is at capacity and you have been added to the waitlist."],
  };
  const [heading, message] = labels[status];
  const guests = 1 + (Array.isArray(rsvpData.attendees) ? rsvpData.attendees.length : 0);
  const dietary = rsvpData.dietaryRestrictions
    ? `<p><strong>Dietary restrictions:</strong> ${escapeHtml(rsvpData.dietaryRestrictions)}</p>` : "";
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <h2>${heading}</h2><p>Dear ${escapeHtml(name)},</p><p>${message}</p>
    <div style="background:#f7fafc;padding:20px;border-radius:8px">
      <p><strong>Event:</strong> ${event.title}</p><p><strong>Date:</strong> ${event.date}</p>
      <p><strong>Time:</strong> ${event.time}</p><p><strong>Location:</strong> ${event.location}</p>
      <p><strong>Number of guests:</strong> ${guests}</p>${dietary}</div>
    <p>If you need to make changes, please contact us directly.</p><p>Shalom,<br>Backcountry Bayit Team</p></div>`;

  try {
    const {Resend} = require("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const senderEmail = process.env.SENDER_EMAIL || "info@bcbayit.org";
    const senderName = process.env.SENDER_NAME || "Backcountry Bayit";
    const {data, error} = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`, to,
      subject: `${heading}: ${String(eventData.title || "").slice(0, 160)}`,
      html, reply_to: process.env.REPLY_TO || "info@bcbayit.org",
    });
    if (error) {
      console.error("RSVP email provider error:", error);
      return res.status(502).json({error: "Email provider rejected the request"});
    }
    return res.status(200).json({success: true, id: data && data.id});
  } catch (error) {
    console.error("RSVP email error:", error.message);
    return res.status(500).json({error: "Failed to send email"});
  }
};
