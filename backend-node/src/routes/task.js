const taskService = require('../services/taskService');
const response = require('../response');

function getTaskStatus(db, log) {
  return (req, res) => {
    const task = taskService.getTask(db, req.params.task_id);
    if (!task) return response.notFound(res, '任务不存在');
    response.success(res, task);
  };
}

function getResourceTasks(db, log) {
  return (req, res) => {
    const resourceId = req.query.resource_id;
    if (!resourceId) return response.badRequest(res, '缺少resource_id参数');
    try {
      const tasks = taskService.getTasksByResource(db, resourceId);
      response.success(res, tasks);
    } catch (err) {
      log.errorw('Get resource tasks failed', { error: err.message });
      response.internalError(res, err.message);
    }
  };
}

module.exports = function taskRoutes(db, log) {
  return {
    getTaskStatus: getTaskStatus(db, log),
    getResourceTasks: getResourceTasks(db, log),
  };
};
