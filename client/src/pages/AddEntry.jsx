import React, { useEffect, useMemo, useState } from "react";
import { addAccount, deleteAccount, getAccounts, updateAccount } from "../api.js";
import {
  assetCategories,
  liabilityCategories,
  colorForCategory,
  categoryType,
  categoryLabels,
  getCategoryBadgeStyle
} from "../palette.js";

// Get category display label
const getCategoryLabel = (cat) => categoryLabels[cat] || cat;

// Sort categories in order
const sortCategories = (cats, isAsset) => {
  const order = isAsset ? assetCategories : liabilityCategories;
  return [...cats].sort((a, b) => {
    const idxA = order.indexOf(a);
    const idxB = order.indexOf(b);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });
};

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

  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  useEffect(() => {
    getAccounts().then(list => {
      setAccounts(list.map(a => ({ ...a, category: a.category || "other" })));
    });
  }, []);

  // Group accounts by category
  const groupedAccounts = useMemo(() => {
    const groups = {};
    
    // Initialize all categories
    [...assetCategories, ...liabilityCategories].forEach(cat => {
      groups[cat] = [];
    });
    
    // Group accounts
    accounts.forEach(acct => {
      const cat = acct.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(acct);
    });
    
    return groups;
  }, [accounts]);

  // Get asset and liability groups separately
  const assetGroups = useMemo(() => {
    return sortCategories(
      assetCategories.filter(cat => groupedAccounts[cat]?.length > 0),
      true
    );
  }, [groupedAccounts]);

  const liabilityGroups = useMemo(() => {
    return sortCategories(
      liabilityCategories.filter(cat => groupedAccounts[cat]?.length > 0),
      false
    );
  }, [groupedAccounts]);

  const onCreateAccount = async () => {
    if (!newAccount.trim()) return;
    const updated = await addAccount(newAccount.trim(), newCategory);
    setAccounts(updated.map(a => ({ ...a, category: a.category || "other" })));
    setStatus("Account added successfully!");
    setNewAccount("");
    setNewType("asset");
    setNewCategory(assetCategories[0]);
    setTimeout(() => setStatus(""), 3000);
  };

  const onDeleteAccount = async (id) => {
    const ok = window.confirm("Delete this account and its balances?");
    if (!ok) return;
    try {
      const updated = await deleteAccount(id);
      setAccounts(updated.map(a => ({ ...a, category: a.category || "other" })));
      setStatus("Account deleted.");
      setTimeout(() => setStatus(""), 3000);
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
      setTimeout(() => setStatus(""), 3000);
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
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setStatus("Error updating account.");
    }
  };

  // Render a category section
  const renderCategorySection = (category, accounts) => {
    if (!accounts || accounts.length === 0) return null;
    
    const colors = colorForCategory(category);
    const isLiability = liabilityCategories.includes(category);
    
    return (
      <div key={category} className="category-section">
        <div className={`category-header ${isLiability ? 'liabilities' : category}`}>
          <span style={{ marginRight: 8 }}>{isLiability ? "🔴" : "🟢"}</span>
          {getCategoryLabel(category)}
          <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.8 }}>
            {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="table-container" style={{ borderRadius: '0 0 12px 12px', borderTop: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Account Name</th>
                <th>Type</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct) => (
                <tr key={acct.id}>
                  {editingId === acct.id ? (
                    <>
                      <td>
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Account name"
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
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
                      </td>
                      <td>
                        <select 
                          value={editingCategory} 
                          onChange={(e) => setEditingCategory(e.target.value)}
                        >
                          {(editingType === "asset" ? assetCategories : liabilityCategories).map(c => (
                            <option key={c} value={c}>{getCategoryLabel(c)}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button type="button" onClick={() => saveEdit(acct.id)}>Save</button>
                          <button type="button" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 500 }}>{acct.name}</td>
                      <td style={{ textTransform: "capitalize" }}>
                        {categoryType(acct.category)}
                      </td>
                      <td>
                        <span 
                          className={`category-badge ${acct.category || 'other'}`}
                          style={getCategoryBadgeStyle(acct.category)}
                        >
                          {getCategoryLabel(acct.category || 'other')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button type="button" onClick={() => startEdit(acct)}>Edit</button>
                          <button type="button" className="danger" onClick={() => onDeleteAccount(acct.id)}>Delete</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Create Account Section */}
      <section>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Create Account</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            placeholder="Account name (e.g., Chase Checking, Fidelity 401k)..."
            value={newAccount}
            onChange={(e) => setNewAccount(e.target.value)}
            style={{ flex: 1, minWidth: 250 }}
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
          <select 
            value={newCategory} 
            onChange={(e) => setNewCategory(e.target.value)}
            style={{ minWidth: 150 }}
          >
            {(newType === "asset" ? assetCategories : liabilityCategories).map(c => (
              <option key={c} value={c}>{getCategoryLabel(c)}</option>
            ))}
          </select>
          <button onClick={onCreateAccount} className="primary">Add Account</button>
        </div>
        {status && (
          <p style={{ margin: "12px 0 0 0", color: status.includes("Error") || status.includes("deleted") ? "#f85149" : "#3fb950" }}>
            {status}
          </p>
        )}
      </section>

      {/* Accounts by Category */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Your Accounts</h2>
          {accounts.length > 0 && (
            <button type="button" className="danger" onClick={deleteAllAccounts}>
              Delete All
            </button>
          )}
        </div>

        {accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8b949e' }}>
            <p style={{ margin: 0, fontSize: 16 }}>No accounts yet. Add your first account above to get started.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 24 }}>
            {/* Assets Section */}
            {assetGroups.length > 0 && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#3fb950', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Assets
                </h3>
                <div style={{ display: "grid", gap: 16 }}>
                  {assetGroups.map(cat => renderCategorySection(cat, groupedAccounts[cat]))}
                </div>
              </div>
            )}

            {/* Liabilities Section */}
            {liabilityGroups.length > 0 && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#f85149', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Liabilities
                </h3>
                <div style={{ display: "grid", gap: 16 }}>
                  {liabilityGroups.map(cat => renderCategorySection(cat, groupedAccounts[cat]))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Category Legend */}
      <section style={{ padding: 16 }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8b949e' }}>
          Category Colors
        </h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {assetCategories.map(cat => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={`category-badge ${cat}`} style={getCategoryBadgeStyle(cat)}>
                {getCategoryLabel(cat)}
              </span>
            </div>
          ))}
          {liabilityCategories.map(cat => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={`category-badge ${cat}`} style={getCategoryBadgeStyle(cat)}>
                {getCategoryLabel(cat)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
