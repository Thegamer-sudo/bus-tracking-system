import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAuGphgLYaBmeBeB3qvvMlIp3EmF1_9id4",
  authDomain: "smart-bus-tracker-f8b90.firebaseapp.com",
  projectId: "smart-bus-tracker-f8b90",
  storageBucket: "smart-bus-tracker-f8b90.firebasestorage.app",
  messagingSenderId: "769943466148",
  appId: "1:769943466148:web:04fde4ceb329bdfa23b631"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;