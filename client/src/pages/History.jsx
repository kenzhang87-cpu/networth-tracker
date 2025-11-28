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

const assetCategories = ["cash", "stocks", "crypto", "retirement", "property", "other"];
const liabilityCategories = ["mortgage", "credit card", "loans", "other liability"];

const palette = {
  cash: { fill: "rgba(84, 119, 215, 0.9)", stroke: "#4a90e2" },
  stocks: { fill: "rgba(51, 216, 123, 0.9)", stroke: "#27ae60" },
  crypto: { fill: "rgba(253, 203, 110, 0.9)", stroke: "#f39c12" },
  retirement: { fill: "rgba(246, 221, 204, 0.9)", stroke: "#d35400" },
  property: { fill: "rgba(232, 218, 239, 0.9)", stroke: "#8e44ad" },
  mortgage: { fill: "rgba(214, 234, 248, 0.9)", stroke: "#2980b9" },
  "credit card": { fill: "rgba(245, 183, 177, 0.9)", stroke: "#c0392b" },
  loans: { fill: "rgba(215, 189, 226, 0.9)", stroke: "#7d3c98" },
  "other liability": { fill: "rgba(236, 240, 241, 0.9)", stroke: "#7f8c8d" },
  other: { fill: "rgba(242, 244, 244, 0.9)", stroke: "#7f8c8d" }
};

const colorForCategory = (cat) => palette[cat] || palette.other;
const categoryType = (cat) => {
  const c = (cat || "").toLowerCase();
  if (liabilityCategories.includes(c)) return "liability";
  return "asset";
};

export default function History() {
  const [balances, setBalances] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [status, setStatus] = useState("");
  const [sortDir, setSortDir] = useState("desc"); // "desc" or "asc"

  const [editingRowKey, setEditingRowKey] = useState(null); // draft id or date string
  const [editingDate, setEditingDate] = useState("");
  const [editingValues, setEditingValues] = useState({});

  const [draftRows, setDraftRows] = useState([]);
  const [assetCols, setAssetCols] = useState([]);
  const [liabilityCols, setLiabilityCols] = useState([]);

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

  const accountsByType = useMemo(() => {
    const names = new Set();
    balances.forEach(b => names.add(b.account));
    accountsList.forEach(a => names.add(a.name));

    const withMeta = [...names].map(name => {
      const cat = accountCategory.get(name) || "other";
      const type = categoryType(cat);
      return { name, cat, type };
    });

    const orderAsset = new Map(assetCategories.map((c, i) => [c, i]));
    const orderLiab = new Map(liabilityCategories.map((c, i) => [c, i]));

    const assets = withMeta
      .filter(x => x.type === "asset")
      .sort((a, b) => {
        const ca = orderAsset.get(a.cat) ?? orderAsset.size;
        const cb = orderAsset.get(b.cat) ?? orderAsset.size;
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name);
      });

    const liabilities = withMeta
      .filter(x => x.type === "liability")
      .sort((a, b) => {
        const ca = orderLiab.get(a.cat) ?? orderLiab.size;
        const cb = orderLiab.get(b.cat) ?? orderLiab.size;
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name);
      });

    return { assets, liabilities };
  }, [balances, accountsList, accountCategory]);

  useEffect(() => {
    setAssetCols(accountsByType.assets.map(a => a.name));
    setLiabilityCols(accountsByType.liabilities.map(a => a.name));
  }, [accountsByType]);

  const allColumns = useMemo(() => [...assetCols, ...liabilityCols], [assetCols, liabilityCols]);

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
          allColumns.forEach(a => {
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
  }, [draftRows, dates, allColumns, byDate, sortDir]);

  const addDateRow = () => {
    if (allColumns.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const latestDate = dates[0] || today;
    const latestMap = buildLatestMap(balances, latestDate);

    const values = {};
    allColumns.forEach(a => { values[a] = latestMap[a] ?? ""; });

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
    for (const acct of allColumns) {
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
        const entries = allColumns
          .map(acct => byDate.get(originalDate)?.get(acct))
          .filter(Boolean);
        for (const entry of entries) {
          await deleteBalance(entry.id);
        }
      }

      for (const acct of allColumns) {
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
    const cols = allColumns; // account names
    const rows = [];
    rows.push(["date", "account", "balance"].join(","));
  
    const sortedDates = [...dates].sort((a, b) => dateMs(a) - dateMs(b));
  
    for (const date of sortedDates) {
      const iso = toIsoDate(date);
  
      // Try both keys because your byDate might be keyed by raw date or ISO
      let entries = byDate.get?.(date) ?? byDate.get?.(iso) ?? byDate[date] ?? byDate[iso];
  
      // Normalize entries to a Map-ish accessor
      const getEntry = (acct) => {
        if (!entries) return undefined;
        if (entries instanceof Map) return entries.get(acct);
        return entries[acct]; // plain object case
      };
  
      for (const acct of cols) {
        const entry = getEntry(acct);
        if (entry == null) continue; // skip blanks to match your attached CSV
  
        // Support entry being {balance: x} or directly a number
        const bal =
          typeof entry === "object" && entry !== null
            ? entry.balance
            : entry;
  
        if (bal == null || bal === "") continue;
  
        // Use same date style as your original file (change to `iso` if you want ISO)
        const dateOut = date;
  
        rows.push([dateOut, acct, bal].join(","));
      }
    }
  
    const csvContent = rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
  
    const link = document.createElement("a");
    link.href = url;
    link.download = "balances_long.csv";
    link.click();
  
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

  const renderRow = ({ key, dateIso, values, isDraft, originalDate, columns = allColumns }) => {
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
        {columns.map(acct => {
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
      {allColumns.length > 0 && (
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
        <>
          <div
  style={{
    background: "#000",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 8,
    marginBottom: 8
  }}
>
  <h3 style={{ margin: 0 }}>Assets</h3>
</div>

<div style={{ overflowX: "auto" }}>
  ...
</div>

          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            {assetCols.length === 0 ? (
              <div style={{ color: "#777" }}>No asset accounts</div>
            ) : (
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
                    {assetCols.map(acct => {
                      const cat = accountCategory.get(acct) || "other";
                      const colors = colorForCategory(cat);
                      return (
                        <th
                          key={acct}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", `asset::${acct}`)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const data = e.dataTransfer.getData("text/plain");
                            if (!data.startsWith("asset::")) return;
                            const dragged = data.split("::")[1];
                            setAssetCols(cols => {
                              const next = cols.filter(c => c !== dragged);
                              const idx = next.indexOf(acct);
                              next.splice(idx, 0, dragged);
                              return [...next];
                            });
                          }}
                          style={{
                            textAlign: "center",
                            background: colors.fill,
                            borderBottom: `1px solid ${colors.stroke}`,
                            color: "#111",
                            cursor: "grab"
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
                  {tableRows.map(r => renderRow({ ...r, columns: assetCols }))}
                </tbody>
              </table>
            )}
          </div>

          <div
  style={{
    background: "#000",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 8,
    marginBottom: 8
  }}
>
  <h3 style={{ margin: 0 }}>Liabilities</h3>
</div>

<div style={{ overflowX: "auto" }}>
  ...
</div>

          <div style={{ overflowX: "auto" }}>
            {liabilityCols.length === 0 ? (
              <div style={{ color: "#777" }}>No liability accounts</div>
            ) : (
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
                    {liabilityCols.map(acct => {
                      const cat = accountCategory.get(acct) || "other liability";
                      const colors = colorForCategory(cat);
                      return (
                        <th
                          key={acct}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", `liability::${acct}`)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const data = e.dataTransfer.getData("text/plain");
                            if (!data.startsWith("liability::")) return;
                            const dragged = data.split("::")[1];
                            setLiabilityCols(cols => {
                              const next = cols.filter(c => c !== dragged);
                              const idx = next.indexOf(acct);
                              next.splice(idx, 0, dragged);
                              return [...next];
                            });
                          }}
                          style={{
                            textAlign: "center",
                            background: colors.fill,
                            borderBottom: `1px solid ${colors.stroke}`,
                            color: "#111",
                            cursor: "grab"
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
                  {tableRows.map(r => renderRow({ ...r, columns: liabilityCols }))}
                </tbody>
              </table>
            )}
          </div>
        </>
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
