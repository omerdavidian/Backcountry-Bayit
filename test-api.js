import fetch from 'node-fetch';

const payload = {
  rsvpData: {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    attendees: [
      { firstName: "Jane", lastName: "Doe", email: "jane.doe@example.com" }
    ],
    dietaryRestrictions: "Vegetarian"
  },
  eventData: {
    title: "Community Gathering",
    date: "2025-11-15",
    time: "6:00 PM",
    location: "123 Main St, Anytown"
  },
  status: "approved",
  dryRun: false
};

fetch('http://localhost:3000/api/send-rsvp-confirmation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);