import { useState, useEffect, useCallback, useRef } from "react";
import {
  onAuth, signInWithGoogle, logOut,
  getUserProfile, createHousehold, joinHousehold, leaveHousehold,
  getHouseholdInfo, subscribeData, saveSharedData,
  sendInvitation, getPendingInvitations, acceptInvitation,
  declineInvitation, cancelInvitation, getHouseholdPendingInvites,
} from "./firebase.js";
import App from "./App.jsx";

const P = {
  bg: "#0B0F14", card: "#141A22", bd: "rgba(255,255,255,0.06)",
  surfAlt: "#111820", surfHov: "#1A2230",
  ac: "#4ADE80", acL: "rgba(74,222,128,0.15)", acD: "#4ADE80",
  tx: "#E8ECF1", txD: "#7A8699", txM: "#4A5568",
  pos: "#4ADE80", neg: "#F87171",
};

const btnBase = {
  padding: "10px 24px", borderRadius: 8, border: "1px solid " + P.bd,
  background: "rgba(255,255,255,0.04)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: P.tx, minHeight: 44,
};
const btnPrimary = { ...btnBase, background: P.acL, color: P.ac, border: "none" };
const inputStyle = {
  padding: "10px 14px", borderRadius: 8, border: "1px solid " + P.bd,
  fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none",
  background: P.card, color: P.tx,
};

export default function AppWrapper() {
  const [user, setUser] = useState(undefined); // undefined=loading, null=signed out
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

  // ─── Household panel (shown from user bar) ───
  const [hhPanel, setHhPanel] = useState(false);
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
        // If update came from another user, bump version to remount App
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
        if (profile && profile.householdId) {
          setHouseholdId(profile.householdId);
          const info = await getHouseholdInfo(profile.householdId);
          setHouseholdInfo(info);
          startSubscription(profile.householdId, u.uid);
        } else {
          // No household yet — show setup
          setSetupMode(true);
          try {
            const invites = await getPendingInvitations(u.email);
            setPendingInvitations(invites);
          } catch (e) {
            console.error("Failed to fetch invitations:", e);
          }
        }
      } else {
        // Signed out — reset everything
        if (unsubData.current) unsubData.current();
        setHouseholdId(null);
        setHouseholdInfo(null);
        setSetupMode(false);
        setInitialData(null);
        setLoaded(false);
        setDataVersion(0);
        setHhPanel(false);
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
      setHhPanel(false);
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

  // ─── Fetch outgoing invites when panel opens ───
  useEffect(() => {
    if (hhPanel && householdId) {
      getHouseholdPendingInvites(householdId)
        .then(setOutgoingInvites)
        .catch(e => console.error("Failed to load outgoing invites:", e));
    }
  }, [hhPanel, householdId]);

  // ─── Loading state ───
  if (user === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: P.bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: P.tx }}>Budget Tracker</div>
          <div style={{ fontSize: 12, color: P.txD, marginBottom: 24 }}>Sign in to access your cashflow data</div>
          <button onClick={signInWithGoogle}
            style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 auto", padding: "10px 24px", borderRadius: 8,
              border: "1px solid " + P.bd, background: "rgba(255,255,255,0.04)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: P.tx, minHeight: 44 }}>
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
          <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>💰</div>
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

  // ─── Signed in — render app ───
  return (
    <div>
      {/* User bar */}
      <div style={{ background: P.card, borderBottom: "1px solid " + P.bd, padding: "4px 20px",
        display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, position: "relative" }}>
        {householdInfo && (
          <button onClick={() => setHhPanel(p => !p)}
            style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid " + P.bd,
              background: P.acL, color: P.ac, cursor: "pointer", fontWeight: 600 }}>
            {householdInfo.name} ({householdInfo.memberEmails?.length || 1})
          </button>
        )}
        <span style={{ fontSize: 10, color: P.txD }}>{user.email}</span>
        <button onClick={logOut} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: "1px solid " + P.bd, background: "rgba(255,255,255,0.04)", color: P.txD, cursor: "pointer" }}>Sign out</button>

        {/* Household panel dropdown */}
        {hhPanel && householdInfo && (
          <div style={{ position: "absolute", top: "100%", right: 20, marginTop: 4, background: P.card,
            border: "1px solid " + P.bd, borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,.4)",
            padding: 16, width: 280, zIndex: 999 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: P.tx }}>{householdInfo.name}</div>

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
          </div>
        )}
      </div>
      {loaded && <App key={dataVersion} initialData={initialData} onDataChange={onDataChange} />}
    </div>
  );
}
