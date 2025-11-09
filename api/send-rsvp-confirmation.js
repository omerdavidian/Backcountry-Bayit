// Vercel Serverless Function to send RSVP confirmation emails using Resend
// Note: Resend is required lazily so local dry-run tests can run without
// installing the production dependency.
module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Log for debugging
    console.log('Received request body:', req.body);
    console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);

  const { rsvpData, eventData, status, dryRun } = req.body;

    // Validate required fields
    if (!rsvpData || !eventData || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }


    // If dryRun is true, skip the actual send and return the prepared payload.
    if (dryRun === true) {
      console.log('Dry run requested - skipping actual email send.');
      const simulatedPayload = {
        to: Array.from(new Set([...(rsvpData.email ? [rsvpData.email] : []), ...(Array.isArray(rsvpData.attendees) ? rsvpData.attendees.map(a => a.email).filter(Boolean) : [])])),
        subject: `RSVP (${status}): ${eventData.title}`,
        htmlPreview: `Preview available in logs`,
        totalGuests: 1 + (Array.isArray(rsvpData.attendees) ? rsvpData.attendees.length : 0)
      };
      return res.status(200).json({ success: true, dryRun: true, payload: simulatedPayload });
    }

    // Build primary registrant name
    const primaryName = `${(rsvpData.firstName || rsvpData.name || '').trim()} ${(rsvpData.lastName || '').trim()}`.trim() || 'Guest';

    // Build recipients list (primary + any additional attendee emails)
    const recipients = new Set();
    if (rsvpData.email) recipients.add(rsvpData.email);
    if (Array.isArray(rsvpData.attendees)) {
      rsvpData.attendees.forEach(a => {
        if (a && a.email) recipients.add(a.email);
      });
    }

    const to = Array.from(recipients);

    const totalGuests = 1 + (Array.isArray(rsvpData.attendees) ? rsvpData.attendees.length : 0);

    // Build attendees HTML block
    const attendeeLines = [];
    attendeeLines.push(`<p><strong>Primary registrant:</strong> ${primaryName}${rsvpData.email ? ` &nbsp;(${rsvpData.email})` : ''}</p>`);
    if (Array.isArray(rsvpData.attendees) && rsvpData.attendees.length > 0) {
      attendeeLines.push('<p><strong>Additional attendees:</strong></p>');
      attendeeLines.push('<ul>');
      rsvpData.attendees.forEach(att => {
        const name = `${(att.firstName || '').trim()} ${(att.lastName || '').trim()}`.trim() || 'Guest';
        const email = att.email ? ` &nbsp;(${att.email})` : '';
        const phone = att.phone ? ` &nbsp;• ${att.phone}` : '';
        attendeeLines.push(`<li>${name}${email}${phone}</li>`);
      });
      attendeeLines.push('</ul>');
    }

    let subject = '';
    let htmlContent = '';

    if (status === 'approved') {
      subject = `RSVP Confirmed: ${eventData.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c5282;">RSVP Confirmed</h2>
          <p>Dear ${primaryName},</p>
          <p>Your RSVP has been confirmed for:</p>

          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Event:</strong> ${eventData.title}</p>
            <p><strong>Date:</strong> ${eventData.date}</p>
            <p><strong>Time:</strong> ${eventData.time}</p>
            <p><strong>Location:</strong> ${eventData.location}</p>
            <p><strong>Number of Guests:</strong> ${totalGuests}</p>
            ${rsvpData.dietaryRestrictions ? `<p><strong>Dietary Restrictions:</strong> ${rsvpData.dietaryRestrictions}</p>` : ''}
            ${attendeeLines.join('\n')}
          </div>

          <p>We look forward to seeing you!</p>
          <p>If you need to make any changes, please contact us directly.</p>

          <p style="margin-top: 30px;">Shalom,<br/>Backcountry Bayit Team</p>
        </div>
      `;
    } else if (status === 'pending') {
      subject = `RSVP Received: ${eventData.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c5282;">RSVP Received</h2>
          <p>Dear ${primaryName},</p>
          <p>Thank you for your RSVP! We have received your registration for:</p>

          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Event:</strong> ${eventData.title}</p>
            <p><strong>Date:</strong> ${eventData.date}</p>
            <p><strong>Time:</strong> ${eventData.time}</p>
            <p><strong>Location:</strong> ${eventData.location}</p>
            <p><strong>Number of Guests:</strong> ${totalGuests}</p>
            ${attendeeLines.join('\n')}
          </div>

          <p><strong>Your RSVP is currently pending approval.</strong> We will send you a confirmation email once it has been reviewed.</p>
          <p>If you need to make any changes, please contact us directly.</p>

          <p style="margin-top: 30px;">Shalom,<br/>Backcountry Bayit Team</p>
        </div>
      `;
    } else if (status === 'waitlist') {
      subject = `Waitlist Confirmation: ${eventData.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c5282;">Waitlist Confirmation</h2>
          <p>Dear ${primaryName},</p>
          <p>Thank you for your interest in:</p>

          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Event:</strong> ${eventData.title}</p>
            <p><strong>Date:</strong> ${eventData.date}</p>
            <p><strong>Time:</strong> ${eventData.time}</p>
            <p><strong>Location:</strong> ${eventData.location}</p>
          </div>

          <p>Unfortunately, this event has reached capacity. You have been added to the waitlist and will be notified if space becomes available.</p>
          <p><strong>Number of Guests Requested:</strong> ${totalGuests}</p>
          <p>If you have any questions, please contact us directly.</p>

          <p style="margin-top: 30px;">Shalom,<br/>Backcountry Bayit Team</p>
        </div>
      `;
    }

    // Lazily require Resend so local tests can skip installing the lib.
    const { Resend } = require('resend');
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return res.status(500).json({ error: 'Email service not configured' });
    }
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Build from address. Prefer a verified single-sender email if provided.
    const senderEmail = process.env.SENDER_EMAIL; // e.g. 'you@example.com'
    const senderName = process.env.SENDER_NAME || 'Backcountry Bayit';
    const fromAddress = senderEmail ? `${senderName} <${senderEmail}>` : 'Backcountry Bayit <noreply@bcbayit.org>';
    console.log('Using from address:', fromAddress);

    // Send email using Resend
    const data = await resend.emails.send({
      from: fromAddress,
      to,
      subject: subject,
      html: htmlContent,
      reply_to: process.env.REPLY_TO || 'info@bcbayit.org'
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ 
      error: 'Failed to send email', 
      details: error.message 
    });
  }
}
