<?php
namespace plugin\admin\api;

use ReflectionException;
use Webman\Http\Request;
use Webman\Http\Response;
use Webman\MiddlewareInterface;
use support\exception\BusinessException;

/**
 * 对外提供的鉴权中间件
 */
class Middleware implements MiddlewareInterface
{
    /**
     * 鉴权
     * @param Request $request
     * @param callable $handler
     * @return Response
     * @throws ReflectionException
     * @throws BusinessException
     */
    public function process(Request $request, callable $handler): Response
    {
        $controller = $request->controller;
        $action = $request->action;

        $code = 0;
        $msg = '';
        if (!Auth::canAccess($controller, $action, $code, $msg)) {
            if ($request->expectsJson()) {
                $response = json(['code' => $code, 'msg' => $msg, 'type' => 'error']);
            } else {
                if ($code === 401) {
                    $response = admin_error_401_script();
                } else {
                    $request->app = '';
                    $request->plugin = 'admin';
                    $response = view('common/error/403')->withStatus(403);
                }
            }
        } else {
            $response = $request->method() == 'OPTIONS' ? response('') : $handler($request);
        }
        return $response;
    }

}
