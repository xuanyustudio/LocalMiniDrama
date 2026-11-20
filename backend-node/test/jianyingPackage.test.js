const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const AdmZip = require('adm-zip');
const { writePackage } = require('../src/services/jianyingPackage');

test('an oversized package keeps images and audio, skips the videos that do not fit, and says so', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lmd-jianying-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'a.png'), Buffer.alloc(10));
  fs.writeFileSync(path.join(root, 'a.mp3'), Buffer.alloc(10));
  fs.writeFileSync(path.join(root, 'v1.mp4'), Buffer.alloc(60));
  fs.writeFileSync(path.join(root, 'v2.mp4'), Buffer.alloc(60));
  const filename = path.join(root, 'out.zip');
  writePackage({
    root, filename, maxBytes: 100,
    episode: { title: '第1集', script_content: '剧本', video_url: null },
    shots: [
      { title: '一', duration: 5, dialogue: '林宁：走。', packageImage: 'a.png', packageVideo: '/static/v1.mp4', audio_local_path: 'a.mp3' },
      { title: '二', duration: 5, dialogue: '', packageImage: null, packageVideo: 'v2.mp4' },
      { title: '三', duration: 5, packageVideo: '../escape.mp4' },
    ],
  });
  const zip = new AdmZip(filename);
  const names = zip.getEntries().map(e => e.entryName).sort();
  assert.deepEqual(names.filter(n => /\.(png|mp3|mp4)$/.test(n)), ['audio/shot-001.mp3', 'images/shot-001.png', 'videos/shot-001.mp4']);
  const timeline = JSON.parse(zip.readAsText('timeline.json'));
  assert.equal(timeline.shots[1].video, 'skipped:too_large');
  assert.equal(timeline.shots[2].video, null, 'paths outside storage are never packaged');
  assert.deepEqual(timeline.skipped, ['videos/shot-002.mp4']);
  assert.match(zip.readAsText('README.txt'), /videos\/shot-002\.mp4/);
  assert.match(zip.readAsText('dialogue.srt'), /^﻿1\r\n00:00:00,000 --> 00:00:05,000\r\n林宁：走。/);
});
