'use strict';

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function jsonPath() {
  return process.env.LEADS_JSON_PATH
    ? path.resolve(process.cwd(), process.env.LEADS_JSON_PATH)
    : path.join(DATA_DIR, 'leads.json');
}

function dbPath() {
  return process.env.LEADS_DB_PATH
    ? path.resolve(process.cwd(), process.env.LEADS_DB_PATH)
    : path.join(DATA_DIR, 'leads.db');
}

function saveJson(lead) {
  ensureDir();
  const file = jsonPath();
  let list = [];
  if (fs.existsSync(file)) {
    try {
      list = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(list)) list = [];
    } catch {
      list = [];
    }
  }
  list.push(lead);
  fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
  return { json: file };
}

function saveSqlite(lead) {
  ensureDir();
  const file = dbPath();
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch {
    return { sqlite: null, skip: 'node:sqlite недоступен' };
  }

  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT,
      tariff TEXT,
      comment TEXT,
      created_at TEXT NOT NULL,
      payload TEXT
    )
  `);
  db.prepare(
    `INSERT INTO leads (id, name, email, role, tariff, comment, created_at, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    lead.id,
    lead.name,
    lead.email,
    lead.role || '',
    lead.tariff || '',
    lead.comment || '',
    lead.createdAt,
    JSON.stringify(lead)
  );
  db.close();
  return { sqlite: file };
}

function saveLocal(lead) {
  const json = saveJson(lead);
  const sqlite = saveSqlite(lead);
  return { ...json, ...sqlite };
}

module.exports = { saveLocal, jsonPath, dbPath };
