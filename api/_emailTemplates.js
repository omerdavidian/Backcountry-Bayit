const SITE = new URL(process.env.BCB_PUBLIC_ORIGIN || "https://www.backcountrybayit.com").origin;
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

function emailLayout({category, heading, paragraphs, details = [], action, note}) {
  const rows = details.filter(([, value]) => value !== undefined && value !== null && value !== "");
  return {
    text: ["Backcountry Bayit", heading, ...paragraphs, ...rows.map(([label, value]) => `${label}: ${value}`),
      note, action && `${action.label}: ${action.url}`].filter(Boolean).join("\n\n"),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;background:#edf4fb;color:#17304b;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf4fb"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:592px;background:#ffffff;border:1px solid #dae6f2;border-radius:18px;overflow:hidden">
<tr><td style="padding:20px 28px;background:#fff;color:#004080;font-size:16px;font-weight:bold">
<img src="${SITE}/images/email-logo.png" width="46" height="46" alt="" style="vertical-align:middle;margin-right:12px">Backcountry Bayit</td></tr>
<tr><td style="padding:30px 28px;background:#004080;color:#ffffff;border-top:4px solid #ffd700">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;color:#c8e5ff;font-weight:bold">${escapeHtml(category.toUpperCase())}</p>
<h1 style="margin:0;font-size:31px;line-height:1.15">${escapeHtml(heading)}</h1></td></tr>
<tr><td style="padding:26px 28px 30px;font-size:16px;line-height:1.6">
${paragraphs.map(paragraph => `<p style="margin:0 0 16px;white-space:pre-line">${escapeHtml(paragraph).replace(/\r?\n/g, "<br>")}</p>`).join("")}
${rows.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f7fc;border:1px solid #dce9f5;border-radius:12px;margin:0 0 20px">${rows.map(([label, value]) => `<tr><td style="padding:8px 14px;color:#415b73;font-size:14px">${escapeHtml(label)}</td><td style="padding:8px 14px;font-weight:bold">${escapeHtml(value)}</td></tr>`).join("")}</table>` : ""}
${action ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:4px 0 18px"><tr><td bgcolor="#0066cc" style="border-radius:8px"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:13px 20px;color:#fff;text-decoration:none;font-weight:bold">${escapeHtml(action.label)}</a></td></tr></table>` : ""}
${note ? `<p style="margin:0;color:#49627a;font-size:14px">${escapeHtml(note)}</p>` : ""}
</td></tr><tr><td style="padding:18px 28px;background:#f4f8fc;color:#49627a;font-size:13px;line-height:1.65">
<strong>Backcountry Bayit</strong><br><a href="${SITE}" style="color:#004080">Visit our website</a> &nbsp;·&nbsp; <a href="mailto:info@bcbayit.org" style="color:#004080">Contact us</a>
</td></tr></table></td></tr></table></body></html>`,
  };
}

function managerEmail(secret, onboarding) {
  return {
    subject: "Your Backcountry Bayit manager invitation",
    ...emailLayout({
      category: "Manager access",
      heading: onboarding ? "You’re invited to manage Backcountry Bayit" : "Your manager sign-in link",
      paragraphs: [onboarding
        ? "You’ve been invited to help manage events and RSVPs for the Backcountry Bayit community. Complete your profile to activate your manager account."
        : "Use the button below to sign in to your existing Backcountry Bayit manager account."],
      action: {
        label: onboarding ? "Complete your manager profile" : "Sign in to the dashboard",
        url: `${SITE}/${onboarding ? "manager/profile" : "login"}#invite=${secret}`,
      },
      note: "This link works once and expires in 30 days. If you weren’t expecting it, you can ignore this email.",
    }),
  };
}

function rsvpEmail({name, event, status, guests, dietary}) {
  const messages = {
    approved: ["RSVP confirmed", "Your spot is confirmed. We look forward to seeing you!"],
    pending: ["RSVP received", "We received your RSVP and will review it before confirming your spot."],
    waitlist: ["You’re on the waitlist", "This event is at capacity. We’ll be in touch if a spot opens."],
  };
  const [heading, message] = messages[status];
  return {
    subject: `${heading}: ${String(event.title || "").slice(0, 160)}`,
    ...emailLayout({
      category: "Community events", heading, paragraphs: [`Shalom ${name},`, message],
      details: [["Event", event.title], ["Date", event.date], ["Time", event.time], ["Location", event.location],
        ["Guests", guests], ["Dietary notes", dietary]],
      action: {label: "View community events", url: `${SITE}/events`},
      note: "Need to make a change? Reply to this email and we’ll help.",
    }),
  };
}

function guestEmail(subject, message, eventTitle) {
  return emailLayout({
    category: "Event update", heading: subject, paragraphs: [message],
    details: [["Event", eventTitle]],
    note: "You received this update because you RSVP’d for a Backcountry Bayit event.",
  });
}

module.exports = {SITE, emailLayout, managerEmail, rsvpEmail, guestEmail};
