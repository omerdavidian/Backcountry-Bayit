const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config({path: ".env.local"});

const app = express();
// Keep 3001 available for Create React App when its default port (3000) is busy.
const PORT = process.env.SERVER_PORT || 3002;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// API Routes
const eventsHandler = require("./api/events");
const listUsersHandler = require("./api/list-users");
const createManagerHandler = require("./api/create-manager");
const deleteUserHandler = require("./api/delete-user");
const sendBulkEmailHandler = require("./api/send-bulk-email");

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
app.all("/api/list-users", adaptHandler(listUsersHandler));
app.all("/api/create-manager", adaptHandler(createManagerHandler));
app.all("/api/delete-user", adaptHandler(deleteUserHandler));
app.all("/api/send-bulk-email", adaptHandler(sendBulkEmailHandler));

// Start server
app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
});
