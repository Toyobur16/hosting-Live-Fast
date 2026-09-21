// Firebase Client Initialization & Helpers
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot
} from 'firebase/firestore';

// Default config from user's Firebase project
export const firebaseConfig = {
  apiKey: "AIzaSyA08M7c1iHvXhQHeUf8kXS5cUvtJ8s_kqY",
  authDomain: "hosting-live-fast-11b13.firebaseapp.com",
  projectId: "hosting-live-fast-11b13",
  storageBucket: "hosting-live-fast-11b13.firebasestorage.app",
  messagingSenderId: "880032238370",
  appId: "1:880032238370:web:732d55a4826a744e1c737b",
  measurementId: "G-K2NFZE486M"
};

// Initialize app single-instance
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore
export const db = getFirestore(app);

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot
};
