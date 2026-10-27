import { db } from '../config/firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Driver calls this to update bus position in Firebase
export const updateBusPosition = async (routeId, busId, latitude, longitude, currentStopIndex) => {
  try {
    await setDoc(doc(db, 'buses', busId), {
      routeId,
      busId,
      latitude,
      longitude,
      currentStopIndex,
      updatedAt: serverTimestamp(),
      status: 'ON_TIME',
    });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// User calls this to listen to bus position in real time
export const listenToBusPosition = (busId, callback) => {
  const busRef = doc(db, 'buses', busId);
  return onSnapshot(busRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    }
  });
};

// Update bus status
export const updateBusStatus = async (busId, status) => {
  try {
    await setDoc(doc(db, 'buses', busId), { status }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
};