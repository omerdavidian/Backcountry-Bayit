const {Resend} = require("resend");
const {guestEmail} = require("./_emailTemplates");
const admin = require("firebase-admin");
const {applyCors, requireManager} = require("./_auth");

module.exports = async function handler(req, res) {
  // Restrictive CORS (only allow-listed origins)
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed"});
  }

  // Sending bulk email to guests requires an authenticated manager/admin
  let ctx;
  try {
    ctx = await requireManager(req);
  } catch (e) {
    return res.status(e.status || 401).json({error: e.message || "Unauthorized"});
  }

  const db = ctx.admin.firestore();

  const {recipients, subject, message, eventId, eventTitle} = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({error: "No recipients provided"});
  }

  if (!subject || !message) {
    return res.status(400).json({error: "Subject and message are required"});
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return res.status(500).json({error: "Server configuration error: Missing email API key"});
  }

  const resend = new Resend(resendApiKey);
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  // TEMPORARY THROTTLING SOLUTION
  // Requirement: Send emails sequentially at 1 email per second to avoid Resend rate limits.
  // This is a temporary workaround and should be replaced with a proper queue system later.
  
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const sendResults = [];

  for (const [index, recipient] of recipients.entries()) {
    try {
      const {email, name} = recipient;

      // Simple personalization
      const personalizedMessage = message.replace(/\[Name\]/g, name || "Guest");

      const {data, error} = await resend.emails.send({
        from: "Backcountry Bayit <noreply@bcbayit.org>",
        to: email,
        subject,
        ...guestEmail(subject, personalizedMessage, eventTitle),
      });

      if (error) {
        console.error(`Failed to send to ${email}:`, error);
        results.failed++;
        results.errors.push({email, error});
        sendResults.push({email, status: "failed", error});
      } else {
        results.success++;
        sendResults.push({email, status: "sent", id: data.id});
      }
    } catch (err) {
      console.error(`Exception sending to ${recipient.email}:`, err);
      results.failed++;
      results.errors.push({email: recipient.email, error: err.message});
      sendResults.push({email: recipient.email, status: "error", error: err.message});
    }

    // Throttle: Wait 1 second before next email (unless it's the last one)
    if (index < recipients.length - 1) {
      await sleep(1000);
    }
  }

  // Log to Firestore
  try {
    await db.collection("email_logs").add({
      eventId,
      eventTitle,
      subject,
      message, // Log original message
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      recipientCount: recipients.length,
      successCount: results.success,
      failureCount: results.failed,
      details: sendResults, // Store detailed status for each recipient
    });
  } catch (logError) {
    console.error("Failed to log email batch to Firestore:", logError);
    // Don't fail the request just because logging failed, but note it.
  }

  return res.status(200).json({
    message: `Emails processed. Success: ${results.success}, Failed: ${results.failed}`,
    results,
  });
};
