import sqlite3 from "sqlite3";

const db = new sqlite3.Database("./networth.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'other'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      balance REAL NOT NULL,
      FOREIGN KEY(account_id) REFERENCES accounts(id),
      UNIQUE(account_id, date)
    )
  `);

  // Add category column for pre-existing databases; ignore if it already exists.
  db.run(`ALTER TABLE accounts ADD COLUMN category TEXT NOT NULL DEFAULT 'other'`, (err) => {
    if (err && !String(err.message).includes("duplicate column name")) {
      console.error("Failed to add category column:", err.message);
    }
  });

  // Backfill null categories if any exist from older schemas.
  db.run(`UPDATE accounts SET category='other' WHERE category IS NULL`, (err) => {
    if (err) console.error("Failed to backfill category:", err.message);
  });
});

export default db;
