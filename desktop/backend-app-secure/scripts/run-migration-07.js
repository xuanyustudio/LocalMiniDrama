#!/usr/bin/env node
/**
 * 单独执行 07_add_image_generations_frame_type.sql
 * 用法（在 backend-node 目录下）：node scripts/run-migration-07.js
 */
const fs = require('fs');
const path = require('path');
const { getDb } = require('../src/db/index.js');
const { loadConfig } = require('../src/config/index.js');

const sqlPath = path.join(__dirname, '..', 'migrations', '07_add_image_generations_frame_type.sql');
let sql = fs.readFileSync(sqlPath, 'utf8');
sql = sql.replace(/--[^\n]*/g, '').trim();
const statements = sql.split(';').map((s) => s.trim()).filter((s) => s.length > 0);

const config = loadConfig();
const db = getDb(config.database);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i] + ';';
  try {
    db.exec(stmt);
    console.log('OK', i + 1 + '/', statements.length);
  } catch (err) {
    const msg = (err && err.message) || '';
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      console.log('Skip (already applied):', msg.slice(0, 50));
    } else {
      console.error('Error:', msg);
      throw err;
    }
  }
}

console.log('Migration 07 done.');
db.close();
