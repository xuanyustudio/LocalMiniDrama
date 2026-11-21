/**
 * TTS 语音合成服务
 * 支持多种 TTS 接口：minimax、edge-tts（本地）、通用 HTTP
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { randomUUID } = require('crypto');

const execFileAsync = promisify(execFile);
const MINIMAX_SPEECH_URL = 'https://api.minimax.io/v1/t2a_v2';
const MANDARIN_DEFAULT = 'Chinese (Mandarin)_Reliable_Executive';
const MANDARIN_FEMALE = 'Chinese (Mandarin)_IntellectualGirl';
const COSYVOICE_PRESETS = {
  [MANDARIN_DEFAULT]: 'longanyang',
  [MANDARIN_FEMALE]: 'longanhuan_v3',
};

function requestCosyVoice(text, voice, apiKey, model, rate, url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    const taskId = randomUUID();
    const audio = [];
    ws.binaryType = 'arraybuffer';
    function finish(error) {
      clearTimeout(timer);
      if (error) reject(new Error(error));
      else resolve(Buffer.concat(audio));
      if (ws.readyState < WebSocket.CLOSING) ws.close();
    }
    const timer = setTimeout(() => finish('百炼配音等候超时，请稍后重试。'), 120000);
    function send(action, payload) {
      ws.send(JSON.stringify({ header: { action, task_id: taskId, streaming: 'duplex' }, payload }));
    }
    ws.addEventListener('open', () => {
      send('run-task', {
        task_group: 'audio', task: 'tts', function: 'SpeechSynthesizer', model,
        parameters: { text_type: 'PlainText', voice, format: 'mp3', sample_rate: 22050, volume: 50, rate, pitch: 1 },
        input: {},
      });
    });
    ws.addEventListener('message', ({ data }) => {
      if (data instanceof ArrayBuffer) {
        audio.push(Buffer.from(data));
        return;
      }
      let header;
      try { header = JSON.parse(data).header; }
      catch (_) { return finish('百炼配音返回了无法识别的消息。'); }
      if (header?.task_id !== taskId) return;
      if (header.event === 'task-started') {
        send('continue-task', { input: { text } });
        send('finish-task', { input: {} });
      } else if (header.event === 'task-finished') {
        finish(audio.length ? undefined : '百炼配音没有返回音频。');
      } else if (header.event === 'task-failed') {
        const code = /^[A-Za-z0-9._-]{1,80}$/.test(header.error_code || '') ? `（${header.error_code}）` : '';
        finish(`百炼配音失败${code}，请检查音色、额度和权限。`);
      }
    });
    ws.addEventListener('error', () => finish('无法连接百炼配音，请检查网络和密钥。'));
    ws.addEventListener('close', () => finish('百炼配音连接提前关闭，请重试。'));
  });
}

async function requestMinimaxIntl(text, voiceId, apiKey, model, speed) {
  const res = await fetch(MINIMAX_SPEECH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      text,
      stream: false,
      language_boost: 'Chinese',
      output_format: 'hex',
      voice_setting: { voice_id: voiceId, speed, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`MiniMax 国际版配音请求失败（HTTP ${res.status}），请检查账户、额度与服务权限。`);
  const data = await res.json();
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax 国际版配音失败（状态 ${Number(data.base_resp?.status_code) || '未知'}），请检查额度和音色设置。`);
  }
  const audioHex = data.data?.audio;
  if (typeof audioHex !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(audioHex)) {
    throw new Error('MiniMax 国际版没有返回有效的音频。');
  }
  return Buffer.from(audioHex, 'hex');
}

function splitDialogue(text, defaultVoice, speakerVoices) {
  const parts = [];
  for (const line of text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
    const match = /^(?:[-*]\s+)?([\p{L}\p{N}· ]{1,30})(?:[（(［\[][\s\S]*?[）)］\]])?\s*[：:]\s*(.+)$/u.exec(line);
    const speaker = match?.[1].trim();
    const voice = speaker && Object.hasOwn(speakerVoices, speaker) ? speakerVoices[speaker] : defaultVoice;
    const lineText = match ? match[2] : line;
    const previous = parts.at(-1);
    if (previous?.voice === voice) previous.text += '\n' + lineText;
    else parts.push({ voice, text: lineText });
  }
  return parts;
}

async function joinMp3Parts(buffers) {
  const { getFfmpegPath } = require('../utils/ffmpegPath');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-tts-'));
  const files = buffers.map((_, i) => `line-${i}.mp3`);
  try {
    for (const [i, file] of files.entries()) fs.writeFileSync(path.join(work, file), buffers[i]);
    fs.writeFileSync(path.join(work, 'parts.txt'), files.map((file) => `file '${file}'`).join('\n'));
    await execFileAsync(getFfmpegPath(), ['-v', 'error', '-f', 'concat', '-safe', '1', '-i', 'parts.txt', '-c:a', 'copy', 'dialogue.mp3'], {
      cwd: work, windowsHide: true, timeout: 60000,
    });
    return fs.readFileSync(path.join(work, 'dialogue.mp3'));
  } finally {
    for (const file of [...files, 'parts.txt', 'dialogue.mp3']) {
      const target = path.join(work, file);
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    fs.rmdirSync(work);
  }
}

async function synthesizeDialogue(text, voiceId, speed, kind, speakerVoices, render) {
  const voice = voiceId || MANDARIN_DEFAULT;
  const rate = Number(speed);
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 2) throw new Error('配音语速须在 0.5 到 2 之间。');
  if (text.length >= 10000) throw new Error('分镜对白须少于 10000 个字符。');
  if (speakerVoices && (typeof speakerVoices !== 'object' || Array.isArray(speakerVoices))) {
    throw new Error('角色音色应按角色名填写。');
  }
  const hasDialogue = kind === 'dialogue' || (!kind && speakerVoices);
  const parts = hasDialogue ? splitDialogue(text, voice, speakerVoices || {}) : [{ voice, text }];
  const cleanParts = parts.map((part) => ({ text: part.text, voice: typeof part.voice === 'string' ? part.voice.trim() : '' }));
  if (cleanParts.some((part) => !part.voice || part.voice.length > 128)) throw new Error('请检查角色配音音色 ID。');
  if (cleanParts.length > 1 && !require('../utils/ffmpegPath').hasLocalFfmpeg()) {
    throw new Error('需要 FFmpeg 合并多角色对白，请检查工作台的 FFmpeg 安装。');
  }
  const buffers = [];
  for (const part of cleanParts) buffers.push(await render(part.text, part.voice, rate));
  return buffers.length === 1 ? buffers[0] : joinMp3Parts(buffers);
}

/**
 * 使用 MiniMax T2A v2 合成语音
 */
async function synthesizeWithMinimax(text, voiceId, apiKey, groupId, model) {
  const body = JSON.stringify({
    model: model || 'speech-02-hd',
    text,
    stream: false,
    voice_setting: {
      voice_id: voiceId || 'female-shaonv',
      speed: 1.0,
      vol: 1.0,
      pitch: 0,
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: 'mp3',
      channel: 1,
    },
  });
  const url = `https://api.minimax.chat/v1/t2a_v2?GroupId=${groupId}`;
  return new Promise((resolve, reject) => {
    const reqOpts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.request(urlObj, reqOpts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`MiniMax TTS HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString()}`));
          return;
        }
        const data = JSON.parse(Buffer.concat(chunks).toString());
        if (data.base_resp?.status_code !== 0) {
          reject(new Error(`MiniMax TTS error: ${data.base_resp?.status_msg || 'unknown'}`));
          return;
        }
        const audioHex = data.data?.audio;
        if (!audioHex) { reject(new Error('MiniMax TTS 未返回音频')); return; }
        resolve(Buffer.from(audioHex, 'hex'));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 使用 OpenAI TTS API 合成语音（兼容所有 OpenAI 格式的代理）
 * POST {base_url}/audio/speech  body: { model, input, voice, response_format, speed }
 */
async function synthesizeWithOpenai(text, voice, apiKey, baseUrl, model, speed) {
  const url = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/audio/speech';
  const body = JSON.stringify({
    model: model || 'tts-1',
    input: text,
    voice: voice || 'alloy',
    response_format: 'mp3',
    speed: speed || 1.0,
  });
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    };
    const req = mod.request(reqOpts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`OpenAI TTS HTTP ${res.statusCode}: ${buf.toString('utf-8').slice(0, 500)}`));
          return;
        }
        resolve(buf);
      });
    });
    const timer = setTimeout(() => { req.destroy(); reject(new Error('OpenAI TTS 请求超时')); }, 120000);
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.on('close', () => clearTimeout(timer));
    req.write(body);
    req.end();
  });
}

/**
 * 合成 TTS 并保存到本地文件
 * @returns {{ local_path: string, audio_url: string }}
 */
function getTtsConfig(db) {
  const configs = require('./aiConfigService').listConfigs(db, 'tts');
  const active = configs.filter((c) => c.is_active);
  return active.find((c) => c.is_default) || active[0];
}

async function synthesize(db, log, { text, storyboard_id, config, storage_base, voice_id, speed, tts_kind, speaker_voices }) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('text 不能为空');
  const ttsConfig = config || getTtsConfig(db);
  if (!ttsConfig) throw new Error('未配置 TTS 模型，请在「AI 配置」中添加 service_type=tts 的配置');

  const provider = (ttsConfig.provider || '').toLowerCase();
  let ttsSettings = {};
  try { ttsSettings = JSON.parse(ttsConfig.settings || '{}'); } catch (_) {}
  // 外部传入的 voice_id / speed 优先（海外化场景），否则取配置值
  const voiceId = voice_id || ttsConfig.voice_id || ttsSettings.voice_id || '';
  const groupId = ttsConfig.group_id || ttsSettings.group_id || '';
  const ttsModel = ttsConfig.default_model || (Array.isArray(ttsConfig.model) ? ttsConfig.model[0] : ttsConfig.model) || '';
  const finalSpeed = speed || ttsSettings.speed || 1.0;
  let audioBuffer;

  if (provider === 'cosyvoice' || provider === 'minimax_intl') {
    const production = require('./productionProviders');
    const cosy = provider === 'cosyvoice';
    const url = cosy
      ? production.BAILIAN_PROFILES.tts.base_url + production.BAILIAN_PROFILES.tts.endpoint
      : MINIMAX_SPEECH_URL;
    const key = production.generationKey(ttsConfig, url, 'tts');
    const expectedModel = cosy ? 'cosyvoice-v3-flash' : 'speech-2.8-turbo';
    const model = ttsConfig.default_model || expectedModel;
    if (model !== expectedModel) throw new Error(`中文配音配置使用 ${expectedModel} 模型。`);
    const render = cosy
      ? (line, voice, rate) => requestCosyVoice(line, COSYVOICE_PRESETS[voice] || voice, key, model, rate, url)
      : (line, voice, rate) => requestMinimaxIntl(line, voice, key, model, rate);
    audioBuffer = await synthesizeDialogue(text, voiceId, finalSpeed, tts_kind,
      speaker_voices || ttsSettings.speaker_voices, render);
  } else if (provider === 'minimax') {
    audioBuffer = await synthesizeWithMinimax(
      text,
      voiceId || 'female-shaonv',
      ttsConfig.api_key,
      groupId,
      ttsModel || 'speech-02-hd'
    );
  } else if (provider === 'openai' || ttsConfig.base_url) {
    audioBuffer = await synthesizeWithOpenai(
      text,
      voiceId || 'alloy',
      ttsConfig.api_key,
      ttsConfig.base_url,
      ttsModel || 'tts-1',
      finalSpeed
    );
  } else {
    throw new Error(`不支持的 TTS provider: ${provider}，目前支持 openai、minimax、minimax_intl、cosyvoice`);
  }

  // 保存到本地
  const audioDir = path.join(storage_base, 'audio');
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
  const filename = `tts_sb${storyboard_id || 'x'}_${randomUUID().slice(0, 8)}.mp3`;
  const filePath = path.join(audioDir, filename);
  fs.writeFileSync(filePath, audioBuffer);
  const localPath = `audio/${filename}`;
  log.info('[TTS] 合成完成', { storyboard_id, local_path: localPath, provider });
  try { const cs = require('./cloudService'); cs.reportUsage('tts', ttsModel || '', '', 0); } catch (_) {}
  return { local_path: localPath };
}

module.exports = { synthesize, getTtsConfig, splitDialogue };
