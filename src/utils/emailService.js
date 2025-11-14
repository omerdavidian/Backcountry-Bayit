export const sendRSVPConfirmationEmail = async (rsvpData, eventData, status = 'approved') => {
  try {
    console.log('Attempting to send RSVP confirmation email...');
    console.log('RSVP Data:', rsvpData);
    console.log('Event Data:', eventData);
    console.log('Status:', status);

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

    console.log('API Response status:', response.status);

    const responseBody = await response.text();

    if (!response.ok) {
      console.error('API Error response:', responseBody);
      try {
        const parsed = JSON.parse(responseBody);
        throw new Error(parsed.details || parsed.error || 'Failed to send email');
      } catch (parseError) {
        throw new Error(`Failed to send email: ${response.status} ${responseBody}`);
      }
    }

    const result = responseBody ? JSON.parse(responseBody) : {};
    console.log('Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending RSVP confirmation email:', error);
    throw error;
  }
};
