/**
 * 可灵官方 OpenAPI JWT（与文档 commonInfo 及官方示例一致）
 * @see https://klingai.com/document-api/apiReference/commonInfo
 * @see https://app.klingai.com/cn/dev/document-api/apiReference/commonInfo
 *
 * Header: alg=HS256, typ=JWT
 * Payload: iss=AccessKey, exp, nbf（nbf 默认 now-300s 以容忍本机时钟快于服务端，避免 1003；可用 KLING_JWT_NBF_SKEW_SECONDS 覆盖）
 */
const jwt = require('jsonwebtoken');

/** 客户端时钟快于服务端时，nbf 过「新」会触发 1003 Authorization is not active；默认放宽到 5 分钟 */
const DEFAULT_NBF_SKEW_SEC = (() => {
  const n = parseInt(process.env.KLING_JWT_NBF_SKEW_SECONDS || '', 10);
  return Number.isFinite(n) && n >= 0 ? n : 300;
})();

/** 去掉首尾空白与常见零宽字符（避免复制密钥时签名校验失败） */
function normalizeKlingCredential(s) {
  return String(s || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/**
 * @param {string} accessKey
 * @param {string} secretKey
 * @param {{ ttlSeconds?: number, secretEncoding?: 'utf8'|'base64' } | number} [opts] 兼容旧调用 signKlingOfficialJwt(ak, sk, 1800)
 */
function signKlingOfficialJwt(accessKey, secretKey, opts = {}) {
  const options =
    typeof opts === 'number' ? { ttlSeconds: opts } : opts && typeof opts === 'object' ? opts : {};
  const ttlSeconds = options.ttlSeconds ?? 1800;
  const secretEncoding = options.secretEncoding === 'base64' ? 'base64' : 'utf8';

  const ak = normalizeKlingCredential(accessKey);
  const sk = normalizeKlingCredential(secretKey);
  if (!ak || !sk) throw new Error('AccessKey 与 SecretKey 不能为空');

  let signingSecret = sk;
  if (secretEncoding === 'base64') {
    const buf = Buffer.from(sk, 'base64');
    if (!buf.length) throw new Error('SecretKey 按 Base64 解码后为空，请检查是否勾选错误或粘贴内容');
    signingSecret = buf;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ak,
    exp: now + ttlSeconds,
    nbf: now - DEFAULT_NBF_SKEW_SEC,
  };

  return jwt.sign(payload, signingSecret, {
    algorithm: 'HS256',
    header: { alg: 'HS256', typ: 'JWT' },
    noTimestamp: true,
  });
}

/** 调试：解码 payload，不校验签名（勿记录完整 token） */
function unsafeDecodeKlingJwtPayload(token) {
  try {
    return jwt.decode(token, { complete: false });
  } catch (_) {
    return null;
  }
}

/** JWT 三段 base64url 长度，用于对照是否截断 */
function jwtPartLengths(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return { invalid: true, part_count: parts.length };
  return { header: parts[0].length, payload: parts[1].length, signature: parts[2].length };
}

module.exports = {
  signKlingOfficialJwt,
  normalizeKlingCredential,
  unsafeDecodeKlingJwtPayload,
  jwtPartLengths,
};
