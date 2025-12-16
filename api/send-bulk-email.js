const {Resend} = require("resend");
const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") : undefined,
      }),
    });
  } catch (error) {
    console.error("Firebase admin initialization error:", error);
  }
}

const db = admin.firestore();

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed"});
  }

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

  // Send emails in parallel (with some caution)
  // For larger lists, we might want to batch this, but for < 100 guests, Promise.all is likely fine.
  // We'll send individually to allow personalization and better deliverability.

  const emailPromises = recipients.map(async (recipient) => {
    try {
      const {email, name} = recipient;

      // Simple personalization
      const personalizedMessage = message.replace(/\[Name\]/g, name || "Guest");

      // Convert newlines to <br> for HTML email
      const htmlMessage = personalizedMessage.replace(/\n/g, "<br>");

      const {data, error} = await resend.emails.send({
        from: "Backcountry Bayit <noreply@bcbayit.org>",
        to: email,
        subject: subject,
        html: `
          <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
            <p>${htmlMessage}</p>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #888;">
              You are receiving this email because you RSVP'd to <strong>${eventTitle}</strong>.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error(`Failed to send to ${email}:`, error);
        results.failed++;
        results.errors.push({email, error});
        return {email, status: "failed", error};
      }

      results.success++;
      return {email, status: "sent", id: data.id};
    } catch (err) {
      console.error(`Exception sending to ${email}:`, err);
      results.failed++;
      results.errors.push({email: recipient.email, error: err.message});
      return {email: recipient.email, status: "error", error: err.message};
    }
  });

  const sendResults = await Promise.all(emailPromises);

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
