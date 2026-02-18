import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove, addDoc, collection } from "firebase/firestore";

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

// Storage helpers
const DATA_KEY = "btv3_2";

// ─── Legacy per-user data (kept for migration) ───
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

// ─── User profile (stores householdId pointer) ───
export const getUserProfile = async (uid) => {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("getUserProfile failed:", e);
    return null;
  }
};

const setUserProfile = async (uid, data) => {
  try {
    await setDoc(doc(db, "users", uid), data, { merge: true });
  } catch (e) {
    console.error("setUserProfile failed:", e);
  }
};

// ─── Household CRUD ───
export const createHousehold = async (uid, email, name) => {
  // Create household doc
  const ref = await addDoc(collection(db, "households"), {
    name,
    members: [uid],
    memberEmails: [email],
    createdBy: uid,
    createdAt: new Date().toISOString(),
  });
  const householdId = ref.id;

  // Point user at this household
  await setUserProfile(uid, { householdId });

  // Migrate existing user data to household
  const existing = await loadData(uid);
  if (existing) {
    await setDoc(doc(db, "households", householdId, "data", DATA_KEY), {
      payload: existing,
      updatedAt: new Date().toISOString(),
      updatedBy: uid,
    });
  }

  return householdId;
};

export const joinHousehold = async (uid, email, householdId) => {
  // Verify household exists
  const snap = await getDoc(doc(db, "households", householdId));
  if (!snap.exists()) throw new Error("Household not found");

  // Add member
  await updateDoc(doc(db, "households", householdId), {
    members: arrayUnion(uid),
    memberEmails: arrayUnion(email),
  });

  // Point user at this household
  await setUserProfile(uid, { householdId });
};

export const leaveHousehold = async (uid, email, householdId) => {
  await updateDoc(doc(db, "households", householdId), {
    members: arrayRemove(uid),
    memberEmails: arrayRemove(email),
  });
  await setUserProfile(uid, { householdId: null });
};

export const getHouseholdInfo = async (householdId) => {
  try {
    const snap = await getDoc(doc(db, "households", householdId));
    return snap.exists() ? { id: householdId, ...snap.data() } : null;
  } catch (e) {
    console.error("getHouseholdInfo failed:", e);
    return null;
  }
};

// ─── Real-time data subscription ───
export const subscribeData = (householdId, callback) => {
  return onSnapshot(doc(db, "households", householdId, "data", DATA_KEY), (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      callback({ payload: d.payload, updatedBy: d.updatedBy || null });
    } else {
      callback({ payload: null, updatedBy: null });
    }
  }, (err) => {
    console.error("subscribeData error:", err);
  });
};

// ─── Shared data save ───
export const saveSharedData = async (householdId, uid, data) => {
  try {
    await setDoc(doc(db, "households", householdId, "data", DATA_KEY), {
      payload: data,
      updatedAt: new Date().toISOString(),
      updatedBy: uid,
    });
  } catch (e) {
    console.error("saveSharedData failed:", e);
  }
};
