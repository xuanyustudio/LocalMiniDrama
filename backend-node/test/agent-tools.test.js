const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createAgentTestDb, seedTwoDramas } = require('./helpers/agentTestDb');

const log = { info() {}, warn() {}, error() {} };

describe('agent tools', () => {
  it('reads a project without guessing an episode and saves one script only', async () => {
    const { executeGetCurrentProject, executeSaveEpisodeScript } = await import('../src/mastra/tools.mjs');
    const db = createAgentTestDb();
    const ids = seedTwoDramas(db);
    db.prepare('UPDATE episodes SET script_content = ? WHERE id = ?').run('字'.repeat(12001), ids.episodeA1);

    const current = executeGetCurrentProject(db, ids.dramaA, ids.episodeA1);
    assert.equal(current.ok, true);
    assert.equal(current.project.script.length, 12000);
    assert.equal(current.project.scriptTruncated, true);
    assert.deepEqual(current.project.episodes.map((ep) => ep.id), [ids.episodeA1, ids.episodeA2]);
    assert.deepEqual(current.project.characters.map((c) => c.id), [ids.characterA]);
    assert.equal(current.project.characters[0].name, '甲角');
    assert.deepEqual(current.project.scenes.map((s) => s.location), ['甲地']);
    assert.ok(current.project.storyboards[0].summary.length <= 200);

    const listed = executeGetCurrentProject(db, ids.dramaA, null);
    assert.equal(listed.ok, true);
    assert.equal(listed.project.episodeSpecified, false);
    assert.equal(listed.project.script, '');
    assert.deepEqual(listed.project.episodes.map((ep) => ep.id), [ids.episodeA1, ids.episodeA2]);

    const only = executeGetCurrentProject(db, ids.dramaB, null);
    assert.equal(only.project.episodeSpecified, true);
    assert.equal(only.project.script, '乙集剧本');

    const refused = executeSaveEpisodeScript(db, ids.dramaA, null, { scriptContent: '不会写入' });
    assert.equal(refused.error, '请指定哪一集');
    assert.equal(db.prepare('SELECT script_content FROM episodes WHERE id = ?').get(ids.episodeA1).script_content.length, 12001);

    executeSaveEpisodeScript(db, ids.dramaA, ids.episodeA1, { scriptContent: '新剧本', dramaId: ids.dramaB });
    assert.equal(db.prepare('SELECT script_content FROM episodes WHERE id = ?').get(ids.episodeA1).script_content, '新剧本');
    assert.equal(db.prepare('SELECT deleted_at FROM episodes WHERE id = ?').get(ids.episodeA2).deleted_at, null);
    assert.equal(db.prepare('SELECT script_content FROM episodes WHERE id = ?').get(ids.episodeB1).script_content, '乙集剧本');

    db.prepare('INSERT INTO dramas (id, title) VALUES (3, \'空剧\')').run();
    const created = executeSaveEpisodeScript(db, 3, null, { scriptContent: '第一集正文', title: '开场' });
    assert.equal(created.ok, true);
    const row = db.prepare('SELECT episode_number, script_content, title FROM episodes WHERE drama_id = 3').get();
    assert.equal(row.episode_number, 1);
    assert.equal(row.script_content, '第一集正文');
    assert.equal(row.title, '开场');
  });

  it('reports storyboard hasImage from real image records, not from video paths', async () => {
    const { executeGetCurrentProject } = await import('../src/mastra/tools.mjs');
    const db = createAgentTestDb();
    const ids = seedTwoDramas(db);
    const now = '2026-10-16T00:00:00.000Z';

    // 初始：分镜还没有任何图
    const before = executeGetCurrentProject(db, ids.dramaA, ids.episodeA1);
    assert.equal(before.project.storyboards[0].hasImage, false);

    // 普通分镜图只落在 image_generations，不回写 storyboards.image_url
    db.prepare(
      `INSERT INTO image_generations (storyboard_id, drama_id, episode_id, frame_type, status, created_at, updated_at)
       VALUES (?, ?, ?, 'first', 'processing', ?, ?)`
    ).run(ids.storyboardA, ids.dramaA, ids.episodeA1, now, now);
    const processing = executeGetCurrentProject(db, ids.dramaA, ids.episodeA1);
    assert.equal(processing.project.storyboards[0].hasImage, false, '处理中的图生不算已有图');

    db.prepare(
      `UPDATE image_generations SET status = 'completed', local_path = 'images/ig_a.jpg' WHERE storyboard_id = ?`
    ).run(ids.storyboardA);
    const afterGeneration = executeGetCurrentProject(db, ids.dramaA, ids.episodeA1);
    assert.equal(afterGeneration.project.storyboards[0].hasImage, true, '已完成的图生记录算已有图');

    // 删掉的图生记录不算已有图
    db.prepare('UPDATE image_generations SET deleted_at = ? WHERE storyboard_id = ?').run(now, ids.storyboardA);
    const afterDeleted = executeGetCurrentProject(db, ids.dramaA, ids.episodeA1);
    assert.equal(afterDeleted.project.storyboards[0].hasImage, false, '已删除的图生记录不算已有图');

    // 尾帧绑定/导入会回写 storyboards.image_url
    db.prepare('UPDATE storyboards SET image_url = ? WHERE id = ?').run('/static/a.png', ids.storyboardA);
    const afterRowUrl = executeGetCurrentProject(db, ids.dramaA, ids.episodeA1);
    assert.equal(afterRowUrl.project.storyboards[0].hasImage, true, 'storyboards.image_url 有值算已有图');

    // 视频管线把 storyboards.local_path 写成视频路径，不能据此判断已有图
    db.prepare('UPDATE storyboards SET image_url = NULL, local_path = ?, video_url = ? WHERE id = ?')
      .run('videos/sb_a.mp4', '/static/sb_a.mp4', ids.storyboardA);
    const afterVideo = executeGetCurrentProject(db, ids.dramaA, ids.episodeA1);
    assert.equal(afterVideo.project.storyboards[0].hasImage, false, '只有视频路径时不算已有图');

    // 别的剧的图不能算到当前剧
    db.prepare(
      `INSERT INTO image_generations (storyboard_id, drama_id, episode_id, frame_type, status, local_path, created_at, updated_at)
       VALUES (?, ?, ?, 'first', 'completed', 'images/ig_b.jpg', ?, ?)`
    ).run(ids.storyboardB, ids.dramaB, ids.episodeB1, now, now);
    const crossDrama = executeGetCurrentProject(db, ids.dramaA, ids.episodeA1);
    assert.equal(crossDrama.project.storyboards[0].hasImage, false, '别的剧的图不能算到当前剧');
  });

  it('edits characters, scenes, and shots without touching other dramas', async () => {
    const { executeUpdateCharacter, executeUpdateScene, executeUpdateStoryboard } = await import('../src/mastra/tools.mjs');
    const db = createAgentTestDb();
    const ids = seedTwoDramas(db);

    const created = executeUpdateCharacter(db, log, ids.dramaA, ids.episodeA1, { name: '新人' });
    assert.equal(created.ok, true);
    assert.equal(db.prepare('SELECT drama_id FROM characters WHERE id = ?').get(created.id).drama_id, ids.dramaA);
    assert.ok(db.prepare('SELECT 1 AS ok FROM episode_characters WHERE episode_id = ? AND character_id = ?').get(ids.episodeA1, ids.characterA));
    assert.ok(db.prepare('SELECT 1 AS ok FROM episode_characters WHERE episode_id = ? AND character_id = ?').get(ids.episodeA1, created.id));

    executeUpdateCharacter(db, log, ids.dramaA, ids.episodeA1, { id: ids.characterA, name: '改名' });
    const renamed = db.prepare('SELECT name, image_url FROM characters WHERE id = ?').get(ids.characterA);
    assert.equal(renamed.name, '改名');
    assert.equal(renamed.image_url, '/static/a.png');
    const foreign = executeUpdateCharacter(db, log, ids.dramaA, ids.episodeA1, { id: ids.characterB, name: '不该改' });
    assert.equal(foreign.ok, false);
    assert.equal(db.prepare('SELECT name FROM characters WHERE id = ?').get(ids.characterB).name, '乙角');

    assert.equal(executeUpdateScene(db, log, ids.dramaA, ids.episodeA1, { id: ids.sceneB, location: '不该改' }).ok, false);
    const scene = executeUpdateScene(db, log, ids.dramaA, ids.episodeA1, { location: '新地点' });
    assert.equal(scene.ok, true);
    assert.equal(db.prepare('SELECT location, image_url FROM scenes WHERE id = ?').get(scene.id).image_url, null);

    executeUpdateStoryboard(db, log, ids.dramaA, { id: ids.storyboardA, imagePrompt: '雨夜' });
    const shot = db.prepare('SELECT image_prompt, video_prompt FROM storyboards WHERE id = ?').get(ids.storyboardA);
    assert.equal(shot.image_prompt, '雨夜');
    assert.equal(shot.video_prompt, '甲镜视频');
    assert.equal(executeUpdateStoryboard(db, log, ids.dramaA, { id: ids.storyboardB, imagePrompt: '不该改' }).ok, false);

    const before = db.prepare('SELECT COUNT(*) AS c FROM characters').get().c;
    const missingEpisode = executeUpdateCharacter(db, log, ids.dramaA, null, { name: '再一个' });
    assert.equal(missingEpisode.error, '请指定哪一集');
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM characters').get().c, before);
  });

  it('starts generation with the current drama and does not poll', async () => {
    const tools = await import('../src/mastra/tools.mjs');
    const db = createAgentTestDb();
    const ids = seedTwoDramas(db);
    const calls = [];
    const deps = {
      startStoryGeneration(d, l, body) { calls.push(['story', body]); return 'task-new'; },
      generateCharacters() { calls.push(['characters']); return 'task-chars'; },
      extractBackgroundsForEpisode() { calls.push(['scenes']); return 'task-scenes'; },
      generateStoryboard(...args) { calls.push(['boards', args]); return { task_id: 'task-boards' }; },
      generateCharacterFourViewImage() { return { image_url: '/static/a.png', local_path: 'a.png' }; },
      generateSceneSingleImage() { calls.push(['scene-single']); return { image_url: '/static/s.png' }; },
      generateSceneFourViewImage() { calls.push(['scene-four']); return { image_url: '/static/s4.png' }; },
      updateStoryboard(d, l, id, patch) { calls.push(['update-shot', id, patch]); },
      createImage(d, l, body) { calls.push(['image', body]); return { task_id: 'task-img' }; },
    };

    const story = tools.executeGenerateStory(db, log, ids.dramaA, deps);
    assert.equal(story.taskId, 'task-new');
    assert.equal(calls[0][1].drama_id, ids.dramaA);
    assert.equal(calls.filter((c) => c[0] === 'story').length, 1);

    const boards = tools.executeGenerateStoryboards(db, log, ids.dramaA, ids.episodeA1, {}, deps);
    const boardArgs = calls.find((c) => c[0] === 'boards')[1];
    assert.equal(boardArgs[3], undefined);
    assert.equal(boardArgs[4], undefined);
    assert.equal(boardArgs[5], undefined);
    assert.equal(boardArgs[8], false);
    assert.equal(boardArgs[9], false);
    assert.equal(boards.taskId, 'task-boards');

    const portrait = await tools.executeGenerateImage(db, log, {}, ids.dramaA, { type: 'character', id: ids.characterA }, deps);
    assert.equal(portrait.imageUrl, '/static/a.png');
    assert.equal(portrait.taskId, undefined);

    await tools.executeGenerateImage(db, log, {}, ids.dramaA, { type: 'scene', id: ids.sceneA, view: 'four' }, deps);
    assert.ok(calls.some((c) => c[0] === 'scene-four'));
    await tools.executeGenerateImage(db, log, {}, ids.dramaA, { type: 'scene', id: ids.sceneA }, deps);
    assert.ok(calls.some((c) => c[0] === 'scene-single'));

    const shot = await tools.executeGenerateImage(db, log, {}, ids.dramaA, { type: 'storyboard', id: ids.storyboardA, prompt: '雨夜' }, deps);
    const imageCall = calls.find((c) => c[0] === 'image')[1];
    assert.equal(imageCall.prompt, '雨夜');
    assert.equal('provider' in imageCall, false);
    assert.equal('apiKey' in imageCall, false);
    assert.equal(shot.taskId, 'task-img');

    assert.equal(tools.executeGetTask(db, ids.dramaA, { taskId: 'task-ep' }).ok, true);
    assert.equal(tools.executeGetTask(db, ids.dramaA, { taskId: 'task-b' }).ok, false);

    const sceneCalls = calls.filter((c) => c[0] === 'scenes').length;
    const blocked = tools.executeGenerateScenes(db, {}, log, ids.dramaA, null, deps);
    assert.equal(blocked.error, '请指定哪一集');
    assert.equal(calls.filter((c) => c[0] === 'scenes').length, sceneCalls);
  });

  it('refuses to delete another drama and requires approval', async () => {
    const { deleteItemSpec, executeDeleteItem } = await import('../src/mastra/tools.mjs');
    const { guardDeleteApproval } = await import('../src/mastra/sse.mjs');
    const db = createAgentTestDb();
    const ids = seedTwoDramas(db);
    assert.equal(deleteItemSpec.requireApproval, true);
    const declined = guardDeleteApproval(db, ids.dramaA, { type: 'character', id: ids.characterB });
    assert.equal(declined.action, 'decline');
    assert.equal(db.prepare('SELECT deleted_at FROM characters WHERE id = ?').get(ids.characterB).deleted_at, null);
    const ask = guardDeleteApproval(db, ids.dramaA, { type: 'character', id: ids.characterA });
    assert.equal(ask.action, 'ask');
    assert.equal(ask.label, '改名' in {} ? '改名' : db.prepare('SELECT name FROM characters WHERE id = ?').get(ids.characterA).name);
    assert.equal(executeDeleteItem(db, log, ids.dramaA, { type: 'character', id: ids.characterB }).ok, false);
    assert.equal(db.prepare('SELECT deleted_at FROM characters WHERE id = ?').get(ids.characterB).deleted_at, null);
    assert.equal(executeDeleteItem(db, log, ids.dramaA, { type: 'character', id: ids.characterA }).ok, true);
    assert.notEqual(db.prepare('SELECT deleted_at FROM characters WHERE id = ?').get(ids.characterA).deleted_at, null);
  });
});
