'use strict';
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.resolve(__dirname, '../data/drama_generator.db'));
db.pragma('journal_mode = WAL');

// episode 60 的角色关联 → 合并到 episode 40
const sourceId = 60;
const targetId = 40;

const chars = db.prepare('SELECT * FROM episode_characters WHERE episode_id = ?').all(sourceId);
console.log('episode ' + sourceId + ' 的角色关联数量:', chars.length);

const ins = db.prepare('INSERT OR IGNORE INTO episode_characters (episode_id, character_id) VALUES (?, ?)');
let copied = 0;
for (const row of chars) {
  const result = ins.run(targetId, row.character_id);
  const c = db.prepare('SELECT name FROM characters WHERE id = ?').get(row.character_id);
  if (result.changes > 0) {
    copied++;
    console.log('  复制角色 id=' + row.character_id + ' 《' + (c ? c.name : '?') + '》');
  } else {
    console.log('  已存在角色 id=' + row.character_id + ' 《' + (c ? c.name : '?') + '》，跳过');
  }
}
console.log('\n完成，共复制 ' + copied + ' 条角色关联到 episode ' + targetId);
db.close();
