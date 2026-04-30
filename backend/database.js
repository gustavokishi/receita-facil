const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'receita-facil.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT DEFAULT 'geral',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity TEXT DEFAULT '',
      type TEXT DEFAULT 'ingredient',
      has INTEGER DEFAULT 0,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity TEXT DEFAULT '1 un',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      rating INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);

  migrateIngredientsPrice(db);
  migrateOrderItemsPrice(db);
}

function migrateIngredientsPrice(database) {
  try {
    database.exec('ALTER TABLE ingredients ADD COLUMN price REAL DEFAULT NULL');
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (!msg.includes('duplicate column')) throw e;
  }
}

function migrateOrderItemsPrice(database) {
  try {
    database.exec('ALTER TABLE order_items ADD COLUMN price REAL DEFAULT NULL');
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (!msg.includes('duplicate column')) throw e;
  }
}

module.exports = { getDb };
