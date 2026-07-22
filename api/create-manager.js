// Vercel Serverless Function to create manager accounts using Firebase Admin SDK
const admin = require("firebase-admin");
const {applyCors, requireAdmin} = require("./_auth");

module.exports = async function handler(req, res) {
  // Restrictive CORS (only allow-listed origins)
  applyCors(req, res);

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed"});
  }

  // Only admins may create manager accounts
  try {
    await requireAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({error: e.message || "Unauthorized"});
  }

  try {
    const {email, password, displayName} = req.body;

    // Validate required fields
    if (!email || !password || !displayName) {
      return res.status(400).json({error: "Missing required fields: email, password, displayName"});
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({error: "Password must be at least 6 characters"});
    }

    // Create the user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: false,
    });

    // Set custom claims to mark this user as a manager
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      isManager: true,
    });

    // Add user to Firestore 'users' collection
    const db = admin.firestore();
    await db.collection("users").doc(userRecord.uid).set({
      email: email,
      displayName: displayName,
      role: "manager",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      uid: userRecord.uid,
    });

    return res.status(200).json({
      success: true,
      uid: userRecord.uid,
      message: "Manager account created successfully",
    });
  } catch (error) {
    console.error("Error creating manager:", error);

    // Handle specific Firebase errors
    if (error && error.code) {
      if (error.code === "auth/email-already-exists") {
        return res.status(400).json({error: "Email already exists"});
      } else if (error.code === "auth/invalid-email") {
        return res.status(400).json({error: "Invalid email address"});
      } else if (error.code === "auth/invalid-password") {
        return res.status(400).json({error: "Invalid password"});
      }
    }

    // Generic fallback — details are logged server-side only, never returned to the client
    return res.status(500).json({
      error: "Failed to create manager account",
    });
  }
};
