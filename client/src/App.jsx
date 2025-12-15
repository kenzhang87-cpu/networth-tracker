import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import AddEntry from "./pages/AddEntry.jsx";
import History from "./pages/History.jsx";
import Charts from "./pages/Charts.jsx";
import { login, register, forgotPassword, changePassword, getMe, updateEmail } from "./api.js";

const navStyle = ({ isActive }) => ({
  padding: "8px 12px",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "white" : "#111",
  background: isActive ? "#111" : "transparent"
});

export default function App() {
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

  if (!token) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "0 auto", padding: 16 }}>
        <h1 style={{ marginTop: 0 }}>Net Wealth Tracker</h1>
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
    <BrowserRouter>
      <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "0 auto", padding: 16 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>Net Wealth Tracker</h1>
          <nav style={{ display: "flex", gap: 8 }}>
            <NavLink to="/" style={navStyle} end>Accounts</NavLink>
            <NavLink to="/history" style={navStyle}>Data</NavLink>
            <NavLink to="/charts" style={navStyle}>Charts</NavLink>
          </nav>
          <button onClick={onLogout}>Logout</button>
        </header>

        <section style={{ marginBottom: 24, padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "#f8f8f8" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Account settings</h3>
            <div style={{ fontSize: 14, color: "#333" }}>
              Email on file: {profileEmail || "none set"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
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
              {passwordError && <div style={{ color: "red" }}>{passwordError}</div>}
              {passwordMessage && <div style={{ color: "green" }}>{passwordMessage}</div>}
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
              {emailError && <div style={{ color: "red" }}>{emailError}</div>}
              {emailMessage && <div style={{ color: "green" }}>{emailMessage}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit">Save email</button>
              </div>
            </form>
          )}
        </section>

        <Routes>
          <Route path="/" element={<AddEntry />} />
          <Route path="/history" element={<History />} />
          <Route path="/charts" element={<Charts />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
