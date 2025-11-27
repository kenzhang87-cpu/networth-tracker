const API = import.meta.env.VITE_API_URL || "/api";


export async function getAccounts() {
  const r = await fetch(`${API}/accounts`);
  return r.json();
}

export async function addAccount(name, category = "other") {
  const r = await fetch(`${API}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, category })
  });
  return r.json();
}

export async function updateAccount(id, payload) {
  const r = await fetch(`${API}/accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Update failed");
  return data;
}

export async function deleteAccount(id) {
  const r = await fetch(`${API}/accounts/${id}`, {
    method: "DELETE"
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Delete failed");
  return data;
}

export async function getBalances() {
  const r = await fetch(`${API}/balances`);
  return r.json();
}

export async function addBalance(entry) {
  const r = await fetch(`${API}/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  return r.json();
}

export async function getTimeseries() {
  const r = await fetch(`${API}/timeseries`);
  return r.json();
}

export async function deleteBalance(id) {
    const r = await fetch(`${API}/balances/${id}`, {
      method: "DELETE"
    });
    return r.json();
  }

export async function updateBalance(id, balance) {
  const r = await fetch(`${API}/balances/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ balance })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || "Update failed");
  }
  return data;
}
    
