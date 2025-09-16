// Firestore bağlantısı ve yardımcılar
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from './firebase';

export const db = getFirestore(app);

// Kullanıcı rekorunu getir
export async function getUserBest(uid) {
  const ref = doc(db, 'users', uid, 'meta', 'best');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().score || 0 : 0;
}

// Kullanıcı rekorunu güncelle
export async function setUserBest(uid, score) {
  const ref = doc(db, 'users', uid, 'meta', 'best');
  await setDoc(ref, { score });
}
