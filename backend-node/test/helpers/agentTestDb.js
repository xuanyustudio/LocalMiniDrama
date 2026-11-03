const Database = require('better-sqlite3');

function createAgentTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE dramas (
      id INTEGER PRIMARY KEY,
      title TEXT,
      style TEXT,
      metadata TEXT,
      description TEXT,
      deleted_at TEXT
    );
    CREATE TABLE episodes (
      id INTEGER PRIMARY KEY,
      drama_id INTEGER,
      episode_number INTEGER,
      title TEXT,
      script_content TEXT,
      description TEXT,
      deleted_at TEXT
    );
    CREATE TABLE characters (
      id INTEGER PRIMARY KEY,
      drama_id INTEGER,
      name TEXT,
      role TEXT,
      appearance TEXT,
      personality TEXT,
      description TEXT,
      image_url TEXT,
      local_path TEXT,
      negative_prompt TEXT,
      seedance2_asset TEXT,
      sort_order INTEGER DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE scenes (
      id INTEGER PRIMARY KEY,
      drama_id INTEGER,
      episode_id INTEGER,
      location TEXT,
      time TEXT,
      prompt TEXT,
      image_url TEXT,
      local_path TEXT,
      storyboard_count INTEGER DEFAULT 0,
      status TEXT,
      deleted_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE storyboards (
      id INTEGER PRIMARY KEY,
      episode_id INTEGER,
      storyboard_number INTEGER,
      title TEXT,
      description TEXT,
      dialogue TEXT,
      action TEXT,
      image_prompt TEXT,
      video_prompt TEXT,
      image_url TEXT,
      local_path TEXT,
      video_url TEXT,
      deleted_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE image_generations (
      id INTEGER PRIMARY KEY,
      storyboard_id INTEGER,
      drama_id INTEGER,
      episode_id INTEGER,
      frame_type TEXT,
      status TEXT,
      image_url TEXT,
      local_path TEXT,
      deleted_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE async_tasks (
      id TEXT PRIMARY KEY,
      type TEXT,
      status TEXT,
      progress INTEGER DEFAULT 0,
      message TEXT,
      error TEXT,
      result TEXT,
      resource_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      completed_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE episode_characters (
      episode_id INTEGER,
      character_id INTEGER,
      PRIMARY KEY (episode_id, character_id)
    );
    CREATE TABLE ai_service_configs (
      id INTEGER PRIMARY KEY,
      service_type TEXT,
      base_url TEXT,
      api_key TEXT,
      model TEXT,
      default_model TEXT,
      priority INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      deleted_at TEXT,
      endpoint TEXT
    );
  `);
  return db;
}

function seedTwoDramas(db) {
  const now = '2026-10-16T00:00:00.000Z';
  db.prepare('INSERT INTO dramas (id, title, style, metadata, description) VALUES (?, ?, ?, ?, ?)').run(
    1, '甲', '古风', JSON.stringify({ aspect_ratio: '16:9' }), '甲的简介'
  );
  db.prepare('INSERT INTO dramas (id, title, style, metadata, description) VALUES (?, ?, ?, ?, ?)').run(
    2, '乙', '现代', JSON.stringify({ aspect_ratio: '9:16' }), '乙的简介'
  );
  const insertEp = db.prepare(
    'INSERT INTO episodes (id, drama_id, episode_number, title, script_content, description) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertEp.run(11, 1, 1, '第一集', '甲集剧本', '甲集说明');
  insertEp.run(12, 1, 2, '第二集', '甲二剧本', '甲二说明');
  insertEp.run(13, 2, 1, '乙集', '乙集剧本', '乙集说明');

  db.prepare(
    `INSERT INTO characters (id, drama_id, name, role, image_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(1, 1, '甲角', '主角', '/static/a.png', now, now);
  db.prepare(
    `INSERT INTO characters (id, drama_id, name, role, image_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(2, 2, '乙角', '配角', '/static/b.png', now, now);
  db.prepare('INSERT INTO episode_characters (episode_id, character_id) VALUES (?, ?)').run(11, 1);

  db.prepare(
    `INSERT INTO scenes (id, drama_id, episode_id, location, time, prompt, image_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(1, 1, 11, '甲地', '夜', '甲地提示', '/static/scene-a.png', now, now);
  db.prepare(
    `INSERT INTO scenes (id, drama_id, episode_id, location, time, prompt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(2, 2, 13, '乙地', '日', '乙地提示', now, now);

  db.prepare(
    `INSERT INTO storyboards (id, episode_id, storyboard_number, description, image_prompt, video_prompt, dialogue, action, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(1, 11, 1, '甲镜画面', '甲镜出图', '甲镜视频', '甲台词', '甲动作', now, now);
  db.prepare(
    `INSERT INTO storyboards (id, episode_id, storyboard_number, description, image_prompt, video_prompt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(2, 13, 1, '乙镜画面', '乙镜出图', '乙镜视频', now, now);

  const insertTask = db.prepare(
    `INSERT INTO async_tasks (id, type, status, resource_id, created_at, updated_at)
     VALUES (?, ?, 'pending', ?, ?, ?)`
  );
  insertTask.run('task-a', 'story_generation', '1', now, now);
  insertTask.run('task-ep', 'storyboard_generation', '11', now, now);
  insertTask.run('task-b', 'story_generation', '2', now, now);

  return {
    dramaA: 1,
    episodeA1: 11,
    episodeA2: 12,
    dramaB: 2,
    episodeB1: 13,
    characterA: 1,
    characterB: 2,
    sceneA: 1,
    sceneB: 2,
    storyboardA: 1,
    storyboardB: 2,
    taskA: 'task-a',
    taskB: 'task-b',
    taskEpisode: 'task-ep',
  };
}

module.exports = { createAgentTestDb, seedTwoDramas };
