const multer = require('multer');
const response = require('../response');
const uploadService = require('../services/uploadService');

const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const maxSize = 10 * 1024 * 1024; // 10MB

const memoryStorage = multer.memoryStorage();
const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: maxSize },
  fileFilter: (req, file, cb) => {
    const ct = file.mimetype || 'application/octet-stream';
    if (!allowedTypes.includes(ct)) {
      return cb(new Error('只支持图片格式 (jpg, png, gif, webp)'));
    }
    cb(null, true);
  },
});

function routes(cfg, log) {
  const singleUpload = upload.single('file');
  return {
    multerSingle: singleUpload,
    uploadImage: (req, res) => {
      if (!req.file || !req.file.buffer) {
        return response.badRequest(res, '请选择文件');
      }
      try {
        const storagePath = cfg?.storage?.local_path || './data/storage';
        const baseUrl = cfg?.storage?.base_url || '';
        const result = uploadService.uploadFile(
          storagePath,
          baseUrl,
          log,
          req.file.buffer,
          req.file.originalname || 'image.png',
          req.file.mimetype,
          'uploads'
        );
        response.success(res, {
          url: result.url,
          path: result.local_path,
          local_path: result.local_path,
          filename: req.file.originalname,
          size: req.file.size,
        });
      } catch (err) {
        log.error('upload image', { error: err.message });
        response.internalError(res, err.message || '上传失败');
      }
    },
  };
}

module.exports = { routes, upload };
module.exports.multerSingle = upload.single('file');
