import React, { useEffect, useMemo, useState } from "react";
import { getTimeseries, getAccounts } from "../api.js";
import {
  LineChart, Line, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine
} from "recharts";

// dnd-kit (drag reorder) imports — MUST stay at top
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  return `${sign}$${(Math.abs(num) / 1_000_000).toFixed(1)}m`;
};

/** ---------------- Categories ---------------- */

const assetCategories = ["cash", "stocks", "crypto", "retirement", "property", "other"];
const liabilityCategories = ["mortgage", "credit card", "loans", "other liability"];
const categoriesOrder = [...assetCategories, ...liabilityCategories];

/** ---------------- Y-axis scaling ---------------- */

// Net worth chart: start at $2.0m, ticks every $0.5m
const computeYNetWorth = (rows) => {
  const vals = rows
    .map(r => Number(r.netWorth))
    .filter(v => Number.isFinite(v));

  const step = 500_000;      // 0.5m
  const minTick = 2_000_000; // 2.0m floor

  if (vals.length === 0) {
    return {
      domain: [minTick, minTick + step],
      ticks: [minTick, minTick + step]
    };
  }

  let max = Math.max(...vals);

  // small headroom
  const pad = (max - minTick) * 0.05;
  max += pad;

  const maxTick = Math.ceil(max / step) * step;

  const ticks = [];
  for (let t = minTick; t <= maxTick; t += step) ticks.push(t);

  return { domain: [minTick, maxTick], ticks };
};

// Stacked chart: include negatives, ticks every $0.5m
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
  const pad = range * 0.05;
  min -= pad;
  max += pad;

  // keep 0 so ref line is visible
  min = Math.min(min, 0);
  max = Math.max(max, 0);

  const step = 500_000;

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
      background: "#111",
      border: "1px solid #333",
      padding: 10,
      borderRadius: 8,
      color: "#f5f5f5",
      minWidth: 190
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{dateLabel}</div>

      {rows.map(r => (
        <div key={r.cat} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: r.color, textTransform: "capitalize" }}>{r.cat}</span>
          <span>{formatCurrency(r.val)}</span>
        </div>
      ))}

      {netWorth != null && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          paddingTop: 6,
          borderTop: "1px solid #333",
          fontWeight: 700
        }}>
          <span>Net Worth</span>
          <span>{formatCurrency(netWorth)}</span>
        </div>
      )}
    </div>
  );
};

/** ---------------- Drag reorder wrapper ---------------- */

const SortableSection = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        style={{
          padding: "6px 10px",
          fontSize: 12,
          color: "#aaa",
          background: "#0b0b0b",
          border: "1px solid #222",
          borderBottom: "none",
          borderRadius: "10px 10px 0 0",
          userSelect: "none",
          cursor: "grab"
        }}
      >
        ⇅ Drag to reorder
      </div>
      <div style={{ borderRadius: "0 0 10px 10px" }}>
        {children}
      </div>
    </div>
  );
};

/** ---------------- Component ---------------- */

export default function Charts() {
  const [series, setSeries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [pieDate, setPieDate] = useState("");

  // order for draggable sections
  const [sectionOrder, setSectionOrder] = useState([
    "networth",
    "categories",
    "snapshot",
  ]);

  // persist order
  useEffect(() => {
    const saved = localStorage.getItem("charts-order");
    if (saved) setSectionOrder(JSON.parse(saved));
  }, []);
  useEffect(() => {
    localStorage.setItem("charts-order", JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  useEffect(() => {
    getTimeseries().then(setSeries);
    getAccounts().then(setAccounts);
  }, []);

  const { chartData, monthTicks, yMetaNetWorth, yMetaStacked } = useMemo(() => {
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
        yMetaStacked: { domain: ["auto", "auto"], ticks: [] }
      };
    }

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

    return {
      chartData,
      monthTicks: ticks,
      yMetaNetWorth: computeYNetWorth(chartData),
      yMetaStacked: computeYStacked(chartData)
    };
  }, [series, accounts]);

  const pieData = useMemo(() => {
    if (series.length === 0) return { assets: [], liabilities: [], closestLabel: "", totalAssets: 0, totalLiab: 0 };

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

    const assetSlices = assetCategories
      .map(cat => ({ name: cat, value: Math.max(0, catSums[cat] || 0) }))
      .filter(s => s.value > 0);

    const liabilitySlices = liabilityCategories
      .map(cat => ({ name: cat, value: Math.max(0, Math.abs(catSums[cat] || 0)) }))
      .filter(s => s.value > 0);

    const totalAssets = assetSlices.reduce((s, x) => s + x.value, 0);
    const totalLiab = liabilitySlices.reduce((s, x) => s + x.value, 0);

    assetSlices.forEach(s => { s.pct = totalAssets ? (s.value / totalAssets) * 100 : 0; });
    liabilitySlices.forEach(s => { s.pct = totalLiab ? (s.value / totalLiab) * 100 : 0; });

    return {
      assets: assetSlices,
      liabilities: liabilitySlices,
      closestLabel: formatMonthDayLabel(closest.ms),
      totalAssets,
      totalLiab
    };
  }, [series, accounts, pieDate]);

  if (chartData.length === 0) {
    return (
      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Charts</h2>
        <p>No data to plot yet.</p>
      </div>
    );
  }

  // ----- sections as render fns so we can reorder -----
  const renderNetWorth = () => (
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
              domain={yMetaNetWorth.domain}
              ticks={yMetaNetWorth.ticks}
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
            <Line type="monotone" dataKey="netWorth" dot={false} activeDot={{ r: 4 }} stroke="#5dade2" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );

  const renderCategories = () => (
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
              domain={yMetaStacked.domain}
              ticks={yMetaStacked.ticks}
              tickFormatter={formatCurrencyShort}
              stroke="#aaa"
              tick={{ fill: "#ccc" }}
            />
            <Tooltip content={<CategoriesTooltip />} />
            <Legend wrapperStyle={{ color: "#f5f5f5" }} content={<LegendTwoLine />} />

            {assetCategories.map((cat) => (
              <Area
                key={cat}
                type="monotone"
                dataKey={cat}
                stackId="assets"
                dot={false}
                fillOpacity={0.6}
                fill={colorForCategory(cat).fill}
                stroke={colorForCategory(cat).stroke}
              />
            ))}

            {liabilityCategories.map((cat) => (
              <Area
                key={cat}
                type="monotone"
                dataKey={cat}
                stackId="liabilities"
                dot={false}
                fillOpacity={0.6}
                fill={colorForCategory(cat).fill}
                stroke={colorForCategory(cat).stroke}
              />
            ))}

            <ReferenceLine y={0} stroke="#888" />
            <Line type="monotone" dataKey="netWorth" stroke="#5dade2" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );

  const renderSnapshot = () => (
    <section style={{ padding: 12, border: "1px solid #333", borderRadius: 12, background: "#000", color: "#f5f5f5" }}>
      <h2 style={{ marginTop: 0, color: "#f5f5f5" }}>Categories Snapshot</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <label>
          Date:&nbsp;
          <input
            type="date"
            value={pieDate}
            onChange={(e) => setPieDate(e.target.value)}
            style={{ padding: 4, borderRadius: 4, background: "#111", color: "#f5f5f5", border: "1px solid #333" }}
          />
        </label>
        <span style={{ color: "#aaa" }}>
          Closest point: {pieData.closestLabel || "N/A"}
        </span>
        {pieData.totalAssets != null && pieData.totalLiab != null && (
          <span style={{ color: "#f5f5f5", fontWeight: 600 }}>
            Total Net Worth: {formatCurrency(pieData.totalAssets - pieData.totalLiab)}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Assets pie */}
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "start" }}>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData.assets} dataKey="value" nameKey="name" outerRadius={90} labelLine={false}>
                  {pieData.assets.map(s => (
                    <Cell
                      key={`cell-a-${s.name}`}
                      fill={colorForCategory(s.name).fill}
                      stroke={colorForCategory(s.name).stroke}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 style={{ margin: "0 0 6px 0" }}>Assets</h4>
            {pieData.assets.length === 0 && <div style={{ color: "#777" }}>None</div>}
            {pieData.assets.map(s => (
              <div key={`a-${s.name}`} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: colorForCategory(s.name).stroke, textTransform: "capitalize" }}>{s.name}</span>
                <span>{formatCurrency(s.value)} ({s.pct.toFixed(1)}%)</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 4 }}>
              <span>Total</span>
              <span>{formatCurrency(pieData.totalAssets)}</span>
            </div>
          </div>
        </div>

        {/* Liabilities pie */}
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "start" }}>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData.liabilities} dataKey="value" nameKey="name" outerRadius={90} labelLine={false}>
                  {pieData.liabilities.map(s => (
                    <Cell
                      key={`cell-l-${s.name}`}
                      fill={colorForCategory(s.name).fill}
                      stroke={colorForCategory(s.name).stroke}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 style={{ margin: "0 0 6px 0" }}>Liabilities</h4>
            {pieData.liabilities.length === 0 && <div style={{ color: "#777" }}>None</div>}
            {pieData.liabilities.map(s => (
              <div key={`l-${s.name}`} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: colorForCategory(s.name).stroke, textTransform: "capitalize" }}>{s.name}</span>
                <span>{formatCurrency(s.value)} ({s.pct.toFixed(1)}%)</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 4 }}>
              <span>Total</span>
              <span>{formatCurrency(pieData.totalLiab)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const sectionMap = {
    networth: renderNetWorth,
    categories: renderCategories,
    snapshot: renderSnapshot,
  };

  return (
    <div style={{ display: "grid", gap: 16, background: "#fff", color: "#111", padding: 12, borderRadius: 12 }}>
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          const { active, over } = event;
          if (!over || active.id === over.id) return;

          setSectionOrder((items) => {
            const oldIndex = items.indexOf(active.id);
            const newIndex = items.indexOf(over.id);
            return arrayMove(items, oldIndex, newIndex);
          });
        }}
      >
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          {sectionOrder.map((id) => (
            <SortableSection key={id} id={id}>
              {sectionMap[id]?.()}
            </SortableSection>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

/** ---------------- Colors + Legends ---------------- */

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

const legendLabel = (name) => {
  const c = colorForCategory(name);
  return <span style={{ color: c.stroke }}>{name}</span>;
};

const LegendTwoLine = () => {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ marginRight: 4 }}>Assets:</strong>
        {assetCategories.map(cat => (
          <span key={`leg-a-${cat}`} style={{ color: colorForCategory(cat).stroke, textTransform: "capitalize" }}>
            {cat}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ marginRight: 4 }}>Liabilities:</strong>
        {liabilityCategories.map(cat => (
          <span key={`leg-l-${cat}`} style={{ color: colorForCategory(cat).stroke, textTransform: "capitalize" }}>
            {cat}
          </span>
        ))}
      </div>
    </div>
  );
};
