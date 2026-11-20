const {readEvents} = require("./events");
const {DateTime} = require("luxon");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({error: "Method not allowed"});
  try {
    const events = (await readEvents()).map(event => {
      const start = DateTime.fromISO(event.start, {zone: "America/Denver"});
      return {...event, date: start.toISODate(), time: event.start.includes("T") ? start.toFormat("h:mm a") : "All day"};
    });
    return res.status(200).json({events});
  } catch {
    return res.status(503).json({error: "Calendar temporarily unavailable."});
  }
};
