const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

let db = null;

async function initDB() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, "finance.db");

  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  runMigrations();
  seedData();

  
  setInterval(() => saveDB(), 5000);

  return db;
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(path.join(__dirname, "finance.db"), buffer);
}

function getDB() {
  if (!db) throw new Error("Database not initialized");
  return db;
}

function runMigrations() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('viewer', 'analyst', 'admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS financial_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL CHECK(amount > 0),
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      deleted_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function seedData() {
  const bcrypt = require("bcryptjs");

  
  const result = db.exec("SELECT COUNT(*) as count FROM users");
  const count = result[0]?.values[0][0];
  if (count > 0) return;

  const adminHash = bcrypt.hashSync("admin123", 10);
  const analystHash = bcrypt.hashSync("analyst123", 10);
  const viewerHash = bcrypt.hashSync("viewer123", 10);

  db.run(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
    ["Admin User", "admin@finance.com", adminHash, "admin"]
  );
  db.run(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
    ["Analyst User", "analyst@finance.com", analystHash, "analyst"]
  );
  db.run(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
    ["Viewer User", "viewer@finance.com", viewerHash, "viewer"]
  );

  
  const records = [
    [5000, "income", "Salary", "2024-01-05", "January salary", 1],
    [200, "expense", "Utilities", "2024-01-10", "Electricity bill", 1],
    [1500, "income", "Freelance", "2024-01-15", "Design project", 1],
    [800, "expense", "Rent", "2024-01-20", "Monthly rent", 1],
    [300, "expense", "Groceries", "2024-02-05", "Weekly groceries", 1],
    [6000, "income", "Salary", "2024-02-05", "February salary", 1],
    [150, "expense", "Transport", "2024-02-12", "Monthly pass", 1],
    [2000, "income", "Consulting", "2024-02-20", "Tech consulting", 1],
    [500, "expense", "Entertainment", "2024-03-01", "Movies and dining", 1],
    [5500, "income", "Salary", "2024-03-05", "March salary", 1],
  ];

  for (const r of records) {
    db.run(
      `INSERT INTO financial_records (amount, type, category, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      r
    );
  }

  console.log(" Seed data inserted");
}


function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}


function execute(sql, params = []) {
  db.run(sql, params);
  const meta = db.exec("SELECT last_insert_rowid() as id, changes() as changes");
  return {
    lastInsertRowid: meta[0]?.values[0][0],
    changes: meta[0]?.values[0][1],
  };
}

module.exports = { initDB, getDB, saveDB, query, execute };
