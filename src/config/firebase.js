import {initializeApp} from "firebase/app";
import {getAuth} from "firebase/auth";
import {getFirestore} from "firebase/firestore";

// Firebase configuration
// TODO: Replace with your actual Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCwBKzo8-tyg4AERbTe4-x8uxJ05CnP3nU",
  authDomain: "backcountry-bayit-website.firebaseapp.com",
  projectId: "backcountry-bayit-website",
  storageBucket: "backcountry-bayit-website.firebasestorage.app",
  messagingSenderId: "274221431699",
  appId: "1:274221431699:web:286ae1983d5e53c398c666",
  measurementId: "G-DJZLD86PGX",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
