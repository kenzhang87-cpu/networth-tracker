import React, { useEffect, useMemo, useState } from "react";
import {
  addAccount,
  addBalance,
  deleteBalance,
  getAccounts,
  getBalances,
  updateAccount,
  updateBalance
} from "../api.js";

/** ---------------- Date helpers ---------------- */

const parseDateParts = (str) => {
  if (!str) return null;
  const s = String(str).trim();
  const parts = s.includes("/") ? s.split("/") : s.split("-");
  if (parts.length < 3) return null;
  let [a, b, c] = parts.map(Number);
  if ([a, b, c].some(x => Number.isNaN(x))) return null;

  let y, m, d;
  if (s.includes("/")) {
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
  if (!p) return String(str).trim();
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

/** ---------------- Misc helpers ---------------- */

const buildLatestMap = (data, targetDate) => {
  if (!targetDate) return {};
  const map = {};
  for (const b of data) {
    if (toIsoDate(b.date) === toIsoDate(targetDate)) map[b.account] = b.balance;
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
const sanitizeCategory = (cat) => {
  const c = String(cat || "").trim().toLowerCase();
  if (!c) return "other";
  return c;
};
const normalizeType = (val) => {
  const t = String(val || "").trim().toLowerCase();
  if (t.startsWith("liab")) return "liability";
  if (t.startsWith("asset")) return "asset";
  return null;
};

/** ---------------- CSV (LONG FORMAT) PARSER ----------------
 * Expected columns: date, account, category, type, balance
 */

const parseCsvLong = (text) => {
  const lines = String(text)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const hasHeader5 =
    header[0] === "date" &&
    header[1] === "account" &&
    header[2] === "category" &&
    header[3] === "type" &&
    header[4] === "balance";
  const hasHeader4 =
    header[0] === "date" &&
    header[1] === "account" &&
    header[2] === "type" &&
    header[3] === "balance";
  const hasHeader3 =
    header[0] === "date" &&
    header[1] === "account" &&
    header[2] === "balance";

  const startIdx = hasHeader5 || hasHeader4 || hasHeader3 ? 1 : 0;
  const records = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    if (cols.length < 3) continue;

    let dateStr, account, categoryRaw, typeRaw, balStr;
    if (hasHeader5 || cols.length >= 5) {
      [dateStr, account, categoryRaw, typeRaw, balStr] = cols;
    } else if (hasHeader4 || cols.length === 4) {
      [dateStr, account, typeRaw, balStr] = cols;
      categoryRaw = null;
    } else {
      [dateStr, account, balStr] = cols;
      categoryRaw = null;
      typeRaw = null;
    }

    if (!dateStr || !account || !balStr) continue;

    const balance = Number(balStr.replace(/[$,]/g, ""));
    if (!Number.isFinite(balance)) continue;

    const date = toIsoDate(dateStr);
    const type = normalizeType(typeRaw);
    const category = sanitizeCategory(categoryRaw);
    records.push({ date, account, balance, type, category });
  }

  return records;
};

export default function History() {
  const [balances, setBalances] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [status, setStatus] = useState("");
  const [sortDir, setSortDir] = useState("desc");

  const [editingRowKey, setEditingRowKey] = useState(null);
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

  useEffect(() => { load(); }, []);

  const deleteAllData = async () => {
    const ok = window.confirm(
      "⚠️ Delete ALL history?\n\nThis will permanently remove every balance entry. This cannot be undone."
    );
    if (!ok) return;
  
    try {
      setStatus("Deleting all data...");
  
      const current = await getBalances();
      if (!Array.isArray(current) || current.length === 0) {
        setStatus("No data to delete.");
        return;
      }
  
      const total = current.length;
  
      // helper to chunk an array
      const chunk = (arr, size) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
          arr.slice(i * size, i * size + size)
        );
  
      let deleted = 0;
  
      // delete in batches of 100 (tweak if you want)
      for (const group of chunk(current, 100)) {
        await Promise.all(
          group
            .filter(row => row?.id != null)
            .map(row => deleteBalance(row.id))
        );
        deleted += group.length;
        setStatus(`Deleting all data... ${deleted}/${total}`);
      }
  
      await load();
      setStatus("All history deleted.");
    } catch (err) {
      console.error(err);
      setStatus("Error deleting all data.");
    }
  };
  

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

  const allColumns = useMemo(
    () => [...assetCols, ...liabilityCols],
    [assetCols, liabilityCols]
  );

  const dates = useMemo(() => {
    const d = new Set(balances.map(b => toIsoDate(b.date)));
    return [...d].sort((a, b) => dateMs(b) - dateMs(a));
  }, [balances]);

  const byDate = useMemo(() => {
    const m = new Map();
    for (const b of balances) {
      const iso = toIsoDate(b.date);
      if (!m.has(iso)) m.set(iso, new Map());
      m.get(iso).set(b.account, b);
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
        .filter(date => !draftRows.some(dr => toIsoDate(dr.date) === date))
        .map(date => {
          const values = {};
          allColumns.forEach(a => {
            const entry = byDate.get(date)?.get(a);
            values[a] = entry ? entry.balance : "";
          });
          return { key: date, dateIso: date, values, isDraft: false, originalDate: date };
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

      if (isDraft) setDraftRows(prev => prev.filter(dr => dr.id !== key));

      setStatus("Row saved.");
      cancelEditRow();
      await load();
    } catch (e) {
      setStatus("Error saving row.");
    }
  };

  /** ---------------- CSV upload (FASTER) ---------------- */
const onCsvUpload = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setStatus("Processing CSV...");

  // small helper: chunk an array into groups
  const chunk = (arr, size) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );

  try {
    const text = await file.text();
    const records = parseCsvLong(text);

    if (records.length === 0) {
      setStatus("No valid rows found. Check headers: date, account, category, type, balance");
      return;
    }

    const ok = window.confirm(
      `Replace all history with this CSV?\n\nThis will delete existing entries and import ${records.length} rows.\nAccounts and categories will be updated to match the CSV.`
    );
    if (!ok) {
      setStatus("Import canceled.");
      return;
    }

    setStatus("Syncing accounts...");

    // Fetch current accounts
    const acctList = await getAccounts();
    const acctMap = new Map(
      acctList.map(a => [String(a.name).trim().toLowerCase(), a])
    );

    const desiredMeta = new Map();
    const defaultCategoryForType = (t) =>
      (t === "liability" ? "other liability" : "other");

    // Build desiredMeta once (unique accounts only)
    for (const rec of records) {
      const name = String(rec.account || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();

      const categoryFromCsv = sanitizeCategory(rec.category);
      const existingCategory = sanitizeCategory(acctMap.get(key)?.category);

      const typeFromCsv = normalizeType(rec.type);
      const typeFromCategory = categoryType(
        categoryFromCsv || existingCategory
      );

      const type = typeFromCsv || typeFromCategory || "asset";
      const category =
        categoryFromCsv ||
        existingCategory ||
        defaultCategoryForType(type);

      desiredMeta.set(key, { name, category });
    }

    // Prepare create/update tasks (don’t execute yet)
    const createTasks = [];
    const updateTasks = [];

    for (const meta of desiredMeta.values()) {
      const key = meta.name.toLowerCase();
      const existing = acctMap.get(key);

      if (!existing) {
        createTasks.push(async () => {
          await addAccount(meta.name, meta.category);
          // put a placeholder so later balance inserts don't try again
          acctMap.set(key, { id: null, name: meta.name, category: meta.category });
        });
      } else if (
        sanitizeCategory(existing.category) !== sanitizeCategory(meta.category)
      ) {
        updateTasks.push(async () => {
          try {
            await updateAccount(existing.id, {
              name: existing.name,
              category: meta.category
            });
            acctMap.set(key, { ...existing, category: meta.category });
          } catch (err) {
            console.error("FAILED updateAccount during import:", existing.name, err);
          }
        });
      }
    }

    // Run creates + updates in parallel batches
    const runTasksInBatches = async (tasks, batchSize, label) => {
      let done = 0;
      for (const group of chunk(tasks, batchSize)) {
        await Promise.all(group.map(fn => fn()));
        done += group.length;
        if (label) setStatus(`${label} ${done}/${tasks.length}...`);
      }
    };

    await runTasksInBatches(createTasks, 10, "Creating accounts");
    await runTasksInBatches(updateTasks, 10, "Updating accounts");

    setStatus("Deleting old balances...");

    // Delete existing balances IN PARALLEL batches
    const current = await getBalances();
    const deleteTasks = current
      .filter(row => row?.id != null)
      .map(row => () => deleteBalance(row.id));

    await runTasksInBatches(deleteTasks, 100, "Deleting balances");

    setStatus("Importing balances...");

    // Clean + validate records first (so we skip trash fast)
    const cleanedRecords = records
      .map(rec => {
        const accountName = String(rec.account || "").trim();
        if (!accountName) return null;

        const date = toIsoDate(rec.date);
        const balance = Number(rec.balance);

        if (!date || !Number.isFinite(balance)) return null;

        return {
          date,
          account: accountName,
          balance
        };
      })
      .filter(Boolean);

    let imported = 0;
    let failed = 0;

    // Add balances in parallel batches
    for (const group of chunk(cleanedRecords, 100)) {
      const results = await Promise.allSettled(
        group.map(rec => addBalance(rec))
      );

      for (const r of results) {
        if (r.status === "fulfilled") imported++;
        else {
          failed++;
          console.error("FAILED addBalance:", r.reason);
        }
      }

      setStatus(`Importing balances... ${imported}/${cleanedRecords.length}`);
    }

    await load();
    setStatus(
      `Imported ${imported} rows.${failed ? ` ${failed} failed (see Console).` : ""}`
    );
  } catch (err) {
    console.error(err);
    setStatus("Error importing CSV.");
  } finally {
    e.target.value = "";
  }
};

  /** ---------------- CSV download (long format) ---------------- */

  const downloadCsv = () => {
    const cols = allColumns;
    const rows = [];
    rows.push(["date", "account", "category", "type", "balance"].join(","));

    const sortedDates = [...dates].sort((a, b) => dateMs(a) - dateMs(b));

    for (const date of sortedDates) {
      const entries = byDate.get(date) || new Map();

      for (const acct of cols) {
        const entry = entries.get(acct);
        if (!entry) continue;
        const bal = entry.balance;
        if (bal == null || bal === "") continue;
        const type = categoryType(accountCategory.get(acct) || "other");
        const category = sanitizeCategory(accountCategory.get(acct) || "other");
        rows.push([formatDate(date), acct, category, type, bal].join(","));
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
              <button style={btnStyle} onClick={() => startEditRow(key, dateIso, { ...values })}>
                Edit
              </button>
              <button
                style={{ ...btnStyle, marginLeft: 6 }}
                onClick={() => {
                  if (isDraft) setDraftRows(prev => prev.filter(dr => dr.id !== key));
                  else deleteRow(dateIso);
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

      {/* ✅ BUTTONS LIVE HERE */}
      {allColumns.length > 0 && (
        <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btnStyle} onClick={addDateRow}>Add date</button>

          <button
            type="button"
            onClick={deleteAllData}
            style={{
              ...btnStyle,
              border: "1px solid #c0392b",
              color: "#c0392b",
              fontWeight: 700
            }}
          >
            Delete ALL data
          </button>
        </div>
      )}

      <section style={{ padding: 0, marginBottom: 12 }}>
        <h3 style={{ marginBottom: 6 }}>Upload CSV</h3>
        <p style={{ marginTop: 0, marginBottom: 8 }}>
          CSV columns: date, account, category, type (asset/liability), balance. Header row optional (legacy 3- or 4-column files still import; missing category defaults to "other" or "other liability").
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="file" accept=".csv,text/csv" onChange={onCsvUpload} />
          <button style={btnStyle} type="button" onClick={downloadCsv}>Download CSV</button>
        </div>
      </section>

      {(dates.length > 0 || draftRows.length > 0) && (
        <>
          {/* ASSETS TABLE */}
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

          {/* LIABILITIES TABLE */}
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
