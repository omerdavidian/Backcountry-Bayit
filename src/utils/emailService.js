export const sendRSVPConfirmationEmail = async (rsvpData, eventData, status = 'approved') => {
  try {
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

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to send email');
    }

    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    console.error('Error sending RSVP confirmation email:', error);
    return { success: false, error: error.message };
  }
};
