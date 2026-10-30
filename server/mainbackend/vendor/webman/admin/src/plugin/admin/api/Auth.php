<?php
namespace plugin\admin\api;

use plugin\admin\app\model\Role;
use plugin\admin\app\model\Rule;
use support\exception\BusinessException;
use function admin;

/**
 * 对外提供的鉴权接口
 */
class Auth
{
    /**
     * 判断权限
     * 如果没有权限则抛出异常
     * @param string $controller
     * @param string $action
     * @return void
     * @throws \ReflectionException|BusinessException
     */
    public static function access(string $controller, string $action)
    {
        $code = 0;
        $msg = '';
        if (!static::canAccess($controller, $action, $code, $msg)) {
            throw new BusinessException($msg, $code);
        }
    }

    /**
     * 判断是否有权限
     * @param string $controller
     * @param string $action
     * @param int $code
     * @param string $msg
     * @return bool
     * @throws \ReflectionException|BusinessException
     */
    public static function canAccess(string $controller, string $action, int &$code = 0, string &$msg = ''): bool
    {
        // 无控制器信息说明是函数调用，函数不属于任何控制器，鉴权操作应该在函数内部完成。
        if (!$controller) {
            return true;
        }
        // 获取控制器鉴权信息
        $class = new \ReflectionClass($controller);
        $properties = $class->getDefaultProperties();
        $noNeedLogin = $properties['noNeedLogin'] ?? [];
        $noNeedAuth = $properties['noNeedAuth'] ?? [];

        // 不需要登录
        if (in_array($action, $noNeedLogin)) {
            return true;
        }

        // 获取登录信息
        $admin = admin();
        if (!$admin) {
            $msg = '请登录';
            // 401是未登录固定的返回码
            $code = 401;
            return false;
        }

        // 不需要鉴权
        if (in_array($action, $noNeedAuth)) {
            return true;
        }

        // 当前管理员无角色
        $roles = $admin['roles'];
        if (!$roles) {
            $msg = '无权限';
            $code = 2;
            return false;
        }

        // 角色没有规则
        $rules = Role::whereIn('id', $roles)->pluck('rules');
        $rule_ids = [];
        foreach ($rules as $rule_string) {
            if (!$rule_string) {
                continue;
            }
            $rule_ids = array_merge($rule_ids, explode(',', $rule_string));
        }
        if (!$rule_ids) {
            $msg = '无权限';
            $code = 2;
            return false;
        }

        // 超级管理员
        if (in_array('*', $rule_ids)){
            return true;
        }

        // 如果action为index，规则里有任意一个以$controller开头的权限即可
        if (strtolower($action) === 'index') {
            $rule = Rule::where(function ($query) use ($controller, $action) {
                $controller_like = str_replace('\\', '\\\\', $controller);
                $query->where('key', 'like', "$controller_like@%")->orWhere('key', $controller);
            })->whereIn('id', $rule_ids)->first();
            if ($rule) {
                return true;
            }
            $msg = '无权限';
            $code = 2;
            return false;
        }

        // 查询是否有当前控制器的规则
        $rule = Rule::where(function ($query) use ($controller, $action) {
            $query->where('key', "$controller@$action")->orWhere('key', $controller);
        })->whereIn('id', $rule_ids)->first();

        if (!$rule) {
            $msg = '无权限';
            $code = 2;
            return false;
        }

        return true;
    }

}