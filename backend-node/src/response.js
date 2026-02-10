// 和 Go 端 pkg/response 保持一致，方便前端复用
function send(res, statusCode, body) {
  const payload = {
    ...body,
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(payload);
}

function success(res, data) {
  send(res, 200, { success: true, data });
}

function created(res, data) {
  send(res, 201, { success: true, data });
}

function successWithPagination(res, items, total, page, pageSize) {
  const totalPages = Math.ceil(total / pageSize) || 0;
  send(res, 200, {
    success: true,
    data: {
      items,
      pagination: { page, page_size: pageSize, total, total_pages: totalPages },
    },
  });
}

function error(res, statusCode, code, message, details) {
  send(res, statusCode, {
    success: false,
    error: { code, message, ...(details && { details }) },
  });
}

function badRequest(res, message) {
  error(res, 400, 'BAD_REQUEST', message);
}

function notFound(res, message) {
  error(res, 404, 'NOT_FOUND', message);
}

function forbidden(res, message) {
  error(res, 403, 'FORBIDDEN', message);
}

function internalError(res, message) {
  error(res, 500, 'INTERNAL_ERROR', message || '服务器错误');
}

module.exports = {
  success,
  created,
  successWithPagination,
  error,
  badRequest,
  notFound,
  forbidden,
  internalError,
};
