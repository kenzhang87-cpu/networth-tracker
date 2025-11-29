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

export async function register(username, password) {
  const r = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
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

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || `addAccount failed (${r.status})`);
  }
  return data;
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

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    // This will show the real reason (missing fields, auth, unknown account, etc.)
    throw new Error(data.error || `addBalance failed (${r.status})`);
  }
  return data;
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
