const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'resumes.db');
const dataDir = path.join(__dirname, '..', 'data');

let db;

async function getDb() {
  if (db) return db;
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const SQL = await require('sql.js')();

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      raw_text TEXT,
      name TEXT,
      email TEXT,
      phone TEXT,
      skills TEXT,
      experience_years INTEGER,
      education TEXT,
      summary TEXT,
      ats_score INTEGER,
      strengths TEXT,
      weaknesses TEXT,
      suggestions TEXT,
      job_matches TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// sql.js does not accept null/undefined — convert everything to safe types
function safe(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return val;
  return String(val);
}

function run(sql, params = []) {
  db.run(sql, params.map(safe));
  saveDb();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params.map(safe));
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(params.map(safe));
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

module.exports = { getDb, run, get, all, saveDb };
