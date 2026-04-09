import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCg52t0TXukf_GHf5qYU2YTpL-Hw-4av4A",
  authDomain: "conciergerie-dashboard.firebaseapp.com",
  projectId: "conciergerie-dashboard",
  storageBucket: "conciergerie-dashboard.firebasestorage.app",
  messagingSenderId: "492973983856",
  appId: "1:492973983856:web:03211dd5dccf85f1734cb5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
