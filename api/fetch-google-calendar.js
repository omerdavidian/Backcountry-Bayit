import ical from "node-ical";
import {DateTime} from "luxon";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({error: "Method not allowed"});
  }

  try {
    // Public ICS URL provided by the user
    const icsUrl = "https://calendar.google.com/calendar/ical/c_8d4665aa1fe4810f58bcc8c8bbb4be5d6dc14824ea33016fbab9e18fb8172382%40group.calendar.google.com/public/basic.ics";

    const events = await ical.async.fromURL(icsUrl);
    const formattedEvents = [];

    for (const k in events) {
      if (events.hasOwnProperty(k)) {
        const ev = events[k];
        if (ev.type === "VEVENT") {
          // Parse metadata from description
          // Expected format in description:
          // Capacity: 50
          // Image: https://example.com/image.jpg
          // OneTable: https://onetable.org/...

          let description = ev.description || "";
          let capacity = 40; // Default
          let imageUrl = "";
          let oneTableLink = "";
          let imagePosition = 50;

          // Extract Capacity
          const capacityMatch = description.match(/Capacity:\s*(\d+)/i);
          if (capacityMatch) {
            capacity = parseInt(capacityMatch[1], 10);
            // Remove metadata from description for cleaner display
            // description = description.replace(capacityMatch[0], '');
          }

          // Extract Image URL
          const imageMatch = description.match(/Image:\s*(https?:\/\/[^\s]+)/i);
          if (imageMatch) {
            imageUrl = imageMatch[1];
            // description = description.replace(imageMatch[0], '');
          }

          // Extract OneTable Link
          const oneTableMatch = description.match(/OneTable:\s*(https?:\/\/[^\s]+)/i);
          if (oneTableMatch) {
            oneTableLink = oneTableMatch[1];
            // description = description.replace(oneTableMatch[0], '');
          }

          // Format date and time
          // Google Calendar ICS dates are already Date objects or strings
          const start = new Date(ev.start);
          const end = new Date(ev.end);

          // Format time string (e.g. "6:30 PM")
          // We assume the event is in the correct timezone or UTC.
          // We'll format it to display nicely.
          const timeStr = start.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Denver", // Force Denver time for display consistency
          });

          // Format date string (YYYY-MM-DD)
          const dateStr = start.toLocaleDateString("en-CA", {
            // YYYY-MM-DD
            timeZone: "America/Denver",
          });

          formattedEvents.push({
            id: ev.uid, // Use ICS UID to link with RSVPs
            title: ev.summary,
            description: description.trim(),
            location: ev.location || "Backcountry Bayit",
            date: dateStr,
            time: timeStr,
            start: start.toISOString(),
            end: end.toISOString(),
            capacity: capacity,
            imageUrl: imageUrl,
            imagePosition: imagePosition,
            oneTableLink: oneTableLink,
            rsvpSources: {
              website: !oneTableLink, // If OneTable link exists, assume website RSVP is secondary or disabled?
              // Actually, let's keep website RSVP enabled unless specified.
              // For now, default to true.
              oneTable: !!oneTableLink,
            },
          });
        }
      }
    }

    // Sort by date
    formattedEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

    return res.status(200).json({events: formattedEvents});
  } catch (error) {
    console.error("Error fetching Google Calendar:", error);
    return res.status(500).json({error: "Failed to fetch calendar events"});
  }
}
