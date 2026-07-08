// backend-node/src/services/elevenlabsService.js
// 仅用于「取样」：调用一次 ElevenLabs TTS API 生成一小段示例音频，
// 之后该音频会作为 ref_audio 交给本地 OmniVoice 做克隆合成，不再持续调用 ElevenLabs。
const https = require('https');
const aiConfigService = require('./aiConfigService');

const ELEVENLABS_SAMPLE_TEXT = 'The quick brown fox jumps over the lazy dog while the morning sun rises slowly behind the distant hills.';

function getElevenLabsConfig(db) {
  const configs = aiConfigService.listConfigs(db, 'tts');
  const cfg = configs.find((c) => c.is_active && (c.provider || '').toLowerCase() === 'elevenlabs');
  if (!cfg || !cfg.api_key) {
    throw new Error('未配置 ElevenLabs，请在「AI 配置」中添加 service_type=tts, provider=elevenlabs 的配置并填写 API Key');
  }
  return { apiKey: cfg.api_key, baseUrl: (cfg.base_url || 'https://api.elevenlabs.io/v1').replace(/\/+$/, '') };
}

function fetchSampleAudio(apiKey, baseUrl, voiceId, text) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${baseUrl}/text-to-speech/${voiceId}`);
    const body = JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    });
    const req = https.request(parsed, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          reject(new Error(`ElevenLabs HTTP ${res.statusCode}: ${buf.toString('utf-8').slice(0, 500)}`));
          return;
        }
        resolve(buf);
      });
    });
    const timer = setTimeout(() => { req.destroy(); reject(new Error('ElevenLabs 请求超时')); }, 60000);
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.on('close', () => clearTimeout(timer));
    req.write(body);
    req.end();
  });
}

module.exports = { ELEVENLABS_SAMPLE_TEXT, getElevenLabsConfig, fetchSampleAudio };
