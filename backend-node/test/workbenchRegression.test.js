const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const AdmZip = require('adm-zip');

test('missing static media returns 404 and a Jianying package contains the expected assets', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-http-test-'));
  const publicFiles = path.join(root, 'frontend');
  const storage = path.join(root, 'storage');
  const previousWebDist = process.env.WEB_DIST_PATH;
  process.env.WEB_DIST_PATH = publicFiles;
  const { closeDb } = require('../src/db');
  t.after(() => {
    closeDb();
    if (previousWebDist === undefined) delete process.env.WEB_DIST_PATH;
    else process.env.WEB_DIST_PATH = previousWebDist;
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.mkdirSync(publicFiles);
  fs.mkdirSync(storage);
  fs.writeFileSync(path.join(publicFiles, 'index.html'), '<!DOCTYPE html><title>Studio fixture</title>');
  const media = randomBytes(4 * 1024 * 1024);
  fs.writeFileSync(path.join(storage, 'shot.mp4'), media);
  const config = require('../src/config');
  t.mock.method(config, 'loadConfig', () => ({
    app: { name: 'Studio fixture', version: 'test' }, server: {},
    database: { path: path.join(root, 'db.sqlite') }, storage: { local_path: storage },
  }));
  const { app, db } = require('../src/app').createApp();
  db.exec(`INSERT INTO dramas (id, title) VALUES (1, '口播测试');
    INSERT INTO episodes (id, drama_id, episode_number, title, script_content) VALUES (1, 1, 1, '第一集', '测试剧本');
    INSERT INTO storyboards (id, episode_id, storyboard_number, duration, dialogue, video_url)
      VALUES (1, 1, 1, 8, '现在开始。', '/static/shot.mp4');`);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const missing = await fetch(`${base}/static/missing.png`);
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('content-type'), /^text\/plain/);
  const page = await fetch(`${base}/film/1`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Studio fixture/);
  const existing = await fetch(`${base}/static/shot.mp4`);
  assert.equal(existing.status, 200);
  await existing.body.cancel();

  const archiveRequest = fetch(`${base}/api/v1/episodes/1/jianying-package`);
  assert.equal((await (await fetch(`${base}/health`)).json()).status, 'ok');
  const response = await archiveRequest;
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /episode-1-jianying\.zip/);
  const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
  assert.deepEqual(zip.readFile('videos/shot-001.mp4'), media);
  assert.match(zip.readAsText('dialogue.srt'), /00:00:08,000/);
  assert.equal(JSON.parse(zip.readAsText('timeline.json')).shots[0].video, 'videos/shot-001.mp4');
});
