import React, { useEffect, useMemo, useState } from "react";
import { getTimeseries, getAccounts } from "../api.js";
import {
  LineChart, Line, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

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

const monthKey = (iso) => iso.slice(0, 7); // YYYY-MM

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
  return `$${(num / 1_000_000).toFixed(1)}m`;
};

const categoriesOrder = ["cash", "stocks", "crypto", "retirement", "property", "other"];

const computeY = (rows) => {
  const allVals = [];
  for (const r of rows) {
    if (r.netWorth != null) allVals.push(Number(r.netWorth));
    const catSum = categoriesOrder.reduce((s, c) => s + (Number(r[c]) || 0), 0);
    allVals.push(catSum);
  }
  const valid = allVals.filter(v => !Number.isNaN(v));
  if (valid.length === 0) return { domain: ["auto", "auto"], ticks: [] };
  const step = 500_000;
  let min = Math.min(...valid);
  let max = Math.max(...valid);
  if (min === max) {
    min = min - step;
    max = max + step;
  }
  const minTick = Math.floor(min / step) * step;
  const maxTick = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = minTick; t <= maxTick; t += step) ticks.push(t);
  return { domain: [minTick, maxTick], ticks };
};

export default function Charts() {
  const [series, setSeries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [pieDate, setPieDate] = useState("");

  useEffect(() => {
    getTimeseries().then(setSeries);
    getAccounts().then(setAccounts);
  }, []);

  const { chartData, monthTicks, yMeta } = useMemo(() => {
    const acctCategory = new Map(accounts.map(a => [a.name, (a.category || "other").toLowerCase()]));

    const normalized = series.map(d => {
      const iso = toIsoDate(d.date);
      const ms = dateMs(iso);
      return { ...d, iso, ms };
    }).sort((a, b) => a.ms - b.ms);

    if (normalized.length === 0) return { chartData: [], monthTicks: [] };

    // build continuous month ticks from min to max
    const ticks = [];
    let cursor = monthStartMs(normalized[0].iso);
    const end = monthStartMs(normalized[normalized.length - 1].iso);
    while (cursor <= end) {
      ticks.push(cursor);
      const d = new Date(cursor);
      cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    }

    const chartData = normalized.map(d => {
      const row = { dateMs: d.ms, dateLabel: formatMonthDayLabel(d.ms), netWorth: d.netWorth };
      const catSums = Object.fromEntries(categoriesOrder.map(c => [c, 0]));
      if (d.accounts) {
        for (const [acct, bal] of Object.entries(d.accounts)) {
          const cat = acctCategory.get(acct) || "other";
          if (catSums[cat] == null) catSums[cat] = 0;
          catSums[cat] += bal;
        }
      }
      categoriesOrder.forEach(c => { row[c] = catSums[c]; });
      return row;
    });

    const yMeta = computeY(chartData);

    return { chartData, monthTicks: ticks, yMeta };
  }, [series, accounts]);

  const pieData = useMemo(() => {
    if (series.length === 0) return { slices: [], closestLabel: "" };
    const normalized = series.map(d => {
      const iso = toIsoDate(d.date);
      return { ...d, iso, ms: dateMs(iso) };
    }).sort((a, b) => a.ms - b.ms);

    let targetIso = pieDate ? toIsoDate(pieDate) : normalized[normalized.length - 1].iso;
    let targetMs = dateMs(targetIso);
    let closest = normalized[0];
    let diff = Math.abs(normalized[0].ms - targetMs);
    for (const d of normalized) {
      const ndiff = Math.abs(d.ms - targetMs);
      if (ndiff <= diff) {
        diff = ndiff;
        closest = d;
      } else break;
    }

    const acctCategory = new Map(accounts.map(a => [a.name, (a.category || "other").toLowerCase()]));
    const catSums = Object.fromEntries(categoriesOrder.map(c => [c, 0]));
    if (closest.accounts) {
      for (const [acct, bal] of Object.entries(closest.accounts)) {
        const cat = acctCategory.get(acct) || "other";
        catSums[cat] = (catSums[cat] || 0) + bal;
      }
    }
    const total = Object.values(catSums).reduce((s, v) => s + v, 0);
    const slices = categoriesOrder
      .map(cat => ({ name: cat, value: catSums[cat], pct: total ? (catSums[cat] / total) * 100 : 0 }));

    return { slices, closestLabel: formatMonthDayLabel(closest.ms), total };
  }, [series, accounts, pieDate]);

  if (chartData.length === 0) {
    return (
      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Charts</h2>
        <p>No data to plot yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16, background: "#fff", color: "#f5f5f5", padding: 12, borderRadius: 12 }}>
      <section style={{ padding: 12, border: "1px solid #333", borderRadius: 12, background: "#111" }}>
        <h2 style={{ marginTop: 0, color: "#f5f5f5" }}>Total Net Worth</h2>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                type="number"
                dataKey="dateMs"
                ticks={monthTicks}
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatMonthLabel}
                stroke="#aaa"
                tick={{ fill: "#ccc" }}
              />
              <YAxis
                domain={yMeta.domain}
                ticks={yMeta.ticks}
                tickFormatter={formatCurrencyShort}
                stroke="#aaa"
                tick={{ fill: "#ccc" }}
              />
              <Tooltip
                labelFormatter={(ms) => formatMonthDayLabel(ms)}
                formatter={(v, n) => [formatCurrency(v), legendLabel(n)]}
                contentStyle={{ background: "#111", border: "1px solid #333", color: "#f5f5f5" }}
              />
              <Legend wrapperStyle={{ color: "#f5f5f5" }} formatter={(value) => legendLabel(value)} />
              <Line type="monotone" dataKey="netWorth" dot stroke="#5dade2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section style={{ padding: 12, border: "1px solid #333", borderRadius: 12, background: "#111" }}>
        <h2 style={{ marginTop: 0, color: "#f5f5f5" }}>Categories Over Time</h2>
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} stackOffset="none" margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                type="number"
                dataKey="dateMs"
                ticks={monthTicks}
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatMonthLabel}
                stroke="#aaa"
                tick={{ fill: "#ccc" }}
              />
              <YAxis
                domain={[-200_000, 4_000_000]}
                ticks={[0, 500_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000]}
                tickFormatter={(v) => formatCurrencyShort(v)}
                stroke="#aaa"
                tick={{ fill: "#ccc" }}
              />
              <Tooltip
                labelFormatter={(ms) => formatMonthDayLabel(ms)}
                formatter={(v, n) => [formatCurrency(v), legendLabel(n)]}
                contentStyle={{ background: "#111", border: "1px solid #333", color: "#f5f5f5" }}
              />
              <Legend wrapperStyle={{ color: "#f5f5f5" }} formatter={(value) => legendLabel(value)} />
              {categoriesOrder.map((cat) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId="1"
                  dot={false}
                  fillOpacity={0.6}
                  fill={colorForCategory(cat).fill}
                  stroke={colorForCategory(cat).stroke}
                />
              ))}
              <Line type="monotone" dataKey="netWorth" stroke="#5dade2" dot />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section style={{ padding: 12, border: "1px solid #333", borderRadius: 12, background: "#111" }}>
        <h2 style={{ marginTop: 0, color: "#f5f5f5" }}>Categories Snapshot</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <label>
            Date:&nbsp;
            <input
              type="date"
              value={pieDate}
              onChange={(e) => setPieDate(e.target.value)}
              style={{ background: "#111", color: "#f5f5f5", border: "1px solid #333", padding: 4, borderRadius: 4 }}
            />
          </label>
          <span style={{ color: "#aaa" }}>
            Closest point: {pieData.closestLabel || "N/A"}
          </span>
          {pieData.total != null && (
            <span style={{ color: "#f5f5f5", fontWeight: 600 }}>
              Total Net Worth: {formatCurrency(pieData.total)}
            </span>
          )}
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData.slices}
                dataKey="value"
                nameKey="name"
                outerRadius={110}
                label={({ name, value, percent }) => `${name} / $${Number(value).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} / ${(percent * 100).toFixed(1)}%`}
              >
                {pieData.slices.map((entry) => {
                  const colors = colorForCategory(entry.name);
                  return <Cell key={entry.name} fill={colors.fill} stroke={colors.stroke} />;
                })}
              </Pie>
              <Tooltip
                formatter={(v, n, props) => {
                  const pct = props?.payload?.pct ?? 0;
                  return [`${formatCurrency(v)} (${pct.toFixed(1)}%)`, legendLabel(n)];
                }}
                contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff" }}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "#fff" }}
              />
              
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}


const palette = {
  cash: { fill: "rgba(84, 119, 215, 0.9)", stroke: "#4a90e2" },
  stocks: { fill: "rgba(51, 216, 123, 0.9)", stroke: "#27ae60" },
  crypto: { fill: "rgba(253, 203, 110, 0.9)", stroke: "#f39c12" },
  retirement: { fill: "rgba(246, 221, 204, 0.9)", stroke: "#d35400" },
  property: { fill: "rgba(194, 119, 232, 0.9)", stroke: "#8e44ad" },
  other: { fill: "rgba(242, 244, 244, 0.9)", stroke: "#7f8c8d" }
};

const colorForCategory = (cat) => palette[cat] || palette.other;
const legendLabel = (name) => {
  const c = colorForCategory(name);
  return <span style={{ color: c.stroke }}>{name}</span>;
};
