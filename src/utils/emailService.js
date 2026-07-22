export const sendRSVPConfirmationEmail = async (rsvpData, eventData, status = 'approved') => {
  try {
    // Note: do not log rsvpData/eventData — they contain guest PII (name, email, phone)

    // Call Vercel serverless function
    const response = await fetch('/api/send-rsvp-confirmation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rsvpData,
        eventData,
        status
      })
    });

    const responseBody = await response.text();

    if (!response.ok) {
      try {
        const parsed = JSON.parse(responseBody);
        throw new Error(parsed.error || 'Failed to send email');
      } catch (parseError) {
        throw new Error(`Failed to send email (${response.status})`);
      }
    }

    const result = responseBody ? JSON.parse(responseBody) : {};
    return result;
  } catch (error) {
    console.error('Error sending RSVP confirmation email:', error);
    throw error;
  }
};
