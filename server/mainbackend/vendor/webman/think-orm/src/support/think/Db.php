<?php

// +----------------------------------------------------------------------
// | ThinkPHP [ WE CAN DO IT JUST THINK ]
// +----------------------------------------------------------------------
// | Copyright (c) 2006~2023 http://thinkphp.cn All rights reserved.
// +----------------------------------------------------------------------
// | Licensed ( http://www.apache.org/licenses/LICENSE-2.0 )
// +----------------------------------------------------------------------
// | Author: liu21st <liu21st@gmail.com>
// +----------------------------------------------------------------------

namespace support\think;

use think\db\BaseQuery;
use think\Event;
use think\Facade;
use Webman\ThinkOrm\DbManager;

/**
 * Class Db
 * 数据库操作类
 * @mixin \think\DbManager
 * @method static \think\DbManager name(string $name) 指定当前数据表名（不含前缀）
 * @method static \think\DbManager table(mixed $table) 指定当前操作的数据表
 * @method static mixed transaction(callable $callback) 执行数据库事务
 * @method static void startTrans() 启动事务
 * @method static void commit() 用于非自动提交状态下面的查询提交
 * @method static void rollback() 事务回滚
 * @method static array query(string $sql, array $bind = []) 执行查询返回数据集
 * @method static \think\DbManager master(bool $readMaster = true) 设置从主服务器读取数据
 * @method static int execute(string $sql, array $bind = []) 执行语句
 * @method static \think\DbManager connect(string|null $name = null, bool $force = false) 创建/切换数据库连接查询
 * @method static void setConfig($config) 设置配置对象
 * @method static mixed getConfig(string $name = '', $default = null) 获取配置参数
 * @method static void setEvent(Event $event) 设置Event对象
 * @method static void event(string $event, callable $callback) 注册回调方法
 * @method static mixed trigger(string $event, $params = null, bool $once = false) 触发事件
 */

class Db extends Facade
{

    /**
     * 获取当前Facade对应类名（或者已经绑定的容器对象标识）.
     *
     * @return string
     */
    protected static function getFacadeClass()
    {
        return DbManager::class;
    }

}
