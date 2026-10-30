<?php

namespace Webman\Console\Commands\Concerns;

use Doctrine\Inflector\InflectorFactory;
use support\Db;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Question\Question;
use Webman\Console\OrmType;
use Webman\Console\Util;

trait OrmTableCommandHelpers
{

    /**
     * Set to 'db' when promptForTable returns null due to DB connection/permission failure.
     * Callers can check this to avoid showing redundant table_required message.
     */
    protected ?string $lastTablePromptFailureReason = null;

    /**
     * Severity for DB failures during table prompt.
     * - error: fatal (e.g. make:crud requires a table)
     * - warning: non-fatal (e.g. make:model can still generate an empty model)
     */
    protected string $tablePromptDbFailureSeverity = 'warning';

    /**
     * Last printed native DB error message (for deduplication within one command run).
     */
    protected ?string $lastDbNativeErrorPrinted = null;

    /**
     * Normalize a connection name into the final key used by Db drivers:
     * - Main project: "mysql"
     * - Plugin: "plugin.<plugin>.<conn>"
     *
     * If $pluginForDb is null, connection name will be returned as-is.
     *
     * @param string|null $pluginForDb plugin name that has DB config; null means "use main project"
     * @param string|null $connectionOption user provided value like "mysql" or "plugin.admin.mysql"
     * @return string|null
     */
    protected function normalizeConnectionNameForDb(?string $pluginForDb, ?string $connectionOption): ?string
    {
        $pluginForDb = $this->normalizeOptionValue($pluginForDb);
        $connectionOption = $this->normalizeOptionValue($connectionOption);
        if (!$connectionOption) {
            return null;
        }

        if (!$pluginForDb) {
            return $connectionOption;
        }

        if (str_starts_with($connectionOption, 'plugin.')) {
            return $connectionOption;
        }

        return "plugin.$pluginForDb.$connectionOption";
    }

    /**
     * Resolve a connection name that is safe to pass into Db::connection()/think Db::connect().
     * Always returns a non-empty string (falls back to main project default).
     *
     * Rules:
     * - If $plugin is provided and plugin has DB config, prefer plugin config:
     *   - If $databaseOption is provided => "plugin.<plugin>.<databaseOption>" (unless already "plugin.*")
     *   - Else => "plugin.<plugin>.<plugin_default>"
     * - Otherwise, fall back to main project:
     *   - If $databaseOption is provided => $databaseOption
     *   - Else => main default connection name
     */
    protected function resolveConnectionNameOrDefault(string $ormType, ?string $plugin, ?string $databaseOption): string
    {
        $plugin = $this->normalizeOptionValue($plugin);
        $databaseOption = $this->normalizeOptionValue($databaseOption);

        $pluginForDb = ($plugin && $this->pluginHasDbConfig($ormType, $plugin)) ? $plugin : null;

        if ($pluginForDb) {
            if ($databaseOption) {
                return (string)$this->normalizeConnectionNameForDb($pluginForDb, $databaseOption);
            }
            $resolved = $this->resolveConnectionByPlugin($ormType, $pluginForDb, null);
            if ($resolved) {
                return $resolved;
            }
        }

        // Main project fallback
        if ($databaseOption) {
            return $databaseOption;
        }

        if ($ormType === OrmType::THINKORM) {
            $is_thinkorm_v2 = class_exists(\support\think\Db::class);
            $configName = $is_thinkorm_v2 ? 'think-orm' : 'thinkorm';
            return (string)(config("$configName.default") ?: 'mysql');
        }

        return (string)(config('database.default') ?: 'mysql');
    }

    /**
     * Resolve a connection name using current rules, but keep it nullable:
     * - If $connection is provided, use it
     * - Otherwise resolve from ($plugin, $databaseOption) and defaults
     *
     * @param string $ormType
     * @param string|null $connection
     * @param string|null $plugin
     * @param string|null $databaseOption
     * @return string
     */
    protected function resolveConnectionName(string $ormType, ?string $connection, ?string $plugin = null, ?string $databaseOption = null): string
    {
        $connection = $this->normalizeOptionValue($connection);
        if ($connection) {
            return $connection;
        }
        return $this->resolveConnectionNameOrDefault($ormType, $plugin, $databaseOption);
    }

    /**
     * Resolve orm type.
     *
     * @param string|null $ormOption
     * @return string
     */
    protected function resolveOrm(?string $ormOption): string
    {
        $ormOption = $ormOption !== null ? strtolower(trim((string)$ormOption)) : null;
        if ($ormOption) {
            $ormOption = ltrim($ormOption, '=');
            if ($ormOption === 'thinkorm' || $ormOption === 'tp') {
                return OrmType::THINKORM;
            }
            return OrmType::LARAVEL;
        }

        // Auto detect
        $database = config('database');
        if (isset($database['default']) && strpos($database['default'], 'plugin.') === 0) {
            $database = false;
        }
        $thinkorm = config('think-orm') ?: config('thinkorm');
        if (isset($thinkorm['default']) && strpos($thinkorm['default'], 'plugin.') === 0) {
            $thinkorm = false;
        }
        return !$database && $thinkorm ? OrmType::THINKORM : OrmType::LARAVEL;
    }

    /**
     * Resolve the database connection name with plugin priority.
     *
     * Rules:
     * - If user explicitly provides --database/-d, always respect it.
     * - If --plugin/-p is provided and that plugin has DB config, prefer the plugin default connection.
     * - If plugin has no DB config, fall back to main project config.
     *
     * Note:
     * Plugin connections are merged into global config with names like "plugin.<plugin>.<connection>".
     *
     * @param string $ormType
     * @param string|null $plugin
     * @param string|null $connectionOption
     * @return string|null
     */
    protected function resolveConnectionByPlugin(string $ormType, ?string $plugin, ?string $connectionOption): ?string
    {
        $connectionOption = $this->normalizeOptionValue($connectionOption);
        if ($connectionOption) {
            return $connectionOption;
        }
        $plugin = $this->normalizeOptionValue($plugin);
        if (!$plugin) {
            return null;
        }

        // If plugin has no DB config or connections is empty, fall back to main project config.
        if (!$this->pluginHasDbConfig($ormType, $plugin)) {
            return null;
        }

        if ($ormType === OrmType::THINKORM) {
            $is_thinkorm_v2 = class_exists(\support\think\Db::class);
            $configName = $is_thinkorm_v2 ? 'think-orm' : 'thinkorm';
            $default = $this->normalizeOptionValue(config("plugin.$plugin.$configName.default"));
            if (!$default) {
                $connections = config("plugin.$plugin.$configName.connections", []);
                if (is_array($connections) && $connections) {
                    $default = (string)array_key_first($connections);
                }
            }
            if (!$default) {
                return null;
            }
            return str_starts_with($default, 'plugin.') ? $default : "plugin.$plugin.$default";
        }

        $default = $this->normalizeOptionValue(config("plugin.$plugin.database.default"));
        if (!$default) {
            $connections = config("plugin.$plugin.database.connections", []);
            if (is_array($connections) && $connections) {
                $default = (string)array_key_first($connections);
            }
        }
        if (!$default) {
            return null;
        }
        return str_starts_with($default, 'plugin.') ? $default : "plugin.$plugin.$default";
    }

    /**
     * Resolve and validate the final connection name for model generation.
     *
     * @param string $ormType
     * @param string|null $plugin
     * @param string|null $connectionOption
     * @param OutputInterface $output
     * @return array{0:bool,1:?string} [ok, connectionName]
     */
    protected function resolveAndValidateConnection(string $ormType, ?string $plugin, ?string $connectionOption, OutputInterface $output): array
    {
        $plugin = $this->normalizeOptionValue($plugin);
        $connectionOption = $this->normalizeOptionValue($connectionOption);

        // Determine which config set to validate against.
        $isThink = $ormType === OrmType::THINKORM;
        $thinkConfigName = null;
        if ($isThink) {
            $is_thinkorm_v2 = class_exists(\support\think\Db::class);
            $thinkConfigName = $is_thinkorm_v2 ? 'think-orm' : 'thinkorm';
        }

        // If plugin has no DB config, fall back to main project DB config (but still keep plugin for path).
        $pluginForDb = ($plugin && $this->pluginHasDbConfig($ormType, $plugin)) ? $plugin : null;

        // Case A: plugin(with DB config) + explicit connection => use plugin connection config.
        if ($pluginForDb && $connectionOption) {
            $final = $this->normalizeConnectionNameForDb($pluginForDb, $connectionOption);
            // Prefer displaying user's original input in messages, unless user explicitly typed "plugin.*".
            $displayConnection = str_starts_with($connectionOption, 'plugin.') ? (string)$final : $connectionOption;
            if (str_starts_with((string)$final, 'plugin.')) {
                if (!str_starts_with((string)$final, "plugin.$pluginForDb.")) {
                    $output->writeln($this->msg('connection_plugin_mismatch', [
                        '{plugin}' => $pluginForDb,
                        '{connection}' => (string)$final,
                    ]));
                    return [false, null];
                }
            }

            $exists = $isThink
                ? (bool)$this->getThinkOrmConnectionConfig((string)$thinkConfigName, $final)
                : (bool)$this->getLaravelConnectionConfig($final);

            if (!$exists) {
                $output->writeln($this->msg('connection_not_found_plugin', [
                    '{plugin}' => $pluginForDb,
                    '{connection}' => $displayConnection,
                ]));
                return [false, null];
            }
            return [true, $final];
        }

        // Case A2: plugin(without DB config) + explicit connection => treat as main project connection.
        if ($plugin && !$pluginForDb && $connectionOption) {
            $final = $this->normalizeConnectionNameForDb(null, $connectionOption);
            $exists = $isThink
                ? (bool)$this->getThinkOrmConnectionConfig((string)$thinkConfigName, $final)
                : (bool)$this->getLaravelConnectionConfig($final);
            if (!$exists) {
                $output->writeln($this->msg('connection_not_found', [
                    '{connection}' => $final,
                ]));
                return [false, null];
            }
            return [true, $final];
        }

        // Case B: no plugin + explicit connection => validate it exists.
        if (!$plugin && $connectionOption) {
            $final = $this->normalizeConnectionNameForDb(null, $connectionOption);
            $exists = $isThink
                ? (bool)$this->getThinkOrmConnectionConfig((string)$thinkConfigName, $final)
                : (bool)$this->getLaravelConnectionConfig($final);
            if (!$exists) {
                $output->writeln($this->msg('connection_not_found', [
                    '{connection}' => $final,
                ]));
                return [false, null];
            }
            return [true, $final];
        }

        // Case C: no explicit connection => prefer plugin default (if plugin has DB config), else null.
        $final = $this->resolveConnectionByPlugin($ormType, $pluginForDb, null);
        if ($pluginForDb && $final) {
            $exists = $isThink
                ? (bool)$this->getThinkOrmConnectionConfig((string)$thinkConfigName, $final)
                : (bool)$this->getLaravelConnectionConfig($final);
            if (!$exists) {
                $output->writeln($this->msg('plugin_default_connection_invalid', [
                    '{plugin}' => $pluginForDb,
                    '{connection}' => $final,
                ]));
                return [false, null];
            }
        }
        return [true, $final];
    }

    /**
     * Get laravel database connection config by name (dot-safe).
     *
     * @param string $connectionName
     * @return array
     */
    protected function getLaravelConnectionConfig(string $connectionName): array
    {
        $connectionName = trim($connectionName);
        if ($connectionName === '') {
            return [];
        }

        $all = config('database.connections', []);
        if (is_array($all)) {
            $cfg = $all[$connectionName] ?? null;
            if (is_array($cfg)) {
                return $cfg;
            }
        }

        // Fallback: direct plugin config reading.
        if (str_starts_with($connectionName, 'plugin.')) {
            $parts = explode('.', $connectionName, 3);
            $plugin = $parts[1] ?? '';
            $conn = $parts[2] ?? '';
            if ($plugin !== '' && $conn !== '') {
                $cfg = config("plugin.$plugin.database.connections.$conn");
                return is_array($cfg) ? $cfg : [];
            }
        }

        return [];
    }

    /**
     * Get thinkorm connection config by name (dot-safe).
     *
     * @param string $configName "think-orm" or "thinkorm"
     * @param string $connectionName
     * @return array
     */
    protected function getThinkOrmConnectionConfig(string $configName, string $connectionName): array
    {
        $configName = trim($configName);
        $connectionName = trim($connectionName);
        if ($configName === '' || $connectionName === '') {
            return [];
        }

        $connections = config("$configName.connections", []);
        if (is_array($connections)) {
            $cfg = $connections[$connectionName] ?? null;
            if (is_array($cfg)) {
                return $cfg;
            }
        }

        // Fallback: direct plugin config reading.
        if (str_starts_with($connectionName, 'plugin.')) {
            $parts = explode('.', $connectionName, 3);
            $plugin = $parts[1] ?? '';
            $conn = $parts[2] ?? '';
            if ($plugin !== '' && $conn !== '') {
                $cfg = config("plugin.$plugin.$configName.connections.$conn");
                return is_array($cfg) ? $cfg : [];
            }
        }

        return [];
    }

    /**
     * Whether plugin has a usable DB config. If not, callers should fall back to main project config.
     */
    protected function pluginHasDbConfig(string $ormType, string $plugin): bool
    {
        $plugin = $this->normalizeOptionValue($plugin);
        if (!$plugin) {
            return false;
        }

        if ($ormType === OrmType::THINKORM) {
            $is_thinkorm_v2 = class_exists(\support\think\Db::class);
            $configName = $is_thinkorm_v2 ? 'think-orm' : 'thinkorm';
            $connections = config("plugin.$plugin.$configName.connections");
            return is_array($connections) && $connections !== [];
        }

        $connections = config("plugin.$plugin.database.connections");
        return is_array($connections) && $connections !== [];
    }

    /**
     * Suggest a model class name from a table name:
     * - Strip table prefix (from connection config) if present
     * - Convert to StudlyCase
     * - Singularize
     *
     * @param string $table
     * @param string $ormType
     * @param string|null $connection
     * @return string e.g. "UserProfile"
     */
    protected function suggestModelNameFromTable(
        string $table,
        string $ormType,
        ?string $connection,
        ?string $plugin = null,
        ?string $databaseOption = null
    ): string
    {
        $table = ltrim(trim($table), '=');
        $prefix = $this->getConnectionPrefix($ormType, $connection, $plugin, $databaseOption);
        $tableNoPrefix = $this->stripPrefix($table, $prefix);
        $inflector = InflectorFactory::create()->build();
        $singular = $inflector->singularize($tableNoPrefix);
        return Util::nameToClass($singular);
    }

    /**
     * When no `--table/-t` is provided and convention-based guessing fails,
     * provide a good interactive UX if supported; otherwise fall back to empty model.
     *
     * - Non-interactive: return null, caller will handle the fallback.
     * - Interactive and DB reachable and has tables: show up to 20 candidates and allow
     *   selecting by number or typing a table name. Press Enter to skip.
     *
     * @param InputInterface $input
     * @param OutputInterface $output
     * @param string $ormType
     * @param string|null $connection
     * @param string $class
     * @param string[]|null $hintBaseNames Optional base names for multi-candidate ranking
     * @return string|null
     */
    protected function promptForTableIfNeeded(
        InputInterface $input,
        OutputInterface $output,
        string $ormType,
        ?string $connection,
        string $class,
        ?string $plugin = null,
        ?string $databaseOption = null,
        ?array $hintBaseNames = null
    ): ?string
    {
        return $this->promptForTableInternal($input, $output, $ormType, $connection, $class, true, $plugin, $databaseOption, $hintBaseNames);
    }

    /**
     * Always prompt to select a table (no convention shortcut).
     *
     * @param InputInterface $input
     * @param OutputInterface $output
     * @param string $ormType
     * @param string|null $connection
     * @param string $class
     * @param string[]|null $hintBaseNames Optional base names for multi-candidate ranking
     * @return string|null
     */
    protected function promptForTable(
        InputInterface $input,
        OutputInterface $output,
        string $ormType,
        ?string $connection,
        string $class = 'Model',
        ?string $plugin = null,
        ?string $databaseOption = null,
        ?array $hintBaseNames = null
    ): ?string
    {
        return $this->promptForTableInternal($input, $output, $ormType, $connection, $class, false, $plugin, $databaseOption, $hintBaseNames);
    }

    /**
     * Guess table from hint base names when in no-interaction mode.
     * Returns the top-ranked table or null if none.
     *
     * @param string $ormType
     * @param string|null $connection
     * @param array $hintBaseNames
     * @param string|null $plugin
     * @param string|null $databaseOption
     * @return string|null
     */
    protected function guessTableFromHints(
        string $ormType,
        ?string $connection,
        array $hintBaseNames,
        ?string $plugin = null,
        ?string $databaseOption = null
    ): ?string {
        $hintBaseNames = array_values(array_filter(array_map('trim', $hintBaseNames)));
        if ($hintBaseNames === []) {
            return null;
        }
        try {
            $tables = $this->listTables($ormType, $connection, $plugin, $databaseOption);
        } catch (\Throwable) {
            return null;
        }
        if ($tables === []) {
            return null;
        }
        $prefix = $this->getConnectionPrefix($ormType, $connection, $plugin, $databaseOption);
        $ranked = $this->rankCandidateTablesMulti($tables, $prefix, $hintBaseNames);
        return $ranked[0] ?? null;
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @param string $ormType
     * @param string|null $connection
     * @param string $class
     * @param bool $skipIfConventionMatch
     * @param string[]|null $hintBaseNames
     * @return string|null
     */
    private function promptForTableInternal(
        InputInterface $input,
        OutputInterface $output,
        string $ormType,
        ?string $connection,
        string $class,
        bool $skipIfConventionMatch,
        ?string $plugin = null,
        ?string $databaseOption = null,
        ?array $hintBaseNames = null
    ): ?string {
        if (!$this->isTerminalInteractive($input)) {
            return null;
        }

        $this->lastTablePromptFailureReason = null;
        if ($skipIfConventionMatch) {
            // If table can be guessed by convention, don't interrupt.
            try {
                if ($this->canGuessTableByConvention($ormType, $connection, $class, $plugin, $databaseOption)) {
                    return null;
                }
            } catch (\Throwable $e) {
                $this->writeDbAccessFailed($output, $e, $ormType, $connection, $plugin, $databaseOption);
                $this->lastTablePromptFailureReason = 'db';
                return null;
            }
        }

        try {
            $tables = $this->listTables($ormType, $connection, $plugin, $databaseOption);
        } catch (\Throwable $e) {
            $this->writeDbAccessFailed($output, $e, $ormType, $connection, $plugin, $databaseOption);
            $this->lastTablePromptFailureReason = 'db';
            return null;
        }

        if (!$tables) {
            return null;
        }

        $prefix = $this->getConnectionPrefix($ormType, $connection, $plugin, $databaseOption);
        $orderedAll = $hintBaseNames && $hintBaseNames !== []
            ? $this->rankCandidateTablesMulti($tables, $prefix, $hintBaseNames)
            : $this->rankCandidateTables($tables, $prefix, $class);

        $batchSize = 20;
        $filterKeyword = null;
        $ordered = $orderedAll;
        $offset = 0;
        $indexToTable = [];

        $output->writeln($this->msg('no_match'));
        $output->writeln($this->msg('prompt_help'));

        $helper = $this->getHelper('question');
        $question = new Question('> ', '');

        while (true) {
            $slice = array_slice($ordered, $offset, $batchSize);
            if ($slice) {
                foreach ($slice as $t) {
                    $indexToTable[] = $t;
                }
                $this->printTableList($output, $indexToTable, $offset, $slice);
                $offset += count($slice);
            } else {
                $output->writeln($this->msg('no_more'));
            }

            $answerRaw = $this->askOrAbort($input, $output, $question);
            $answerRaw = is_string($answerRaw) ? $answerRaw : '';
            $answer = trim($answerRaw);

            // Enter => more
            if ($answer === '') {
                if ($offset >= count($ordered)) {
                    // Nothing more; keep waiting for user input.
                    $output->writeln($this->msg('end_of_list'));
                }
                continue;
            }

            // 0 => empty model
            if ($answer === '0') {
                return null;
            }

            // /keyword filter
            if (str_starts_with($answer, '/')) {
                $kw = trim(substr($answer, 1));
                if ($kw === '') {
                    // Clear filter
                    $filterKeyword = null;
                    $ordered = $orderedAll;
                    $offset = 0;
                    $indexToTable = [];
                    $output->writeln($this->msg('filter_cleared'));
                    continue;
                }
                $filterKeyword = $kw;
                $ordered = $this->filterTables($orderedAll, $filterKeyword);
                $offset = 0;
                $indexToTable = [];
                if (!$ordered) {
                    $output->writeln($this->msg('filter_no_match', ['{keyword}' => $filterKeyword]));
                    // Keep filter active but list is empty.
                } else {
                    $output->writeln($this->msg('filter_applied', ['{keyword}' => $filterKeyword]));
                }
                continue;
            }

            // numeric selection (from already shown list)
            if (ctype_digit($answer)) {
                $n = (int)$answer;
                if ($n >= 1 && $n <= count($indexToTable)) {
                    return $indexToTable[$n - 1];
                }
                $output->writeln($this->msg('selection_out_of_range'));
                continue;
            }

            // manual input table name, validate if possible
            if (!in_array($answer, $tables, true)) {
                $output->writeln($this->msg('table_not_in_list', ['{table}' => $answer]));
            }
            return $answer;
        }
    }

    /**
     * @param InputInterface $input
     * @return bool
     */
    protected function isTerminalInteractive(InputInterface $input): bool
    {
        if (!$input->isInteractive()) {
            return false;
        }
        // When stdin is not a TTY (e.g. piped), do not prompt to avoid blocking.
        if (\defined('STDIN') && \function_exists('stream_isatty')) {
            try {
                return stream_isatty(STDIN);
            } catch (\Throwable) {
                // ignore
            }
        }
        return true;
    }

    /**
     * Print the newly appended slice with global indexes.
     *
     * @param OutputInterface $output
     * @param array $allShown
     * @param int $offsetBefore
     * @param array $newSlice
     * @return void
     */
    protected function printTableList(OutputInterface $output, array $allShown, int $offsetBefore, array $newSlice): void
    {
        $startIndex = $offsetBefore + 1;
        $endIndex = $offsetBefore + count($newSlice);
        $output->writeln($this->msg('showing_range', [
            '{start}' => (string)$startIndex,
            '{end}' => (string)$endIndex,
            '{shown}' => (string)count($allShown),
        ]));
        foreach ($newSlice as $i => $t) {
            $num = $offsetBefore + $i + 1;
            $numStr = str_pad((string)$num, 3, ' ', STR_PAD_LEFT);
            $output->writeln("  <info>{$numStr}</info>. {$t}");
        }
    }

    /**
     * @param array $tables
     * @param string $keyword
     * @return array
     */
    protected function filterTables(array $tables, string $keyword): array
    {
        $keyword = strtolower($keyword);
        return array_values(array_filter($tables, static function ($t) use ($keyword) {
            return str_contains(strtolower((string)$t), $keyword);
        }));
    }

    /**
     * @param string $ormType
     * @param string|null $connection
     * @param string $class
     * @return bool
     */
    protected function canGuessTableByConvention(
        string $ormType,
        ?string $connection,
        string $class,
        ?string $plugin = null,
        ?string $databaseOption = null
    ): bool
    {
        $inflector = InflectorFactory::create()->build();
        $tableBase = Util::classToName($class);
        $tablePlural = $inflector->pluralize($inflector->tableize($class));

        if ($ormType === OrmType::THINKORM) {
            return $this->thinkOrmTableExists($connection, $tablePlural, $plugin, $databaseOption)
                || $this->thinkOrmTableExists($connection, $tableBase, $plugin, $databaseOption);
        }
        return $this->laravelTableExists($connection, $tablePlural, $plugin, $databaseOption)
            || $this->laravelTableExists($connection, $tableBase, $plugin, $databaseOption);
    }

    /**
     * List all tables for the connection.
     *
     * @param string $ormType
     * @param string|null $connection
     * @return array
     */
    protected function listTables(string $ormType, ?string $connection, ?string $plugin = null, ?string $databaseOption = null): array
    {
        return $ormType === OrmType::THINKORM
            ? $this->listThinkOrmTables($connection, $plugin, $databaseOption)
            : $this->listLaravelTables($connection, $plugin, $databaseOption);
    }

    /**
     * @param string|null $connection
     * @return array
     */
    protected function listLaravelTables(?string $connection, ?string $plugin = null, ?string $databaseOption = null): array
    {
        $connection = $this->resolveConnectionName(OrmType::LARAVEL, $connection, $plugin, $databaseOption);
        $conn = $this->getLaravelConnectionConfig((string)$connection);
        $driver = (string)($conn['driver'] ?? 'mysql');
        $con = Db::connection($connection);

        if ($driver === 'pgsql') {
            $schema = (string)($conn['schema'] ?? 'public');
            $rows = $con->select('SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = ?', [$schema]);
            return array_values(array_filter(array_map(static function ($row) {
                $arr = (array)$row;
                return $arr['tablename'] ?? (array_values($arr)[0] ?? null);
            }, $rows)));
        }

        // default mysql
        $rows = $con->select('SHOW TABLES');
        return array_values(array_filter(array_map(static function ($row) {
            $arr = (array)$row;
            return array_values($arr)[0] ?? null;
        }, $rows)));
    }

    /**
     * @param string|null $connection
     * @return array
     */
    protected function listThinkOrmTables(?string $connection, ?string $plugin = null, ?string $databaseOption = null): array
    {
        $connection = $this->resolveConnectionName(OrmType::THINKORM, $connection, $plugin, $databaseOption);
        $is_thinkorm_v2 = class_exists(\support\think\Db::class);
        $config_name = $is_thinkorm_v2 ? 'think-orm' : 'thinkorm';
        $conn = $this->getThinkOrmConnectionConfig($config_name, (string)$connection);
        $driver = (string)($conn['type'] ?? 'mysql');

        if ($is_thinkorm_v2) {
            $con = \support\think\Db::connect($connection);
        } else {
            $con = \think\facade\Db::connect($connection);
        }

        if ($driver === 'pgsql') {
            $schema = (string)($conn['schema'] ?? 'public');
            $rows = $con->query('SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = ?', [$schema]);
            return array_values(array_filter(array_map(static function ($row) {
                return $row['tablename'] ?? (array_values($row)[0] ?? null);
            }, $rows)));
        }

        $rows = $con->query('SHOW TABLES');
        return array_values(array_filter(array_map(static function ($row) {
            return array_values($row)[0] ?? null;
        }, $rows)));
    }

    /**
     * Rank candidate tables based on model class name.
     *
     * @param array $tables
     * @param string $prefix
     * @param string $class
     * @return array
     */
    protected function rankCandidateTables(array $tables, string $prefix, string $class): array
    {
        return $this->rankCandidateTablesMulti($tables, $prefix, [$class]);
    }

    /**
     * Rank candidate tables by relevance to multiple base names (e.g. from controller, model, validator).
     * Combines scores from each base name, tables matching more hints rank higher.
     *
     * @param array $tables
     * @param string $prefix
     * @param array $baseNames Base class names (e.g. ['User', 'UserProfile'])
     * @return array
     */
    protected function rankCandidateTablesMulti(array $tables, string $prefix, array $baseNames): array
    {
        $inflector = InflectorFactory::create()->build();
        $scores = [];

        foreach ($tables as $t) {
            $raw = (string)$t;
            $cmp = $this->stripPrefix($raw, $prefix);
            $totalScore = 0;

            foreach ($baseNames as $class) {
                $class = trim((string)$class);
                if ($class === '') {
                    continue;
                }
                $tableBase = Util::classToName($class);
                $tablePlural = $inflector->pluralize($inflector->tableize($class));
                $score = 0;
                if ($cmp === $tableBase) {
                    $score += 100;
                }
                if ($cmp === $tablePlural) {
                    $score += 95;
                }
                if (str_contains($cmp, $tableBase)) {
                    $score += 40;
                }
                if (str_contains($cmp, $tablePlural)) {
                    $score += 35;
                }
                $score += max(0, 20 - levenshtein($cmp, $tableBase));
                $totalScore += $score;
            }

            $scores[$raw] = $totalScore;
        }

        arsort($scores);
        return array_keys($scores);
    }

    /**
     * @param string $value
     * @param string $prefix
     * @return string
     */
    protected function stripPrefix(string $value, string $prefix): string
    {
        if ($prefix && str_starts_with($value, $prefix)) {
            return substr($value, strlen($prefix));
        }
        return $value;
    }

    /**
     * @param string $ormType
     * @param string|null $connection
     * @return string
     */
    protected function getConnectionPrefix(string $ormType, ?string $connection, ?string $plugin = null, ?string $databaseOption = null): string
    {
        $connection = $this->normalizeOptionValue($connection);
        if (!$connection) {
            $connection = $this->resolveConnectionNameOrDefault($ormType, $plugin, $databaseOption);
        }

        if ($ormType === OrmType::THINKORM) {
            $is_thinkorm_v2 = class_exists(\support\think\Db::class);
            $config_name = $is_thinkorm_v2 ? 'think-orm' : 'thinkorm';
            $conn = $this->getThinkOrmConnectionConfig($config_name, (string)$connection);
            return (string)($conn['prefix'] ?? '');
        }
        $conn = $this->getLaravelConnectionConfig((string)$connection);
        return (string)($conn['prefix'] ?? '');
    }

    /**
     * @param string|null $connection
     * @param string $tableNoPrefix
     * @return bool
     */
    protected function laravelTableExists(
        ?string $connection,
        string $tableNoPrefix,
        ?string $plugin = null,
        ?string $databaseOption = null
    ): bool
    {
        $connection = $this->resolveConnectionName(OrmType::LARAVEL, $connection, $plugin, $databaseOption);
        $conn = $this->getLaravelConnectionConfig((string)$connection);
        $driver = (string)($conn['driver'] ?? 'mysql');
        $prefix = (string)($conn['prefix'] ?? '');
        $con = Db::connection($connection);

        if ($driver === 'pgsql') {
            $schema = (string)($conn['schema'] ?? 'public');
            $rows = $con->select("SELECT to_regclass('{$schema}.{$prefix}{$tableNoPrefix}') as table_exists");
            return !empty($rows[0]->table_exists);
        }
        return (bool)$con->select("SHOW TABLES LIKE '{$prefix}{$tableNoPrefix}'");
    }

    /**
     * @param string|null $connection
     * @param string $tableNoPrefix
     * @return bool
     */
    protected function thinkOrmTableExists(
        ?string $connection,
        string $tableNoPrefix,
        ?string $plugin = null,
        ?string $databaseOption = null
    ): bool
    {
        $connection = $this->resolveConnectionName(OrmType::THINKORM, $connection, $plugin, $databaseOption);
        $is_thinkorm_v2 = class_exists(\support\think\Db::class);
        $config_name = $is_thinkorm_v2 ? 'think-orm' : 'thinkorm';
        $conn = $this->getThinkOrmConnectionConfig($config_name, (string)$connection);
        $driver = (string)($conn['type'] ?? 'mysql');
        $prefix = (string)($conn['prefix'] ?? '');

        if ($is_thinkorm_v2) {
            $con = \support\think\Db::connect($connection);
        } else {
            $con = \think\facade\Db::connect($connection);
        }

        if ($driver === 'pgsql') {
            $schema = (string)($conn['schema'] ?? 'public');
            $rows = $con->query("SELECT to_regclass('{$schema}.{$prefix}{$tableNoPrefix}') as table_exists");
            return !empty($rows[0]['table_exists']);
        }
        return (bool)$con->query("SHOW TABLES LIKE '{$prefix}{$tableNoPrefix}'");
    }

    protected function buildDbAccessFailedMessage(
        \Throwable $e,
        string $ormType,
        ?string $connection,
        ?string $plugin = null,
        ?string $databaseOption = null
    ): string {
        $context = $this->extractDbErrorContext($e);
        $isPermissionDenied = $this->isPermissionDeniedError($context);
        if ($isPermissionDenied) {
            [$dbUser, $dbName] = $this->getDbUserAndName($ormType, $connection, $plugin, $databaseOption);
            $fallback = str_starts_with(Util::getLocale(), 'zh') ? '未知' : 'unknown';
            $userText = $dbUser !== '' ? $dbUser : $fallback;
            $dbText = $dbName !== '' ? $dbName : $fallback;
            $hint = $this->shouldSuggestTableOverride($context) ? $this->msg('db_permission_denied_hint') : '';
            return $this->msg('db_permission_denied', [
                '{user}' => $userText,
                '{database}' => $dbText,
                '{hint}' => $hint,
            ]);
        }
        $configPath = $this->getDatabaseConfigPath($ormType, $plugin);
        return $this->msg('db_connect_failed', ['{configPath}' => $configPath]);
    }

    protected function writeDbAccessFailed(
        OutputInterface $output,
        \Throwable $e,
        string $ormType,
        ?string $connection,
        ?string $plugin = null,
        ?string $databaseOption = null
    ): void {
        $severityTag = $this->tablePromptDbFailureSeverity === 'error' ? 'error' : 'comment';
        $this->writeDbNativeErrorOnce($output, $e, $severityTag);

        $friendly = $this->buildDbAccessFailedMessage($e, $ormType, $connection, $plugin, $databaseOption);
        if ($severityTag === 'comment') {
            // Non-fatal flows: show the same text in warning color.
            $friendly = str_replace(['<error>', '</error>'], ['<comment>', '</comment>'], $friendly);
        }
        $output->writeln($friendly);
    }

    protected function writeDbNativeErrorOnce(OutputInterface $output, \Throwable $e, string $severityTag = 'error'): void
    {
        $msg = trim((string)$e->getMessage());
        if ($msg === '') {
            return;
        }
        if ($this->lastDbNativeErrorPrinted === $msg) {
            return;
        }
        $this->lastDbNativeErrorPrinted = $msg;
        $tag = $severityTag === 'comment' ? 'comment' : 'error';
        $output->writeln("<{$tag}>{$msg}</{$tag}>");
    }

    protected function getDatabaseConfigPath(string $ormType, ?string $plugin): string
    {
        $plugin = $this->normalizeOptionValue($plugin);
        $pluginForConfig = $plugin && $this->pluginHasDbConfig($ormType, $plugin) ? $plugin : null;
        $baseDir = $pluginForConfig ? "plugin/{$pluginForConfig}/config/" : 'config/';
        if ($ormType !== OrmType::THINKORM) {
            return $baseDir . 'database.php';
        }
        $first = $baseDir . 'think-orm.php';
        $second = $baseDir . 'thinkorm.php';
        $firstExists = file_exists(base_path($first));
        if ($firstExists) {
            return $first;
        }
        $secondExists = file_exists(base_path($second));
        if ($secondExists) {
            return $second;
        }
        return $first;
    }

    /**
     * @return array{0:string,1:string} [dbUser, dbName]
     */
    protected function getDbUserAndName(
        string $ormType,
        ?string $connection,
        ?string $plugin = null,
        ?string $databaseOption = null
    ): array {
        $connection = $this->resolveConnectionName($ormType, $connection, $plugin, $databaseOption);
        if ($ormType === OrmType::THINKORM) {
            $is_thinkorm_v2 = class_exists(\support\think\Db::class);
            $configName = $is_thinkorm_v2 ? 'think-orm' : 'thinkorm';
            $cfg = $this->getThinkOrmConnectionConfig($configName, (string)$connection);
        } else {
            $cfg = $this->getLaravelConnectionConfig((string)$connection);
        }
        $dbUser = (string)($cfg['username'] ?? $cfg['user'] ?? $cfg['userid'] ?? '');
        $dbName = (string)($cfg['database'] ?? $cfg['dbname'] ?? $cfg['db_name'] ?? '');
        return [$dbUser, $dbName];
    }

    /**
     * @return array{messages: string[], codes: string[], sqlstates: string[]}
     */
    protected function extractDbErrorContext(\Throwable $e): array
    {
        $messages = [];
        $codes = [];
        $sqlstates = [];
        $current = $e;
        while ($current !== null) {
            $messages[] = (string)$current->getMessage();
            $code = $current->getCode();
            if ($code !== null && $code !== '') {
                $codes[] = (string)$code;
            }
            if ($current instanceof \PDOException && is_array($current->errorInfo)) {
                $sqlstate = (string)($current->errorInfo[0] ?? '');
                if ($sqlstate !== '') {
                    $sqlstates[] = $sqlstate;
                }
                $driverCode = $current->errorInfo[1] ?? null;
                if ($driverCode !== null && $driverCode !== '') {
                    $codes[] = (string)$driverCode;
                }
                $driverMsg = $current->errorInfo[2] ?? null;
                if (is_string($driverMsg) && $driverMsg !== '') {
                    $messages[] = $driverMsg;
                }
            } elseif (property_exists($current, 'errorInfo') && is_array($current->errorInfo)) {
                $sqlstate = (string)($current->errorInfo[0] ?? '');
                if ($sqlstate !== '') {
                    $sqlstates[] = $sqlstate;
                }
                $driverCode = $current->errorInfo[1] ?? null;
                if ($driverCode !== null && $driverCode !== '') {
                    $codes[] = (string)$driverCode;
                }
                $driverMsg = $current->errorInfo[2] ?? null;
                if (is_string($driverMsg) && $driverMsg !== '') {
                    $messages[] = $driverMsg;
                }
            }
            $current = $current->getPrevious();
        }
        return [
            'messages' => $messages,
            'codes' => $codes,
            'sqlstates' => $sqlstates,
        ];
    }

    /**
     * @param array{messages: string[], codes: string[], sqlstates: string[]} $context
     */
    protected function isPermissionDeniedError(array $context): bool
    {
        if ($this->isAuthOrConnectionError($context)) {
            return false;
        }
        $codes = array_map('strval', $context['codes']);
        $sqlstates = array_map('strval', $context['sqlstates']);
        $message = strtolower(implode(' ', $context['messages']));

        if (in_array('1142', $codes, true) || in_array('1143', $codes, true)) {
            return true;
        }
        if (in_array('42501', $sqlstates, true)) {
            return true;
        }
        if (str_contains($message, 'permission denied') || str_contains($message, 'insufficient privilege')) {
            return true;
        }
        if (str_contains($message, 'command denied')) {
            return true;
        }
        return false;
    }

    /**
     * @param array{messages: string[], codes: string[], sqlstates: string[]} $context
     */
    protected function isAuthOrConnectionError(array $context): bool
    {
        $codes = array_map('strval', $context['codes']);
        $sqlstates = array_map('strval', $context['sqlstates']);
        $message = strtolower(implode(' ', $context['messages']));

        if (in_array('1045', $codes, true) || in_array('1044', $codes, true)) {
            return true;
        }
        if (in_array('2002', $codes, true) || in_array('2003', $codes, true) || in_array('2006', $codes, true) || in_array('2013', $codes, true)) {
            return true;
        }
        if (in_array('28000', $sqlstates, true) || in_array('28p01', array_map('strtolower', $sqlstates), true)) {
            return true;
        }
        if (in_array('08001', $sqlstates, true) || in_array('08004', $sqlstates, true) || in_array('08006', $sqlstates, true)) {
            return true;
        }
        if (str_contains($message, 'access denied for user')) {
            return true;
        }
        if (str_contains($message, 'password authentication failed')) {
            return true;
        }
        if (str_contains($message, 'could not connect') || str_contains($message, 'connection refused') || str_contains($message, 'server has gone away')) {
            return true;
        }
        return false;
    }

    /**
     * @param array{messages: string[], codes: string[], sqlstates: string[]} $context
     */
    protected function shouldSuggestTableOverride(array $context): bool
    {
        $codes = array_map('strval', $context['codes']);
        $message = strtolower(implode(' ', $context['messages']));
        if (in_array('1142', $codes, true) && str_contains($message, 'show tables')) {
            return true;
        }
        if (str_contains($message, 'pg_catalog.pg_tables') || str_contains($message, 'pg_tables')) {
            return true;
        }
        return false;
    }
}
