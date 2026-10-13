const tailFrameLinkService = require('../services/tailFrameLinkService');

function routes(db, cfg, log) {
  const service = tailFrameLinkService(db, cfg, log);
  return {
    linkTailFrame: service.linkTailFrame
  };
}

module.exports = routes;