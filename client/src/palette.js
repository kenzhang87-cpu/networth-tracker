export const assetCategories = ["cash", "stocks", "crypto", "retirement", "property", "other"];
export const liabilityCategories = ["mortgage", "credit card", "loans", "other liability"];

export const palette = {
  cash: { fill: "rgba(188, 6, 51, 0.9)", stroke: "rgba(188, 6, 51, 0.9)" },
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

export const colorForCategory = (cat) => palette[String(cat || "").toLowerCase()] || palette.other;

export const categoryType = (cat) => {
  const c = (cat || "").toLowerCase();
  if (liabilityCategories.includes(c)) return "liability";
  return "asset";
};
