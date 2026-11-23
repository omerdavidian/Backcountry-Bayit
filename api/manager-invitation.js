const {randomBytes, createHash} = require("crypto");
const {managerEmail} = require("./_emailTemplates");
const {Resend} = require("resend");
const {requireAdmin, resolveRole} = require("./_auth");
const requestPasswordReset = require("./_passwordReset");
const {admin, initAdmin} = require("./firebase-admin");
const digest = value => createHash("sha256").update(value).digest("hex");
const reject = (status, message) => Object.assign(new Error(message), {status});
const INVITATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const onboardingUid = email => "invite-" + digest(email.toLowerCase());
const isOnboardingAccount = user => user.email && /^invite-[a-f0-9]{64}$/.test(user.uid);

function validateProfile(profile) {
  const read = key => typeof profile?.[key] === "string" ? profile[key].trim() : "";
  const firstName = read("firstName");
  const lastName = read("lastName");
  const phone = read("phone");
  const birthday = read("birthday");
  const date = new Date(birthday + "T00:00:00Z");
  if (!firstName || !lastName || firstName.length > 80 || lastName.length > 80 ||
      !/^\+?[0-9(). -]{7,30}$/.test(phone) || phone.replace(/\D/g, "").length < 7 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(birthday) || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== birthday || birthday > new Date().toISOString().slice(0, 10) ||
      birthday < "1900-01-01") {
    throw reject(400, "Enter your first and last name, a valid phone number, and a valid birthday.");
  }
  return {firstName, lastName, phone, birthday, displayName: firstName + " " + lastName};
}

async function manager(uid) {
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/")) throw reject(400, "Invalid manager.");
  const user = await admin.auth().getUser(uid);
  if (user.disabled || !user.email) throw reject(403, "An active manager account is required.");
  const role = await resolveRole(admin, {...user.customClaims, uid});
  if (role === "manager") return {user, onboarding: false};
  if (role === "user") {
    const profile = (await admin.firestore().collection("users").doc(uid).get()).data();
    if (profile?.managerRevokedAt) return {user, onboarding: false, restore: true};
  }
  if (!role && isOnboardingAccount(user)) return {user, onboarding: true};
  throw reject(403, "An active manager account is required.");
}

async function createInvitee(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw reject(400, "Enter a valid email address.");
  const initialUid = onboardingUid(email);
  const oldProfile = (await admin.firestore().collection("users").doc(initialUid).get()).data();
  const uid = oldProfile?.managerRevokedAt && !oldProfile.role
    ? `invite-${randomBytes(32).toString('hex')}`
    : initialUid;
  try {
    await admin.auth().createUser({uid, email});
  } catch (error) {
    if (!["auth/email-already-exists", "auth/uid-already-exists"].includes(error.code)) throw error;
    const existing = await admin.auth().getUserByEmail(email);
    if (existing.uid !== uid) {
      const account = await manager(existing.uid).catch(error => {
        if (error.status === 403) throw reject(409, "An account with this email already exists.");
        throw error;
      });
      return account;
    }
  }
  return manager(uid);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  if (req.body?.action === "requestPasswordReset") return requestPasswordReset(req, res);
  try {
    const {uid, invite, email, profile, password, checkProfile, reset} = req.body || {};
    if (invite !== undefined) {
      if (typeof invite !== "string" || !/^[a-f0-9]{64}$/.test(invite)) throw reject(400, "Invalid invitation.");
      initAdmin();
      const db = admin.firestore();
      const matches = await db.collection("managerInvitations").where("hash", "==", digest(invite)).limit(1).get();
      const invalid = () => reject(410, "This invitation is expired or already used. Request a new invitation.");
      if (matches.empty) throw invalid();
      const ref = matches.docs[0].ref;
      const {user, onboarding, restore = false} = await manager(ref.id);
      const validRecord = record => record && record.hash === digest(invite) &&
        record.email === user.email && record.status === "Pending" && record.expires > Date.now() &&
        Boolean(record.onboarding) === onboarding && Boolean(record.restore) === restore;
      if (!validRecord((await ref.get()).data())) throw invalid();
      if (checkProfile === true) {
        if (!onboarding) throw invalid();
        return res.json({profileRequired: true});
      }
      const fields = onboarding ? validateProfile(profile) : null;
      if (typeof password !== "string" || password.length < 12 || password.length > 128) {
        throw reject(400, "Choose a password with 12 to 128 characters.");
      }

      const auth = admin.auth();
      const operation = randomBytes(16).toString("hex");
      await db.runTransaction(async tx => {
        const record = (await tx.get(ref)).data();
        if (!validRecord(record)) throw invalid();
        if (record.setupUntil > Date.now()) throw reject(409, "Setup is already in progress. Please try again shortly.");
        tx.update(ref, {setupOperation: operation, setupUntil: Date.now() + 300000});
      });
      try {
        await auth.updateUser(user.uid, {password, emailVerified: true, ...(fields && {displayName: fields.displayName})});
        const token = isOnboardingAccount(user)
          ? await auth.createCustomToken(user.uid, {isManager: true})
          : await auth.createCustomToken(user.uid);
        await db.runTransaction(async tx => {
          const record = (await tx.get(ref)).data();
          if (!validRecord(record) || record.setupOperation !== operation) throw invalid();
          if (restore) {
            const profileRef = db.collection("users").doc(user.uid);
            const existing = (await tx.get(profileRef)).data();
            if (!existing?.managerRevokedAt || existing.role !== "user") throw invalid();
            tx.set(profileRef, {role: "manager", managerRevokedAt: null}, {merge: true});
          }
          if (fields) {
            tx.set(db.collection("users").doc(user.uid), {
              ...fields, email: user.email, uid: user.uid, role: "manager", createdAt: new Date(),
            }, {merge: true});
          }
          tx.update(ref, {status: "Accepted", hash: null, setupUntil: null, setupOperation: null,
            ...(fields && {displayName: fields.displayName})});
        });
        return res.json({token});
      } catch (error) {
        await db.runTransaction(async tx => {
          const record = (await tx.get(ref)).data();
          if (record?.setupOperation === operation) tx.update(ref, {setupUntil: null, setupOperation: null});
        });
        if (error.code === "auth/invalid-password") throw reject(400, "Firebase rejected this password. Choose a stronger password and try again.");
        throw error;
      }
    }
    await requireAdmin(req);
    const {user, onboarding, restore = false} = email === undefined ? await manager(uid) : await createInvitee(email);
    const resetActive = !onboarding && !restore && email === undefined && reset === true;
    if (!onboarding && !restore && !resetActive) throw reject(409, "This person already has manager access. Use Reset invitation in their account row.");
    const db = admin.firestore();
    const ref = db.collection("managerInvitations").doc(user.uid);
    const secret = randomBytes(32).toString("hex");
    const hash = digest(secret);
    await db.runTransaction(async tx => {
      const previous = (await tx.get(ref)).data() || {};
      if (previous.status === "Deleting") throw reject(409, "This account is being deleted.");
      if (previous.setupUntil > Date.now()) throw reject(409, "This invitation is being completed. Try again shortly.");
      if (resetActive && (previous.status === "Revoked" || (previous.restore && previous.status !== "Accepted"))) throw reject(409, "Manager access changed. Refresh the users list.");
      if (previous.status === "Accepted" && !resetActive) throw reject(409, "This invitation was already accepted.");
      if (Date.now() - previous.attempt < 60000) throw reject(429, "Wait one minute before resending.");
      tx.set(ref, {
        hash, email: user.email, onboarding, restore, status: "Pending", expires: Date.now() + INVITATION_TTL_MS,
        attempt: Date.now(), lastSent: previous.lastSent || null, displayName: previous.displayName || null,
      });
    });
    let messageId = null;
    try {
      const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "Backcountry Bayit <info@bcbayit.org>",
        to: user.email,
        replyTo: "info@bcbayit.org",
        ...managerEmail(secret, onboarding),
      });
      if (!result.error) messageId = result.data?.id || null;
    } catch {
      messageId = null;
    } finally {
      await db.runTransaction(async tx => {
        const record = (await tx.get(ref)).data();
        if (record?.hash === hash) tx.update(ref, messageId ? {lastSent: Date.now(), messageId} : {hash:null, status:"Failed"});
      });
    }
    if (!messageId) throw reject(502, "Invitation delivery failed. Please try again.");
    return res.json({success:true});
  } catch (error) {
    return res.status(error.status || 500).json({error:error.status ? error.message : "Unable to process the invitation."});
  }
};
