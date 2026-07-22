const {requireAdmin} = require("./_auth");

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let ctx;
  try {
    ctx = await requireAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message || 'Unauthorized' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Prevent an admin from deleting their own account.
  if (userId === ctx.decoded.uid) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    await ctx.admin.auth().deleteUser(userId);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
}
