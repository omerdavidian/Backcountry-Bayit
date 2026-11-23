const {requireAdmin, resolveRole} = require("./_auth");

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let ctx;
  try {
    ctx = await requireAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message || 'Unauthorized' });
  }

  try {
    const admin = ctx.admin;

    // List all users
    const listUsersResult = await admin.auth().listUsers();
    
    // Format user data
    const refs = listUsersResult.users.map(user => admin.firestore().collection("managerInvitations").doc(user.uid));
    const snapshots = refs.length ? await admin.firestore().getAll(...refs) : [];
    const users = await Promise.all(listUsersResult.users.map(async (user,index) => {
      const invite = snapshots[index].data();
      const role = await resolveRole(admin, {...user.customClaims, uid: user.uid});
      const invitedAccount = Boolean(!role && invite?.onboarding && user.uid.startsWith("invite-"));
      const formerManager = role === "user" && (invite?.status === "Revoked" || invite?.restore === true);
      return ({
      canResetInvitation: Boolean(!user.disabled && user.email && (invitedAccount || formerManager || role === "manager")),
      canRevokeManager: role === "manager",
      managerEligible: Boolean(!user.disabled && user.email && invitedAccount),
      invitationStatus: invite?.status === "Pending" && invite.expires <= Date.now() ? "Expired" : invite?.status || "Never sent",
      lastSent: invite?.lastSent || null,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || invite?.displayName,
      role: role || (invitedAccount ? "Invited" : "User"),
      customClaims: user.customClaims || {},
      metadata: {
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime
      }
    });}));

    // Sort by creation time (newest first)
    users.sort((a, b) => new Date(b.metadata.creationTime) - new Date(a.metadata.creationTime));

    return res.status(200).json({ users });
  } catch (error) {
    console.error('Error listing users:', error);
    return res.status(500).json({ error: 'Failed to list users' });
  }
}
