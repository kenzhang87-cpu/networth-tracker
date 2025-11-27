import React, { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import AddEntry from "./pages/AddEntry.jsx";
import History from "./pages/History.jsx";
import Charts from "./pages/Charts.jsx";
import { login, register } from "./api.js";

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
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const onAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const fn = authMode === "login" ? login : register;
      const res = await fn(username, password);
      if (res.token) {
        localStorage.setItem("token", res.token);
        setToken(res.token);
      } else if (authMode === "register") {
        const loginRes = await login(username, password);
        localStorage.setItem("token", loginRes.token);
        setToken(loginRes.token);
      }
    } catch (err) {
      setAuthError(err.message || "Auth failed");
    }
  };

  const onLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  if (!token) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "0 auto", padding: 16 }}>
        <h1 style={{ marginTop: 0 }}>Net Worth Tracker</h1>
        <form onSubmit={onAuth} style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {authError && <div style={{ color: "red" }}>{authError}</div>}
          <button type="submit">{authMode === "login" ? "Login" : "Register"}</button>
        </form>
        <p style={{ marginTop: 12 }}>
          {authMode === "login" ? "Need an account?" : "Have an account?"}{" "}
          <button onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
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
          <h1 style={{ margin: 0 }}>Net Worth Tracker</h1>
          <nav style={{ display: "flex", gap: 8 }}>
            <NavLink to="/" style={navStyle} end>Accounts</NavLink>
            <NavLink to="/history" style={navStyle}>Data</NavLink>
            <NavLink to="/charts" style={navStyle}>Charts</NavLink>
          </nav>
          <button onClick={onLogout}>Logout</button>
        </header>

        <Routes>
          <Route path="/" element={<AddEntry />} />
          <Route path="/history" element={<History />} />
          <Route path="/charts" element={<Charts />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
