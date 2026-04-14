# UI/UX Overhaul Tasks

## 1. Update Categories & Colors (palette.js)
- Cash: Blue
- Investments: Green
- Retirement: Purple
- Property: Orange
- Crypto: Yellow/Gold
- Other Assets: Gray
- Liabilities: Red (credit cards, mortgage, loans, other)

## 2. Update server API (server/index.js + db.js)
- Add snapshots table
- Add POST /snapshots - save current data
- Add GET /snapshots - list saved versions
- Add GET /snapshots/:id - load specific version

## 3. Update client API (client/src/api.js)
- Add saveSnapshot(), getSnapshots(), loadSnapshot()

## 4. Update AddEntry.jsx
- Show accounts grouped by category
- Better table design with category colors
- Sortable columns

## 5. Update History.jsx
- Group by category headers
- Better spacing and typography
- Row hover effects

## 6. Update Charts.jsx
- Better styling
- Update colors

## 7. Update App.jsx
- Add Save/Load buttons in header
- Success notifications
- Load modal with list of saves

## 8. Update global.css
- Better table styling
- Category color classes
- Modal styles
