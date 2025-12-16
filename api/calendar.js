import admin from 'firebase-admin';
import { createEvents } from 'ics';
import { DateTime } from 'luxon';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
    })
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const eventsSnapshot = await db.collection('events').get();
    const events = [];

    eventsSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Skip if no date or title
      if (!data.date || !data.title) return;

      // Parse date and time
      // Data format: date: "YYYY-MM-DD", time: "H:MM PM" (e.g. "6:30 PM")
      // We assume the event time is in Mountain Time (America/Denver)
      let startDateTime;
      
      try {
        const timeStr = data.time || '12:00 PM'; // Default to noon if no time
        const fullDateTimeStr = `${data.date} ${timeStr}`;
        
        // Parse as Denver time
        const dt = DateTime.fromFormat(fullDateTimeStr, 'yyyy-MM-dd h:mm a', { zone: 'America/Denver' });
        
        if (!dt.isValid) {
          console.warn(`Invalid date for event ${doc.id}: ${fullDateTimeStr} - ${dt.invalidReason}`);
          return;
        }
        
        // Convert to UTC for ICS
        const utc = dt.toUTC();
        startDateTime = [utc.year, utc.month, utc.day, utc.hour, utc.minute];
        
      } catch (e) {
        console.error(`Error parsing date for event ${doc.id}`, e);
        return;
      }

      // Construct event URL
      // Assuming the event page is at /events or we can link to specific event if routing supports it
      // For now, link to the main events page
      const url = 'https://backcountrybayit.com/events'; 

      events.push({
        start: startDateTime,
        startInputType: 'utc',
        duration: { hours: 2 }, // Default duration
        title: data.title,
        description: data.description || '',
        location: data.location || 'Backcountry Bayit',
        url: url,
        uid: doc.id, // Use Firestore ID as UID to ensure updates work correctly
        categories: ['Backcountry Bayit'],
        status: 'CONFIRMED',
        busyStatus: 'BUSY'
      });
    });

    // Generate ICS
    const { error, value } = createEvents(events);

    if (error) {
      console.error('Error generating ICS:', error);
      return res.status(500).json({ error: 'Error generating calendar feed' });
    }

    // Set headers for ICS file
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bcb-events.ics"');
    res.status(200).send(value);

  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: error.message });
  }
}
