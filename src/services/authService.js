import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const saveUserIfNew = async (firebaseUser, extraData = {}) => {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      fullName: extraData.fullName || '',
      role: 'user',
      createdAt: serverTimestamp(),
      savedRoutes: [],
      notificationsEnabled: true,
    });
  }
  
  return (await getDoc(userRef)).data();
};

export const registerWithEmail = async (email, password, fullName) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const userData = await saveUserIfNew(result.user, { fullName });
    return { success: true, user: userData };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export const loginWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const userRef = doc(db, 'users', result.user.uid);
    const userSnap = await getDoc(userRef);
    return { success: true, user: userSnap.data() };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export const getCurrentUserData = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) return { success: true, user: userSnap.data() };
    return { success: false, message: 'User not found' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
};