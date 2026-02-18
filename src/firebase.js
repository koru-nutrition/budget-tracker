import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBeTaCMIbz0sxhAGvakjYoziD42WySR_5w",
  authDomain: "redman-cashflow.firebaseapp.com",
  projectId: "redman-cashflow",
  storageBucket: "redman-cashflow.firebasestorage.app",
  messagingSenderId: "889878541513",
  appId: "1:889878541513:web:16e7ad49e6a91ce8344918"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const logOut = () => signOut(auth);
export const onAuth = (cb) => onAuthStateChanged(auth, cb);

// Storage helpers — mirrors the window.storage API but uses Firestore
const DATA_KEY = "btv3_2";

export const loadData = async (uid) => {
  try {
    const snap = await getDoc(doc(db, "users", uid, "data", DATA_KEY));
    return snap.exists() ? snap.data().payload : null;
  } catch (e) {
    console.error("Load failed:", e);
    return null;
  }
};

export const saveData = async (uid, data) => {
  try {
    await setDoc(doc(db, "users", uid, "data", DATA_KEY), { payload: data, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("Save failed:", e);
  }
};
