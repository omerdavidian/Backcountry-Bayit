const {requireAdmin, resolveRole} = require("./_auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({error: "Method not allowed"});
  try {
    const {admin, decoded} = await requireAdmin(req);
    const {userId} = req.body || {};
    if (typeof userId !== "string" || !userId || userId.length > 128 || userId.includes("/") || userId === decoded.uid) {
      return res.status(400).json({error: "Select another manager."});
    }

    const auth = admin.auth();
    const user = await auth.getUser(userId);
    if (await resolveRole(admin, {...user.customClaims, uid: userId}) !== "manager") {
      return res.status(409).json({error: "This account does not have manager access."});
    }

    const db = admin.firestore();
    const batch = db.batch();
    batch.set(db.collection("users").doc(userId), {role: "user", managerRevokedAt: new Date()}, {merge: true});
    batch.set(db.collection("managerInvitations").doc(userId), {
      status: "Revoked", hash: null, setupOperation: null, setupUntil: null,
    }, {merge: true});
    await batch.commit();
    const {isManager, ...claims} = user.customClaims || {};
    try {
      await auth.setCustomUserClaims(userId, claims);
      await auth.revokeRefreshTokens(userId);
    } catch (error) {
      // The committed profile marker blocks manager permissions even on old tokens.
      console.error("Manager claim cleanup failed:", error.code);
    }
    return res.json({success: true, message: "Manager access removed."});
  } catch (error) {
    return res.status(error.status || 500).json({error: error.status ? error.message : "Could not remove manager access."});
  }
};
