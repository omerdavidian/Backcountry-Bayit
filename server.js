const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// API Routes
const eventsHandler = require("./api/events");

// Wrapper to adapt Vercel/Next.js handler (req, res) to Express
const adaptHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error("API Error:", error);
    if (!res.headersSent) {
      res.status(500).json({error: error.message});
    }
  }
};

app.all("/api/events", adaptHandler(eventsHandler));

// Start server
app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
});
