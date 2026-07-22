import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

const SECONDARY_APP_NAME = 'secondary-for-admin-creation';

export function getSecondaryAuth() {
  let secondaryApp;
  const existing = getApps().find(a => a.name === SECONDARY_APP_NAME);
  if (existing) {
    secondaryApp = existing;
  } else {
    secondaryApp = initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  }
  return getAuth(secondaryApp);
}

export const DOMINIO_INSTITUCIONAL = import.meta.env.VITE_DOMINIO_INSTITUCIONAL || 'utec.edu.sv';
export const EMAIL_JEFA = import.meta.env.VITE_EMAIL_JEFA;
