import React, { useEffect, useMemo, useState } from "react";
import { getBalances, getAccounts, addBalance, updateBalance, deleteBalance } from "../api.js";

const parseDateParts = (str) => {
  if (!str) return null;
  const parts = str.includes("/") ? str.split("/") : str.split("-");
  if (parts.length < 3) return null;
  let [a, b, c] = parts.map(Number);
  if ([a, b, c].some(x => Number.isNaN(x))) return null;
  // Handle both MM/DD/YY and YYYY-MM-DD
  let y, m, d;
  if (str.includes("/")) {
    [m, d, y] = [a, b, c];
  } else {
    [y, m, d] = [a, b, c];
  }
  if (y < 100) y = 2000 + y;
  if (!y || !m || !d) return null;
  return { y, m, d };
};

const toIsoDate = (str) => {
  const p = parseDateParts(str);
  if (!p) return str;
  const mm = String(p.m).padStart(2, "0");
  const dd = String(p.d).padStart(2, "0");
  return `${p.y}-${mm}-${dd}`;
};

const formatDate = (str) => {
  const p = parseDateParts(str);
  if (!p) return str;
  const yy = String(p.y).slice(-2);
  return `${p.m}/${p.d}/${yy}`;
};

const dateMs = (str) => {
  const p = parseDateParts(str);
  if (!p) return 0;
  return Date.UTC(p.y, p.m - 1, p.d);
};

const buildLatestMap = (data, targetDate) => {
  if (!targetDate) return {};
  const map = {};
  for (const b of data) {
    if (b.date === targetDate) map[b.account] = b.balance;
  }
  return map;
};

const formatNumber = (val) => {
  if (val === "" || val == null) return "";
  const num = Number(String(val).replace(/,/g, ""));
  if (Number.isNaN(num)) return String(val);
  return num.toLocaleString(undefined, { useGrouping: true, maximumFractionDigits: 20 });
};

const categoriesOrder = ["cash", "stocks", "crypto", "retirement", "property", "other"];

const palette = {
    cash: { fill: "rgba(84, 119, 215, 0.9)", stroke: "#4a90e2" },
    stocks: { fill: "rgba(51, 216, 123, 0.9)", stroke: "#27ae60" },
    crypto: { fill: "rgba(253, 203, 110, 0.9)", stroke: "#f39c12" },
    retirement: { fill: "rgba(246, 221, 204, 0.9)", stroke: "#d35400" },
    property: { fill: "rgba(232, 218, 239, 0.9)", stroke: "#8e44ad" },
    other: { fill: "rgba(242, 244, 244, 0.9)", stroke: "#7f8c8d" }

};

const colorForCategory = (cat) => palette[cat] || palette.other;

export default function History() {
  const [balances, setBalances] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [status, setStatus] = useState("");
  const [sortDir, setSortDir] = useState("desc"); // "desc" or "asc"

  const [editingRowKey, setEditingRowKey] = useState(null); // draft id or date string
  const [editingDate, setEditingDate] = useState("");
  const [editingValues, setEditingValues] = useState({});

  const [draftRows, setDraftRows] = useState([]);

  const load = async () => {
    const [data, accts] = await Promise.all([getBalances(), getAccounts()]);
    setBalances(data);
    setAccountsList(accts);
  };

  useEffect(() => {
    load();
  }, []);

  const accountCategory = useMemo(() => {
    const map = new Map();
    accountsList.forEach(a => map.set(a.name, (a.category || "other").toLowerCase()));
    balances.forEach(b => {
      if (!map.has(b.account)) map.set(b.account, "other");
    });
    return map;
  }, [accountsList, balances]);

  const accounts = useMemo(() => {
    const names = new Set();
    balances.forEach(b => names.add(b.account));
    accountsList.forEach(a => names.add(a.name));

    const orderMap = new Map(categoriesOrder.map((c, i) => [c, i]));
    return [...names]
      .map(name => {
        const cat = accountCategory.get(name) || "other";
        return { name, cat };
      })
      .sort((a, b) => {
        const ca = orderMap.get(a.cat) ?? orderMap.size;
        const cb = orderMap.get(b.cat) ?? orderMap.size;
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name);
      })
      .map(x => x.name);
  }, [balances, accountsList, accountCategory]);

  const dates = useMemo(() => {
    const d = new Set(balances.map(b => b.date));
    return [...d].sort((a, b) => dateMs(b) - dateMs(a));
  }, [balances]);

  const byDate = useMemo(() => {
    const m = new Map();
    for (const b of balances) {
      if (!m.has(b.date)) m.set(b.date, new Map());
      m.get(b.date).set(b.account, b);
    }
    return m;
  }, [balances]);

  const tableRows = useMemo(() => {
    const rows = [
      ...draftRows.map(dr => ({
        key: dr.id,
        dateIso: toIsoDate(dr.date),
        values: dr.values,
        isDraft: true,
        originalDate: toIsoDate(dr.date)
      })),
      ...dates
        .filter(date => !draftRows.some(dr => dr.date === date))
        .map(date => {
          const values = {};
          accounts.forEach(a => {
            const entry = byDate.get(date)?.get(a);
            values[a] = entry ? entry.balance : "";
          });
          const iso = toIsoDate(date);
          return { key: iso, dateIso: iso, values, isDraft: false, originalDate: iso };
        })
    ];
    return rows.sort((a, b) => {
      const cmp = dateMs(b.dateIso) - dateMs(a.dateIso);
      return sortDir === "desc" ? cmp : -cmp;
    });
  }, [draftRows, dates, accounts, byDate, sortDir]);

  const addDateRow = () => {
    if (accounts.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const latestDate = dates[0] || today;
    const latestMap = buildLatestMap(balances, latestDate);

    const values = {};
    accounts.forEach(a => { values[a] = latestMap[a] ?? ""; });

    const id = `draft-${Date.now()}`;
    const isoDate = toIsoDate(latestDate);
    setDraftRows(prev => [{ id, date: isoDate, values }, ...prev]);
    setEditingRowKey(id);
    setEditingDate(isoDate);
    setEditingValues(values);
  };

  const startEditRow = (key, date, values) => {
    const isoDate = toIsoDate(date);
    setEditingRowKey(key);
    setEditingDate(isoDate);
    setEditingValues(values);
    setStatus("");
  };

  const cancelEditRow = () => {
    setEditingRowKey(null);
    setEditingDate("");
    setEditingValues({});
  };

  const saveRow = async ({ key, isDraft, originalDate }) => {
    if (!editingRowKey || editingRowKey !== key) return;

    // validate numbers first
    for (const acct of accounts) {
      const raw = editingValues[acct];
      if (raw === "" || raw == null) continue;
      const num = Number(String(raw).replace(/,/g, ""));
      if (Number.isNaN(num)) {
        setStatus("Please enter valid numbers.");
        return;
      }
    }

    const ok = window.confirm("Save changes to this row?");
    if (!ok) return;

    try {
      if (!isDraft && editingDate !== originalDate) {
        const entries = accounts
          .map(acct => byDate.get(originalDate)?.get(acct))
          .filter(Boolean);
        for (const entry of entries) {
          await deleteBalance(entry.id);
        }
      }

      for (const acct of accounts) {
        const raw = editingValues[acct];
        const existing = byDate.get(originalDate)?.get(acct);
        if (raw === "" || raw == null) {
          if (!isDraft && existing && editingDate === originalDate) {
            await deleteBalance(existing.id);
          }
          continue;
        }
        const num = Number(String(raw).replace(/,/g, ""));
        if (!isDraft && existing && editingDate === originalDate) {
          await updateBalance(existing.id, num);
        } else {
          await addBalance({ account: acct, date: editingDate, balance: num });
        }
      }

      if (isDraft) {
        setDraftRows(prev => prev.filter(dr => dr.id !== key));
      }

      setStatus("Row saved.");
      cancelEditRow();
      await load();
    } catch (e) {
      setStatus("Error saving row.");
    }
  };

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    let startIdx = 0;
    const firstCols = lines[0].split(",").map(c => c.trim().toLowerCase());
    const headerLooksRight =
      firstCols.includes("date") && firstCols.includes("account") && firstCols.includes("balance");
    if (headerLooksRight) startIdx = 1;

    const records = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      if (cols.length < 3) continue;
      const [dateCol, accountCol, balanceCol] = cols;
      if (!dateCol || !accountCol || balanceCol === undefined) continue;

      const balanceNum = Number(balanceCol.replace(/,/g, ""));
      if (Number.isNaN(balanceNum)) continue;

      records.push({
        date: toIsoDate(dateCol),
        account: accountCol,
        balance: balanceNum
      });
    }
    return records;
  };

  const onCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Processing CSV...");

    try {
      const text = await file.text();
      const records = parseCsv(text);
      if (records.length === 0) {
        setStatus("No valid rows found.");
        return;
      }

      const ok = window.confirm("Replace all history with this CSV? This will delete existing entries.");
      if (!ok) {
        setStatus("Import canceled.");
        return;
      }

      // delete existing balances first
      const current = await getBalances();
      for (const row of current) {
        await deleteBalance(row.id);
      }

      let imported = 0;
      for (const rec of records) {
        await addBalance(rec);
        imported += 1;
      }

      await load();
      setStatus(`Imported ${imported} rows from CSV (replaced previous history).`);
    } catch (err) {
      setStatus("Error importing CSV.");
    } finally {
      e.target.value = "";
    }
  };

  const downloadCsv = () => {
    const sorted = [...balances].sort((a, b) => {
      const diff = dateMs(toIsoDate(b.date)) - dateMs(toIsoDate(a.date));
      if (diff !== 0) return diff;
      return a.account.localeCompare(b.account);
    });
    const rows = ["date,account,balance"];
    for (const b of sorted) {
      rows.push(`${b.date},${b.account},${b.balance}`);
    }
    const blob = new Blob([rows.join("\\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteRow = async (date) => {
    const iso = toIsoDate(date);
    const ok = window.confirm("Delete this date row?");
    if (!ok) return;
    try {
      const entries = balances.filter(b => toIsoDate(b.date) === iso);
      for (const entry of entries) {
        await deleteBalance(entry.id);
      }
      setStatus("Row deleted.");
      load();
    } catch (err) {
      setStatus("Error deleting row.");
    }
  };

  const renderRow = ({ key, dateIso, values, isDraft, originalDate }) => {
    const isEditing = editingRowKey === key;
    const rowDate = isEditing ? editingDate : dateIso;

    return (
      <tr key={key} style={{ borderBottom: "1px solid #f2f2f2" }}>
        <td style={{ whiteSpace: "nowrap", fontWeight: isDraft ? 400 : 600 }}>
          {isEditing ? (
            <input type="date" value={editingDate} onChange={(e) => setEditingDate(e.target.value)} />
          ) : (
            formatDate(rowDate)
          )}
        </td>
        {accounts.map(acct => {
          const val = isEditing ? editingValues[acct] ?? "" : values[acct] ?? "";
          const shown = isEditing ? val : formatNumber(val);
          return (
            <td key={acct} style={{ textAlign: "right", verticalAlign: "top" }}>
              {isEditing ? (
                <input
                  type="text"
                  value={val}
                  onChange={(e) => setEditingValues(v => ({ ...v, [acct]: e.target.value }))}
                  style={{ width: "100%", textAlign: "right" }}
                />
              ) : (
                shown || <span style={{ color: "#999" }}>—</span>
              )}
            </td>
          );
        })}
        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {isEditing ? (
            <>
              <button style={btnStyle} onClick={() => saveRow({ key, isDraft, originalDate })}>Save</button>
              <button style={{ ...btnStyle, marginLeft: 6 }} onClick={cancelEditRow}>Cancel</button>
            </>
          ) : (
            <>
              <button
                style={btnStyle}
                onClick={() => startEditRow(key, dateIso, { ...values })}
              >
                Edit
              </button>
              <button
                style={{ ...btnStyle, marginLeft: 6 }}
                onClick={() => {
                  if (isDraft) {
                    setDraftRows(prev => prev.filter(dr => dr.id !== key));
                  } else {
                    deleteRow(dateIso);
                  }
                }}
              >
                Delete row
              </button>
            </>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
      <h2 style={{ marginTop: 0 }}>History</h2>

      {status && <p>{status}</p>}
      {dates.length === 0 && draftRows.length === 0 && <p>No balances yet.</p>}
      {accounts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button style={btnStyle} onClick={addDateRow}>Add date</button>
        </div>
      )}

      <section style={{ padding: 0, marginBottom: 12 }}>
        <h3 style={{ marginBottom: 6 }}>Upload CSV</h3>
        <p style={{ marginTop: 0, marginBottom: 8 }}>
          CSV columns: date, account, balance. Header row optional.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="file" accept=".csv,text/csv" onChange={onCsvUpload} />
          <button style={btnStyle} type="button" onClick={downloadCsv}>Download CSV</button>
        </div>
      </section>

      {(dates.length > 0 || draftRows.length > 0) && (
        <div style={{ overflowX: "auto" }}>
          <table width="100%" cellPadding="6" style={{ borderCollapse: "collapse", minWidth: 400 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th
                  style={{ width: 120, lineHeight: 1.2, whiteSpace: "nowrap", cursor: "pointer" }}
                  onClick={() => setSortDir(d => (d === "desc" ? "asc" : "desc"))}
                  title="Click to sort by date"
                >
                  Date {sortDir === "desc" ? "▼" : "▲"}
                </th>
                {accounts.map(acct => {
                  const cat = accountCategory.get(acct) || "other";
                  const colors = colorForCategory(cat);
                  return (
                    <th
                      key={acct}
                      style={{
                        textAlign: "center",
                        background: colors.fill,
                        borderBottom: `1px solid ${colors.stroke}`,
                        color: "#111"
                      }}
                      title={cat}
                    >
                      {acct}
                    </th>
                  );
                })}
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(r => renderRow(r))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 6,
  padding: "4px 8px",
  cursor: "pointer"
};
