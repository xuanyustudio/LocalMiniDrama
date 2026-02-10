const fs = require('fs');
const path = require('path');
const { getDb } = require('./index.js');
const { loadConfig } = require('../config/index.js');

function stripLeadingComments(sql) {
  return sql
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('--');
    })
    .join('\n')
    .trim();
}

function runOne(database, sql, file, index) {
  const s = stripLeadingComments(sql);
  if (!s) return;
  try {
    database.exec(s);
    console.log('Ran migration:', file + (index >= 0 ? ' #' + (index + 1) : ''));
  } catch (err) {
    if (err.code === 'SQLITE_ERROR' && (err.message || '').toLowerCase().includes('duplicate column')) {
      console.log('Skip (column exists):', file + (index >= 0 ? ' #' + (index + 1) : ''));
    } else {
      throw err;
    }
  }
}

function runMigrations(database) {
  const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('Migrations dir missing, skipping:', migrationsDir);
    return;
  }
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (statements.length <= 1) {
      runOne(database, sql, file, -1);
    } else {
      statements.forEach((stmt, i) => runOne(database, stmt + ';', file, i));
    }
  }
}

/** 若 ai_service_configs 缺少 default_model 列则补上（兜底：迁移未执行或失败时） */
function ensureDefaultModelColumn(database) {
  try {
    const rows = database.prepare("PRAGMA table_info(ai_service_configs)").all();
    const hasColumn = rows.some((r) => r.name === 'default_model');
    if (hasColumn) return;
    database.exec('ALTER TABLE ai_service_configs ADD COLUMN default_model TEXT');
    console.log('Ran ensureDefaultModelColumn: added default_model');
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('duplicate column')) {
      console.log('ensureDefaultModelColumn: column already exists');
    } else if (msg.includes('no such table')) {
      console.log('ensureDefaultModelColumn: table not found, skip');
    } else {
      throw err;
    }
  }
}

/** 若 props 缺少 episode_id 列则补上（从某集提取的道具归属该集） */
function ensurePropsEpisodeIdColumn(database) {
  try {
    const rows = database.prepare("PRAGMA table_info(props)").all();
    const hasColumn = rows.some((r) => r.name === 'episode_id');
    if (hasColumn) return;
    database.exec('ALTER TABLE props ADD COLUMN episode_id INTEGER');
    console.log('Ran ensurePropsEpisodeIdColumn: added episode_id');
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('duplicate column')) {
      console.log('ensurePropsEpisodeIdColumn: column already exists');
    } else if (msg.includes('no such table')) {
      console.log('ensurePropsEpisodeIdColumn: table not found, skip');
    } else {
      throw err;
    }
  }
}

/** 对已打开的 database 执行迁移与兜底补列（供 app 启动时调用） */
function runMigrationsAndEnsure(database) {
  runMigrations(database);
  ensureDefaultModelColumn(database);
  ensurePropsEpisodeIdColumn(database);
}

function main() {
  const config = loadConfig();
  const database = getDb(config.database);
  runMigrationsAndEnsure(database);
  console.log('Migrations complete.');
}

if (require.main === module) {
  main();
}

module.exports = { runMigrationsAndEnsure, ensureDefaultModelColumn };
