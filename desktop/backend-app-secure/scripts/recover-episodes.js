/**
 * 分集数据恢复脚本
 *
 * 背景：旧版 saveEpisodes 每次保存都会 soft-delete 全部分集再重新 INSERT，
 *       导致新分集拿到新 id，而 storyboards/characters/scenes/props 挂在旧 id 上，
 *       形成"孤岛数据"。
 *
 * 本脚本功能：
 *   1. [分析模式] --analyze   扫描所有被孤立的旧分集，打印报告，不修改数据
 *   2. [恢复模式] --recover    将有价值的旧分集激活，并把当前同 episode_number 的
 *                              新分集（无关联数据的空壳）软删除，完成数据还原
 *   3. [指定剧]  --drama=10   只处理 drama_id=10
 *
 * 用法：
 *   node scripts/recover-episodes.js --analyze
 *   node scripts/recover-episodes.js --analyze --drama=10
 *   node scripts/recover-episodes.js --recover --drama=10
 *   node scripts/recover-episodes.js --recover           （处理全部剧）
 */

'use strict';

const path = require('path');
const Database = require('better-sqlite3');

// ── 数据库路径 ──────────────────────────────────────────────────────────────
const DB_PATH = path.resolve(__dirname, '../data/drama_generator.db');

// ── 参数解析 ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const MODE_ANALYZE = args.includes('--analyze');
const MODE_RECOVER = args.includes('--recover');
const dramaArg = args.find(a => a.startsWith('--drama='));
const filterDramaId = dramaArg ? Number(dramaArg.split('=')[1]) : null;

if (!MODE_ANALYZE && !MODE_RECOVER) {
  console.log('用法:');
  console.log('  node scripts/recover-episodes.js --analyze           # 分析（不修改数据）');
  console.log('  node scripts/recover-episodes.js --analyze --drama=10');
  console.log('  node scripts/recover-episodes.js --recover --drama=10 # 恢复指定剧');
  console.log('  node scripts/recover-episodes.js --recover            # 恢复全部');
  process.exit(0);
}

// ── 连接数据库 ─────────────────────────────────────────────────────────────
const db = new Database(DB_PATH, { readonly: MODE_ANALYZE });
db.pragma('journal_mode = WAL');

console.log(`\n数据库: ${DB_PATH}`);
console.log(`模式: ${MODE_ANALYZE ? '分析（只读）' : '恢复（写入）'}`);
if (filterDramaId) console.log(`只处理 drama_id = ${filterDramaId}`);
console.log('─'.repeat(60));

// ── 查找所有有价值的孤岛分集 ────────────────────────────────────────────────
function countLinkedData(episodeId) {
  const storyboards = db.prepare(
    'SELECT COUNT(*) as n FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL'
  ).get(episodeId).n;
  const characters = db.prepare(
    'SELECT COUNT(*) as n FROM episode_characters WHERE episode_id = ?'
  ).get(episodeId).n;
  const scenes = db.prepare(
    'SELECT COUNT(*) as n FROM scenes WHERE episode_id = ? AND deleted_at IS NULL'
  ).get(episodeId).n;
  const props = db.prepare(
    'SELECT COUNT(*) as n FROM props WHERE episode_id = ? AND deleted_at IS NULL'
  ).get(episodeId).n;
  return { storyboards, characters, scenes, props, total: storyboards + characters + scenes + props };
}

// 取所有被软删且存在关联数据的旧分集
const deletedEpsSql = filterDramaId
  ? 'SELECT e.*, d.title as drama_title FROM episodes e JOIN dramas d ON d.id = e.drama_id WHERE e.drama_id = ? AND e.deleted_at IS NOT NULL ORDER BY e.drama_id, e.episode_number, e.id'
  : 'SELECT e.*, d.title as drama_title FROM episodes e JOIN dramas d ON d.id = e.drama_id WHERE e.deleted_at IS NOT NULL ORDER BY e.drama_id, e.episode_number, e.id';

const deletedEps = filterDramaId
  ? db.prepare(deletedEpsSql).all(filterDramaId)
  : db.prepare(deletedEpsSql).all();

// 找出有价值的孤岛（有关联数据的）
const orphans = deletedEps
  .map(ep => ({ ...ep, linked: countLinkedData(ep.id) }))
  .filter(ep => ep.linked.total > 0);

if (orphans.length === 0) {
  console.log('\n✅ 没有发现需要恢复的孤岛分集，数据完好。');
  db.close();
  process.exit(0);
}

// ── 打印分析报告 ────────────────────────────────────────────────────────────
console.log(`\n发现 ${orphans.length} 个有价值的孤岛分集：\n`);

let currentDrama = null;
for (const ep of orphans) {
  if (currentDrama !== ep.drama_id) {
    currentDrama = ep.drama_id;
    console.log(`\n【剧 id=${ep.drama_id}】${ep.drama_title}`);
  }
  console.log(
    `  旧分集 id=${ep.id}  第${ep.episode_number}集《${ep.title || '无标题'}》` +
    `  ← 分镜:${ep.linked.storyboards} 角色关联:${ep.linked.characters}` +
    ` 场景:${ep.linked.scenes} 道具:${ep.linked.props}` +
    `  [删除时间: ${ep.deleted_at?.slice(0,19)}]`
  );

  // 检查当前激活的同 episode_number 分集
  const current = db.prepare(
    'SELECT id, title FROM episodes WHERE drama_id = ? AND episode_number = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1'
  ).get(ep.drama_id, ep.episode_number);
  if (current) {
    const curLinked = countLinkedData(current.id);
    console.log(
      `    当前激活 id=${current.id}《${current.title || '无标题'}》` +
      `  分镜:${curLinked.storyboards} 角色:${curLinked.characters}` +
      ` 场景:${curLinked.scenes} 道具:${curLinked.props}` +
      (curLinked.total === 0 ? '  ← 空壳，可安全替换' : '  ← ⚠️ 也有数据，需人工确认')
    );
  } else {
    console.log(`    当前激活: 无同集号分集`);
  }
}

if (MODE_ANALYZE) {
  console.log('\n─'.repeat(60));
  console.log('分析完成（只读模式，未修改数据）。');
  console.log('如需恢复，请加 --recover 参数重新运行。');
  db.close();
  process.exit(0);
}

// ── 恢复模式 ────────────────────────────────────────────────────────────────
console.log('\n─'.repeat(60));
console.log('开始恢复...\n');

// 按剧 + 集号分组，每组取 id 最大（最新）的孤岛分集作为恢复目标
const grouped = new Map(); // key: `${drama_id}_${episode_number}`
for (const ep of orphans) {
  const key = `${ep.drama_id}_${ep.episode_number}`;
  if (!grouped.has(key) || ep.id > grouped.get(key).id) {
    grouped.set(key, ep);
  }
}

const now = new Date().toISOString();
let recovered = 0;
let skipped = 0;

const recoverEp = db.transaction((ep) => {
  // 查当前激活的同集号分集
  const current = db.prepare(
    'SELECT id FROM episodes WHERE drama_id = ? AND episode_number = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1'
  ).get(ep.drama_id, ep.episode_number);

  if (current) {
    const curLinked = countLinkedData(current.id);
    if (curLinked.total > 0) {
      // 当前分集也有数据，跳过，避免误覆盖
      console.log(`  ⚠️  跳过 drama=${ep.drama_id} 第${ep.episode_number}集：` +
        `当前激活分集(id=${current.id})也有关联数据，请人工决定。`);
      return false;
    }
    // 当前是空壳，软删掉
    db.prepare('UPDATE episodes SET deleted_at = ? WHERE id = ?').run(now, current.id);
    console.log(`  🗑  软删空壳分集 id=${current.id}`);
  }

  // 激活旧分集
  db.prepare('UPDATE episodes SET deleted_at = NULL, updated_at = ? WHERE id = ?').run(now, ep.id);
  console.log(`  ✅ 恢复分集 id=${ep.id}  drama=${ep.drama_id} 第${ep.episode_number}集《${ep.title}》`);
  return true;
});

for (const ep of grouped.values()) {
  const ok = recoverEp(ep);
  if (ok) recovered++;
  else skipped++;
}

console.log('\n─'.repeat(60));
console.log(`恢复完成：成功 ${recovered} 个，跳过 ${skipped} 个（需人工处理）。`);
if (recovered > 0) {
  console.log('\n请重启后端服务后刷新页面，数据应已还原。');
}

db.close();
