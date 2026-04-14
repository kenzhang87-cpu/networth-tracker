// Category definitions with colors
// Colors: Cash (Blue), Investments (Green), Retirement (Purple), Property (Orange), Crypto (Yellow/Gold), Other (Gray), Liabilities (Red)

export const assetCategories = ["cash", "investments", "retirement", "property", "crypto", "other"];
export const liabilityCategories = ["credit card", "mortgage", "loans", "other liability"];
export const allCategories = [...assetCategories, ...liabilityCategories];

export const categoryLabels = {
  cash: "Cash",
  investments: "Investments",
  retirement: "Retirement",
  property: "Property",
  crypto: "Crypto",
  other: "Other Assets",
  "credit card": "Credit Cards",
  mortgage: "Mortgage",
  loans: "Loans",
  "other liability": "Other Liabilities"
};

// Color palette - matches requested colors
export const palette = {
  // Assets
  cash: { fill: "rgba(59, 130, 246, 0.7)", stroke: "#3b82f6", bg: "#3b82f6", text: "#ffffff" },           // Blue
  investments: { fill: "rgba(34, 197, 94, 0.7)", stroke: "#22c55e", bg: "#22c55e", text: "#ffffff" },     // Green
  retirement: { fill: "rgba(168, 85, 247, 0.7)", stroke: "#a855f7", bg: "#a855f7", text: "#ffffff" },      // Purple
  property: { fill: "rgba(249, 115, 22, 0.7)", stroke: "#f97316", bg: "#f97316", text: "#ffffff" },        // Orange
  crypto: { fill: "rgba(234, 179, 8, 0.7)", stroke: "#eab308", bg: "#eab308", text: "#000000" },           // Yellow/Gold
  other: { fill: "rgba(156, 163, 175, 0.7)", stroke: "#9ca3af", bg: "#9ca3af", text: "#ffffff" },          // Gray
  
  // Liabilities - all shades of red
  "credit card": { fill: "rgba(239, 68, 68, 0.7)", stroke: "#ef4444", bg: "#ef4444", text: "#ffffff" },    // Red
  mortgage: { fill: "rgba(220, 38, 38, 0.7)", stroke: "#dc2626", bg: "#dc2626", text: "#ffffff" },         // Dark Red
  loans: { fill: "rgba(185, 28, 28, 0.7)", stroke: "#b91c1c", bg: "#b91c1c", text: "#ffffff" },            // Darker Red
  "other liability": { fill: "rgba(153, 27, 27, 0.7)", stroke: "#991b1b", bg: "#991b1b", text: "#ffffff" } // Darkest Red
};

export const colorForCategory = (cat) => {
  const key = String(cat || "").toLowerCase().trim();
  return palette[key] || palette.other;
};

export const categoryType = (cat) => {
  const c = String(cat || "").toLowerCase().trim();
  if (liabilityCategories.includes(c)) return "liability";
  return "asset";
};

// Helper to get category badge style
export const getCategoryBadgeStyle = (cat) => {
  const colors = colorForCategory(cat);
  return {
    backgroundColor: colors.bg,
    color: colors.text,
    padding: "4px 10px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "capitalize",
    display: "inline-block",
    letterSpacing: "0.025em"
  };
};

// Chart colors array for Recharts
export const chartColors = [
  "#3b82f6", // cash - blue
  "#22c55e", // investments - green
  "#a855f7", // retirement - purple
  "#f97316", // property - orange
  "#eab308", // crypto - yellow
  "#9ca3af", // other - gray
  "#ef4444", // credit card - red
  "#dc2626", // mortgage - dark red
  "#b91c1c", // loans - darker red
  "#991b1b"  // other liability - darkest red
];
