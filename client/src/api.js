const API = import.meta.env.VITE_API_URL || "/api";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function login(username, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Login failed");
  return data;
}

export async function register(username, email, password) {
  const r = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Register failed");
  return data;
}

export async function getAccounts() {
  const r = await fetch(`${API}/accounts`, { headers: authHeaders() });
  return r.json();
}

export async function addAccount(name, category = "other") {
  const r = await fetch(`${API}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name, category })
  });
  return r.json();
}

export async function updateAccount(id, payload) {
  const r = await fetch(`${API}/accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Update failed");
  return data;
}

export async function deleteAccount(id) {
  const r = await fetch(`${API}/accounts/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Delete failed");
  return data;
}

export async function getBalances() {
  const r = await fetch(`${API}/balances`, { headers: authHeaders() });
  return r.json();
}

export async function addBalance(entry) {
  const r = await fetch(`${API}/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(entry)
  });
  return r.json();
}

export async function getTimeseries() {
  const r = await fetch(`${API}/timeseries`, { headers: authHeaders() });
  return r.json();
}

export async function deleteBalance(id) {
  const r = await fetch(`${API}/balances/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  return r.json();
}

export async function updateBalance(id, balance) {
  const r = await fetch(`${API}/balances/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ balance })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || "Update failed");
  }
  return data;
}

export async function getMe() {
  const r = await fetch(`${API}/auth/me`, { headers: authHeaders() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Failed to fetch profile");
  return data;
}

export async function updateEmail(email) {
  const r = await fetch(`${API}/auth/email`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ email })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Failed to update email");
  return data;
}

export async function changePassword(currentPassword, newPassword) {
  const r = await fetch(`${API}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Failed to change password");
  return data;
}

export async function forgotPassword(email) {
  const r = await fetch(`${API}/auth/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Reset failed");
  return data;
}

// Snapshot endpoints for save/load functionality
export async function getSnapshots() {
  const r = await fetch(`${API}/snapshots`, { headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to fetch snapshots");
  return r.json();
}

export async function saveSnapshot(name) {
  const r = await fetch(`${API}/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Failed to save snapshot");
  return data;
}

export async function loadSnapshot(id) {
  const r = await fetch(`${API}/snapshots/${id}/restore`, {
    method: "POST",
    headers: authHeaders()
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Failed to restore snapshot");
  return data;
}

export async function deleteSnapshot(id) {
  const r = await fetch(`${API}/snapshots/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  if (!r.ok) throw new Error("Failed to delete snapshot");
  return r.json();
}
