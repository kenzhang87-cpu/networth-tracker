import React, { useEffect, useState } from "react";
import { addAccount, deleteAccount, getAccounts, updateAccount } from "../api.js";
import {
  assetCategories,
  liabilityCategories,
  colorForCategory,
  categoryType
} from "../palette.js";

export default function AddEntry() {
  const [accounts, setAccounts] = useState([]);
  const [newAccount, setNewAccount] = useState("");
  const [newType, setNewType] = useState("asset");
  const [newCategory, setNewCategory] = useState(assetCategories[0]);

  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingCategory, setEditingCategory] = useState("other");
  const [editingType, setEditingType] = useState("asset");

  useEffect(() => {
    getAccounts().then(list => {
      setAccounts(list.map(a => ({ ...a, category: a.category || "other" })));
    });
  }, []);

  const onCreateAccount = async () => {
    if (!newAccount.trim()) return;
    const updated = await addAccount(newAccount.trim(), newCategory);
    setAccounts(updated.map(a => ({ ...a, category: a.category || "other" })));
    setStatus("Account added.");
    setNewAccount("");
    setNewType("asset");
    setNewCategory(assetCategories[0]);
  };

  const onDeleteAccount = async (id) => {
    const ok = window.confirm("Delete this account and its balances?");
    if (!ok) return;
    try {
      const updated = await deleteAccount(id);
      setAccounts(updated.map(a => ({ ...a, category: a.category || "other" })));
      setStatus("Account deleted.");
    } catch (err) {
      setStatus("Error deleting account.");
    }
  };

  const startEdit = (acct) => {
    setEditingId(acct.id);
    setEditingName(acct.name);
    setEditingCategory(acct.category || "other");
    setEditingType(categoryType(acct.category));
    setStatus("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingCategory("other");
  };

  const deleteAllAccounts = async () => {
    if (accounts.length === 0) return;
    const ok = window.confirm("Delete ALL accounts and their balances? This cannot be undone.");
    if (!ok) return;
    try {
      for (const acct of accounts) {
        await deleteAccount(acct.id);
      }
      setAccounts([]);
      setStatus("All accounts deleted.");
    } catch (err) {
      console.error(err);
      setStatus("Error deleting accounts.");
    }
  };

  const saveEdit = async (id) => {
    if (!editingName.trim()) return;
    try {
      const updated = await updateAccount(id, { name: editingName.trim(), category: editingCategory });
      setAccounts(updated.map(a => ({ ...a, category: a.category || "other" })));
      setStatus("Account updated.");
      cancelEdit();
    } catch (err) {
      setStatus("Error updating account.");
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Create account</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Checking, Brokerage, Mortgage..."
            value={newAccount}
            onChange={(e) => setNewAccount(e.target.value)}
          />
          <select
            value={newType}
            onChange={(e) => {
              const t = e.target.value;
              setNewType(t);
              setNewCategory((t === "asset" ? assetCategories : liabilityCategories)[0]);
            }}
          >
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
          </select>
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
            {(newType === "asset" ? assetCategories : liabilityCategories).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={onCreateAccount}>Add account</button>
        </div>
        {status && <p style={{ margin: 8, marginLeft: 0 }}>{status}</p>}
      </section>

      <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Accounts</h2>
        {accounts.length > 0 && (
          <button type="button" onClick={deleteAllAccounts} style={{ marginBottom: 8 }}>
            Delete ALL accounts
          </button>
        )}
        {accounts.length === 0 && <p style={{ margin: 0 }}>No accounts yet. Add one above.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {accounts.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.6fr 0.8fr auto", gap: 8, fontWeight: 600 }}>
              <span>Account</span>
              <span>Type</span>
              <span>Category</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>
          )}
          {accounts.map((acct) => (
            <div
              key={acct.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.6fr 0.8fr auto",
                alignItems: "center",
                gap: 8
              }}
            >
              {editingId === acct.id ? (
                <>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="Account name"
                  />
                  <select
                    value={editingType}
                    onChange={(e) => {
                      const t = e.target.value;
                      setEditingType(t);
                      setEditingCategory((t === "asset" ? assetCategories : liabilityCategories)[0]);
                    }}
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                  </select>
                  <select value={editingCategory} onChange={(e) => setEditingCategory(e.target.value)}>
                    {(editingType === "asset" ? assetCategories : liabilityCategories).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => saveEdit(acct.id)}>Save</button>
                    <button type="button" onClick={cancelEdit}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <span>{acct.name}</span>
                  <span style={{ textTransform: "capitalize" }}>{categoryType(acct.category)}</span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 8px",
                      borderRadius: 8,
                      background: colorForCategory(acct.category || "other").fill,
                      border: `1px solid ${colorForCategory(acct.category || "other").stroke}`,
                      color: "#111",
                      textTransform: "capitalize",
                      textAlign: "center"
                    }}
                  >
                    {acct.category || "other"}
                  </span>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => startEdit(acct)}>Edit</button>
                    <button type="button" onClick={() => onDeleteAccount(acct.id)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
