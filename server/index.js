import express from "express";
import cors from "cors";
import db from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const run = (sql, params=[]) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    })
  );

const all = (sql, params=[]) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    })
  );

app.get("/accounts", async (req, res) => {
  const rows = await all(`SELECT id, name, COALESCE(category, 'other') AS category FROM accounts ORDER BY name`);
  res.json(rows);
});

app.post("/accounts", async (req, res) => {
  const { name, category = "other" } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });

  try {
    await run(`INSERT INTO accounts(name, category) VALUES (?, ?)`, [name.trim(), category]);
    const rows = await all(`SELECT * FROM accounts ORDER BY name`);
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/accounts/:id", async (req, res) => {
  const { id } = req.params;
  const { name, category } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });

  try {
    const result = await run(`UPDATE accounts SET name = ?, category = ? WHERE id = ?`, [name.trim(), category || "other", id]);
    if (result.changes === 0) return res.status(404).json({ error: "account not found" });
    const rows = await all(`SELECT * FROM accounts ORDER BY name`);
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/accounts/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await run(`DELETE FROM balances WHERE account_id = ?`, [id]);
    const result = await run(`DELETE FROM accounts WHERE id = ?`, [id]);
    if (result.changes === 0) return res.status(404).json({ error: "account not found" });
    const rows = await all(`SELECT * FROM accounts ORDER BY name`);
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/balances", async (req, res) => {
  const rows = await all(`
    SELECT b.id, b.date, b.balance, a.name AS account
    FROM balances b
    JOIN accounts a ON a.id = b.account_id
    ORDER BY b.date ASC, a.name ASC
  `);
  res.json(rows);
});

app.post("/balances", async (req, res) => {
  const { account, date, balance } = req.body;
  if (!account || !date || balance == null) {
    return res.status(400).json({ error: "account, date, balance required" });
  }

  await run(`INSERT OR IGNORE INTO accounts(name) VALUES (?)`, [account]);
  const [acct] = await all(`SELECT id FROM accounts WHERE name=?`, [account]);

  try {
    await run(
      `
      INSERT INTO balances(account_id, date, balance)
      VALUES (?, ?, ?)
      ON CONFLICT(account_id, date)
      DO UPDATE SET balance=excluded.balance
      `,
      [acct.id, date, balance]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
// Delete a balance entry by id
app.delete("/balances/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await run(`DELETE FROM balances WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/balances/:id", async (req, res) => {
  const { id } = req.params;
  const { balance } = req.body;

  if (balance == null || Number.isNaN(Number(balance))) {
    return res.status(400).json({ error: "balance required" });
  }

  try {
    const result = await run(`UPDATE balances SET balance = ? WHERE id = ?`, [balance, id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "balance not found" });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/timeseries", async (req, res) => {
  const rows = await all(`
    SELECT b.date, a.name AS account, b.balance
    FROM balances b
    JOIN accounts a ON a.id = b.account_id
    ORDER BY b.date ASC, a.name ASC
  `);

  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, { date: r.date, accounts: {}, netWorth: 0 });
    byDate.get(r.date).accounts[r.account] = r.balance;
  }

  for (const v of byDate.values()) {
    v.netWorth = Object.values(v.accounts).reduce((s, x) => s + Number(x), 0);
  }

  res.json([...byDate.values()]);
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
