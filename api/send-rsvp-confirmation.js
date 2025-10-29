// Vercel Serverless Function to send RSVP confirmation emails using Resend
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rsvpData, eventData, status } = req.body;

    // Validate required fields
    if (!rsvpData || !eventData || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let subject = '';
    let htmlContent = '';

    if (status === 'approved') {
      subject = `RSVP Confirmed: ${eventData.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c5282;">RSVP Confirmed</h2>
          <p>Dear ${rsvpData.name},</p>
          <p>Your RSVP has been confirmed for:</p>
          
          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Event:</strong> ${eventData.title}</p>
            <p><strong>Date:</strong> ${eventData.date}</p>
            <p><strong>Time:</strong> ${eventData.time}</p>
            <p><strong>Location:</strong> ${eventData.location}</p>
            <p><strong>Number of Guests:</strong> ${rsvpData.guests}</p>
            ${rsvpData.dietaryRestrictions ? `<p><strong>Dietary Restrictions:</strong> ${rsvpData.dietaryRestrictions}</p>` : ''}
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
          <p>Dear ${rsvpData.name},</p>
          <p>Thank you for your RSVP! We have received your registration for:</p>
          
          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Event:</strong> ${eventData.title}</p>
            <p><strong>Date:</strong> ${eventData.date}</p>
            <p><strong>Time:</strong> ${eventData.time}</p>
            <p><strong>Location:</strong> ${eventData.location}</p>
            <p><strong>Number of Guests:</strong> ${rsvpData.guests}</p>
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
          <p>Dear ${rsvpData.name},</p>
          <p>Thank you for your interest in:</p>
          
          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Event:</strong> ${eventData.title}</p>
            <p><strong>Date:</strong> ${eventData.date}</p>
            <p><strong>Time:</strong> ${eventData.time}</p>
            <p><strong>Location:</strong> ${eventData.location}</p>
          </div>
          
          <p>Unfortunately, this event has reached capacity. You have been added to the waitlist and will be notified if space becomes available.</p>
          <p><strong>Number of Guests Requested:</strong> ${rsvpData.guests}</p>
          <p>If you have any questions, please contact us directly.</p>
          
          <p style="margin-top: 30px;">Shalom,<br/>Backcountry Bayit Team</p>
        </div>
      `;
    }

    // Send email using Resend
    const data = await resend.emails.send({
      from: 'Backcountry Bayit <noreply@bcbayit.org>',
      to: [rsvpData.email],
      subject: subject,
      html: htmlContent,
      reply_to: 'info@bcbayit.org'
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
