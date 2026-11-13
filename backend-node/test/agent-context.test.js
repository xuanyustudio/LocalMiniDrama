const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createAgentTestDb, seedTwoDramas } = require('./helpers/agentTestDb');

describe('agent context', () => {
  it('keeps the current drama boundary', async () => {
    const { dramaThreadId, resolveEpisode, assertOwned, validateChatBody, resolveChatEpisode } = await import('../src/mastra/context.mjs');
    const db = createAgentTestDb();
    const ids = seedTwoDramas(db);

    assert.equal(dramaThreadId(3), 'drama-3');

    const chatEpisode = resolveChatEpisode(db, ids.dramaA, ids.episodeA1);
    assert.equal(chatEpisode.ok, true);
    assert.equal(chatEpisode.episodeId, ids.episodeA1);

    const chatNone = resolveChatEpisode(db, ids.dramaA, null);
    assert.equal(chatNone.ok, true);
    assert.equal(chatNone.episodeId, null);

    const many = resolveEpisode(db, ids.dramaA, null);
    assert.equal(many.ok, false);
    assert.equal(many.error, '请指定哪一集');

    const only = resolveEpisode(db, ids.dramaB, null);
    assert.equal(only.ok, true);
    assert.equal(only.episodeId, ids.episodeB1);

    const foreign = resolveEpisode(db, ids.dramaA, ids.episodeB1);
    assert.equal(foreign.ok, false);
    assert.equal(foreign.error, '这一集不属于当前项目');

    const otherCharacter = assertOwned(db, ids.dramaA, 'character', ids.characterB);
    assert.equal(otherCharacter.ok, false);
    const stillThere = db.prepare('SELECT deleted_at FROM characters WHERE id = ?').get(ids.characterB);
    assert.equal(stillThere.deleted_at, null);

    const episodeTask = assertOwned(db, ids.dramaA, 'task', 'task-ep');
    assert.equal(episodeTask.ok, true);

    const otherTask = assertOwned(db, ids.dramaA, 'task', 'task-b');
    assert.equal(otherTask.ok, false);

    const missing = validateChatBody(db, { message: 'hi', dramaId: 99 });
    assert.equal(missing.ok, false);
    assert.equal(missing.message, '项目不存在');

    const open = validateChatBody(db, { message: 'hi', dramaId: ids.dramaA });
    assert.equal(open.ok, true);
    assert.equal(open.episodeId, null);

    const wrongEpisode = validateChatBody(db, { message: 'hi', dramaId: ids.dramaA, episodeId: ids.episodeB1 });
    assert.equal(wrongEpisode.ok, false);
    assert.equal(wrongEpisode.message, '这一集不属于当前项目');
  });
});
