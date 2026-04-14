import React, { useEffect, useMemo, useState } from "react";
import { getTimeseries, getAccounts } from "../api.js";
import {
  assetCategories,
  liabilityCategories,
  colorForCategory,
  categoryLabels
} from "../palette.js";
import {
  LineChart, Line, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine
} from "recharts";

/** ---------------- Date helpers ---------------- */

const parseDateParts = (str) => {
  if (!str) return null;
  const parts = str.includes("/") ? str.split("/") : str.split("-");
  if (parts.length < 3) return null;
  let [a, b, c] = parts.map(Number);
  if ([a, b, c].some(x => Number.isNaN(x))) return null;
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

const dateMs = (str) => {
  const p = parseDateParts(str);
  if (!p) return 0;
  return Date.UTC(p.y, p.m - 1, p.d);
};

const monthStartMs = (iso) => {
  const p = parseDateParts(iso);
  if (!p) return 0;
  return Date.UTC(p.y, p.m - 1, 1);
};

const formatMonthLabel = (ms) => {
  const d = new Date(ms);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${month} ${yy}`;
};

const formatMonthDayLabel = (ms) => {
  const d = new Date(ms);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  const day = String(d.getUTCDate());
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${month} ${day}, ${yy}`;
};

/** ---------------- Formatting helpers ---------------- */

const formatCurrency = (val) => {
  if (val == null) return "";
  const num = Number(val);
  if (Number.isNaN(num)) return val;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const formatCurrencyShort = (val) => {
  if (val == null) return "";
  const num = Number(val);
  if (Number.isNaN(num)) return val;
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}m`;
  } else if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}$${abs.toFixed(0)}`;
};

const categoriesOrder = [...assetCategories, ...liabilityCategories];

/** ---------------- Y-axis scaling ---------------- */
const computeYNetWorth = (rows) => {
  const vals = rows
    .map(r => Number(r.netWorth))
    .filter(v => Number.isFinite(v));

  if (vals.length === 0) return { domain: ["auto", "auto"], ticks: [] };

  let min = Math.min(...vals);
  let max = Math.max(...vals);

  if (min === max) {
    const bump = Math.abs(min) || 1;
    min -= bump;
    max += bump;
  }

  const range = max - min;
  const pad = range * 0.02;
  min -= pad;
  max += pad;

  const step = 10_000;

  const minTick = Math.floor(min / step) * step;
  const maxTick = Math.ceil(max / step) * step;

  const ticks = [];
  for (let t = minTick; t <= maxTick; t += step) {
    ticks.push(t);
  }

  return { domain: [minTick, maxTick], ticks };
};

const computeYStacked = (rows) => {
  const totals = [];

  for (const r of rows) {
    let pos = 0;
    let neg = 0;

    for (const c of categoriesOrder) {
      const v = Number(r[c]) || 0;
      if (liabilityCategories.includes(c)) neg += Math.abs(v);
      else pos += v;
    }

    totals.push(pos);
    totals.push(-neg);
  }

  const valid = totals.filter(v => Number.isFinite(v));
  if (valid.length === 0) return { domain: ["auto", "auto"], ticks: [] };

  let min = Math.min(...valid);
  let max = Math.max(...valid);

  if (min === max) {
    const bump = Math.abs(min) || 1;
    min -= bump;
    max += bump;
  }

  const range = max - min;
  const pad = range * 0.02;
  min -= pad;
  max += pad;

  min = Math.min(min, 0);
  max = Math.max(max, 0);

  const step = 10_000;

  const minTick = Math.floor(min / step) * step;
  const maxTick = Math.ceil(max / step) * step;

  const ticks = [];
  for (let t = minTick; t <= maxTick; t += step) ticks.push(t);

  return { domain: [minTick, maxTick], ticks };
};

/** -------- Custom tooltip for stacked category chart -------- */

const CategoriesTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const dateLabel = formatMonthDayLabel(label);
  const valueByKey = new Map(payload.map(p => [p.dataKey, p.value]));

  const rows = categoriesOrder
    .map((cat) => {
      const v = valueByKey.get(cat);
      if (v == null || v === 0) return null;
      return {
        cat,
        val: v,
        color: colorForCategory(cat).stroke
      };
    })
    .filter(Boolean);

  const netWorth = valueByKey.get("netWorth");

  return (
    <div style={{
      background: "#161b22",
      border: "1px solid #30363d",
      padding: 12,
      borderRadius: 8,
      color: "#e6edf3",
      minWidth: 190,
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: "#f5f5f5" }}>{dateLabel}</div>

      {rows.map(r => (
        <div key={r.cat} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <span style={{ color: r.color, textTransform: "capitalize" }}>{categoryLabels[r.cat] || r.cat}</span>
          <span>{formatCurrency(r.val)}</span>
        </div>
      ))}

      {netWorth != null && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid #30363d",
          fontWeight: 700
        }}>
          <span>Net Worth</span>
          <span>{formatCurrency(netWorth)}</span>
        </div>
      )}
    </div>
  );
};

/** ---------------- Component ---------------- */

export default function Charts() {
  const [series, setSeries] = useState([]);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    getTimeseries().then(setSeries);
    getAccounts().then(setAccounts);
  }, []);

  const { chartData, monthTicks, yMetaNetWorth, yMetaStacked, totals } = useMemo(() => {
    const acctCategory = new Map(
      accounts.map(a => [a.name, (a.category || "other").toLowerCase()])
    );

    const normalized = series.map(d => {
      const iso = toIsoDate(d.date);
      const ms = dateMs(iso);
      return { ...d, iso, ms };
    }).sort((a, b) => a.ms - b.ms);

    if (normalized.length === 0) {
      return {
        chartData: [],
        monthTicks: [],
        yMetaNetWorth: { domain: ["auto", "auto"], ticks: [] },
        yMetaStacked: { domain: ["auto", "auto"], ticks: [] },
        totals: {}
      };
    }

    // Calculate category totals for summary
    const catTotals = {};
    categoriesOrder.forEach(c => catTotals[c] = 0);

    // continuous month ticks
    const ticks = [];
    let cursor = monthStartMs(normalized[0].iso);
    const end = monthStartMs(normalized[normalized.length - 1].iso);
    while (cursor <= end) {
      ticks.push(cursor);
      const d = new Date(cursor);
      cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    }

    const chartData = normalized.map(d => {
      const row = { dateMs: d.ms, dateLabel: formatMonthDayLabel(d.ms) };
      const catSums = Object.fromEntries(categoriesOrder.map(c => [c, 0]));

      if (d.accounts) {
        for (const [acct, bal] of Object.entries(d.accounts)) {
          const cat = acctCategory.get(acct) || "other";
          catSums[cat] = (catSums[cat] || 0) + bal;
        }
      }

      categoriesOrder.forEach(c => {
        const val = catSums[c];
        const isLiab = liabilityCategories.includes(c);
        row[c] = isLiab ? -Math.abs(val) : val;
      });

      row.netWorth = Object.values(catSums).reduce((s, v) => s + v, 0);
      return row;
    });

    // Get latest values for summary
    if (chartData.length > 0) {
      const latest = chartData[chartData.length - 1];
      categoriesOrder.forEach(c => {
        catTotals[c] = Math.abs(latest[c] || 0);
      });
    }

    return {
      chartData,
      monthTicks: ticks,
      yMetaNetWorth: computeYNetWorth(chartData),
      yMetaStacked: computeYStacked(chartData),
      totals: catTotals
    };
  }, [series, accounts]);

  const assetTotal = useMemo(() => 
    assetCategories.reduce((sum, cat) => sum + (totals[cat] || 0), 0),
  [totals]);

  const liabilityTotal = useMemo(() => 
    liabilityCategories.reduce((sum, cat) => sum + (totals[cat] || 0), 0),
  [totals]);

  const netWorth = assetTotal - liabilityTotal;

  if (chartData.length === 0) {
    return (
      <div className="chart-container">
        <h2 style={{ marginTop: 0 }}>Charts</h2>
        <p style={{ color: '#8b949e' }}>No data to plot yet. Add some accounts and balances to see charts.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span className="summary-card-label">Total Assets</span>
          <span className="summary-card-value" style={{ color: '#3fb950' }}>{formatCurrency(assetTotal)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-card-label">Total Liabilities</span>
          <span className="summary-card-value" style={{ color: '#f85149' }}>{formatCurrency(liabilityTotal)}</span>
        </div>
        <div className={`summary-card ${netWorth >= 0 ? 'positive' : 'negative'}`}>
          <span className="summary-card-label">Net Worth</span>
          <span className="summary-card-value">{formatCurrency(netWorth)}</span>
        </div>
      </div>

      {/* Net Worth Line Chart */}
      <div className="chart-container">
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Net Worth Over Time</h2>
        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ left: 12, right: 24, top: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3fb950" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3fb950" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis
                type="number"
                dataKey="dateMs"
                ticks={monthTicks}
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatMonthLabel}
                stroke="#8b949e"
                tick={{ fill: "#8b949e", fontSize: 12 }}
              />
              <YAxis
                domain={yMetaNetWorth.domain}
                ticks={yMetaNetWorth.ticks}
                tickFormatter={formatCurrencyShort}
                stroke="#8b949e"
                tick={{ fill: "#8b949e", fontSize: 12 }}
                width={70}
              />
              <Tooltip
                labelFormatter={(ms) => formatMonthDayLabel(ms)}
                formatter={(v) => [formatCurrency(v), "Net Worth"]}
                contentStyle={{ 
                  background: "#161b22", 
                  border: "1px solid #30363d", 
                  color: "#e6edf3",
                  borderRadius: 8
                }}
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="none"
                fill="url(#netWorthGradient)"
              />
              <Line 
                type="monotone" 
                dataKey="netWorth" 
                dot={false} 
                activeDot={{ r: 6, strokeWidth: 0 }} 
                stroke="#3fb950" 
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Categories Stacked Area Chart */}
      <div className="chart-container">
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Categories Breakdown Over Time</h2>
        <LegendTwoLine />
        <div style={{ width: "100%", height: 400, marginTop: 16 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} stackOffset="none" margin={{ left: 12, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis
                type="number"
                dataKey="dateMs"
                ticks={monthTicks}
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatMonthLabel}
                stroke="#8b949e"
                tick={{ fill: "#8b949e", fontSize: 12 }}
              />
              <YAxis
                domain={yMetaStacked.domain}
                ticks={yMetaStacked.ticks}
                tickFormatter={formatCurrencyShort}
                stroke="#8b949e"
                tick={{ fill: "#8b949e", fontSize: 12 }}
                width={70}
              />
              <Tooltip content={<CategoriesTooltip />} />

              {assetCategories.map((cat) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId="assets"
                  dot={false}
                  fillOpacity={0.7}
                  fill={colorForCategory(cat).fill}
                  stroke={colorForCategory(cat).stroke}
                  strokeWidth={2}
                />
              ))}

              {liabilityCategories.map((cat) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId="liabilities"
                  dot={false}
                  fillOpacity={0.7}
                  fill={colorForCategory(cat).fill}
                  stroke={colorForCategory(cat).stroke}
                  strokeWidth={2}
                />
              ))}

              <ReferenceLine y={0} stroke="#8b949e" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Pie Charts */}
      <div className="chart-container">
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Current Allocation</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
          {/* Assets Pie */}
          <div>
            <h3 style={{ textAlign: "center", marginBottom: 16, color: "#3fb950" }}>Assets</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={assetCategories
                      .map(cat => ({ name: cat, value: totals[cat] || 0 }))
                      .filter(d => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => 
                      percent > 0.05 ? `${categoryLabels[name] || name}: ${(percent * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}
                  >
                    {assetCategories.map(cat => (
                      <Cell key={cat} fill={colorForCategory(cat).stroke} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [formatCurrency(val), categoryLabels[name] || name]}
                    contentStyle={{ 
                      background: "#161b22", 
                      border: "1px solid #30363d", 
                      color: "#e6edf3",
                      borderRadius: 8
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 16 }}>
              {assetCategories
                .filter(cat => (totals[cat] || 0) > 0)
                .map(cat => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: 3, 
                      backgroundColor: colorForCategory(cat).stroke 
                    }} />
                    <span style={{ fontSize: 13, color: "#e6edf3" }}>
                      {categoryLabels[cat]} ({formatCurrency(totals[cat])})
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Liabilities Pie */}
          <div>
            <h3 style={{ textAlign: "center", marginBottom: 16, color: "#f85149" }}>Liabilities</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={liabilityCategories
                      .map(cat => ({ name: cat, value: totals[cat] || 0 }))
                      .filter(d => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => 
                      percent > 0.05 ? `${categoryLabels[name] || name}: ${(percent * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}
                  >
                    {liabilityCategories.map(cat => (
                      <Cell key={cat} fill={colorForCategory(cat).stroke} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [formatCurrency(val), categoryLabels[name] || name]}
                    contentStyle={{ 
                      background: "#161b22", 
                      border: "1px solid #30363d", 
                      color: "#e6edf3",
                      borderRadius: 8
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 16 }}>
              {liabilityCategories
                .filter(cat => (totals[cat] || 0) > 0)
                .map(cat => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: 3, 
                      backgroundColor: colorForCategory(cat).stroke 
                    }} />
                    <span style={{ fontSize: 13, color: "#e6edf3" }}>
                      {categoryLabels[cat]} ({formatCurrency(totals[cat])})
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ---------------- Legend Component ---------------- */

const LegendTwoLine = () => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ fontSize: 12, textTransform: "uppercase", color: "#8b949e" }}>Assets:</strong>
        {assetCategories.map(cat => (
          <div key={`leg-a-${cat}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ 
              width: 10, 
              height: 10, 
              borderRadius: 2, 
              backgroundColor: colorForCategory(cat).stroke 
            }} />
            <span style={{ 
              color: colorForCategory(cat).stroke, 
              textTransform: "capitalize",
              fontSize: 13,
              fontWeight: 500
            }}>
              {categoryLabels[cat]}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ fontSize: 12, textTransform: "uppercase", color: "#8b949e" }}>Liabilities:</strong>
        {liabilityCategories.map(cat => (
          <div key={`leg-l-${cat}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ 
              width: 10, 
              height: 10, 
              borderRadius: 2, 
              backgroundColor: colorForCategory(cat).stroke 
            }} />
            <span style={{ 
              color: colorForCategory(cat).stroke, 
              textTransform: "capitalize",
              fontSize: 13,
              fontWeight: 500
            }}>
              {categoryLabels[cat]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
