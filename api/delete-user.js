const {initAdmin} = require("./firebase-admin");

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const admin = initAdmin();

    // Delete the user from Firebase Authentication
    await admin.auth().deleteUser(userId);

    return res.status(200).json({ 
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ error: error.message });
  }
}
