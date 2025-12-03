import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBeVsjnDJvt4C-S2LCT3XxvBSMbkpPV92c",
  authDomain: "newproject-cf446.firebaseapp.com",
  databaseURL:
    "https://newproject-cf446-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "newproject-cf446",
  storageBucket: "newproject-cf446.appspot.com",
  messagingSenderId: "552559689378",
  appId: "1:552559689378:web:1a66e43a98656f0a9021fb",
  measurementId: "G-9XFRSXZ6M7",
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);

