import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  // These will be replaced with actual Firebase config
  apiKey: "AIzaSyCh2XRiux3rLVKZS64dbHm_TDmAha0PDtU",
  authDomain: "game-scramb.firebaseapp.com",
  projectId: "game-scramb",
  storageBucket: "game-scramb.firebasestorage.app",
  databaseURL: "https://game-scramb-default-rtdb.asia-southeast1.firebasedatabase.app",
  messagingSenderId: "805939361803",
  appId: "1:805939361803:web:67c486e7b0730519d7ef0e",
  measurementId: "G-1KY5KZCSV7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export default app;