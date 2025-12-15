import sqlite3 from "sqlite3";

const db = new sqlite3.Database("./networth.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
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

  const seedDemoUser = (hasEmail) => {
    if (hasEmail) {
      db.run(
        `INSERT OR IGNORE INTO users(id, username, password_hash, email) VALUES (1, 'demo', '$2b$10$HU0iaoR6nZP5ZruVYB.o/.q/YokZhGMevAbpSuaV6TgGO8vchUEeO', 'demo@example.com')`
      );
      db.run(`UPDATE users SET email='demo@example.com' WHERE id=1 AND email IS NULL`);
    } else {
      db.run(
        `INSERT OR IGNORE INTO users(id, username, password_hash) VALUES (1, 'demo', '$2b$10$HU0iaoR6nZP5ZruVYB.o/.q/YokZhGMevAbpSuaV6TgGO8vchUEeO')`
      );
    }
  };

  db.all(`PRAGMA table_info(users)`, (err, rows = []) => {
    if (err) {
      console.error("Failed to inspect users table:", err.message);
      seedDemoUser(false);
      return;
    }
    const hasEmail = rows.some((r) => String(r.name).toLowerCase() === "email");
    const createIndex = () => {
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`, (idxErr) => {
        if (idxErr) console.error("Failed to add email index:", idxErr.message);
      });
    };

    if (!hasEmail) {
      db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (alterErr) => {
        if (alterErr && !String(alterErr.message).includes("duplicate column name")) {
          console.error("Failed to add email to users:", alterErr.message);
          seedDemoUser(false);
          return;
        }
        createIndex();
        seedDemoUser(true);
      });
    } else {
      createIndex();
      seedDemoUser(true);
    }
  });
  db.run(`UPDATE accounts SET user_id=1 WHERE user_id IS NULL`);
  db.run(`UPDATE balances SET user_id=1 WHERE user_id IS NULL`);

  // Enforce per-user account uniqueness on legacy databases too.
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_user_name ON accounts(user_id, name)`);
  // If any old global-name unique indexes exist, drop them so different users can share account names.
  db.run(`DROP INDEX IF EXISTS accounts_name`);
  db.run(`DROP INDEX IF EXISTS idx_accounts_name`);

  // If the table itself was created with a global UNIQUE(name) constraint, rebuild it to remove that constraint.
  db.all(`PRAGMA index_list(accounts)`, (err, rows = []) => {
    if (err) {
      console.error("Failed to inspect account indexes:", err.message);
      return;
    }

    const legacyAuto = rows.find(r => String(r.name || "").startsWith("sqlite_autoindex_accounts") && r.origin === "u");
    if (!legacyAuto) return;

    // Double-check that the legacy autoindex only covers the name column.
    db.all(`PRAGMA index_info(${legacyAuto.name})`, (infoErr, cols = []) => {
      if (infoErr) {
        console.error("Failed to inspect legacy autoindex:", infoErr.message);
        return;
      }
      const isNameOnly = cols.length === 1 && String(cols[0].name).toLowerCase() === "name";
      if (!isNameOnly) return;

      console.warn("Rebuilding accounts table to remove global UNIQUE(name) constraint...");
      db.serialize(() => {
        db.run("PRAGMA foreign_keys=OFF");
        db.run(`
          CREATE TABLE IF NOT EXISTS accounts_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'other',
            UNIQUE(user_id, name),
            FOREIGN KEY(user_id) REFERENCES users(id)
          )
        `);
        db.run(`
          INSERT OR IGNORE INTO accounts_new (id, user_id, name, category)
          SELECT id, user_id, name, COALESCE(category, 'other') FROM accounts
        `);
        db.run(`DROP TABLE accounts`);
        db.run(`ALTER TABLE accounts_new RENAME TO accounts`);
        db.run("PRAGMA foreign_keys=ON");
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_user_name ON accounts(user_id, name)`);
      });
    });
  });
});

export default db;
