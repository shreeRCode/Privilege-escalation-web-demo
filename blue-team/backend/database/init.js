/**
 * BLUE TEAM — Secure Database Initialization
 * ============================================
 * Same seed data as red team, plus a 'defense_log' table
 * for tracking blocked attack attempts.
 */

const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");

const DB_PATH = path.join(__dirname, "lab.db");

let db;

function getDB() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH);
  }
  return db;
}

async function initDB() {
  return new Promise((resolve, reject) => {
    const database = getDB();

    database.serialize(() => {
      // Users table
      database.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          balance REAL DEFAULT 1000.00,
          ssn TEXT,
          credit_card TEXT,
          profile_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Sessions table with expiry
      database.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME
        )
      `);

      // Defense log — tracks blocked attack attempts
      database.run(`
        CREATE TABLE IF NOT EXISTS defense_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          defense_type TEXT NOT NULL,
          threat_blocked TEXT,
          user TEXT,
          target TEXT,
          payload TEXT,
          blocked INTEGER DEFAULT 1,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          details TEXT
        )
      `);

      // Seed users (same as red team)
      const salt = bcrypt.genSaltSync(10);
      const users = [
        {
          username: "alice",
          email: "alice@lab.com",
          password: bcrypt.hashSync("password123", salt),
          role: "user",
          balance: 5000.0,
          ssn: "123-45-6789",
          credit_card: "4111-1111-1111-1111",
          profile_data: JSON.stringify({
            bio: "Regular user Alice",
            dob: "1990-01-15",
          }),
        },
        {
          username: "bob",
          email: "bob@lab.com",
          password: bcrypt.hashSync("password123", salt),
          role: "user",
          balance: 2500.0,
          ssn: "987-65-4321",
          credit_card: "4222-2222-2222-2222",
          profile_data: JSON.stringify({
            bio: "Regular user Bob",
            dob: "1992-06-20",
          }),
        },
        {
          username: "charlie",
          email: "charlie@lab.com",
          password: bcrypt.hashSync("password123", salt),
          role: "moderator",
          balance: 3000.0,
          ssn: "555-44-3333",
          credit_card: "4333-3333-3333-3333",
          profile_data: JSON.stringify({
            bio: "Moderator Charlie",
            dob: "1988-03-10",
          }),
        },
        {
          username: "admin",
          email: "admin@lab.com",
          password: bcrypt.hashSync("admin123", salt),
          role: "admin",
          balance: 99999.0,
          ssn: "000-00-0001",
          credit_card: "4444-4444-4444-4444",
          profile_data: JSON.stringify({
            bio: "System Administrator",
            dob: "1985-12-01",
          }),
        },
      ];

      const stmt = database.prepare(`
        INSERT OR IGNORE INTO users (username, email, password, role, balance, ssn, credit_card, profile_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      users.forEach((u) => {
        stmt.run(
          u.username,
          u.email,
          u.password,
          u.role,
          u.balance,
          u.ssn,
          u.credit_card,
          u.profile_data,
        );
      });

      stmt.finalize(() => {
        console.log("✅ Database initialized with seed users");
        resolve(database);
      });
    });
  });
}

module.exports = { getDB, initDB };

if (require.main === module) {
  initDB()
    .then(() => {
      console.log("✅ DB setup complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ DB init failed:", err);
      process.exit(1);
    });
}
