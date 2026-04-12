// database/db.js
// This file creates the database connection and sets up the schema
// It's a separate module so both server.js and seed.js can import it without duplicating the setup logic

const Database = require('better-sqlite3');
const path = require('path');

// Open (or create) the database file
// SQLite stores the entire database in a single file
// The file is created automatically if it doesn't exist yet
const db = new Database(path.join(__dirname, 'projects.db'));

// ---------------------------------------------------------------------------
// SCHEMA SETUP
// 'CREATE TABLE IF NOT EXISTS' means this is safe to run every time
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT NOT NULL,
    slug      TEXT UNIQUE NOT NULL,
    date      TEXT,
    thumbnail TEXT,
    summary   TEXT
  );

  CREATE TABLE IF NOT EXISTS tags (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );


  CREATE TABLE IF NOT EXISTS project_tags (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, tag_id)
  );
`);

// Export the database connection so other files can import and use it
module.exports = db;
