import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import AddEntry from "./pages/AddEntry.jsx";
import History from "./pages/History.jsx";
import Charts from "./pages/Charts.jsx";

const navStyle = ({ isActive }) => ({
  padding: "8px 12px",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "white" : "#111",
  background: isActive ? "#111" : "transparent"
});

export default function App() {
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
