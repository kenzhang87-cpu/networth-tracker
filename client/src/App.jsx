import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import AddEntry from "./pages/AddEntry.jsx";
import History from "./pages/History.jsx";
import Charts from "./pages/Charts.jsx";
import { login, register, forgotPassword, changePassword, getMe, updateEmail, saveSnapshot, getSnapshots, loadSnapshot, deleteSnapshot } from "./api.js";

// Toast Notification Component
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${type}`}>
      <span>{type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
      {message}
    </div>
  );
}

// Toast Container
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

// Save/Load Modal
function SnapshotModal({ isOpen, onClose, mode, onSave, onLoad, snapshots, loading }) {
  const [saveName, setSaveName] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (saveName.trim()) {
      onSave(saveName.trim());
      setSaveName("");
    }
  };

  const handleLoad = () => {
    if (selectedId) {
      onLoad(selectedId);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === 'save' ? 'Save Snapshot' : 'Load Snapshot'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {mode === 'save' ? (
            <form onSubmit={handleSave}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                Snapshot Name
              </label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g., Q1 2024 Net Worth"
                style={{ width: '100%', marginBottom: 16 }}
                autoFocus
              />
              <p style={{ fontSize: 13, color: '#8b949e', margin: 0 }}>
                This will save all your accounts and balances as a snapshot you can restore later.
              </p>
            </form>
          ) : (
            <div>
              {snapshots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8b949e' }}>
                  <p>No saved snapshots found.</p>
                  <p style={{ fontSize: 13 }}>Save your first snapshot to keep track of different versions.</p>
                </div>
              ) : (
                <div className="snapshot-list">
                  {snapshots.map(snapshot => (
                    <div
                      key={snapshot.id}
                      className={`snapshot-item ${selectedId === snapshot.id ? 'selected' : ''}`}
                      onClick={() => setSelectedId(snapshot.id)}
                    >
                      <div className="snapshot-info">
                        <span className="snapshot-name">{snapshot.name}</span>
                        <span className="snapshot-date">{formatDate(snapshot.created_at)}</span>
                      </div>
                      <div className="snapshot-actions" onClick={e => e.stopPropagation()}>
                        <button
                          className="danger"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => {
                            if (confirm('Delete this snapshot?')) {
                              deleteSnapshot(snapshot.id).then(() => window.location.reload());
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose}>Cancel</button>
          {mode === 'save' ? (
            <button
              type="button"
              className="primary"
              onClick={handleSave}
              disabled={!saveName.trim() || loading}
            >
              {loading ? 'Saving...' : 'Save Snapshot'}
            </button>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={handleLoad}
              disabled={!selectedId || loading}
            >
              {loading ? 'Loading...' : 'Load Snapshot'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const navStyle = ({ isActive }) => ({
  padding: "10px 16px",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "#ffffff" : "#8b949e",
  background: isActive ? "#238636" : "transparent",
  fontSize: 14,
  fontWeight: 500,
  transition: "all 0.2s"
});

function AppContent() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [authMode, setAuthMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  
  // Snapshot state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  
  const navigate = useNavigate();
  const location = useLocation();

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setProfileEmail("");
      setNewEmail("");
      return undefined;
    }
    getMe()
      .then((data) => {
        if (!cancelled) {
          setProfileEmail(data.email || "");
          setNewEmail(data.email || "");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Load snapshots when load modal opens
  useEffect(() => {
    if (showLoadModal && token) {
      getSnapshots().then(setSnapshots).catch(() => addToast("Failed to load snapshots", "error"));
    }
  }, [showLoadModal, token]);

  const onAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setResetMessage("");
    setResetError("");
    try {
      if (authMode === "login") {
        const res = await login(username, password);
        if (res.token) {
          localStorage.setItem("token", res.token);
          setToken(res.token);
        }
      } else {
        await register(username, email, password);
        const loginRes = await login(username, password);
        localStorage.setItem("token", loginRes.token);
        setToken(loginRes.token);
      }
    } catch (err) {
      setAuthError(err.message || "Auth failed");
    }
  };

  const onForgotPassword = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetMessage("");
    try {
      const res = await forgotPassword(resetEmail || email);
      if (res.tempPassword) {
        setResetMessage(`Temporary password sent. Use it to log in: ${res.tempPassword}`);
      } else {
        setResetMessage(res.message || "If an account exists, you'll receive a reset email.");
      }
    } catch (err) {
      setResetError(err.message || "Reset failed");
    }
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err.message || "Update failed");
    }
  };

  const onChangeEmail = async (e) => {
    e.preventDefault();
    setEmailError("");
    setEmailMessage("");
    try {
      const res = await updateEmail(newEmail);
      setEmailMessage("Email updated.");
      setProfileEmail(res.email || newEmail);
    } catch (err) {
      setEmailError(err.message || "Update failed");
    }
  };

  const onLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setProfileEmail("");
    setNewEmail("");
    setEmailMessage("");
    setEmailError("");
    setPasswordMessage("");
    setPasswordError("");
    setCurrentPassword("");
    setNewPassword("");
    setShowChangePassword(false);
    setShowChangeEmail(false);
    setShowForgot(false);
    setResetEmail("");
    setResetMessage("");
    setResetError("");
  };

  const handleSaveSnapshot = async (name) => {
    setSnapshotLoading(true);
    try {
      await saveSnapshot(name);
      addToast(`Snapshot "${name}" saved successfully!`, "success");
      setShowSaveModal(false);
    } catch (err) {
      addToast(err.message || "Failed to save snapshot", "error");
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleLoadSnapshot = async (id) => {
    setSnapshotLoading(true);
    try {
      await loadSnapshot(id);
      addToast("Snapshot loaded successfully! Refreshing...", "success");
      setShowLoadModal(false);
      // Refresh the page to reload data
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      addToast(err.message || "Failed to load snapshot", "error");
    } finally {
      setSnapshotLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "0 auto", padding: 16 }}>
        <h1 style={{ marginTop: 0 }}>Net Wealth Track</h1>
        <form onSubmit={onAuth} style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            {authMode === "login" ? "Username or email" : "Username"}
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          {authMode === "register" && (
            <label style={{ display: "grid", gap: 4 }}>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}
          <label style={{ display: "grid", gap: 4 }}>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {authError && <div style={{ color: "red" }}>{authError}</div>}
          <button type="submit">{authMode === "login" ? "Login" : "Register"}</button>
        </form>
        {authMode === "login" && (
          <>
            <button
              type="button"
              onClick={() => setShowForgot((v) => !v)}
              style={{ marginTop: 12, textDecoration: "underline", background: "none", border: "none", padding: 0, color: "#0066cc", cursor: "pointer" }}
            >
              {showForgot ? "Hide forgot password" : "Forgot password?"}
            </button>
            {showForgot && (
              <form onSubmit={onForgotPassword} style={{ display: "grid", gap: 8, marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <div style={{ fontWeight: 600 }}>Reset password</div>
                <label style={{ display: "grid", gap: 4 }}>
                  Account email
                  <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@example.com" />
                </label>
                {resetError && <div style={{ color: "red" }}>{resetError}</div>}
                {resetMessage && <div style={{ color: "green" }}>{resetMessage}</div>}
                <button type="submit">Send reset</button>
              </form>
            )}
          </>
        )}
        <p style={{ marginTop: 12 }}>
          {authMode === "login" ? "Need an account?" : "Have an account?"}{" "}
          <button
            onClick={() => {
              setAuthMode(authMode === "login" ? "register" : "login");
              setShowForgot(false);
            }}
          >
            {authMode === "login" ? "Register" : "Login"}
          </button>
        </p>
   
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <header style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        marginBottom: 24,
        flexWrap: "wrap",
        gap: 16
      }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Net Wealth Track</h1>
        
        <nav style={{ display: "flex", gap: 8 }}>
          <NavLink to="/" style={navStyle} end>Accounts</NavLink>
          <NavLink to="/history" style={navStyle}>Data</NavLink>
          <NavLink to="/charts" style={navStyle}>Charts</NavLink>
        </nav>

        <div className="header-actions">
          <button onClick={() => setShowSaveModal(true)} style={{ backgroundColor: '#1f6feb !important' }}>
            💾 Save
          </button>
          <button onClick={() => setShowLoadModal(true)} style={{ backgroundColor: '#8957e5 !important' }}>
            📂 Load
          </button>
          <button onClick={onLogout}>Logout</button>
        </div>
      </header>

      {/* Account Settings */}
      <section style={{ marginBottom: 24, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Account Settings</h3>
          <div style={{ fontSize: 14, color: "#8b949e" }}>
            Email: {profileEmail || "none set"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setShowChangePassword((v) => !v)}>
            {showChangePassword ? "Hide password change" : "Change password"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowChangeEmail((v) => !v);
              setNewEmail(profileEmail || "");
            }}
          >
            {showChangeEmail ? "Hide email change" : profileEmail ? "Update email" : "Add email"}
          </button>
        </div>

        {showChangePassword && (
          <form onSubmit={onChangePassword} style={{ display: "grid", gap: 8, maxWidth: 360, marginTop: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              Current password
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              New password
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            {passwordError && <div style={{ color: "#f85149" }}>{passwordError}</div>}
            {passwordMessage && <div style={{ color: "#3fb950" }}>{passwordMessage}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit">Update password</button>
            </div>
          </form>
        )}

        {showChangeEmail && (
          <form onSubmit={onChangeEmail} style={{ display: "grid", gap: 8, maxWidth: 360, marginTop: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              New email
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            {emailError && <div style={{ color: "#f85149" }}>{emailError}</div>}
            {emailMessage && <div style={{ color: "#3fb950" }}>{emailMessage}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit">Save email</button>
            </div>
          </form>
        )}
      </section>

      {/* Routes */}
      <Routes>
        <Route path="/" element={<AddEntry />} />
        <Route path="/history" element={<History />} />
        <Route path="/charts" element={<Charts />} />
      </Routes>

      {/* Modals */}
      <SnapshotModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        mode="save"
        onSave={handleSaveSnapshot}
        loading={snapshotLoading}
      />
      <SnapshotModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        mode="load"
        onLoad={handleLoadSnapshot}
        snapshots={snapshots}
        loading={snapshotLoading}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
