const response = require('../response');

function routes(db, log) {
  return {
    extract: (req, res) => {
      try {
        response.success(res, { url: '' });
      } catch (err) {
        log.error('audio extract', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    extractBatch: (req, res) => {
      try {
        response.success(res, []);
      } catch (err) {
        log.error('audio extract batch', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
