<?php

namespace plugin\admin\app\controller;

use support\Response;
use Throwable;

/**
 * 开发辅助相关
 */
class DevController
{
    /**
     * 表单构建
     * @return Response
     * @throws Throwable
     */
    public function formBuild()
    {
        return raw_view('dev/form-build');
    }

}
