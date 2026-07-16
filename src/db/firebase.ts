import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app: ReturnType<typeof initializeApp> | null = null;
let firestore: ReturnType<typeof getFirestore> | null = null;
let auth: Auth | null = null;
const googleProvider = new GoogleAuthProvider();

export function getFirebaseApp() {
  if (!app && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirestoreDB() {
  if (!firestore && firebaseConfig.apiKey) {
    const firebaseApp = getFirebaseApp();
    if (firebaseApp) {
      firestore = getFirestore(firebaseApp);
      enableIndexedDbPersistence(firestore).catch(() => {});
    }
  }
  return firestore;
}

export function getFirebaseAuth(): Auth | null {
  if (!auth && firebaseConfig.apiKey) {
    const firebaseApp = getFirebaseApp();
    if (firebaseApp) {
      auth = getAuth(firebaseApp);
    }
  }
  return auth;
}

export function getGoogleProvider(): GoogleAuthProvider {
  return googleProvider;
}

export function isFirebaseConfigured(): boolean {
  return !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
}
