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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error response:', errorText);
      
      try {
        const error = JSON.parse(errorText);
        throw new Error(error.details || error.error || 'Failed to send email');
      } catch (parseError) {
        throw new Error(`Failed to send email: ${response.status} ${errorText}`);
      }
    }

    const result = await response.json();
    console.log('Email sent successfully:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error sending RSVP confirmation email:', error);
    return { success: false, error: error.message };
  }
};
