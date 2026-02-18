import { useState, useEffect, useCallback, useRef } from "react";
import { onAuth, signInWithGoogle, logOut, loadData, saveData } from "./firebase.js";
import App from "./App.jsx";

const P = {
  bg: "#f7f8fa", card: "#ffffff", bd: "#e5e7ec",
  ac: "#2563eb", acL: "#dbeafe", acD: "#1d4ed8",
  tx: "#1a1d23", txD: "#5a6070", txM: "#9098a8",
  pos: "#059669", neg: "#dc2626",
};

export default function AppWrapper() {
  const [user, setUser] = useState(undefined); // undefined=loading, null=signed out
  const [initialData, setInitialData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    const unsub = onAuth(async (u) => {
      setUser(u);
      if (u) {
        const data = await loadData(u.uid);
        setInitialData(data);
        setLoaded(true);
      } else {
        setInitialData(null);
        setLoaded(false);
      }
    });
    return unsub;
  }, []);

  // Debounced save — waits 2s after last change
  const onDataChange = useCallback((data) => {
    if (!user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveData(user.uid, data);
    }, 2000);
  }, [user]);

  // Loading state
  if (user === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: P.bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
          <div style={{ fontSize: 14, color: P.txM }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Sign-in screen
  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: P.bg }}>
        <div style={{ textAlign: "center", background: P.card, padding: "40px 48px", borderRadius: 16, border: "1px solid " + P.bd, boxShadow: "0 8px 32px rgba(0,0,0,.06)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Budget Tracker</div>
          <div style={{ fontSize: 12, color: P.txM, marginBottom: 24 }}>Sign in to access your cashflow data</div>
          <button onClick={signInWithGoogle}
            style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 auto", padding: "10px 24px", borderRadius: 8,
              border: "1px solid " + P.bd, background: P.card, cursor: "pointer", fontSize: 13, fontWeight: 600, color: P.tx }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // Signed in — render app
  return (
    <div>
      {/* Tiny user bar */}
      <div style={{ background: P.card, borderBottom: "1px solid " + P.bd, padding: "4px 20px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, color: P.txM }}>{user.email}</span>
        <button onClick={logOut} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: "1px solid " + P.bd, background: P.bg, color: P.txD, cursor: "pointer" }}>Sign out</button>
      </div>
      {loaded && <App initialData={initialData} onDataChange={onDataChange} />}
    </div>
  );
}
