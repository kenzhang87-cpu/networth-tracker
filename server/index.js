import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

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

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch (e) {
    return res.status(401).json({ error: "invalid token" });
  }
};

app.post("/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: "username and password required" });
  const hash = await bcrypt.hash(password, 10);
  try {
    await run(`INSERT INTO users(username, password_hash) VALUES (?, ?)`, [username.trim(), hash]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "user exists" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: "username and password required" });
  const rows = await all(`SELECT * FROM users WHERE username=?`, [username.trim()]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, username: user.username });
});

app.get("/accounts", authMiddleware, async (req, res) => {
  const rows = await all(
    `SELECT id, name, COALESCE(category, 'other') AS category FROM accounts WHERE user_id=? ORDER BY name`,
    [req.user.id]
  );
  res.json(rows);
});

app.post("/accounts", authMiddleware, async (req, res) => {
  const { name, category = "other" } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });

  try {
    await run(`INSERT INTO accounts(user_id, name, category) VALUES (?, ?, ?)`, [req.user.id, name.trim(), category]);
    const rows = await all(`SELECT * FROM accounts WHERE user_id=? ORDER BY name`, [req.user.id]);
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/accounts/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, category } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });

  try {
    const result = await run(
      `UPDATE accounts SET name = ?, category = ? WHERE id = ? AND user_id = ?`,
      [name.trim(), category || "other", id, req.user.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: "account not found" });
    const rows = await all(`SELECT * FROM accounts WHERE user_id=? ORDER BY name`, [req.user.id]);
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/accounts/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await run(`DELETE FROM balances WHERE account_id = ? AND user_id = ?`, [id, req.user.id]);
    const result = await run(`DELETE FROM accounts WHERE id = ? AND user_id = ?`, [id, req.user.id]);
    if (result.changes === 0) return res.status(404).json({ error: "account not found" });
    const rows = await all(`SELECT * FROM accounts WHERE user_id=? ORDER BY name`, [req.user.id]);
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/balances", authMiddleware, async (req, res) => {
  const rows = await all(`
    SELECT b.id, b.date, b.balance, a.name AS account
    FROM balances b
    JOIN accounts a ON a.id = b.account_id
    WHERE b.user_id=?
    ORDER BY b.date ASC, a.name ASC
  `, [req.user.id]);
  res.json(rows);
});

app.post("/balances", authMiddleware, async (req, res) => {
  const { account, date, balance } = req.body;
  if (!account || !date || balance == null) {
    return res.status(400).json({ error: "account, date, balance required" });
  }

  await run(`INSERT OR IGNORE INTO accounts(user_id, name) VALUES (?, ?)`, [req.user.id, account]);
  const [acct] = await all(`SELECT id FROM accounts WHERE user_id=? AND name=?`, [req.user.id, account]);

  try {
    await run(
      `
      INSERT INTO balances(user_id, account_id, date, balance)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id, date)
      DO UPDATE SET balance=excluded.balance
      `,
      [req.user.id, acct.id, date, balance]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
// Delete a balance entry by id
app.delete("/balances/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await run(`DELETE FROM balances WHERE id = ? AND user_id = ?`, [id, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/balances/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { balance } = req.body;

  if (balance == null || Number.isNaN(Number(balance))) {
    return res.status(400).json({ error: "balance required" });
  }

  try {
    const result = await run(`UPDATE balances SET balance = ? WHERE id = ? AND user_id = ?`, [balance, id, req.user.id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "balance not found" });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/timeseries", authMiddleware, async (req, res) => {
  const rows = await all(`
    SELECT b.date, a.name AS account, b.balance
    FROM balances b
    JOIN accounts a ON a.id = b.account_id
    WHERE b.user_id=?
    ORDER BY b.date ASC, a.name ASC
  `, [req.user.id]);

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
