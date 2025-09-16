// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCOWQ_rDlsDgE3aAM5PwIKgalsa_gtU5ZE",
  authDomain: "zihinsel-egzersiz.firebaseapp.com",
  projectId: "zihinsel-egzersiz",
  storageBucket: "zihinsel-egzersiz.firebasestorage.app",
  messagingSenderId: "96703992432",
  appId: "1:96703992432:web:7cbef7efba4279145b9ab5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();