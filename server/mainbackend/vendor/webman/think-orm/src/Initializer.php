<?php

namespace Webman\ThinkOrm;

use think\Paginator;
use support\think\Db;

class Initializer
{
    /**
     * @return void
     */
    public static function init(): void
    {
        $config = config('think-orm');
        if (!$config) {
            return;
        }
        // 配置
        Db::setConfig($config);

        Paginator::currentPageResolver(function ($pageName = 'page') {
            $request = request();
            if (!$request) {
                return 1;
            }
            $page = $request->input($pageName, 1);
            if (filter_var($page, FILTER_VALIDATE_INT) !== false && (int)$page >= 1) {
                return (int)$page;
            }
            return 1;
        });

        // 设置分页url中域名与参数之间的path字符串
        Paginator::currentPathResolver(function (){
            $request = request();
            return $request ? $request->path() : '/';
        });
    }
}

Initializer::init();
