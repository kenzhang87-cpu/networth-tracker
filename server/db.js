import pg from "pg";
const { Pool } = pg;

/**
 * DB connection URL
 * - On Render: set DATABASE_URL (recommended) or POSTGRES_URL in the Web Service env vars
 * - Locally: you can rely on the localhost fallback
 */
const envUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// ✅ In production, REQUIRE a real database URL (don’t silently use localhost)
if (process.env.NODE_ENV === "production" && !envUrl) {
  throw new Error(
    "DATABASE_URL (or POSTGRES_URL) is not set. Add it in Render → Web Service → Environment."
  );
}

// ✅ Local dev fallback only
const connectionString =
  envUrl || "postgres://postgres:postgres@localhost:5432/networth";

// ✅ Helpful, SAFE log (no password)
try {
  const u = new URL(connectionString);
  console.log(`[db] host=${u.hostname} db=${u.pathname.replace("/", "")} ssl=${process.env.NODE_ENV === "production"}`);
} catch {
  console.log("[db] Using DATABASE_URL/POSTGRES_URL (unable to parse URL safely).");
}

export const pool = new Pool({
  connectionString,
  // Render Postgres usually requires SSL; local dev usually does not.
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

export async function initDb() {
  // Fail fast if connection is wrong
  await pool.query("SELECT 1;");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      UNIQUE(user_id, name)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      balance DOUBLE PRECISION NOT NULL,
      UNIQUE(account_id, date)
    );
  `);

  // Helpful indexes
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_balances_user_date
    ON balances(user_id, date);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_balances_account_date
    ON balances(account_id, date);
  `);

  // (Your unique index is redundant with UNIQUE(user_id, name), but harmless to keep.
  // If you want to keep it for safety, keep it.)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_user_name
    ON accounts(user_id, name);
  `);

  console.log("[db] initDb complete");
}

export const all = async (sql, params = []) => {
  const res = await pool.query(sql, params);
  return res.rows;
};

export const run = async (sql, params = []) => {
  const res = await pool.query(sql, params);
  return { rowCount: res.rowCount, rows: res.rows };
};

export default {
  pool,
  initDb,
  all,
  run
};
