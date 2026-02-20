import { useState, useEffect, useCallback, useRef } from "react";
import {
  onAuth, signInWithGoogle, logOut,
  getUserProfile, setUserProfile, createHousehold, joinHousehold, leaveHousehold,
  getHouseholdInfo, subscribeData, saveSharedData,
  sendInvitation, getPendingInvitations, acceptInvitation,
  declineInvitation, cancelInvitation, getHouseholdPendingInvites,
} from "./firebase.js";
import App from "./App.jsx";

const DARK = {
  bg: "#0B0F14", card: "#141A22", bd: "rgba(255,255,255,0.06)",
  surfAlt: "#111820", surfHov: "#1A2230",
  ac: "#4ADE80", acL: "rgba(74,222,128,0.15)", acD: "#4ADE80",
  tx: "#E8ECF1", txD: "#7A8699", txM: "#4A5568",
  pos: "#4ADE80", neg: "#F87171",
  w04: "rgba(255,255,255,0.04)", overlayBg: "rgba(0,0,0,0.6)",
};

const LIGHT = {
  bg: "#F5F7FA", card: "#FFFFFF", bd: "rgba(0,0,0,0.08)",
  surfAlt: "#EDF0F4", surfHov: "#E8ECF1",
  ac: "#16A34A", acL: "rgba(22,163,74,0.1)", acD: "#16A34A",
  tx: "#1A202C", txD: "#64748B", txM: "#94A3B8",
  pos: "#16A34A", neg: "#DC2626",
  w04: "rgba(0,0,0,0.03)", overlayBg: "rgba(0,0,0,0.3)",
};

const isDay = () => { const h = new Date().getHours(); return h >= 7 && h < 19; };

const GearIcon = ({ size = 16, color }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={color}>
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

const SunIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const MoonIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>;
const AutoIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 000 20V2z"/></svg>;

export default function AppWrapper() {
  // ─── Theme state ───
  const [themePref, setThemePref] = useState("dark"); // "light" | "dark" | "auto"
  const [autoLight, setAutoLight] = useState(isDay());

  useEffect(() => {
    if (themePref !== "auto") return;
    const check = () => setAutoLight(isDay());
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [themePref]);

  const resolved = themePref === "auto" ? (autoLight ? "light" : "dark") : themePref;
  const P = resolved === "light" ? LIGHT : DARK;

  useEffect(() => {
    document.body.style.background = P.bg;
    document.body.style.color = P.tx;
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved, P]);

  // ─── Theme-dependent styles ───
  const BudgetIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <rect x="4" y="4" width="92" height="92" rx="22" fill={P.card} stroke={P.ac} strokeOpacity="0.25" strokeWidth="2"/>
      <line x1="50" y1="24" x2="50" y2="76" stroke={P.ac} strokeWidth="6" strokeLinecap="round"/>
      <path d="M60 38C60 26 40 26 40 38C40 46 60 54 60 62C60 74 40 74 40 62" stroke={P.ac} strokeWidth="6" strokeLinecap="round" fill="none"/>
    </svg>
  );
  const btnBase = {
    padding: "10px 24px", borderRadius: 8, border: "1px solid " + P.bd,
    background: P.w04, cursor: "pointer", fontSize: 13, fontWeight: 600, color: P.tx, minHeight: 44,
  };
  const btnPrimary = { ...btnBase, background: P.acL, color: P.ac, border: "none" };
  const inputStyle = {
    padding: "10px 14px", borderRadius: 8, border: "1px solid " + P.bd,
    fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none",
    background: P.card, color: P.tx,
  };

  // ─── Auth & data state ───
  const [user, setUser] = useState(undefined);
  const [householdId, setHouseholdId] = useState(null);
  const [householdInfo, setHouseholdInfo] = useState(null);
  const [setupMode, setSetupMode] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const saveTimer = useRef(null);
  const unsubData = useRef(null);
  const latestUid = useRef(null);

  // ─── Household setup form state ───
  const [createName, setCreateName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  // ─── Settings panel ───
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  // ─── Invitation state ───
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [outgoingInvites, setOutgoingInvites] = useState([]);

  // ─── Subscribe to household data (real-time) ───
  const startSubscription = useCallback((hid, uid) => {
    if (unsubData.current) unsubData.current();
    unsubData.current = subscribeData(hid, ({ payload, updatedBy }) => {
      if (payload) {
        setInitialData(payload);
        if (updatedBy && updatedBy !== uid) {
          setDataVersion(v => v + 1);
        }
      }
      setLoaded(true);
    });
  }, []);

  // ─── Auth state change ───
  useEffect(() => {
    const unsub = onAuth(async (u) => {
      setUser(u);
      if (u) {
        latestUid.current = u.uid;
        const profile = await getUserProfile(u.uid);
        if (profile) {
          if (profile.theme) setThemePref(profile.theme);
          if (profile.householdId) {
            setHouseholdId(profile.householdId);
            const info = await getHouseholdInfo(profile.householdId);
            setHouseholdInfo(info);
            startSubscription(profile.householdId, u.uid);
          } else {
            setSetupMode(true);
            try {
              const invites = await getPendingInvitations(u.email);
              setPendingInvitations(invites);
            } catch (e) {
              console.error("Failed to fetch invitations:", e);
            }
          }
        } else {
          setSetupMode(true);
          try {
            const invites = await getPendingInvitations(u.email);
            setPendingInvitations(invites);
          } catch (e) {
            console.error("Failed to fetch invitations:", e);
          }
        }
      } else {
        if (unsubData.current) unsubData.current();
        setHouseholdId(null);
        setHouseholdInfo(null);
        setSetupMode(false);
        setInitialData(null);
        setLoaded(false);
        setDataVersion(0);
        setSettingsOpen(false);
        latestUid.current = null;
      }
    });
    return () => {
      unsub();
      if (unsubData.current) unsubData.current();
    };
  }, [startSubscription]);

  // ─── Debounced save to shared household ───
  const onDataChange = useCallback((data) => {
    if (!householdId || !latestUid.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSharedData(householdId, latestUid.current, data);
    }, 2000);
  }, [householdId]);

  // ─── Theme change handler ───
  const changeTheme = async (newTheme) => {
    setThemePref(newTheme);
    if (user) {
      try { await setUserProfile(user.uid, { theme: newTheme }); } catch (e) { console.error("Save theme failed:", e); }
    }
  };

  // ─── Household setup actions ───
  const handleCreate = async () => {
    if (!createName.trim()) { setSetupError("Enter a household name"); return; }
    setSetupLoading(true); setSetupError("");
    try {
      const hid = await createHousehold(user.uid, user.email, createName.trim());
      setHouseholdId(hid);
      const info = await getHouseholdInfo(hid);
      setHouseholdInfo(info);
      startSubscription(hid, user.uid);
      setSetupMode(false);
    } catch (e) {
      setSetupError(e.message || "Failed to create household");
    } finally { setSetupLoading(false); }
  };

  const handleJoin = async () => {
    if (!joinId.trim()) { setSetupError("Paste a household ID"); return; }
    setSetupLoading(true); setSetupError("");
    try {
      await joinHousehold(user.uid, user.email, joinId.trim());
      setHouseholdId(joinId.trim());
      const info = await getHouseholdInfo(joinId.trim());
      setHouseholdInfo(info);
      startSubscription(joinId.trim(), user.uid);
      setSetupMode(false);
    } catch (e) {
      setSetupError(e.message || "Failed to join household");
    } finally { setSetupLoading(false); }
  };

  const handleLeave = async () => {
    if (!householdId) return;
    try {
      await leaveHousehold(user.uid, user.email, householdId);
      if (unsubData.current) unsubData.current();
      setHouseholdId(null);
      setHouseholdInfo(null);
      setInitialData(null);
      setLoaded(false);
      setDataVersion(0);
      setSettingsOpen(false);
      setLeaveConfirm(false);
      setSetupMode(true);
    } catch (e) {
      console.error("Leave failed:", e);
    }
  };

  const copyId = () => {
    if (!householdId) return;
    navigator.clipboard.writeText(householdId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ─── Invitation handlers ───
  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) { setInviteError("Enter an email address"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteError("Enter a valid email address"); return;
    }
    setInviteLoading(true); setInviteError(""); setInviteSuccess("");
    try {
      await sendInvitation(user.uid, user.email, householdId, householdInfo.name, inviteEmail.trim());
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      const updated = await getHouseholdPendingInvites(householdId);
      setOutgoingInvites(updated);
      setTimeout(() => setInviteSuccess(""), 3000);
    } catch (e) {
      setInviteError(e.message || "Failed to send invitation");
    } finally { setInviteLoading(false); }
  };

  const handleAcceptInvite = async (invitation) => {
    setSetupLoading(true); setSetupError("");
    try {
      const hid = await acceptInvitation(user.uid, user.email, invitation);
      setHouseholdId(hid);
      const info = await getHouseholdInfo(hid);
      setHouseholdInfo(info);
      startSubscription(hid, user.uid);
      setSetupMode(false);
      setPendingInvitations([]);
    } catch (e) {
      setSetupError(e.message || "Failed to accept invitation");
    } finally { setSetupLoading(false); }
  };

  const handleDeclineInvite = async (invitation) => {
    try {
      await declineInvitation(user.email, invitation.id, invitation.householdId);
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
    } catch (e) {
      console.error("Decline failed:", e);
    }
  };

  const handleCancelInvite = async (invitation) => {
    try {
      await cancelInvitation(invitation.id, invitation.householdId, invitation.inviteeEmail);
      setOutgoingInvites(prev => prev.filter(inv => inv.id !== invitation.id));
    } catch (e) {
      console.error("Cancel invite failed:", e);
    }
  };

  // ─── Fetch outgoing invites when settings opens ───
  useEffect(() => {
    if (settingsOpen && householdId) {
      getHouseholdPendingInvites(householdId)
        .then(setOutgoingInvites)
        .catch(e => console.error("Failed to load outgoing invites:", e));
    }
  }, [settingsOpen, householdId]);

  // ─── Loading state ───
  if (user === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: P.bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 12 }}><BudgetIcon size={40}/></div>
          <div style={{ fontSize: 14, color: P.txD }}>Loading...</div>
        </div>
      </div>
    );
  }

  // ─── Sign-in screen ───
  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: P.bg }}>
        <div style={{ textAlign: "center", background: P.card, padding: "40px 48px", borderRadius: 16, border: "1px solid " + P.bd, boxShadow: "none" }}>
          <div style={{ marginBottom: 16 }}><BudgetIcon size={52}/></div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: P.tx }}>Budget Tracker</div>
          <div style={{ fontSize: 12, color: P.txD, marginBottom: 24 }}>Sign in to access your cashflow data</div>
          <button onClick={signInWithGoogle}
            style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 auto", padding: "10px 24px", borderRadius: 8,
              border: "1px solid " + P.bd, background: P.w04, cursor: "pointer", fontSize: 13, fontWeight: 600, color: P.tx, minHeight: 44 }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // ─── Household setup screen ───
  if (setupMode) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: P.bg }}>
        <div style={{ background: P.card, padding: "40px 48px", borderRadius: 16, border: "1px solid " + P.bd,
          boxShadow: "none", width: 380, maxWidth: "90vw" }}>
          <div style={{ textAlign: "center", marginBottom: 8 }}><BudgetIcon size={52}/></div>
          <div style={{ fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 4, color: P.tx }}>Set Up Your Household</div>
          <div style={{ fontSize: 12, color: P.txD, textAlign: "center", marginBottom: 28 }}>
            Create a new household or join an existing one to share budget data.
          </div>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: P.tx }}>You have been invited!</div>
              {pendingInvitations.map(inv => (
                <div key={inv.id} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid " + P.bd, marginBottom: 8, background: P.acL }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: P.tx }}>{inv.householdName}</div>
                  <div style={{ fontSize: 11, color: P.txD, marginBottom: 8 }}>Invited by {inv.invitedByEmail}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleAcceptInvite(inv)} disabled={setupLoading}
                      style={{ ...btnPrimary, padding: "6px 16px", fontSize: 12 }}>Accept</button>
                    <button onClick={() => handleDeclineInvite(inv)} disabled={setupLoading}
                      style={{ ...btnBase, padding: "6px 16px", fontSize: 12 }}>Decline</button>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 0 }}>
                <div style={{ flex: 1, height: 1, background: P.bd }} />
                <div style={{ fontSize: 11, color: P.txM, fontWeight: 600 }}>OR</div>
                <div style={{ flex: 1, height: 1, background: P.bd }} />
              </div>
            </div>
          )}

          {/* Create */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: P.tx }}>Create a household</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. The Redmans"
                style={inputStyle} onKeyDown={e => e.key === "Enter" && handleCreate()} />
              <button onClick={handleCreate} disabled={setupLoading} style={btnPrimary}>Create</button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: P.bd }} />
            <div style={{ fontSize: 11, color: P.txM, fontWeight: 600 }}>OR</div>
            <div style={{ flex: 1, height: 1, background: P.bd }} />
          </div>

          {/* Join */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: P.tx }}>Join an existing household</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={joinId} onChange={e => setJoinId(e.target.value)} placeholder="Paste household ID"
                style={inputStyle} onKeyDown={e => e.key === "Enter" && handleJoin()} />
              <button onClick={handleJoin} disabled={setupLoading} style={btnBase}>Join</button>
            </div>
          </div>

          {setupError && <div style={{ fontSize: 12, color: P.neg, marginBottom: 12 }}>{setupError}</div>}

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button onClick={logOut} style={{ fontSize: 11, color: P.txD, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Settings modal ───
  const settingsModal = settingsOpen && (
    <div style={{ position: "fixed", inset: 0, minHeight: "100dvh", background: P.overlayBg, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={() => { setSettingsOpen(false); setLeaveConfirm(false); }}>
      <div onClick={e => e.stopPropagation()} style={{ background: P.card, borderRadius: 16, padding: 24, maxWidth: 420, width: "92%",
        maxHeight: "85vh", overflow: "auto", border: "1px solid " + P.bd }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: P.tx }}>Settings</div>
          <button onClick={() => { setSettingsOpen(false); setLeaveConfirm(false); }}
            style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: P.txM, padding: 4 }}>✕</button>
        </div>

        {/* ── Appearance ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: P.txD, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Appearance</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { key: "light", label: "Light", Icon: SunIcon },
              { key: "dark", label: "Dark", Icon: MoonIcon },
              { key: "auto", label: "Auto", Icon: AutoIcon },
            ].map(({ key, label, Icon }) => (
              <button key={key} onClick={() => changeTheme(key)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: "12px 8px", borderRadius: 10, cursor: "pointer", fontSize: 11, fontWeight: 600,
                  border: themePref === key ? "2px solid " + P.ac : "1px solid " + P.bd,
                  background: themePref === key ? P.acL : P.w04,
                  color: themePref === key ? P.ac : P.txD,
                  transition: "all 0.15s ease",
                }}>
                <Icon />
                {label}
              </button>
            ))}
          </div>
          {themePref === "auto" && (
            <div style={{ fontSize: 10, color: P.txM, marginTop: 6, lineHeight: 1.4 }}>
              Switches automatically — light from 7am to 7pm, dark otherwise. Currently: {resolved}.
            </div>
          )}
        </div>

        <div style={{ height: 1, background: P.bd, marginBottom: 20 }} />

        {/* ── Household ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: P.txD, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Household</div>
          {householdInfo && <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: P.tx }}>{householdInfo.name}</div>

            <div style={{ fontSize: 11, color: P.txD, marginBottom: 4, fontWeight: 600 }}>Members</div>
            <div style={{ marginBottom: 12 }}>
              {(householdInfo.memberEmails || []).map(email => (
                <div key={email} style={{ fontSize: 12, color: P.tx, padding: "2px 0" }}>{email}</div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: P.txD, marginBottom: 4, fontWeight: 600 }}>Invite someone</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <input value={inviteEmail} onChange={e => { setInviteEmail(e.target.value); setInviteError(""); setInviteSuccess(""); }}
                placeholder="Enter email address" style={{ ...inputStyle, fontSize: 11, padding: "6px 10px" }}
                onKeyDown={e => e.key === "Enter" && handleSendInvite()} />
              <button onClick={handleSendInvite} disabled={inviteLoading}
                style={{ ...btnPrimary, padding: "6px 12px", fontSize: 11, whiteSpace: "nowrap" }}>
                {inviteLoading ? "..." : "Invite"}
              </button>
            </div>
            {inviteError && <div style={{ fontSize: 11, color: P.neg, marginBottom: 4 }}>{inviteError}</div>}
            {inviteSuccess && <div style={{ fontSize: 11, color: P.pos, marginBottom: 4 }}>{inviteSuccess}</div>}

            {outgoingInvites.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: P.txM, marginBottom: 4 }}>Pending invitations:</div>
                {outgoingInvites.map(inv => (
                  <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
                    <span style={{ fontSize: 11, color: P.txD }}>{inv.inviteeEmail}</span>
                    <button onClick={() => handleCancelInvite(inv)}
                      style={{ fontSize: 10, color: P.neg, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Cancel</button>
                  </div>
                ))}
              </div>
            )}

            <details style={{ marginBottom: 14 }}>
              <summary style={{ fontSize: 10, color: P.txM, cursor: "pointer" }}>Share household ID instead</summary>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input readOnly value={householdId || ""} style={{ ...inputStyle, fontSize: 11, padding: "6px 10px", background: P.bg }} />
                <button onClick={copyId}
                  style={{ ...btnBase, padding: "6px 12px", fontSize: 11, whiteSpace: "nowrap" }}>
                  {copied ? "Copied!" : "Copy ID"}
                </button>
              </div>
            </details>

            {!leaveConfirm ? (
              <button onClick={() => setLeaveConfirm(true)}
                style={{ fontSize: 11, color: P.neg, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Leave household
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: P.neg }}>Are you sure?</span>
                <button onClick={handleLeave}
                  style={{ ...btnBase, fontSize: 11, padding: "4px 12px", color: P.neg, borderColor: P.neg }}>
                  Leave
                </button>
                <button onClick={() => setLeaveConfirm(false)}
                  style={{ ...btnBase, fontSize: 11, padding: "4px 12px" }}>
                  Cancel
                </button>
              </div>
            )}
          </>}
        </div>

        <div style={{ height: 1, background: P.bd, marginBottom: 20 }} />

        {/* ── Account ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: P.txD, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Account</div>
          <div style={{ fontSize: 12, color: P.tx, marginBottom: 10 }}>{user.email}</div>
          <button onClick={logOut}
            style={{ ...btnBase, fontSize: 11, padding: "6px 16px", color: P.neg, borderColor: P.neg }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Signed in — render app ───
  return (
    <div>
      {/* User bar */}
      <div style={{ background: P.card, borderBottom: "1px solid " + P.bd, padding: "4px 20px",
        display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, position: "relative" }}>
        {householdInfo && (
          <span style={{ fontSize: 10, color: P.txD, marginRight: "auto" }}>
            {householdInfo.name}
          </span>
        )}
        <a href={"mailto:" + user.email} style={{ fontSize: 10, color: P.txD, textDecoration: "none" }}>{user.email}</a>
        <button onClick={() => setSettingsOpen(true)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6,
            border: "1px solid " + P.bd, background: P.w04, cursor: "pointer", padding: 0 }}>
          <GearIcon size={14} color={P.txD} />
        </button>
      </div>
      {settingsModal}
      {loaded && <App key={dataVersion} initialData={initialData} onDataChange={onDataChange} theme={resolved} />}
    </div>
  );
}
