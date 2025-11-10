// Vercel Serverless Function to create manager accounts using Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, displayName } = req.body;

    // Validate required fields
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Missing required fields: email, password, displayName' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Create the user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: false
    });

    // Set custom claims to mark this user as a manager
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      isManager: true
    });

    return res.status(200).json({
      success: true,
      uid: userRecord.uid,
      message: 'Manager account created successfully'
    });

  } catch (error) {
    console.error('Error creating manager:', error);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists' });
    } else if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Invalid email address' });
    } else if (error.code === 'auth/invalid-password') {
      return res.status(400).json({ error: 'Invalid password' });
    }

    return res.status(500).json({ 
      error: 'Failed to create manager account',
      details: error.message 
    });
  }
};
