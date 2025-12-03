// Vercel Serverless Function to create manager accounts using Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  // Validate required environment variables early so we can return a helpful error
  const missing = [];
  if (!process.env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
  if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!process.env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');

  if (missing.length) {
    console.error('Missing Firebase admin env vars:', missing.join(', '));
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
    } catch (error) {
      console.error('Firebase admin initialization error:', error);
    }
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

    // Ensure Admin SDK initialized
    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin SDK not initialized. Check server env vars.' });
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

    // Add user to Firestore 'users' collection
    const db = admin.firestore();
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      displayName: displayName,
      role: 'manager',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      uid: userRecord.uid
    });

    return res.status(200).json({
      success: true,
      uid: userRecord.uid,
      message: 'Manager account created successfully'
    });

  } catch (error) {
    console.error('Error creating manager:', error);
    
    // Handle specific Firebase errors
    if (error && error.code) {
      if (error.code === 'auth/email-already-exists') {
        return res.status(400).json({ error: 'Email already exists' });
      } else if (error.code === 'auth/invalid-email') {
        return res.status(400).json({ error: 'Invalid email address' });
      } else if (error.code === 'auth/invalid-password') {
        return res.status(400).json({ error: 'Invalid password' });
      }
    }

    // Generic fallback with details for easier debugging in development
    return res.status(500).json({ 
      error: 'Failed to create manager account',
      details: error && error.message ? error.message : String(error)
    });
  }
};
