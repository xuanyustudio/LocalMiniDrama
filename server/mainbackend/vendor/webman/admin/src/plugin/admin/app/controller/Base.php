<?php

namespace plugin\admin\app\controller;

use support\Model;
use support\Response;

/**
 * 基础控制器
 */
class Base
{

    /**
     * @var Model
     */
    protected $model = null;

    /**
     * 无需登录及鉴权的方法
     * @var array
     */
    protected $noNeedLogin = [];

    /**
     * 需要登录无需鉴权的方法
     * @var array
     */
    protected $noNeedAuth = [];

    /**
     * 数据限制
     * null 不做限制，任何管理员都可以查看该表的所有数据
     * auth 管理员能看到自己以及自己的子管理员插入的数据
     * personal 管理员只能看到自己插入的数据
     * @var string
     */
    protected $dataLimit = null;

    /**
     * 数据限制字段
     */
    protected $dataLimitField = 'admin_id';

    /**
     * 返回格式化json数据
     *
     * @param int $code
     * @param string $msg
     * @param array $data
     * @return Response
     */
    protected function json(int $code, string $msg = 'ok', array $data = []): Response
    {
        return json(['code' => $code, 'data' => $data, 'msg' => $msg]);
    }

    protected function success(string $msg = '成功', array $data = []): Response
    {
        return $this->json(0, $msg, $data);
    }

    protected function fail(string $msg = '失败', array $data = []): Response
    {
        return $this->json(1, $msg, $data);
    }
}
