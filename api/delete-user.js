const {requireAdmin, resolveRole} = require("./_auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({error: "Method not allowed"});
  try {
    const {admin, decoded} = await requireAdmin(req);
    const {userId, permanent = false} = req.body || {};
    if (typeof userId !== "string" || !userId || userId.length > 128 || userId.includes("/") || userId === decoded.uid) {
      return res.status(400).json({error: "Select another user."});
    }

    const auth = admin.auth();
    if (permanent === true) {
      const db = admin.firestore();
      const profileRef = db.collection("users").doc(userId);
      const inviteRef = db.collection("managerInvitations").doc(userId);
      const user = await auth.getUser(userId).catch(error => {
        if (error.code === "auth/user-not-found") return null;
        throw error;
      });

      await db.runTransaction(async tx => {
        const profile = (await tx.get(profileRef)).data();
        const invitation = (await tx.get(inviteRef)).data();
        if (!user && invitation?.status !== "Deleting") {
          throw {status: 404, message: "This user account no longer exists."};
        }
        if (user?.customClaims?.admin || ["admin", "manager"].includes(profile?.role) ||
            (user?.customClaims?.isManager && !profile?.managerRevokedAt)) {
          throw {status: 409, message: "Revoke manager access before deleting a manager. Admin accounts cannot be deleted here."};
        }
        if (invitation?.setupUntil > Date.now() || (invitation?.onboarding && !profile?.managerRevokedAt)) {
          throw {status: 409, message: "This account has a manager invitation. Only ordinary and revoked users can be deleted here."};
        }
        tx.set(inviteRef, {status: "Deleting"});
        // Keep revoked tokens blocked after removing all personal fields from the profile.
        if (profile?.managerRevokedAt) tx.set(profileRef, {managerRevokedAt: profile.managerRevokedAt});
        else tx.delete(profileRef);
      });

      if (user) {
        await auth.deleteUser(userId).catch(error => {
          if (error.code !== "auth/user-not-found") throw error;
        });
      }
      await inviteRef.delete();
      return res.json({success: true, message: "User permanently deleted."});
    }

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
    return res.status(error.status || 500).json({error: error.status ? error.message : req.body?.permanent === true ? "Could not finish deleting the user. Refresh and try again." : "Could not remove manager access."});
  }
};
