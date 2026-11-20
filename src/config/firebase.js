import {initializeApp} from "firebase/app";
import {getAuth} from "firebase/auth";
import {getFirestore} from "firebase/firestore";

// Production defaults. A sandbox uses its own complete Firebase Web app configuration.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCwBKzo8-tyg4AERbTe4-x8uxJ05CnP3nU",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "backcountry-bayit-website.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "backcountry-bayit-website",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "backcountry-bayit-website.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "274221431699",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:274221431699:web:286ae1983d5e53c398c666",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-DJZLD86PGX",
};

if (process.env.REACT_APP_BCB_SANDBOX === "true" && (
  !process.env.REACT_APP_FIREBASE_API_KEY || !process.env.REACT_APP_FIREBASE_AUTH_DOMAIN ||
  !process.env.REACT_APP_FIREBASE_APP_ID || firebaseConfig.projectId === "backcountry-bayit-website"
)) {
  throw new Error("A sandbox requires a separate Firebase Web app configuration.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
