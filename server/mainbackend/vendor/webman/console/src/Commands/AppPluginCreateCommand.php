<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Webman\Console\Commands\Concerns\AppPluginCommandHelpers;
use Webman\Console\Messages;
use Webman\Console\Util;

#[AsCommand('app-plugin:create', 'Create App Plugin')]
class AppPluginCreateCommand extends Command
{
    use AppPluginCommandHelpers;

    /**
     * @return void
     */
    protected function configure()
    {
        $this->addArgument('name', InputArgument::REQUIRED, $this->msg('description_name'));
        $this->setHelp($this->buildHelpText());
    }

    protected function buildHelpText(): string
    {
        return Util::selectByLocale(Messages::getAppPluginCreateHelpText());
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $name = $this->normalizeAppPluginName($input->getArgument('name'));
        $this->writeln($output, $this->msg('create_title', ['{name}' => $name]));

        if (!$this->isValidAppPluginName($name)) {
            $this->writeln($output, $this->msg('bad_name', ['{name}' => $name]));
            return Command::FAILURE;
        }

        $pluginBase = $this->appPluginBasePath($name);
        if (is_dir($pluginBase)) {
            $this->writeln($output, $this->msg('dir_exists', ['{path}' => $this->toRelativePath($pluginBase)]));
            return Command::FAILURE;
        }

        try {
            $this->createAll($name, $output);
        } catch (\Throwable $e) {
            $this->writeln($output, $this->msg('failed', ['{error}' => $e->getMessage()]));
            return Command::FAILURE;
        }

        $this->writeln($output, $this->msg('done'));
        return Command::SUCCESS;
    }

    /**
     * @param $name
     * @param OutputInterface $output
     * @return void
     */
    protected function createAll($name, OutputInterface $output): void
    {
        $base = $this->appPluginBasePath($name);

        $this->mkdir($base . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'controller', 0777, true, $output);
        $this->mkdir($base . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'model', 0777, true, $output);
        $this->mkdir($base . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'middleware', 0777, true, $output);
        $this->mkdir($base . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'view' . DIRECTORY_SEPARATOR . 'index', 0777, true, $output);
        $this->mkdir($base . DIRECTORY_SEPARATOR . 'config', 0777, true, $output);
        $this->mkdir($base . DIRECTORY_SEPARATOR . 'public', 0777, true, $output);
        $this->mkdir($base . DIRECTORY_SEPARATOR . 'api', 0777, true, $output);

        $this->createFunctionsFile($base . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'functions.php', $output);
        $this->createControllerFile($base . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'controller' . DIRECTORY_SEPARATOR . 'IndexController.php', $name, $output);
        $this->createViewFile($base . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'view' . DIRECTORY_SEPARATOR . 'index' . DIRECTORY_SEPARATOR . 'index.html', $output);
        $this->createConfigFiles($base . DIRECTORY_SEPARATOR . 'config', $name, $output);
        $this->createApiFiles($base . DIRECTORY_SEPARATOR . 'api', $name, $output);
        $this->createInstallSqlFile($base . DIRECTORY_SEPARATOR . 'install.sql', $output);
    }

    /**
     * @param $path
     * @param int $mode
     * @param bool $recursive
     * @param OutputInterface $output
     * @return void
     */
    protected function mkdir($path, int $mode, bool $recursive, OutputInterface $output): void
    {
        if (is_dir($path)) {
            return;
        }
        if (!mkdir($path, $mode, $recursive) && !is_dir($path)) {
            throw new \RuntimeException("Unable to create directory: $path");
        }
        $this->writeln($output, $this->msg('created_dir', ['{path}' => $this->toRelativePath($path)]));
    }

    /**
     * @param $path
     * @param $name
     * @param OutputInterface $output
     * @return void
     */
    protected function createControllerFile($path, $name, OutputInterface $output): void
    {
        $content = <<<EOF
<?php

namespace plugin\\$name\\app\\controller;

use support\\Request;

class IndexController
{

    public function index()
    {
        return view('index/index', ['name' => '$name']);
    }

}

EOF;
        $this->writeFile($path, $content, $output);

    }

    /**
     * @param $path
     * @param OutputInterface $output
     * @return void
     */
    protected function createViewFile($path, OutputInterface $output): void
    {
        $content = <<<EOF
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/favicon.ico"/>
    <title>webman app plugin</title>

</head>
<body>
hello <?=htmlspecialchars(\$name)?>
</body>
</html>


EOF;
        $this->writeFile($path, $content, $output);

    }


    /**
     * @param $file
     * @param OutputInterface $output
     * @return void
     */
    protected function createFunctionsFile($file, OutputInterface $output): void
    {
        $content = <<<EOF
<?php
/**
 * Here is your custom functions.
 */



EOF;
        $this->writeFile($file, $content, $output);
    }

    /**
     * @param $base
     * @param $name
     * @param OutputInterface $output
     * @return void
     */
    protected function createApiFiles($base, $name, OutputInterface $output): void
    {
        $content = <<<EOF
<?php

namespace plugin\\$name\\api;

use plugin\admin\api\Menu;
use support\Db;
use Throwable;

class Install
{

    /**
     * 数据库连接
     */
    protected static \$connection = 'plugin.admin.mysql';
    
    /**
     * 安装
     *
     * @param \$version
     * @return void
     */
    public static function install(\$version)
    {
        // 安装数据库
        static::installSql();
        // 导入菜单
        if(\$menus = static::getMenus()) {
            Menu::import(\$menus);
        }
    }

    /**
     * 卸载
     *
     * @param \$version
     * @return void
     */
    public static function uninstall(\$version)
    {
        // 删除菜单
        foreach (static::getMenus() as \$menu) {
            Menu::delete(\$menu['key']);
        }
        // 卸载数据库
        static::uninstallSql();
    }

    /**
     * 更新
     *
     * @param \$from_version
     * @param \$to_version
     * @param \$context
     * @return void
     */
    public static function update(\$from_version, \$to_version, \$context = null)
    {
        // 删除不用的菜单
        if (isset(\$context['previous_menus'])) {
            static::removeUnnecessaryMenus(\$context['previous_menus']);
        }
        // 安装数据库
        static::installSql();
        // 导入新菜单
        if (\$menus = static::getMenus()) {
            Menu::import(\$menus);
        }
        // 执行更新操作
        \$update_file = __DIR__ . '/../update.php';
        if (is_file(\$update_file)) {
            include \$update_file;
        }
    }

    /**
     * 更新前数据收集等
     *
     * @param \$from_version
     * @param \$to_version
     * @return array|array[]
     */
    public static function beforeUpdate(\$from_version, \$to_version)
    {
        // 在更新之前获得老菜单，通过context传递给 update
        return ['previous_menus' => static::getMenus()];
    }

    /**
     * 获取菜单
     *
     * @return array|mixed
     */
    public static function getMenus()
    {
        clearstatcache();
        if (is_file(\$menu_file = __DIR__ . '/../config/menu.php')) {
            \$menus = include \$menu_file;
            return \$menus ?: [];
        }
        return [];
    }

    /**
     * 删除不需要的菜单
     *
     * @param \$previous_menus
     * @return void
     */
    public static function removeUnnecessaryMenus(\$previous_menus)
    {
        \$menus_to_remove = array_diff(Menu::column(\$previous_menus, 'name'), Menu::column(static::getMenus(), 'name'));
        foreach (\$menus_to_remove as \$name) {
            Menu::delete(\$name);
        }
    }
    
    /**
     * 安装SQL
     *
     * @return void
     */
    protected static function installSql()
    {
        static::importSql(__DIR__ . '/../install.sql');
    }
    
    /**
     * 卸载SQL
     *
     * @return void
     */
    protected static function uninstallSql() {
        // 如果卸载数据库文件存在责直接使用
        \$uninstallSqlFile = __DIR__ . '/../uninstall.sql';
        if (is_file(\$uninstallSqlFile)) {
            static::importSql(\$uninstallSqlFile);
            return;
        }
        // 否则根据install.sql生成卸载数据库文件uninstall.sql
        \$installSqlFile = __DIR__ . '/../install.sql';
        if (!is_file(\$installSqlFile)) {
            return;
        }
        \$installSql = file_get_contents(\$installSqlFile);
        preg_match_all('/CREATE TABLE `(.+?)`/si', \$installSql, \$matches);
        \$dropSql = '';
        foreach (\$matches[1] as \$table) {
            \$dropSql .= "DROP TABLE IF EXISTS `\$table`;\\n";
        }
        file_put_contents(\$uninstallSqlFile, \$dropSql);
        static::importSql(\$uninstallSqlFile);
        unlink(\$uninstallSqlFile);
    }
    
    /**
     * 导入数据库
     *
     * @return void
     */
    public static function importSql(\$mysqlDumpFile)
    {
        if (!\$mysqlDumpFile || !is_file(\$mysqlDumpFile)) {
            return;
        }
        foreach (explode(';', file_get_contents(\$mysqlDumpFile)) as \$sql) {
            if (\$sql = trim(\$sql)) {
                try {
                    Db::connection(static::\$connection)->statement(\$sql);
                } catch (Throwable \$e) {}
            }
        }
    }

}
EOF;

        $this->writeFile($base . DIRECTORY_SEPARATOR . 'Install.php', $content, $output);

    }

    /**
     * @param string $file
     * @param OutputInterface $output
     * @return void
     */
    protected function createInstallSqlFile($file, OutputInterface $output): void
    {
        $this->writeFile($file, '', $output);
    }

    /**
     * @param $base
     * @param $name
     * @param OutputInterface $output
     * @return void
     */
    protected function createConfigFiles($base, $name, OutputInterface $output): void
    {
        // app.php
        $content = <<<EOF
<?php

use support\\Request;

return [
    'debug' => true,
    'controller_suffix' => 'Controller',
    'controller_reuse' => false,
    'version' => '1.0.0'
];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'app.php', $content, $output);

        // menu.php
        $content = <<<EOF
<?php

return [];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'menu.php', $content, $output);

        // autoload.php
        $content = <<<EOF
<?php
return [
    'files' => [
        base_path() . '/plugin/$name/app/functions.php',
    ]
];
EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'autoload.php', $content, $output);

        // container.php
        $content = <<<EOF
<?php
return new Webman\\Container;

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'container.php', $content, $output);


        // database.php
        $content = <<<EOF
<?php
return  [];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'database.php', $content, $output);

        // exception.php
        $content = <<<EOF
<?php

return [
    '' => support\\exception\\Handler::class,
];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'exception.php', $content, $output);

        // log.php
        $content = <<<EOF
<?php

return [
    'default' => [
        'handlers' => [
            [
                'class' => Monolog\\Handler\\RotatingFileHandler::class,
                'constructor' => [
                    runtime_path() . '/logs/$name.log',
                    7,
                    Monolog\\Logger::DEBUG,
                ],
                'formatter' => [
                    'class' => Monolog\\Formatter\\LineFormatter::class,
                    'constructor' => [null, 'Y-m-d H:i:s', true],
                ],
            ]
        ],
    ],
];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'log.php', $content, $output);

        // middleware.php
        $content = <<<EOF
<?php

return [
    '' => [
        
    ]
];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'middleware.php', $content, $output);

        // process.php
        $content = <<<EOF
<?php
return [];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'process.php', $content, $output);

        // redis.php
        $content = <<<EOF
<?php
return [
    'default' => [
        'host' => '127.0.0.1',
        'password' => null,
        'port' => 6379,
        'database' => 0,
    ],
];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'redis.php', $content, $output);

        // route.php
        $content = <<<EOF
<?php

use Webman\\Route;


EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'route.php', $content, $output);

        // static.php
        $content = <<<EOF
<?php

return [
    'enable' => true,
    'middleware' => [],    // Static file Middleware
];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'static.php', $content, $output);

        // translation.php
        $content = <<<EOF
<?php

return [
    // Default language
    'locale' => 'zh_CN',
    // Fallback language
    'fallback_locale' => ['zh_CN', 'en'],
    // Folder where language files are stored
    'path' => base_path() . "/plugin/$name/resource/translations",
];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'translation.php', $content, $output);

        // view.php
        $content = <<<EOF
<?php

use support\\view\\Raw;
use support\\view\\Twig;
use support\\view\\Blade;
use support\\view\\ThinkPHP;

return [
    'handler' => Raw::class
];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'view.php', $content, $output);

        // thinkorm.php
        $content = <<<EOF
<?php

return [];

EOF;
        $this->writeFile($base . DIRECTORY_SEPARATOR . 'thinkorm.php', $content, $output);

    }

    /**
     * @param string $file
     * @param string $content
     * @param OutputInterface $output
     * @return void
     */
    protected function writeFile(string $file, string $content, OutputInterface $output): void
    {
        $dir = pathinfo($file, PATHINFO_DIRNAME);
        if (!is_dir($dir)) {
            if (!mkdir($dir, 0777, true) && !is_dir($dir)) {
                throw new \RuntimeException("Unable to create directory: $dir");
            }
        }
        if (file_put_contents($file, $content) === false) {
            throw new \RuntimeException("Unable to write file: $file");
        }
        $this->writeln($output, $this->msg('created_file', ['{path}' => $this->toRelativePath($file)]));
    }

}
