const {initAdmin} = require("./firebase-admin");

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const admin = initAdmin();

    // List all users
    const listUsersResult = await admin.auth().listUsers();
    
    // Format user data
    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      customClaims: user.customClaims || {},
      metadata: {
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime
      }
    }));

    // Sort by creation time (newest first)
    users.sort((a, b) => new Date(b.metadata.creationTime) - new Date(a.metadata.creationTime));

    return res.status(200).json({ users });
  } catch (error) {
    console.error('Error listing users:', error);
    return res.status(500).json({ error: error.message });
  }
}
