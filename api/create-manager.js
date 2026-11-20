const invitation = require("./manager-invitation");

module.exports = (req, res) => invitation({
  ...req,
  method: req.method,
  headers: req.headers,
  body: {email: req.body?.email ?? null},
}, res);
