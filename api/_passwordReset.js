const {createHash} = require("crypto");
const {Resend} = require("resend");
const {initAdmin} = require("./firebase-admin");
const {resolveRole} = require("./_auth");
const {SITE, passwordResetEmail} = require("./_emailTemplates");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  const accepted = () => res.status(202).json({accepted: true});
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({error: "Enter a valid email address."});
  }
  try {
    const admin = initAdmin();
    const auth = admin.auth();
    const user = await auth.getUserByEmail(email).catch(error => {
      if (error.code === "auth/user-not-found") return null;
      throw error;
    });
    if (!user || user.disabled) return accepted();
    const role = await resolveRole(admin, {...user.customClaims, uid: user.uid});
    if (role !== "admin" && role !== "manager") return accepted();

    const db = admin.firestore();
    const ref = db.collection("passwordResetRequests").doc(createHash("sha256").update(email).digest("hex"));
    const allowed = await db.runTransaction(async tx => {
      const previous = (await tx.get(ref)).data();
      const now = Date.now();
      if (previous?.retryAfter > now) return false;
      tx.set(ref, {retryAfter: now + 5 * 60 * 1000});
      return true;
    });
    if (!allowed) return accepted();

    const generated = new URL(await auth.generatePasswordResetLink(user.email));
    const code = generated.searchParams.get("oobCode");
    if (!code) throw new Error("Missing Firebase reset code");
    const url = new URL("/reset-password", SITE);
    url.hash = new URLSearchParams({oobCode: code}).toString();
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: "Backcountry Bayit <info@bcbayit.org>", to: user.email, replyTo: "info@bcbayit.org",
      ...passwordResetEmail(url.href),
    });
    if (result.error || !result.data?.id) throw new Error("Reset email delivery failed");
  } catch (error) {
    console.error("Password reset request failed", error.code || "internal");
  }
  return accepted();
};
