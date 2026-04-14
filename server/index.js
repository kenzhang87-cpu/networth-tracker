import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { all, run, initDb } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

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
  const { username, password, email } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  const emailVal = email?.trim() || null;
  const hash = await bcrypt.hash(password, 10);

  try {
    await run(
      `INSERT INTO users(username, password_hash, email) VALUES ($1, $2, $3)`,
      [username.trim(), hash, emailVal]
    );
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "23505") {
      const target = String(e.detail || "").toLowerCase().includes("email") ? "email" : "username";
      return res.status(400).json({ error: `${target} already in use` });
    }
    res.status(400).json({ error: "could not create user" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const identifier = username?.trim();
  if (!identifier || !password) {
    return res.status(400).json({ error: "username/email and password required" });
  }

  const rows = await all(
    `SELECT * FROM users WHERE username=$1 OR lower(email)=lower($1) LIMIT 1`,
    [identifier]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, username: user.username, email: user.email || null });
});

app.get("/auth/me", authMiddleware, async (req, res) => {
  const rows = await all(`SELECT id, username, email FROM users WHERE id=$1`, [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "user not found" });
  res.json(user);
});

app.post("/auth/change-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword required" });
  }

  const rows = await all(`SELECT password_hash FROM users WHERE id=$1`, [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "user not found" });

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ error: "current password incorrect" });

  const hash = await bcrypt.hash(newPassword, 10);
  await run(`UPDATE users SET password_hash=? WHERE id=?`, [hash, req.user.id]);
  res.json({ ok: true });
});

app.patch("/auth/email", authMiddleware, async (req, res) => {
  const { email } = req.body;
  const emailVal = email?.trim();
  if (!emailVal) return res.status(400).json({ error: "email required" });

  try {
    await run(`UPDATE users SET email=$1 WHERE id=$2`, [emailVal, req.user.id]);
    res.json({ email: emailVal });
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ error: "email already in use" });
    res.status(400).json({ error: "could not update email" });
  }
});

app.post("/auth/forgot", async (req, res) => {
  const email = req.body.email?.trim();
  if (!email) return res.status(400).json({ error: "email required" });

  const rows = await all(`SELECT id FROM users WHERE lower(email)=lower($1)`, [email]);
  const user = rows[0];
  if (!user) {
    return res.json({ message: "If an account exists, you'll receive a reset email." });
  }

  const tempPassword = Math.random().toString(36).slice(-10);
  const hash = await bcrypt.hash(tempPassword, 10);
  await run(`UPDATE users SET password_hash=? WHERE id=?`, [hash, user.id]);
  res.json({ tempPassword });
});

app.get("/accounts", authMiddleware, async (req, res) => {
  const rows = await all(
    `SELECT id, name, COALESCE(category, 'other') AS category FROM accounts WHERE user_id=$1 ORDER BY name`,
    [req.user.id]
  );
  res.json(rows);
});

app.post("/accounts", authMiddleware, async (req, res) => {
  const { name, category = "other" } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });

  try {
    await run(
      `INSERT INTO accounts(user_id, name, category) VALUES ($1, $2, $3) ON CONFLICT(user_id, name) DO NOTHING`,
      [req.user.id, name.trim(), category]
    );
    const rows = await all(`SELECT * FROM accounts WHERE user_id=$1 ORDER BY name`, [req.user.id]);
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
      `UPDATE accounts SET name = $1, category = $2 WHERE id = $3 AND user_id = $4`,
      [name.trim(), category || "other", id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "account not found" });
    const rows = await all(`SELECT * FROM accounts WHERE user_id=$1 ORDER BY name`, [req.user.id]);
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/accounts/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await run(`DELETE FROM balances WHERE account_id = $1 AND user_id = $2`, [id, req.user.id]);
    const result = await run(`DELETE FROM accounts WHERE id = $1 AND user_id = $2`, [id, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "account not found" });
    const rows = await all(`SELECT * FROM accounts WHERE user_id=$1 ORDER BY name`, [req.user.id]);
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
    WHERE b.user_id=$1
    ORDER BY b.date ASC, a.name ASC
  `, [req.user.id]);
  res.json(rows);
});

app.post("/balances", authMiddleware, async (req, res) => {
  const { account, date, balance } = req.body;
  if (!account || !date || balance == null) {
    return res.status(400).json({ error: "account, date, balance required" });
  }

  await run(
    `INSERT INTO accounts(user_id, name) VALUES ($1, $2) ON CONFLICT(user_id, name) DO NOTHING`,
    [req.user.id, account]
  );
  const [acct] = await all(`SELECT id FROM accounts WHERE user_id=$1 AND name=$2`, [req.user.id, account]);

  try {
    await run(
      `
      INSERT INTO balances(user_id, account_id, date, balance)
      VALUES ($1, $2, $3, $4)
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
    await run(`DELETE FROM balances WHERE id = $1 AND user_id = $2`, [id, req.user.id]);
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
    const result = await run(`UPDATE balances SET balance = $1 WHERE id = $2 AND user_id = $3`, [balance, id, req.user.id]);
    if (result.rowCount === 0) {
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
    WHERE b.user_id=$1
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

// Snapshot endpoints for save/load functionality
app.get("/snapshots", authMiddleware, async (req, res) => {
  const rows = await all(`
    SELECT id, name, created_at
    FROM snapshots
    WHERE user_id=$1
    ORDER BY created_at DESC
  `, [req.user.id]);
  res.json(rows);
});

app.post("/snapshots", authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: "name required" });
  }

  try {
    // Get all current data
    const accounts = await all(`
      SELECT id, name, category FROM accounts WHERE user_id=$1 ORDER BY name
    `, [req.user.id]);

    const balances = await all(`
      SELECT b.id, b.date, b.balance, a.name AS account
      FROM balances b
      JOIN accounts a ON a.id = b.account_id
      WHERE b.user_id=$1
      ORDER BY b.date ASC, a.name ASC
    `, [req.user.id]);

    const data = { accounts, balances };

    const result = await run(`
      INSERT INTO snapshots(user_id, name, data) VALUES ($1, $2, $3) RETURNING id
    `, [req.user.id, name.trim(), JSON.stringify(data)]);

    res.json({ id: result.rows[0].id, name: name.trim(), created_at: new Date().toISOString() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/snapshots/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const rows = await all(`
    SELECT id, name, created_at, data
    FROM snapshots
    WHERE id=$1 AND user_id=$2
  `, [id, req.user.id]);

  if (!rows[0]) {
    return res.status(404).json({ error: "snapshot not found" });
  }

  res.json(rows[0]);
});

app.post("/snapshots/:id/restore", authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    // Get snapshot data
    const snapshotRows = await all(`
      SELECT data FROM snapshots WHERE id=$1 AND user_id=$2
    `, [id, req.user.id]);

    if (!snapshotRows[0]) {
      return res.status(404).json({ error: "snapshot not found" });
    }

    const { accounts, balances } = snapshotRows[0].data;

    // Clear current data
    await run(`DELETE FROM balances WHERE user_id=$1`, [req.user.id]);
    await run(`DELETE FROM accounts WHERE user_id=$1`, [req.user.id]);

    // Restore accounts
    const accountIdMap = {};
    for (const acct of accounts) {
      const result = await run(`
        INSERT INTO accounts(user_id, name, category) VALUES ($1, $2, $3) RETURNING id
      `, [req.user.id, acct.name, acct.category || "other"]);
      accountIdMap[acct.name] = result.rows[0].id;
    }

    // Restore balances
    for (const bal of balances) {
      const accountId = accountIdMap[bal.account];
      if (accountId) {
        await run(`
          INSERT INTO balances(user_id, account_id, date, balance) VALUES ($1, $2, $3, $4)
        `, [req.user.id, accountId, bal.date, bal.balance]);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/snapshots/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await run(`DELETE FROM snapshots WHERE id=$1 AND user_id=$2`, [id, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 4000;
const start = async () => {
  await initDb();
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
};

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
