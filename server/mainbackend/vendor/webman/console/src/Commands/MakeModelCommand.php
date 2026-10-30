<?php

namespace Webman\Console\Commands;

use Doctrine\Inflector\InflectorFactory;
use support\Db;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Question\ConfirmationQuestion;
use Symfony\Component\Console\Question\Question;
use Webman\Console\OrmType;
use Webman\Console\Util;
use Webman\Console\Commands\Concerns\MakeCommandHelpers;
use Webman\Console\Commands\Concerns\OrmTableCommandHelpers;
use Webman\Console\Messages;

#[AsCommand('make:model', 'Make model')]
class MakeModelCommand extends Command
{
    use MakeCommandHelpers;
    use OrmTableCommandHelpers;

    /**
     * @return void
     */
    protected function configure()
    {
        /**
         * Usage quick notes:
         * - Prefer explicit `--table/-t` when table name does not follow conventions.
         * - Interactive table picker is available only when terminal supports input; press Enter for more, 0 for empty model, /keyword to filter.
         *
         * 常用提示：
         * - 表名不符合约定时建议显式使用 `--table/-t`。
         * - 交互式选表仅在支持输入的终端下启用：回车=更多，0=空模型，/关键字=过滤。
         */
        $this->addArgument('name', InputArgument::OPTIONAL, 'Model name (optional in interactive mode)');
        $this->addOption('plugin', 'p', InputOption::VALUE_REQUIRED, 'Plugin name under plugin/. e.g. admin');
        $this->addOption('path', 'P', InputOption::VALUE_REQUIRED, 'Target directory (relative to base path). e.g. plugin/admin/app/model');
        $this->addOption('table', 't', InputOption::VALUE_REQUIRED, 'Specify table name. e.g. wa_users');
        $this->addOption('orm', 'o', InputOption::VALUE_REQUIRED, 'Select orm: laravel|thinkorm');
        $this->addOption('database', 'd', InputOption::VALUE_OPTIONAL, 'Select database connection.');
        $this->addOption('force', 'f', InputOption::VALUE_NONE, 'Override existing file without confirmation.');

        // Symfony Console built-in help:
        // - php webman make:model --help
        // - php webman help make:model
        $this->setHelp($this->buildHelpText());

        // Display examples in synopsis (shown in --help).
        $this->addUsage('');
        $this->addUsage('User');
        $this->addUsage('User -p admin');
        $this->addUsage('User -P plugin/admin/app/model');
        $this->addUsage('User -t wa_users -o laravel');
        $this->addUsage('User -t=wa_users -o=thinkorm -f');
        $this->addUsage('admin/User --table=wa_admin_users --orm=laravel --database=mysql');
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $nameArg = $this->normalizeOptionValue($input->getArgument('name'));
        $plugin = $this->normalizeOptionValue($input->getOption('plugin'));
        $pathOption = $this->normalizeOptionValue($input->getOption('path'));
        $orm = $this->normalizeOptionValue($input->getOption('orm'));
        $databaseOption = $this->normalizeOptionValue($input->getOption('database'));
        $connection = $databaseOption;
        $table = $this->normalizeOptionValue($input->getOption('table'));
        $force = (bool)$input->getOption('force');

        if ($plugin && (str_contains($plugin, '/') || str_contains($plugin, '\\'))) {
            $output->writeln($this->msg('invalid_plugin', ['{plugin}' => $plugin]));
            return Command::FAILURE;
        }
        if ($plugin && !$this->assertPluginExists($plugin, $output)) {
            return Command::FAILURE;
        }

        $type = $this->resolveOrm($orm);
        // Resolve & validate DB connection:
        // - When --plugin/-p is provided and --database/-d is provided, use the plugin's connection config.
        //   e.g. "-p admin -d mysql" => "plugin.admin.mysql"
        // - When no plugin is provided, validate that the given --database/-d exists.
        // - When --database/-d is omitted, prefer plugin default connection when plugin has DB config.
        [$ok, $connection] = $this->resolveAndValidateConnection($type, $plugin, $connection, $output);
        if (!$ok) {
            return Command::FAILURE;
        }

        // New interactive flow: when no model name is provided, go table -> name -> path.
        if (!$nameArg) {
            if (!$this->isTerminalInteractive($input)) {
                $output->writeln($this->msg('name_required_non_interactive'));
                return Command::FAILURE;
            }

            if (!$table) {
                $table = $this->promptForTable($input, $output, $type, $connection, 'Model', $plugin, $databaseOption) ?: null;
            }

            $nameDefault = $table ? $this->suggestModelNameFromTable($table, $type, $connection, $plugin, $databaseOption) : 'Model';
            $nameInput = $this->promptForModelNameWithDefault($input, $output, $nameDefault);
            if (!$nameInput) {
                $output->writeln($this->msg('invalid_name'));
                return Command::FAILURE;
            }
            $nameNormalized = $this->normalizeClassLikeName($nameInput);

            $defaultPath = $plugin ? Util::getDefaultAppRelativePath('model', $plugin) : Util::getDefaultAppRelativePath('model');
            $pathFinal = $pathOption;
            if (!$pathFinal) {
                $pathFinal = $this->promptForModelPathWithDefault($input, $output, $defaultPath);
            }
            $pathFinal = $this->normalizeRelativePath($pathFinal ?: $defaultPath);

            // Resolve namespace/file by --plugin/--path rules:
            // - If --path is explicitly provided, keep the strict plugin/path conflict check.
            // - If --path is not provided, allow user to override the default path even when --plugin is set.
            if ($plugin && $pathOption) {
                $resolved = $this->resolveModelTargetByPluginOrPath($nameNormalized, $plugin, $pathOption, $output);
            } else if ($plugin && !$pathOption) {
                $expected = $this->getPluginModelRelativePath($plugin);
                $resolved = $this->pathsEqual($expected, $pathFinal)
                    ? $this->resolveModelTargetByPluginOrPath($nameNormalized, $plugin, null, $output)
                    : $this->resolveModelTargetByPluginOrPath($nameNormalized, null, $pathFinal, $output);
            } else {
                $resolved = $this->resolveModelTargetByPluginOrPath($nameNormalized, null, $pathFinal, $output);
            }

            if ($resolved === null) {
                return Command::FAILURE;
            }
            [$name, $namespace, $file] = $resolved;
        } else {
            // Backward compatible behavior when model name is explicitly provided.
            $name = Util::nameToClass($nameArg);
            // Table selection before path selection.
            if ($nameArg && !$table) {
                $table = $this->promptForTableIfNeeded($input, $output, $type, $connection, $name, $plugin, $databaseOption) ?: null;
            }
            // When path is not provided and interactive: prompt for path after table.
            if (!$pathOption && $input->isInteractive()) {
                $pathDefault = $plugin ? Util::getDefaultAppRelativePath('model', $plugin) : Util::getDefaultAppRelativePath('model');
                $pathOption = $this->promptForModelPathWithDefault($input, $output, $pathDefault);
            }
            if ($plugin || $pathOption) {
                $resolved = $this->resolveModelTargetByPluginOrPath($name, $plugin, $pathOption, $output);
                if ($resolved === null) {
                    return Command::FAILURE;
                }
                [$name, $namespace, $file] = $resolved;
            } else {
                // Original behavior for app models (backward compatible)
                if (!($pos = strrpos($name, '/'))) {
                    $name = ucfirst($name);
                    $model_str = Util::getDefaultAppPath('model');
                    $file = app_path() . DIRECTORY_SEPARATOR .  $model_str . DIRECTORY_SEPARATOR . "$name.php";
                    $namespace = Util::pathToNamespace(Util::getDefaultAppRelativePath('model'));
                } else {
                    $name_str = substr($name, 0, $pos);
                    if ($real_name_str = Util::guessPath(app_path(), $name_str)) {
                        $name_str = $real_name_str;
                    } else if ($real_section_name = Util::guessPath(app_path(), strstr($name_str, '/', true))) {
                        $upper = strtolower($real_section_name[0]) !== $real_section_name[0];
                    } else {
                        $model_str_check = Util::getDefaultAppPath('model');
                        $upper = strtolower($model_str_check[0]) !== $model_str_check[0];
                    }
                    $upper = $upper ?? strtolower($name_str[0]) !== $name_str[0];
                    if ($upper && !$real_name_str) {
                        $name_str = preg_replace_callback('/\/([a-z])/', function ($matches) {
                            return '/' . strtoupper($matches[1]);
                        }, ucfirst($name_str));
                    }
                    $appDirName = Util::detectAppDirName();
                    $model_dir = Util::getDefaultAppPath('model');
                    $path_for_file = "$name_str/" . $model_dir;
                    $name = ucfirst(substr($name, $pos + 1));
                    $file = app_path() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path_for_file) . DIRECTORY_SEPARATOR . "$name.php";
                    $namespace = str_replace('/', '\\', $appDirName . '/' . $path_for_file);
                }
            }
        }

        $output->writeln($this->msg('make_model', ['{name}' => $name]));

        if (is_file($file) && !$force) {
            $relative = $this->toRelativePath($file);
            $prompt = $this->msg('override_prompt', ['{path}' => $relative]);
            $question = new ConfirmationQuestion($prompt, true);
            if (!$this->askOrAbort($input, $output, $question)) {
                return Command::SUCCESS;
            }
        }

        if ($type === OrmType::THINKORM) {
            $this->createTpModel($name, $namespace, $file, $connection, $table, $output);
        } else {
            $this->createModel($name, $namespace, $file, $connection, $table, $output);
        }

        $output->writeln($this->msg('created', ['{path}' => $this->toRelativePath($file)]));
        return self::SUCCESS;
    }

    /**
     * Prompt for model name with a default value.
     */
    protected function promptForModelNameWithDefault(InputInterface $input, OutputInterface $output, string $default): string
    {
        $default = $this->normalizeClassLikeName($default ?: 'Model');
        $question = new Question($this->msg('enter_model_name_prompt', ['{default}' => $default]), $default);
        $answer = $this->askOrAbort($input, $output, $question);
        $answer = is_string($answer) ? trim($answer) : '';
        $answer = $answer !== '' ? $answer : $default;
        return $this->normalizeClassLikeName($answer);
    }

    /**
     * Prompt for model path with a default value.
     */
    protected function promptForModelPathWithDefault(InputInterface $input, OutputInterface $output, string $default): string
    {
        $default = $this->normalizeRelativePath($default ?: 'app/model');
        $question = new Question($this->msg('enter_model_path_prompt', ['{default}' => $default]), $default);
        $answer = $this->askOrAbort($input, $output, $question);
        $answer = is_string($answer) ? trim($answer) : '';
        $answer = $answer !== '' ? $answer : $default;
        return $this->normalizeRelativePath($answer ?: $default);
    }

    /**
     * Normalize "class-like" names with optional sub paths, e.g.:
     * - "admin/user_profile" => "admin/UserProfile"
     * - "Admin\\User" => "admin/User"
     */
    protected function normalizeClassLikeName(string $name): string
    {
        $name = trim($name);
        if ($name === '') {
            return '';
        }
        $name = str_replace('\\', '/', $name);
        $name = trim($name, '/');
        $segments = array_values(array_filter(explode('/', $name), static fn(string $s): bool => $s !== ''));
        $segments = array_map(static fn(string $seg): string => Util::nameToClass($seg), $segments);
        return implode('/', $segments);
    }

    /**
     * Default app model relative path. Prefer existing "Model/model" directory.
     */
    protected function getAppModelRelativePath(): string
    {
        return Util::getDefaultAppRelativePath('model');
    }

    /**
     * @param $class
     * @param $namespace
     * @param $file
     * @param string|null $connection
     * @param string|null $table
     * @param OutputInterface|null $output
     * @return void
     */
    protected function createModel($class, $namespace, $file, $connection = null, $table = null, ?OutputInterface $output = null)
    {
        $path = pathinfo($file, PATHINFO_DIRNAME);
        if (!is_dir($path)) {
            mkdir($path, 0777, true);
        }
        $table_base = Util::classToName($class);
        $table_val = 'null';
        $meta_table = null;
        $pk = 'id';
        $properties = '';
        $connection = $connection ?: config('database.default');
        $timestamps = 'false';
        $hasCreatedAt = false;
        $hasUpdatedAt = false;
        $dbFailed = false;
        $dbFailed = false;
        try {
            $connectionConfig = $this->getLaravelConnectionConfig((string)$connection);
            $prefix = (string)($connectionConfig['prefix'] ?? '');
            $database = (string)($connectionConfig['database'] ?? '');
            $driver = (string)($connectionConfig['driver'] ?? 'mysql');
            $inflector = InflectorFactory::create()->build();
            $table_plura = $inflector->pluralize($inflector->tableize($class));
            $con = Db::connection($connection);

            // Table resolve
            if ($table) {
                $table = ltrim(trim((string)$table), '=');
                $table_for_model = ($prefix && str_starts_with($table, $prefix)) ? substr($table, strlen($prefix)) : $table;
                $table_val = "'" . $table_for_model . "'";
                $meta_table = $prefix . $table_for_model;
            } else {
                // 检查表是否存在（兼容MySQL和PostgreSQL）
                if ($driver === 'pgsql') {
                    $schema = (string)($connectionConfig['schema'] ?? 'public');
                    $exists_plura = $con->select("SELECT to_regclass('{$schema}.{$prefix}{$table_plura}') as table_exists");
                    $exists = $con->select("SELECT to_regclass('{$schema}.{$prefix}{$table_base}') as table_exists");

                    if (!empty($exists_plura[0]->table_exists)) {
                        $table_val = "'$table_plura'";
                        $meta_table = "{$prefix}{$table_plura}";
                    } else if (!empty($exists[0]->table_exists)) {
                        $table_val = "'$table_base'";
                        $meta_table = "{$prefix}{$table_base}";
                    }
                } else {
                    if ($con->select("show tables like '{$prefix}{$table_plura}'")) {
                        $table_val = "'$table_plura'";
                        $meta_table = "{$prefix}{$table_plura}";
                    } else if ($con->select("show tables like '{$prefix}{$table_base}'")) {
                        $table_val = "'$table_base'";
                        $meta_table = "{$prefix}{$table_base}";
                    }
                }
            }

            // 获取表注释和列信息（兼容MySQL和PostgreSQL）
            if ($meta_table) {
                if ($driver === 'pgsql') {
                    $schema = (string)($connectionConfig['schema'] ?? 'public');
                    $tableComment = $con->select("SELECT obj_description('{$schema}.{$meta_table}'::regclass) as table_comment");
                    if (!empty($tableComment) && !empty($tableComment[0]->table_comment)) {
                        $comments = $tableComment[0]->table_comment;
                        $properties .= " * {$meta_table} {$comments}" . PHP_EOL;
                    }

                    $columns = $con->select("
                        SELECT 
                            a.attname as column_name,
                            format_type(a.atttypid, a.atttypmod) as data_type,
                            CASE WHEN con.contype = 'p' THEN 'PRI' ELSE '' END as column_key,
                            d.description as column_comment
                        FROM pg_catalog.pg_attribute a
                        LEFT JOIN pg_catalog.pg_description d ON d.objoid = a.attrelid AND d.objsubid = a.attnum
                        LEFT JOIN pg_catalog.pg_constraint con ON con.conrelid = a.attrelid AND a.attnum = ANY(con.conkey) AND con.contype = 'p'
                        WHERE a.attrelid = '{$schema}.{$meta_table}'::regclass
                        AND a.attnum > 0 AND NOT a.attisdropped
                        ORDER BY a.attnum
                    ");

                    foreach ($columns as $item) {
                        if ($item->column_key === 'PRI') {
                            $pk = $item->column_name;
                            $item->column_comment = ($item->column_comment ? $item->column_comment . ' ' : '') . "(主键)";
                        }
                        $type = $this->getType($item->data_type);
                        if ($item->column_name === 'created_at') {
                            $hasCreatedAt = true;
                        }
                        if ($item->column_name === 'updated_at') {
                            $hasUpdatedAt = true;
                        }
                        $properties .= " * @property $type \${$item->column_name} " . ($item->column_comment ?? '') . "\n";
                    }

                } else {
                    $tableComment = $con->select('SELECT table_comment FROM information_schema.`TABLES` WHERE table_schema = ? AND table_name = ?', [$database, $meta_table]);
                    if (!empty($tableComment)) {
                        $comments = $tableComment[0]->table_comment ?? $tableComment[0]->TABLE_COMMENT;
                        $properties .= " * {$meta_table} {$comments}" . PHP_EOL;
                    }

                    foreach ($con->select("select COLUMN_NAME,DATA_TYPE,COLUMN_KEY,COLUMN_COMMENT from INFORMATION_SCHEMA.COLUMNS where table_name = '$meta_table' and table_schema = '$database' ORDER BY ordinal_position") as $item) {
                        if ($item->COLUMN_KEY === 'PRI') {
                            $pk = $item->COLUMN_NAME;
                            $item->COLUMN_COMMENT .= "(主键)";
                        }
                        $type = $this->getType($item->DATA_TYPE);
                        if ($item->COLUMN_NAME === 'created_at') {
                            $hasCreatedAt = true;
                        }
                        if ($item->COLUMN_NAME === 'updated_at') {
                            $hasUpdatedAt = true;
                        }
                        $properties .= " * @property $type \${$item->COLUMN_NAME} {$item->COLUMN_COMMENT}\n";
                    }
                }
            } else if ($table) {
                $output?->writeln($this->msg('table_not_found_schema', ['{table}' => (string)$table]));
            }
        } catch (\Throwable $e) {
            $dbFailed = true;
            $this->reportException($e, $output);
        }
        if (!$table && !$meta_table) {
            $output?->writeln($dbFailed ? $this->msg('table_not_found_empty_db_failed') : $this->msg('table_not_found_empty'));
        }
        $properties = rtrim($properties) ?: ' *';
        $timestamps = $hasCreatedAt && $hasUpdatedAt ? 'true' : 'false';
        $model_content = <<<EOF
<?php

namespace $namespace;

use support\Model;

/**
$properties
 */
class $class extends Model
{
    /**
     * The connection name for the model.
     *
     * @var string|null
     */
    protected \$connection = '$connection';
    
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected \$table = $table_val;

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected \$primaryKey = '$pk';

    /**
     * Indicates if the model should be timestamped.
     *
     * @var bool
     */
    public \$timestamps = $timestamps;
    
    
}

EOF;
        file_put_contents($file, $model_content);
    }


    /**
     * @param $class
     * @param $namespace
     * @param $file
     * @param string|null $connection
     * @param string|null $table
     * @param OutputInterface|null $output
     * @return void
     */
    protected function createTpModel($class, $namespace, $file, $connection = null, $table = null, ?OutputInterface $output = null)
    {
        $path = pathinfo($file, PATHINFO_DIRNAME);
        if (!is_dir($path)) {
            mkdir($path, 0777, true);
        }
        $table_base = Util::classToName($class);
        $is_thinkorm_v2 = class_exists(\support\think\Db::class);
        $table_val = 'null';
        $meta_table = null;
        $pk = 'id';
        $properties = '';
        try {
            $config_name = $is_thinkorm_v2 ? 'think-orm' : 'thinkorm';
            $connection = $connection ?: (config("$config_name.default") ?: 'mysql');
            $connectionConfig = $this->getThinkOrmConnectionConfig($config_name, (string)$connection);
            $prefix = (string)($connectionConfig['prefix'] ?? '');
            $database = (string)($connectionConfig['database'] ?? '');
            $driver = (string)($connectionConfig['type'] ?? 'mysql');
            $inflector = InflectorFactory::create()->build();
            $table_plural = $inflector->pluralize($inflector->tableize($class));

            if ($is_thinkorm_v2) {
                $con = \support\think\Db::connect($connection);
            } else {
                $con = \think\facade\Db::connect($connection);
            }

            // Table resolve (ThinkORM Model `$table` will be treated as an exact table name and will NOT apply prefix automatically)
            if ($table) {
                $table = ltrim(trim((string)$table), '=');
                if ($prefix && !str_starts_with($table, $prefix)) {
                    $table = $prefix . $table;
                }
                $table_val = "'" . $table . "'";
                $meta_table = $table;
            } else {
                // 检查表是否存在（兼容MySQL和PostgreSQL）
                if ($driver === 'pgsql') {
                    $schema = (string)($connectionConfig['schema'] ?? 'public');
                    $exists_plural = $con->query("SELECT to_regclass('{$schema}.{$prefix}{$table_plural}') as table_exists");
                    $exists = $con->query("SELECT to_regclass('{$schema}.{$prefix}{$table_base}') as table_exists");

                    if (!empty($exists_plural[0]['table_exists'])) {
                        $meta_table = "{$prefix}{$table_plural}";
                        $table_val = "'" . $meta_table . "'";
                    } else if (!empty($exists[0]['table_exists'])) {
                        $meta_table = "{$prefix}{$table_base}";
                        $table_val = "'" . $meta_table . "'";
                    }
                } else {
                    if ($con->query("show tables like '{$prefix}{$table_plural}'")) {
                        $meta_table = "{$prefix}{$table_plural}";
                        $table_val = "'" . $meta_table . "'";
                    } else if ($con->query("show tables like '{$prefix}{$table_base}'")) {
                        $meta_table = "{$prefix}{$table_base}";
                        $table_val = "'" . $meta_table . "'";
                    }
                }
            }

            // 获取表注释和列信息（兼容MySQL和PostgreSQL）
            if ($meta_table) {
                if ($driver === 'pgsql') {
                    $schema = (string)($connectionConfig['schema'] ?? 'public');
                    $tableComment = $con->query("SELECT obj_description('{$schema}.{$meta_table}'::regclass) as table_comment");
                    if (!empty($tableComment) && !empty($tableComment[0]['table_comment'])) {
                        $comments = $tableComment[0]['table_comment'];
                        $properties .= " * {$meta_table} {$comments}" . PHP_EOL;
                    }

                    $columns = $con->query("
                        SELECT 
                            a.attname as column_name,
                            format_type(a.atttypid, a.atttypmod) as data_type,
                            CASE WHEN con.contype = 'p' THEN 'PRI' ELSE '' END as column_key,
                            d.description as column_comment
                        FROM pg_catalog.pg_attribute a
                        LEFT JOIN pg_catalog.pg_description d ON d.objoid = a.attrelid AND d.objsubid = a.attnum
                        LEFT JOIN pg_catalog.pg_constraint con ON con.conrelid = a.attrelid AND a.attnum = ANY(con.conkey) AND con.contype = 'p'
                        WHERE a.attrelid = '{$schema}.{$meta_table}'::regclass
                        AND a.attnum > 0 AND NOT a.attisdropped
                        ORDER BY a.attnum
                    ");

                    foreach ($columns as $item) {
                        if ($item['column_key'] === 'PRI') {
                            $pk = $item['column_name'];
                            $item['column_comment'] = ($item['column_comment'] ? $item['column_comment'] . ' ' : '') . "(主键)";
                        }
                        $type = $this->getType($item['data_type']);
                        $properties .= " * @property $type \${$item['column_name']} " . ($item['column_comment'] ?? '') . "\n";
                    }
                } else {
                    $tableComment = $con->query('SELECT table_comment FROM information_schema.`TABLES` WHERE table_schema = ? AND table_name = ?', [$database, $meta_table]);
                    if (!empty($tableComment)) {
                        $comments = $tableComment[0]['table_comment'] ?? $tableComment[0]['TABLE_COMMENT'];
                        $properties .= " * {$meta_table} {$comments}" . PHP_EOL;
                    }

                    foreach ($con->query("select COLUMN_NAME,DATA_TYPE,COLUMN_KEY,COLUMN_COMMENT from INFORMATION_SCHEMA.COLUMNS where table_name = '$meta_table' and table_schema = '$database' ORDER BY ordinal_position") as $item) {
                        if ($item['COLUMN_KEY'] === 'PRI') {
                            $pk = $item['COLUMN_NAME'];
                            $item['COLUMN_COMMENT'] .= "(主键)";
                        }
                        $type = $this->getType($item['DATA_TYPE']);
                        $properties .= " * @property $type \${$item['COLUMN_NAME']} {$item['COLUMN_COMMENT']}\n";
                    }
                }
            } else if ($table) {
                $output?->writeln($this->msg('table_not_found_schema', ['{table}' => (string)$table]));
            }
        } catch (\Throwable $e) {
            $dbFailed = true;
            $this->reportException($e, $output);
        }
        if (!$table && !$meta_table) {
            $output?->writeln($dbFailed ? $this->msg('table_not_found_empty_db_failed') : $this->msg('table_not_found_empty'));
        }
        $properties = rtrim($properties) ?: ' *';
        $modelNamespace = $is_thinkorm_v2 ? 'support\think\Model' : 'think\Model';
        $model_content = <<<EOF
<?php

namespace $namespace;

use $modelNamespace;

/**
$properties
 */
class $class extends Model
{
    /**
     * The connection name for the model.
     *
     * @var string|null
     */
    protected \$connection = '$connection';
    
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected \$table = $table_val;

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected \$pk = '$pk';

    
}

EOF;
        file_put_contents($file, $model_content);
    }

    /**
     * @param \Throwable $e
     * @param OutputInterface|null $output
     * @return void
     */
    protected function reportException(\Throwable $e, ?OutputInterface $output = null): void
    {
        if ($output) {
            $this->writeDbNativeErrorOnce($output, $e, 'comment');
            return;
        }
        echo $e->getMessage() . PHP_EOL;
    }

    /**
     * Resolve model namespace/file path by --plugin/-p or --path/-P.
     * - --plugin/-p: generate under plugin/<plugin>/app/model by default.
     * - --path/-P: generate under the specified directory (relative to base path).
     * - If both are provided, they must point to the same directory, otherwise it's an error.
     *
     * @param string $name
     * @param string|null $plugin
     * @param string|null $path
     * @param OutputInterface $output
     * @return array{0:string,1:string,2:string}|null [class, namespace, file]
     */
    protected function resolveModelTargetByPluginOrPath(string $name, ?string $plugin, ?string $path, OutputInterface $output): ?array
    {
        $pathNorm = $path ? $this->normalizeRelativePath($path) : null;
        if ($pathNorm !== null && $this->isAbsolutePath($pathNorm)) {
            $output->writeln($this->msg('invalid_path', ['{path}' => $path]));
            return null;
        }

        // Validate plugin existence (from --plugin/-p or inferred from --path/-P).
        $pluginToCheck = $this->normalizeOptionValue($plugin) ?: $this->extractPluginNameFromRelativePath($pathNorm);
        if ($pluginToCheck && !$this->assertPluginExists($pluginToCheck, $output)) {
            return null;
        }

        $expected = null;
        if ($plugin) {
            $expected = $this->getPluginModelRelativePath($plugin);
        }

        if ($plugin && $pathNorm) {
            $pluginPrefix = 'plugin/' . $plugin . '/';
            if (!str_starts_with(strtolower($pathNorm), strtolower($pluginPrefix))) {
                $output->writeln(strtr(
                    Util::selectByLocale(Messages::getPluginPathConflictMessage()),
                    ['{plugin}' => $plugin, '{path}' => $pathNorm]
                ));
                return null;
            }
        }

        $targetRel = $pathNorm ?: $expected;
        if (!$targetRel) {
            return null;
        }

        $targetDir = base_path($targetRel);
        $namespaceRoot = trim(str_replace('/', '\\', $targetRel), '\\');

        if (!($pos = strrpos($name, '/'))) {
            $class = ucfirst($name);
            $subPath = '';
        } else {
            $subPath = substr($name, 0, $pos);
            $class = ucfirst(substr($name, $pos + 1));
        }

        $subDir = $subPath ? str_replace('/', DIRECTORY_SEPARATOR, $subPath) . DIRECTORY_SEPARATOR : '';
        $file = $targetDir . DIRECTORY_SEPARATOR . $subDir . $class . '.php';
        $namespace = $namespaceRoot . ($subPath ? '\\' . str_replace('/', '\\', $subPath) : '');

        return [$class, $namespace, $file];
    }

    /**
     * @param string $plugin
     * @return string relative path
     */
    protected function getPluginModelRelativePath(string $plugin): string
    {
        return Util::getDefaultAppRelativePath('model', $plugin);
    }

    /**
     * Hardcoded CLI messages without translation module.
     *
     * @param string $key
     * @param array $replace
     * @return string
     */
    protected function msg(string $key, array $replace = []): string
    {
        return strtr(Util::selectLocaleMessages(Messages::getMakeModelMessages())[$key] ?? $key, $replace);
    }

    /**
     * Command help text (multilingual).
     *
     * @return string
     */
    protected function buildHelpText(): string
    {
        return Util::selectByLocale(Messages::getMakeModelHelpText());
    }

    /**
     * @param string $type
     * @return string
     */
    protected function getType(string $type)
    {
        if (strpos($type, 'int') !== false) {
            return 'integer';
        }

        if (strpos($type, 'character varying') !== false || strpos($type, 'varchar') !== false) {
            return 'string';
        }

        if (strpos($type, 'timestamp') !== false) {
            return 'string';
        }

        switch ($type) {
            case 'varchar':
            case 'string':
            case 'text':
            case 'date':
            case 'time':
            case 'guid':
            case 'datetimetz':
            case 'datetime':
            case 'decimal':
            case 'enum':
            case 'character':   // PostgreSQL类型
            case 'char':        // PostgreSQL类型
            case 'json':        // PostgreSQL类型
            case 'jsonb':       // PostgreSQL类型
            case 'uuid':        // PostgreSQL类型
            case 'timestamptz': // PostgreSQL类型
            case 'citext':      // PostgreSQL类型
                return 'string';
            case 'boolean':
            case 'bool':        // PostgreSQL类型
                return 'bool';
            case 'float':
            case 'float4':      // PostgreSQL类型 (real)
            case 'float8':      // PostgreSQL类型 (double precision)
                return 'float';
            case 'numeric':     // PostgreSQL类型
                return 'string';
            default:
                return 'mixed';
        }
    }

}
