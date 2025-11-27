import sqlite3 from "sqlite3";

const db = new sqlite3.Database("./networth.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      UNIQUE(user_id, name),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      balance REAL NOT NULL,
      FOREIGN KEY(account_id) REFERENCES accounts(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
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

  db.run(`ALTER TABLE accounts ADD COLUMN user_id INTEGER`, (err) => {
    if (err && !String(err.message).includes("duplicate column name")) {
      console.error("Failed to add user_id to accounts:", err.message);
    }
  });
  db.run(`ALTER TABLE balances ADD COLUMN user_id INTEGER`, (err) => {
    if (err && !String(err.message).includes("duplicate column name")) {
      console.error("Failed to add user_id to balances:", err.message);
    }
  });

  // Ensure a default user exists for legacy data.
  db.run(`INSERT OR IGNORE INTO users(id, username, password_hash) VALUES (1, 'demo', '$2b$10$HU0iaoR6nZP5ZruVYB.o/.q/YokZhGMevAbpSuaV6TgGO8vchUEeO')`);
  db.run(`UPDATE accounts SET user_id=1 WHERE user_id IS NULL`);
  db.run(`UPDATE balances SET user_id=1 WHERE user_id IS NULL`);
});

export default db;
