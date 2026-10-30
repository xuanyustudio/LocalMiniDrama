# 命令行

Webman命令行组件

## 安装
```
composer require webman/console
```

> **注意**
> 以下命令是`webman/console` `v2.2`及以上版本的说明，如果你的console缺少某些功能，请及时更新。

## 目录

### 代码生成
- [make:controller](#make-controller) - 生成控制器类
- [make:model](#make-model) - 从数据库表生成模型类
- [make:crud](#make-crud) - 生成完整 CRUD (模型 + 控制器 + 验证器)
- [make:middleware](#make-middleware) - 生成中间件类
- [make:command](#make-command) - 生成控制台命令类
- [make:bootstrap](#make-bootstrap) - 生成启动初始化类
- [make:process](#make-process) - 生成自定义进程类

### 构建和部署
- [build:phar](#build-phar) - 将项目打包为 PHAR 归档文件
- [build:bin](#build-bin) - 将项目打包为独立二进制文件
- [install](#install) - 运行 Webman 安装脚本

### 实用工具命令
- [version](#version) - 显示 Webman 框架版本
- [fix-disable-functions](#fix-disable-functions) - 修复 php.ini 中的禁用函数
- [route:list](#route-list) - 显示所有注册的路由

### 应用插件管理 (app-plugin:*)
- [app-plugin:create](#app-plugin-create) - 创建新应用插件
- [app-plugin:install](#app-plugin-install) - 安装应用插件
- [app-plugin:uninstall](#app-plugin-uninstall) - 卸载应用插件
- [app-plugin:update](#app-plugin-update) - 更新应用插件
- [app-plugin:zip](#app-plugin-zip) - 将应用插件打包为 ZIP

### 插件管理 (plugin:*)
- [plugin:create](#plugin-create) - 创建新 Webman 插件
- [plugin:install](#plugin-install) - 安装 Webman 插件
- [plugin:uninstall](#plugin-uninstall) - 卸载 Webman 插件
- [plugin:enable](#plugin-enable) - 启用 Webman 插件
- [plugin:disable](#plugin-disable) - 禁用 Webman 插件
- [plugin:export](#plugin-export) - 导出插件源代码

### 服务管理
- [start](#start) - 启动 Webman 工作进程
- [stop](#stop) - 停止 Webman 工作进程
- [restart](#restart) - 重启 Webman 工作进程
- [reload](#reload) - 无停机重载代码
- [status](#status) - 查看工作进程状态
- [connections](#connections) - 获取工作进程连接信息

## 代码生成

<a name="make-controller"></a>
### make:controller 

生成控制器类。

**用法：**
```bash
php webman make:controller <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 控制器名称（不带后缀） |

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--plugin` | `-p` | 在对应插件目录生成控制器 |
| `--path` | `-P` | 自定义控制器路径 |
| `--force` | `-f` | 如果文件存在则覆盖 |
| `--no-suffix` | | 不追加 "Controller" 后缀 |

**示例：**
```bash
# 在 app/controller 中创建 UserController
php webman make:controller User

# 在插件中创建
php webman make:controller AdminUser -p admin

# 自定义路径
php webman make:controller User -P app/api/controller

# 覆盖现有文件
php webman make:controller User -f

# 创建时不带 "Controller" 后缀
php webman make:controller UserHandler --no-suffix
```

**生成的文件结构：**
```php
<?php
namespace app\controller;

use support\Request;

class UserController
{
    public function index(Request $request)
    {
        return response('hello user');
    }
}
```

**说明：**
- 控制器默认放在 `app/controller/` 目录
- 自动追加配置的控制器后缀
- 如果文件存在会提示是否覆盖(下同)

<a name="make-model"></a>
### make:model

从数据库表生成模型类，支持 Laravel ORM 与 ThinkORM。

**用法：**
```bash
php webman make:model [名称]
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 否 | 模型类名，交互模式下可省略 |

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--plugin` | `-p` | 在对应插件目录生成模型 |
| `--path` | `-P` | 目标目录（相对项目根路径） |
| `--table` | `-t` | 指定表名，表名不符合约定时建议显式指定 |
| `--orm` | `-o` | 选择 ORM：`laravel` 或 `thinkorm` |
| `--database` | `-d` | 指定数据库连接名 |
| `--force` | `-f` | 覆盖已存在文件 |

**路径说明：**
- 默认：`app/model/`（主应用）或 `plugin/<插件>/app/model/`（插件）
- `--path` 为相对项目根路径，如 `plugin/admin/app/model`
- 同时使用 `--plugin` 与 `--path` 时，两者必须指向同一目录

**示例：**
```bash
# 在 app/model 中创建 User 模型
php webman make:model User

# 指定表名和 ORM
php webman make:model User -t wa_users -o laravel

# 在插件中创建
php webman make:model AdminUser -p admin

# 自定义路径
php webman make:model User -P plugin/admin/app/model
```

**交互模式：** 不传名称时进入交互流程：选表 → 输入模型名 → 输入路径。支持：回车查看更多、`0` 创建空模型、`/关键字` 过滤表。

**生成的文件结构：**
```php
<?php
namespace app\model;

use support\Model;

/**
 * @property integer $id (主键)
 * @property string $name
 */
class User extends Model
{
    protected $connection = 'mysql';
    protected $table = 'users';
    protected $primaryKey = 'id';
    public $timestamps = true;
}
```

根据表结构自动生成 `@property` 注释。支持 MySQL、PostgreSQL。

<a name="make-crud"></a>
### make:crud

根据数据库表一次性生成模型、控制器和验证器，形成完整 CRUD 能力。

**用法：**
```bash
php webman make:crud
```

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--table` | `-t` | 指定表名 |
| `--model` | `-m` | 模型类名 |
| `--model-path` | `-M` | 模型目录（相对项目根） |
| `--controller` | `-c` | 控制器类名 |
| `--controller-path` | `-C` | 控制器目录 |
| `--validator` | | 验证器类名(依赖`webman/validation`) |
| `--validator-path` | | 验证器目录(依赖`webman/validation`) |
| `--plugin` | `-p` | 在对应插件目录生成相关文件 |
| `--orm` | `-o` | ORM：`laravel` 或 `thinkorm` |
| `--database` | `-d` | 数据库连接名 |
| `--force` | `-f` | 覆盖已存在文件 |
| `--no-validator` | | 不生成验证器 |
| `--no-interaction` | `-n` | 非交互模式，使用默认值 |

**执行流程：** 未指定 `--table` 时进入交互选表；模型名默认由表名推断；控制器名默认由模型名 + 控制器后缀；验证器名默认由控制器名去掉后缀 + `Validator`。各路径默认：模型 `app/model/`，控制器 `app/controller/`，验证器 `app/validation/`；插件下为 `plugin/<插件>/app/` 对应子目录。

**示例：**
```bash
# 交互式生成（选表后逐步确认）
php webman make:crud

# 指定表名
php webman make:crud --table=users

# 指定表名和插件
php webman make:crud --table=users --plugin=admin

# 指定各路径
php webman make:crud --table=users --model-path=app/model --controller-path=app/controller

# 不生成验证器
php webman make:crud --table=users --no-validator

# 非交互 + 覆盖
php webman make:crud --table=users --no-interaction --force
```

**生成的文件结构：**

模型（`app/model/User.php`）：
```php
<?php

namespace app\model;

use support\Model;

class User extends Model
{
    protected $connection = 'mysql';
    protected $table = 'users';
    protected $primaryKey = 'id';
}
```

控制器（`app/controller/UserController.php`）：
```php
<?php

namespace app\controller;

use support\Request;
use support\Response;
use app\model\User;
use app\validation\UserValidator;
use support\validation\annotation\Validate;

class UserController
{
    #[Validate(validator: UserValidator::class, scene: 'create', in: ['body'])]
    public function create(Request $request): Response
    {
        $data = $request->post();
        $model = new User();
        foreach ($data as $key => $value) {
            $model->setAttribute($key, $value);
        }
        $model->save();
        return json(['code' => 0, 'msg' => 'ok', 'data' => $model]);
    }

    #[Validate(validator: UserValidator::class, scene: 'update', in: ['body'])]
    public function update(Request $request): Response
    {
        if (!$model = User::find($request->post('id'))) {
            return json(['code' => 1, 'msg' => 'not found']);
        }
        $data = $request->post();
        unset($data['id']);
        foreach ($data as $key => $value) {
            $model->setAttribute($key, $value);
        }
        $model->save();
        return json(['code' => 0, 'msg' => 'ok', 'data' => $model]);
    }

    #[Validate(validator: UserValidator::class, scene: 'delete', in: ['body'])]
    public function delete(Request $request): Response
    {
        if (!$model = User::find($request->post('id'))) {
            return json(['code' => 1, 'msg' => 'not found']);
        }
        $model->delete();
        return json(['code' => 0, 'msg' => 'ok']);
    }

    #[Validate(validator: UserValidator::class, scene: 'detail')]
    public function detail(Request $request): Response
    {
        if (!$model = User::find($request->input('id'))) {
            return json(['code' => 1, 'msg' => 'not found']);
        }
        return json(['code' => 0, 'msg' => 'ok', 'data' => $model]);
    }
}
```

验证器（`app/validation/UserValidator.php`）：
```php
<?php
declare(strict_types=1);

namespace app\validation;

use support\validation\Validator;

class UserValidator extends Validator
{
    protected array $rules = [
        'id' => 'required|integer|min:0',
        'username' => 'required|string|max:32'
    ];

    protected array $messages = [];

    protected array $attributes = [
        'id' => '主键',
        'username' => '用户名'
    ];

    protected array $scenes = [
        'create' => ['username', 'nickname'],
        'update' => ['id', 'username'],
        'delete' => ['id'],
        'detail' => ['id'],
    ];
}
```

**说明：**
- 如果没安装或没启用`webman/validation`则自动跳过验证器生成（安装方法`composer require webman/validation`）。
- 验证器的 `attributes` 根据数据库字段注释自动生成，无注释则不生成`attributes`。
- 验证器错误信息支持多语言，语言根据 `config('translation.locale')` 自动选择。

<a name="make-middleware"></a>
### make:middleware

生成中间件类，并自动注册到 `config/middleware.php`（插件则为 `plugin/<插件>/config/middleware.php`）。

**用法：**
```bash
php webman make:middleware <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 中间件名称 |

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--plugin` | `-p` | 在对应插件目录生成中间件 |
| `--path` | `-P` | 目标目录（相对项目根路径） |
| `--force` | `-f` | 覆盖已存在文件 |

**示例：**
```bash
# 在 app/middleware 中创建 Auth 中间件
php webman make:middleware Auth

# 在插件中创建
php webman make:middleware Auth -p admin

# 自定义路径
php webman make:middleware Auth -P plugin/admin/app/middleware

```

**生成的文件结构：**
```php
<?php
namespace app\middleware;

use Webman\MiddlewareInterface;
use Webman\Http\Response;
use Webman\Http\Request;

class Auth implements MiddlewareInterface
{
    public function process(Request $request, callable $handler) : Response
    {
        return $handler($request);
    }
}
```

**说明：**
- 默认放在 `app/middleware/` 目录
- 创建后会自动将类名追加到对应 middleware 配置文件中自动启用

<a name="make-command"></a>
### make:command

生成控制台命令类。

**用法：**
```bash
php webman make:command <命令名>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `命令名` | 是 | 命令名称，格式如 `group:action`（如 `user:list`） |

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--plugin` | `-p` | 在对应插件目录生成命令 |
| `--path` | `-P` | 目标目录（相对项目根路径） |
| `--force` | `-f` | 覆盖已存在文件 |

**示例：**
```bash
# 在 app/command 中创建 user:list 命令
php webman make:command user:list

# 在插件中创建
php webman make:command user:list -p admin

# 自定义路径
php webman make:command user:list -P plugin/admin/app/command

# 覆盖现有文件
php webman make:command user:list -f
```

**生成的文件结构：**
```php
<?php

namespace app\command;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand('user:list', 'user list')]
class UserList extends Command
{
    protected function configure(): void
    {
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $output->writeln('<info>Hello</info> <comment>' . $this->getName() . '</comment>');
        return self::SUCCESS;
    }
}
```

**说明：**
- 默认放在 `app/command/` 目录

<a name="make-bootstrap"></a>
### make:bootstrap

生成启动初始化类（Bootstrap），进程启动时会自动调用类的start方法，一般用于在进程启动时做一些全局初始化操作。

**用法：**
```bash
php webman make:bootstrap <名称> 
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | Bootstrap 类名 |

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--plugin` | `-p` | 在对应插件目录生成 |
| `--path` | `-P` | 目标目录（相对项目根路径） |
| `--force` | `-f` | 覆盖已存在文件 |

**示例：**
```bash
# 在 app/bootstrap 中创建 MyBootstrap
php webman make:bootstrap MyBootstrap

# 创建但不自动启用
php webman make:bootstrap MyBootstrap no

# 在插件中创建
php webman make:bootstrap MyBootstrap -p admin

# 自定义路径
php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap

# 覆盖现有文件
php webman make:bootstrap MyBootstrap -f
```

**生成的文件结构：**
```php
<?php

namespace app\bootstrap;

use Webman\Bootstrap;

class MyBootstrap implements Bootstrap
{
    public static function start($worker)
    {
        $is_console = !$worker;
        if ($is_console) {
            return;
        }
        // ...
    }
}
```

**说明：**
- 默认放在 `app/bootstrap/` 目录
- 启用时会将类追加到 `config/bootstrap.php`（插件为 `plugin/<插件>/config/bootstrap.php`）

<a name="make-process"></a>
### make:process

生成自定义进程类，并写入 `config/process.php` 配置自动启动。

**用法：**
```bash
php webman make:process <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 进程类名（如 MyTcp、MyWebsocket） |

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--plugin` | `-p` | 在对应插件目录生成 |
| `--path` | `-P` | 目标目录（相对项目根路径） |
| `--force` | `-f` | 覆盖已存在文件 |

**示例：**
```bash
# 在 app/process 中创建
php webman make:process MyTcp

# 在插件中创建
php webman make:process MyProcess -p admin

# 自定义路径
php webman make:process MyProcess -P plugin/admin/app/process

# 覆盖现有文件
php webman make:process MyProcess -f
```

**交互流程：** 执行后会依次询问：是否监听端口 → 协议类型（websocket/http/tcp/udp/unixsocket）→ 监听地址（IP+端口或 unix socket 路径）→ 进程数量。HTTP 协议还会询问使用内置模式或自定义模式。

**生成的文件结构：**

非监听进程（仅 `onWorkerStart`）：
```php
<?php
namespace app\process;

use Workerman\Worker;

class MyProcess
{
    public function onWorkerStart(Worker $worker)
    {
        // TODO: Write your business logic here.
    }
}
```

TCP/WebSocket 等监听进程会生成对应的 `onConnect`、`onMessage`、`onClose` 等回调模板。

**说明：**
- 默认放在 `app/process/` 目录，进程配置写入 `config/process.php`
- 配置键为类名的 snake_case，若已存在则失败
- HTTP 内置模式复用 `app\process\Http`进程文件，不生成新文件
- 支持协议：websocket、http、tcp、udp、unixsocket

## 构建和部署

<a name="build-phar"></a>
### build:phar

将项目打包为 PHAR 归档文件，便于分发和部署。

**用法：**
```bash
php webman build:phar
```

**启动：**

进入build目录运行

```bash
php webman.phar start
```

**注意事项**
* 打包后的项目不支持reload，更新代码需要restart重启

* 为了避免打包文件尺寸过大占用过多内存，可以设置 config/plugin/webman/console/app.php里的exclude_pattern exclude_files选项将排除不必要的文件。

* 运行webman.phar后会在webman.phar所在目录生成runtime目录，用于存放日志等临时文件。

* 如果你的项目里使用了.env文件，需要将.env文件放在webman.phar所在目录。

* 注意webman.phar不支持在windows下开启自定义进程

* 切勿将用户上传的文件存储在phar包中，因为以phar://协议操作用户上传的文件是非常危险的(phar反序列化漏洞)。用户上传的文件必须单独存储在phar包之外的磁盘中，参见下面。

* 如果你的业务需要上传文件到public目录，需要将public目录独立出来放在webman.phar所在目录，这时候需要配置config/app.php。
```php
'public_path' => base_path(false) . DIRECTORY_SEPARATOR . 'public',
```
业务可以使用助手函数public_path($文件相对位置)找到实际的public目录位置。


<a name="build-bin"></a>
### build:bin

将项目打包为独立二进制文件，内含 PHP 运行时，无需目标环境安装 PHP。

**用法：**
```bash
php webman build:bin [版本]
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `版本` | 否 | PHP 版本号（如 8.1、8.2），默认当前 PHP 版本，最低 8.1 |

**示例：**
```bash
# 使用当前 PHP 版本
php webman build:bin

# 指定 PHP 8.2
php webman build:bin 8.2
```

**启动：**

进入build目录运行

```bash
./webman.bin start
```

**注意事项：**
* 强烈建议本地php版本和打包版本一致，例如本地是php8.1，打包也用php8.1，避免出现兼容问题
* 打包会下载php8的源码，但是并不会本地安装，不会影响本地php环境
* webman.bin目前只支持在x86_64架构的linux系统运行，不支持在mac系统运行
* 打包后的项目不支持reload，更新代码需要restart重启
* 默认不打包env文件(config/plugin/webman/console/app.php中exclude_files控制)，所以启动时env文件应该放置与webman.bin相同目录下
* 运行过程中会在webman.bin所在目录生成runtime目录，用于存放日志文件
* 目前webman.bin不会读取外部php.ini文件，如需要自定义php.ini，请在 /config/plugin/webman/console/app.php 文件custom_ini中设置
* 有些文件不需要打包，可以设置config/plugin/webman/console/app.php排除掉，避免打包后的文件过大
* 二进制打包不支持使用swoole协程
* 切勿将用户上传的文件存储在二进制包中，因为以phar://协议操作用户上传的文件是非常危险的(phar反序列化漏洞)。用户上传的文件必须单独存储在包之外的磁盘中。
* 如果你的业务需要上传文件到public目录，需要将public目录独立出来放在webman.bin所在目录，这时候需要配置config/app.php如下并重新打包。
```php
'public_path' => base_path(false) . DIRECTORY_SEPARATOR . 'public',
```

<a name="install"></a>
### install

执行 Webman 框架的安装脚本（调用 `\Webman\Install::install()`），用于项目初始化。

**用法：**
```bash
php webman install
```

## 实用工具命令

<a name="version"></a>
### version

显示 workerman/webman-framework 版本。

**用法：**
```bash
php webman version
```

**说明：** 从 `vendor/composer/installed.php` 读取版本，若无法读取则返回失败。

<a name="fix-disable-functions"></a>
### fix-disable-functions

修复 php.ini 中的 `disable_functions`，移除 Webman 运行所需函数。

**用法：**
```bash
php webman fix-disable-functions
```

**说明：** 会从 `disable_functions` 中移除以下函数（及其前缀匹配）：`stream_socket_server`、`stream_socket_accept`、`stream_socket_client`、`pcntl_*`、`posix_*`、`proc_*`、`shell_exec`、`exec`。若找不到 php.ini 或 `disable_functions` 为空则跳过。**会直接修改 php.ini 文件**，建议先备份。

<a name="route-list"></a>
### route:list

以表格形式列出所有已注册路由。

**用法：**
```bash
php webman route:list
```

**输出示例：**
```
+-------+--------+-----------------------------------------------+------------+------+
| URI   | 方法   | 回调                                          | 中间件     | 名称 |
+-------+--------+-----------------------------------------------+------------+------+
| /user | GET    | ["app\\controller\\UserController","index"] | null       |      |
| /api  | POST   | 闭包                                          | ["Auth"]   | api  |
+-------+--------+-----------------------------------------------+------------+------+
```

**输出列：** URI、方法、回调、中间件、名称。闭包回调显示为「闭包」。

## 应用插件管理 (app-plugin:*)

<a name="app-plugin-create"></a>
### app-plugin:create

创建新应用插件，生成 `plugin/<名称>` 下的完整目录结构和基础文件。

**用法：**
```bash
php webman app-plugin:create <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 插件名称，需符合 `[a-zA-Z0-9][a-zA-Z0-9_-]*`，不能含 `/` 或 `\` |

**示例：**
```bash
# 创建名为 foo 的应用插件
php webman app-plugin:create foo

# 创建带连字符的插件
php webman app-plugin:create my-app
```

**生成目录结构：**
```
plugin/<名称>/
├── app/
│   ├── controller/IndexController.php
│   ├── model/
│   ├── middleware/
│   ├── view/index/index.html
│   └── functions.php
├── config/          # app.php、route.php、menu.php 等
├── api/Install.php  # 安装/卸载/更新钩子
├── public/
└── install.sql
```

**说明：**
- 插件创建在 `plugin/<名称>/` 下，若目录已存在则失败

<a name="app-plugin-install"></a>
### app-plugin:install

安装应用插件，执行 `plugin/<名称>/api/Install::install($version)`。

**用法：**
```bash
php webman app-plugin:install <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 插件名称，需符合 `[a-zA-Z0-9][a-zA-Z0-9_-]*` |

**示例：**
```bash
php webman app-plugin:install foo
```

<a name="app-plugin-uninstall"></a>
### app-plugin:uninstall

卸载应用插件，执行 `plugin/<名称>/api/Install::uninstall($version)`。

**用法：**
```bash
php webman app-plugin:uninstall <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 插件名称 |

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--yes` | `-y` | 跳过确认，直接执行 |

**示例：**
```bash
php webman app-plugin:uninstall foo
php webman app-plugin:uninstall foo -y
```

<a name="app-plugin-update"></a>
### app-plugin:update

更新应用插件，依次执行 `Install::beforeUpdate($from, $to)` 和 `Install::update($from, $to, $context)`。

**用法：**
```bash
php webman app-plugin:update <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 插件名称 |

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--from` | `-f` | 起始版本，默认当前版本 |
| `--to` | `-t` | 目标版本，默认当前版本 |

**示例：**
```bash
php webman app-plugin:update foo
php webman app-plugin:update foo --from 1.0.0 --to 1.1.0
```

<a name="app-plugin-zip"></a>
### app-plugin:zip

将应用插件打包为 ZIP 文件，输出到 `plugin/<名称>.zip`。

**用法：**
```bash
php webman app-plugin:zip <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 插件名称 |

**示例：**
```bash
php webman app-plugin:zip foo
```

**说明：**
- 自动排除 `node_modules`、`.git`、`.idea`、`.vscode`、`__pycache__` 等目录

## 插件管理 (plugin:*)

<a name="plugin-create"></a>
### plugin:create

创建新 Webman 插件（Composer 包形式），生成 `config/plugin/<名称>` 配置目录和 `vendor/<名称>` 插件源码目录。

**用法：**
```bash
php webman plugin:create <名称>
php webman plugin:create --name <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 插件包名，格式为 `vendor/package`（如 `foo/my-admin`），需符合 Composer 包名规范 |

**示例：**
```bash
php webman plugin:create foo/my-admin
php webman plugin:create --name foo/my-admin
```

**生成结构：**
- `config/plugin/<名称>/app.php`：插件配置（含 `enable` 开关）
- `vendor/<名称>/composer.json`：插件包定义
- `vendor/<名称>/src/`：插件源码目录
- 自动向项目根 `composer.json` 添加 PSR-4 映射
- 执行 `composer dumpautoload` 刷新自动加载

**说明：**
- 名称必须为 `vendor/package` 格式，仅小写字母、数字、`-`、`_`、`.`，且必须包含一个 `/`
- 若 `config/plugin/<名称>` 或 `vendor/<名称>` 已存在则失败
- 同时传入参数和 `--name` 且值不同时会报错

<a name="plugin-install"></a>
### plugin:install

执行插件的安装脚本（`Install::install()`），将插件资源复制到项目目录。

**用法：**
```bash
php webman plugin:install <名称>
php webman plugin:install --name <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 插件包名，格式为 `vendor/package`（如 `foo/my-admin`） |

**选项：**

| 选项 | 描述 |
|--------|-------------|
| `--name` | 以选项形式指定插件名，与参数二选一 |

**示例：**
```bash
php webman plugin:install foo/my-admin
php webman plugin:install --name foo/my-admin
```

<a name="plugin-uninstall"></a>
### plugin:uninstall

执行插件的卸载脚本（`Install::uninstall()`），移除插件复制到项目中的资源。

**用法：**
```bash
php webman plugin:uninstall <名称>
php webman plugin:uninstall --name <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 插件包名，格式为 `vendor/package` |

**选项：**

| 选项 | 描述 |
|--------|-------------|
| `--name` | 以选项形式指定插件名，与参数二选一 |

**示例：**
```bash
php webman plugin:uninstall foo/my-admin
```

<a name="plugin-enable"></a>
### plugin:enable

启用插件，将 `config/plugin/<名称>/app.php` 中的 `enable` 设为 `true`。

**用法：**
```bash
php webman plugin:enable <名称>
php webman plugin:enable --name <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 插件包名，格式为 `vendor/package` |

**选项：**

| 选项 | 描述 |
|--------|-------------|
| `--name` | 以选项形式指定插件名，与参数二选一 |

**示例：**
```bash
php webman plugin:enable foo/my-admin
```

<a name="plugin-disable"></a>
### plugin:disable

禁用插件，将 `config/plugin/<名称>/app.php` 中的 `enable` 设为 `false`。

**用法：**
```bash
php webman plugin:disable <名称>
php webman plugin:disable --name <名称>
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 插件包名，格式为 `vendor/package` |

**选项：**

| 选项 | 描述 |
|--------|-------------|
| `--name` | 以选项形式指定插件名，与参数二选一 |

**示例：**
```bash
php webman plugin:disable foo/my-admin
```

<a name="plugin-export"></a>
### plugin:export

将项目中的插件配置及指定目录导出到 `vendor/<名称>/src/`，并生成 `Install.php`，便于打包发布。

**用法：**
```bash
php webman plugin:export <名称> [--source=路径]...
php webman plugin:export --name <名称> [--source=路径]...
```

**参数：**

| 参数 | 必需 | 描述 |
|----------|----------|-------------|
| `名称` | 是 | 插件包名，格式为 `vendor/package` |

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--name` | | 以选项形式指定插件名，与参数二选一 |
| `--source` | `-s` | 要导出的路径（相对项目根），可多次指定 |

**示例：**
```bash
# 导出插件，默认包含 config/plugin/<名称>
php webman plugin:export foo/my-admin

# 额外导出 app、config 等目录
php webman plugin:export foo/my-admin --source app --source config
php webman plugin:export --name foo/my-admin -s app -s config
```

**说明：**
- 插件名需符合 Composer 包名规范（`vendor/package`）
- 若 `config/plugin/<名称>` 存在且未在 `--source` 中，会自动加入导出列表
- 导出的 `Install.php` 含 `pathRelation`，供 `plugin:install` / `plugin:uninstall` 使用
- `plugin:install`、`plugin:uninstall` 要求插件已存在于 `vendor/<名称>`，且存在 `Install` 类及 `WEBMAN_PLUGIN` 常量

## 服务管理

<a name="start"></a>
### start

启动 Webman 工作进程，默认 DEBUG 模式（前台运行）。

**用法：**
```bash
php webman start
```

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--daemon` | `-d` | 以 DAEMON 模式启动（后台运行） |

<a name="stop"></a>
### stop

停止 Webman 工作进程。

**用法：**
```bash
php webman stop
```

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--graceful` | `-g` | 平滑停止，等待当前请求处理完成后再退出 |

<a name="restart"></a>
### restart

重启 Webman 工作进程。

**用法：**
```bash
php webman restart
```

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--daemon` | `-d` | 重启后以 DAEMON 模式运行 |
| `--graceful` | `-g` | 平滑停止后再重启 |

<a name="reload"></a>
### reload

无停机重载代码，适用于代码更新后热加载。

**用法：**
```bash
php webman reload
```

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--graceful` | `-g` | 平滑重载，等待当前请求处理完成后再重载 |

<a name="status"></a>
### status

查看工作进程运行状态。

**用法：**
```bash
php webman status
```

**选项：**

| 选项 | 快捷方式 | 描述 |
|--------|----------|-------------|
| `--live` | `-d` | 显示详情（实时状态） |

<a name="connections"></a>
### connections

获取工作进程连接信息。

**用法：**
```bash
php webman connections
```

