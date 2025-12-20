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

      // Convert newlines to <br> for HTML email
      const htmlMessage = personalizedMessage.replace(/\n/g, "<br>");

      const {data, error} = await resend.emails.send({
        from: "Backcountry Bayit <noreply@bcbayit.org>",
        to: email,
        subject: subject,
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://bcbayit.org/images/logo.webp" alt="Backcountry Bayit" style="max-height: 80px; width: auto;" />
            </div>
            
            <div style="color: #333333; font-size: 16px; line-height: 1.6;">
              <p>${htmlMessage}</p>
            </div>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee; text-align: center; color: #888888; font-size: 14px;">
              <p style="margin-bottom: 10px; font-style: italic;">Thank you for supporting our community.</p>
              <p style="font-size: 12px; margin-top: 20px; color: #999999;">
                You are receiving this email because you RSVP'd to <strong>${eventTitle}</strong>.
              </p>
            </div>
          </div>
        `,
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
