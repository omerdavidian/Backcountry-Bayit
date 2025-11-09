// Local test harness for API handler (dry-run)
const handler = require('./send-rsvp-confirmation');

// Create mock req/res objects
const req = {
  method: 'POST',
  body: {
    dryRun: true,
    status: 'approved',
    rsvpData: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test.user@example.com',
      attendees: [
        { firstName: 'Guest', lastName: 'One', email: 'guest.one@example.com', phone: '555-0101' },
        { firstName: 'Guest', lastName: 'Two', email: 'guest.two@example.com' }
      ],
      dietaryRestrictions: 'None'
    },
    eventData: {
      title: 'Local Test Event',
      date: '2025-12-01',
      time: '10:00 AM',
      location: 'Test Venue'
    }
  }
};

function createRes() {
  const res = {};
  res.statusCode = 200;
  res.headers = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { console.log('RES JSON:', JSON.stringify(obj, null, 2)); return obj; };
  res.end = () => { console.log('RES end'); };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

(async () => {
  try {
    const res = createRes();
    await handler(req, res);
    console.log('Local dry-run test completed.');
  } catch (err) {
    console.error('Error during local test:', err);
  }
})();