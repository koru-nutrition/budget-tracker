import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove, addDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";

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
    pendingInvites: [],
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

// ─── Invitations ───
export const sendInvitation = async (uid, email, householdId, householdName, inviteeEmail) => {
  const normalizedEmail = inviteeEmail.trim().toLowerCase();

  if (normalizedEmail === email.toLowerCase()) {
    throw new Error("You cannot invite yourself");
  }

  const hhSnap = await getDoc(doc(db, "households", householdId));
  if (!hhSnap.exists()) throw new Error("Household not found");
  const hhData = hhSnap.data();

  if ((hhData.memberEmails || []).map(e => e.toLowerCase()).includes(normalizedEmail)) {
    throw new Error("This person is already a member");
  }

  if ((hhData.pendingInvites || []).map(e => e.toLowerCase()).includes(normalizedEmail)) {
    throw new Error("An invitation has already been sent to this email");
  }

  await addDoc(collection(db, "invitations"), {
    householdId,
    householdName,
    inviteeEmail: normalizedEmail,
    invitedBy: uid,
    invitedByEmail: email,
    status: "pending",
    createdAt: new Date().toISOString(),
    respondedAt: null,
  });

  await updateDoc(doc(db, "households", householdId), {
    pendingInvites: arrayUnion(normalizedEmail),
  });
};

export const getPendingInvitations = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const q = query(
    collection(db, "invitations"),
    where("inviteeEmail", "==", normalizedEmail),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const acceptInvitation = async (uid, email, invitation) => {
  const normalizedEmail = email.trim().toLowerCase();

  const profile = await getUserProfile(uid);
  if (profile && profile.householdId) {
    throw new Error("You are already in a household. Leave it first to accept this invitation.");
  }

  await updateDoc(doc(db, "invitations", invitation.id), {
    status: "accepted",
    respondedAt: new Date().toISOString(),
  });

  await updateDoc(doc(db, "households", invitation.householdId), {
    members: arrayUnion(uid),
    memberEmails: arrayUnion(normalizedEmail),
    pendingInvites: arrayRemove(normalizedEmail),
  });

  await setUserProfile(uid, { householdId: invitation.householdId });
  return invitation.householdId;
};

export const declineInvitation = async (email, invitationId, householdId) => {
  const normalizedEmail = email.trim().toLowerCase();

  await updateDoc(doc(db, "invitations", invitationId), {
    status: "declined",
    respondedAt: new Date().toISOString(),
  });

  await updateDoc(doc(db, "households", householdId), {
    pendingInvites: arrayRemove(normalizedEmail),
  });
};

export const cancelInvitation = async (invitationId, householdId, inviteeEmail) => {
  await deleteDoc(doc(db, "invitations", invitationId));
  await updateDoc(doc(db, "households", householdId), {
    pendingInvites: arrayRemove(inviteeEmail.toLowerCase()),
  });
};

export const getHouseholdPendingInvites = async (householdId) => {
  const q = query(
    collection(db, "invitations"),
    where("householdId", "==", householdId),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
