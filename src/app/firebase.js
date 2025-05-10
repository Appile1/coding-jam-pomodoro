// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBrkUx5XofLuYi86JLD26vmVpZk77dfok8",
  authDomain: "pomodoro-codejam.firebaseapp.com",
  projectId: "pomodoro-codejam",
  storageBucket: "pomodoro-codejam.firebasestorage.app",
  messagingSenderId: "849360035697",
  appId: "1:849360035697:web:3b8bae8983f86b2171e0d0",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
const storage = getStorage(app);

export { storage };
