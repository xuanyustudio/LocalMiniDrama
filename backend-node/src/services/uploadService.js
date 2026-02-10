// 与 Go UploadService 对齐：保存到 local_path，返回 url / local_path
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function uploadFile(storagePath, baseUrl, log, fileBuffer, originalName, mimeType, category) {
  const categoryPath = path.join(storagePath, category);
  ensureDir(categoryPath);
  const ext = path.extname(originalName) || '.png';
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const name = `${timestamp}_${randomUUID()}${ext}`;
  const filePath = path.join(categoryPath, name);
  fs.writeFileSync(filePath, fileBuffer);
  const relativePath = `${category}/${name}`;
  const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/${relativePath}` : `/static/${relativePath}`;
  log.info('File uploaded', { path: filePath, url });
  return { url, local_path: relativePath };
}

/**
 * 将远程/Base64 图片保存到本地 storage，避免 AI 链接过期后无法访问
 * @param {string} storagePath - 存储根目录（如 ./data/storage）
 * @param {string} imageUrl - 图片地址（http(s) URL 或 data:image/xxx;base64,...）
 * @param {string} category - 子目录：characters / scenes / images
 * @param {object} log - logger
 * @param {string} [prefix] - 文件名前缀，如 ig_123
 * @returns {Promise<string|null>} 相对路径如 characters/xxx.png，失败返回 null
 */
async function downloadImageToLocal(storagePath, imageUrl, category, log, prefix = '') {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const categoryPath = path.join(storagePath, category);
  try {
    ensureDir(categoryPath);
    let buffer;
    let ext = 'png';
    if (imageUrl.startsWith('data:')) {
      const match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) {
        log.warn('downloadImageToLocal: invalid data URL');
        return null;
      }
      buffer = Buffer.from(match[2], 'base64');
      ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    } else {
      const res = await fetch(imageUrl, { method: 'GET' });
      if (!res.ok) {
        log.warn('downloadImageToLocal: fetch failed', { status: res.status });
        return null;
      }
      const contentType = res.headers.get('content-type') || '';
      ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      buffer = Buffer.from(await res.arrayBuffer());
    }
    const name = `${prefix}${prefix ? '_' : ''}${randomUUID().slice(0, 8)}.${ext}`;
    const filePath = path.join(categoryPath, name);
    fs.writeFileSync(filePath, buffer);
    const relativePath = `${category}/${name}`;
    log.info('Image saved to local', { category, local_path: relativePath });
    return relativePath;
  } catch (e) {
    log.warn('downloadImageToLocal error', { category, error: e.message });
    return null;
  }
}

module.exports = {
  uploadFile,
  downloadImageToLocal,
};
