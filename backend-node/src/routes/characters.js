const response = require('../response');
const characterLibraryService = require('../services/characterLibraryService');

function routes(db, cfg, log, uploadService) {
  return {
    update: (req, res) => {
      try {
        const out = characterLibraryService.updateCharacter(db, log, req.params.id, req.body || {});
        if (!out.ok) {
          if (out.error === 'character not found') return response.notFound(res, '角色不存在');
          return response.badRequest(res, out.error);
        }
        response.success(res, { message: '保存成功' });
      } catch (err) {
        log.error('characters update', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    delete: (req, res) => {
      try {
        const out = characterLibraryService.deleteCharacter(db, log, req.params.id);
        if (!out.ok) {
          if (out.error === 'character not found') return response.notFound(res, '角色不存在');
          return response.badRequest(res, out.error);
        }
        response.success(res, { message: '删除成功' });
      } catch (err) {
        log.error('characters delete', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    batchGenerateImages: (req, res) => {
      try {
        const body = req.body || {};
        const characterIds = body.character_ids;
        log.info('batch-generate-images request', { character_ids: characterIds, model: body.model, style: body.style });
        if (!Array.isArray(characterIds) || characterIds.length === 0) {
          return response.badRequest(res, 'character_ids 不能为空');
        }
        if (characterIds.length > 10) {
          return response.badRequest(res, '单次最多生成10个角色');
        }
        const out = characterLibraryService.batchGenerateCharacterImages(
          db,
          log,
          cfg,
          characterIds,
          body.model,
          body.style
        );
        if (!out.ok) {
          return response.badRequest(res, out.error);
        }
        response.success(res, {
          message: '批量生成任务已提交',
          count: out.count,
        });
      } catch (err) {
        log.error('characters batch-generate-images', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    generateImage: (req, res) => {
      try {
        const body = req.body || {};
        const out = characterLibraryService.generateCharacterImage(
          db,
          log,
          cfg,
          req.params.id,
          body.model,
          body.style
        );
        if (!out.ok) {
          if (out.error === 'character not found') return response.notFound(res, '角色不存在');
          if (out.error === 'unauthorized') return response.forbidden(res, '无权限');
          return response.badRequest(res, out.error);
        }
        response.success(res, {
          message: '角色图片生成已启动',
          image_generation: out.image_generation,
        });
      } catch (err) {
        log.error('characters generate-image', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    uploadImage: (req, res) => {
      if (!req.file || !req.file.buffer) {
        return response.badRequest(res, '请选择文件');
      }
      try {
        const storagePath = cfg?.storage?.local_path || './data/storage';
        const baseUrl = cfg?.storage?.base_url || '';
        const { url, local_path } = uploadService.uploadFile(
          storagePath,
          baseUrl,
          log,
          req.file.buffer,
          req.file.originalname || 'image.png',
          req.file.mimetype,
          'characters'
        );
        const out = characterLibraryService.uploadCharacterImage(db, log, req.params.id, url);
        if (!out.ok) {
          if (out.error === 'character not found') return response.notFound(res, '角色不存在');
          return response.badRequest(res, out.error);
        }
        response.success(res, { message: '上传成功', url, local_path, filename: req.file.originalname, size: req.file.size });
      } catch (err) {
        log.error('characters upload-image', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    putImage: (req, res) => {
      try {
        const body = req.body || {};
        const out = characterLibraryService.uploadCharacterImage(db, log, req.params.id, body.image_url);
        if (!out.ok) {
          if (out.error === 'character not found') return response.notFound(res, '角色不存在');
          return response.badRequest(res, out.error);
        }
        if (body.local_path != null) {
          const charRow = db.prepare('SELECT id FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(req.params.id));
          if (charRow) {
            db.prepare('UPDATE characters SET local_path = ?, updated_at = ? WHERE id = ?').run(
              body.local_path,
              new Date().toISOString(),
              Number(req.params.id)
            );
          }
        }
        response.success(res, { message: '保存成功' });
      } catch (err) {
        log.error('characters put image', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    imageFromLibrary: (req, res) => {
      try {
        const libraryId = (req.body || {}).library_id;
        if (libraryId == null) return response.badRequest(res, '缺少 library_id');
        const out = characterLibraryService.applyLibraryItemToCharacter(db, log, req.params.id, libraryId);
        if (!out.ok) {
          if (out.error === 'library item not found') return response.notFound(res, '角色库项不存在');
          if (out.error === 'character not found') return response.notFound(res, '角色不存在');
          return response.badRequest(res, out.error);
        }
        response.success(res, { message: '应用成功' });
      } catch (err) {
        log.error('characters image-from-library', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    addToLibrary: (req, res) => {
      try {
        const category = (req.body || {}).category;
        const out = characterLibraryService.addCharacterToLibrary(db, log, req.params.id, category);
        if (!out.ok) {
          if (out.error === 'character not found') return response.notFound(res, '角色不存在');
          return response.badRequest(res, out.error);
        }
        response.success(res, { message: '已加入角色库', item: out.item });
      } catch (err) {
        log.error('characters add-to-library', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
