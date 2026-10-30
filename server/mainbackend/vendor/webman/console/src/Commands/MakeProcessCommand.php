<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Question\ConfirmationQuestion;
use Symfony\Component\Console\Question\Question;
use Webman\Console\Commands\Concerns\MakeCommandHelpers;
use Webman\Console\Util;
use Webman\Console\Messages;

#[AsCommand('make:process', 'Make a custom process.')]
class MakeProcessCommand extends Command
{
    use MakeCommandHelpers;

    private const PROTOCOLS = [
        '1' => 'websocket',
        '2' => 'http',
        '3' => 'tcp',
        '4' => 'udp',
    ];

    /**
     * @return void
     */
    protected function configure()
    {
        $this->addArgument('name', InputArgument::REQUIRED, $this->msg('arg_name'));
        $this->addOption('plugin', 'p', InputOption::VALUE_REQUIRED, $this->msg('opt_plugin'));
        $this->addOption('path', 'P', InputOption::VALUE_REQUIRED, $this->msg('opt_path'));
        $this->addOption('force', 'f', InputOption::VALUE_NONE, $this->msg('opt_force'));

        $this->setHelp($this->buildHelpText());

        $this->addUsage('MyTcp');
        $this->addUsage('MyWebsocket');
        $this->addUsage('MyProcess -p admin');
        $this->addUsage('MyProcess -P plugin/admin/app/process');
        $this->addUsage('MyProcess -f');
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        try {
            $rawName = (string)$input->getArgument('name');
            $name = Util::nameToClass($rawName);
            $name = str_replace('\\', '/', $name);

            $plugin = $this->normalizeOptionValue($input->getOption('plugin'));
            $path = $this->normalizeOptionValue($input->getOption('path'));
            $force = (bool)$input->getOption('force');

            if ($plugin && (str_contains($plugin, '/') || str_contains($plugin, '\\'))) {
                $output->writeln($this->msg('invalid_plugin', ['{plugin}' => $plugin]));
                return Command::FAILURE;
            }
            if ($plugin && !$this->assertPluginExists($plugin, $output)) {
                return Command::FAILURE;
            }

            if (!$path && $input->isInteractive()) {
                $pathDefault = $plugin ? Util::getDefaultAppRelativePath('process', $plugin) : Util::getDefaultAppRelativePath('process');
                $path = $this->promptForPathWithDefault($input, $output, 'process', $pathDefault);
            }

            $target = $this->resolveTarget($name, $plugin, $path, $output);
            if ($target === null) {
                return Command::FAILURE;
            }
            [$class, $namespace, $file] = $target;

            // Once path is confirmed, we can determine the target file path.
            // Detect existing file early and ask whether to override.
            if (!$force && is_file($file)) {
                if (!$input->isInteractive()) {
                    $output->writeln($this->msg('process_file_exists', ['{path}' => $this->toRelativePath($file)]));
                    return Command::FAILURE;
                }
                $relative = $this->toRelativePath($file);
                $prompt = $this->msg('override_prompt', ['{path}' => $relative]);
                $question = new ConfirmationQuestion($prompt, true);
                $yes = (bool)$this->askOrAbort($input, $output, $question);
                if (!$yes) {
                    return Command::SUCCESS;
                }
            }

            $snakeKey = $this->toSnakeKey($name);
            $pluginForConfig = $this->inferPluginNameForConfig($plugin, $path);
            $configFile = $pluginForConfig
                ? base_path('plugin' . DIRECTORY_SEPARATOR . $pluginForConfig . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'process.php')
                : (config_path() . DIRECTORY_SEPARATOR . 'process.php');

            $config = $this->loadPhpConfigArray($configFile);
            if ($config === null) {
                $output->writeln($this->msg('invalid_config', ['{path}' => $this->toRelativePath($configFile)]));
                return Command::FAILURE;
            }

            $processKey = $snakeKey;
            $needsConfirmProcessKey = false;
            if (array_key_exists($processKey, $config)) {
                $needsConfirmProcessKey = true;
                $processKey = $this->nextAvailableProcessKey($processKey, $config);
            }

            $output->writeln($this->msg('make_process', [
                '{class}' => "{$namespace}\\{$class}",
                '{key}' => $processKey,
                '{config}' => $this->toRelativePath($configFile),
            ]));

            $listen = null;
            $listenValue = null; // null|array{kind:string,value:string} kind=string|raw
            $protocol = null;
            $httpMode = null; // builtin|custom|null
            $listenMode = 'none'; // none|port|unixsocket
            $needsFile = true;
            $listenIp = null;
            $listenPort = null;

            if ($input->isInteractive()) {
                $listenMode = $this->askListenMode($input, $output);
            }

            if ($listenMode === 'none') {
                $needsFile = true;
            } else if ($listenMode === 'unixsocket') {
                $protocol = 'unixsocket';
                $socketRelPath = $this->askUnixSocketPathRelative($input, $output, $processKey);
                $listenValue = [
                    'kind' => 'raw',
                    'value' => "'unix://' . runtime_path(" . var_export($socketRelPath, true) . ")",
                ];
                $needsFile = true;
            } else {
                // Port listening process (IP:Port).
                $protocol = $this->askProtocol($input, $output);
                if ($protocol === 'http') {
                    $httpMode = $this->askHttpMode($input, $output);
                }

                $needsFile = $protocol !== 'http' || $httpMode !== 'builtin';

                $listenPort = $this->askPortWithConflictCheck($input, $output, $config, $configFile);
                $listenIp = $this->askIp($input, $output);

                $listen = $this->buildListenString($protocol, (string)$listenIp, (int)$listenPort);
                $listenValue = ['kind' => 'string', 'value' => $listen];
            }

            $countValue = $this->askProcessCount($input, $output, $protocol, $httpMode);

            $handlerFqn = $this->buildHandlerFqn($namespace, $class, $pluginForConfig, $protocol, $httpMode);

            // Generate files/config at the final step.
            if ($needsFile) {
                $this->createProcessFile($protocol, $httpMode, $namespace, $class, $file, $processKey, null);
                $output->writeln($this->msg('created', ['{path}' => $this->toRelativePath($file)]));
            } else {
                $output->writeln($this->msg('reuse_builtin_http', ['{handler}' => $handlerFqn . '::class']));
            }

            if ($needsConfirmProcessKey && $input->isInteractive()) {
                $processKey = $this->askProcessKey($input, $output, $processKey, $config);
            }

            $configEntry = $this->buildProcessConfigEntry($processKey, $handlerFqn, $listenValue, $countValue, $protocol, $httpMode);

            // Update config file (after file creation to avoid broken handler reference).
            $changed = $this->appendProcessConfigEntry($configFile, $configEntry);
            if (!$changed) {
                $output->writeln($this->msg('write_config_failed', ['{path}' => $this->toRelativePath($configFile)]));
                return Command::FAILURE;
            }
            $output->writeln($this->msg('updated_config', ['{path}' => $this->toRelativePath($configFile), '{key}' => $processKey]));
            return Command::SUCCESS;
        } catch (\Throwable $e) {
            throw $e;
        }
    }

    /**
     * @param string $name class path like "admin/MyProcess"
     * @param string|null $plugin
     * @param string|null $path
     * @param OutputInterface $output
     * @return array{0:string,1:string,2:string}|null [class, namespace, file]
     */
    private function resolveTarget(string $name, ?string $plugin, ?string $path, OutputInterface $output): ?array
    {
        if ($plugin || $path) {
            return $this->resolveTargetByPluginOrPath(
                $name,
                $plugin,
                $path,
                $output,
                fn(string $p) => Util::getDefaultAppRelativePath('process', $p),
                fn(string $key, array $replace = []) => $this->msg($key, $replace)
            );
        }
        return $this->resolveAppProcessTarget($name);
    }

    /**
     * Default app process relative path.
     *
     * @return string
     */
    private function getAppProcessRelativePath(): string
    {
        return Util::getDefaultAppRelativePath('process');
    }

    /**
     * Resolve process namespace/file path under app/ (backward compatible).
     *
     * @param string $name
     * @return array{0:string,1:string,2:string} [class, namespace, file]
     */
    private function resolveAppProcessTarget(string $name): array
    {
        $processStr = Util::getDefaultAppPath('process');
        $processRelPath = Util::getDefaultAppRelativePath('process');

        if (!($pos = strrpos($name, '/'))) {
            $class = ucfirst($name);
            $file = app_path() . DIRECTORY_SEPARATOR . $processStr . DIRECTORY_SEPARATOR . "{$class}.php";
            $namespace = Util::pathToNamespace($processRelPath);
            return [$class, $namespace, $file];
        }

        $upper = strtolower($processStr[0]) !== $processStr[0];
        $dirPart = substr($name, 0, $pos);
        $realDirPart = Util::guessPath(app_path(), $dirPart);
        if ($realDirPart) {
            $dirPart = str_replace(DIRECTORY_SEPARATOR, '/', $realDirPart);
        } else if ($upper) {
            $dirPart = preg_replace_callback('/\/([a-z])/', static function ($matches) {
                return '/' . strtoupper($matches[1]);
            }, ucfirst($dirPart));
        }

        $appDirName = Util::detectAppDirName();
        $path = "{$processStr}/{$dirPart}";
        $class = ucfirst(substr($name, $pos + 1));
        $file = app_path() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path) . DIRECTORY_SEPARATOR . "{$class}.php";
        $namespace = str_replace('/', '\\', $appDirName . '/' . $path);
        return [$class, $namespace, $file];
    }


    /**
     * @param string $plugin
     * @return string relative path
     */
    private function getPluginProcessRelativePath(string $plugin): string
    {
        return Util::getDefaultAppRelativePath('process', $plugin);
    }

    /**
     * Prompt for path (question style, input on new line). Reuses enter_path_prompt from make:crud.
     *
     * @param InputInterface $input
     * @param OutputInterface $output
     * @param string $labelKey
     * @param string $defaultPath
     * @return string
     */
    private function promptForPathWithDefault(InputInterface $input, OutputInterface $output, string $labelKey, string $defaultPath): string
    {
        $defaultPath = $this->normalizeRelativePath($defaultPath);
        $label = Util::selectLocaleMessages(Messages::getTypeLabels())[$labelKey] ?? $labelKey;
        $promptText = Util::selectLocaleMessages(Messages::getMakeCrudMessages())['enter_path_prompt']
            ?? 'Enter {label} path (Enter for default: {default}): ';
        $promptText = strtr($promptText, ['{label}' => $label, '{default}' => $defaultPath]);
        $promptText = '<question>' . trim($promptText) . "</question>\n";
        $question = new Question($promptText, $defaultPath);
        $path = $this->askOrAbort($input, $output, $question);
        $path = is_string($path) ? $path : $defaultPath;
        return $this->normalizeRelativePath($path ?: $defaultPath);
    }

    /**
     * Convert class path to snake key for config.
     *
     * @param string $name class path like "admin/MyProcess"
     * @return string
     */
    private function toSnakeKey(string $name): string
    {
        $name = trim(str_replace('\\', '/', $name), '/');
        $parts = $name === '' ? [] : explode('/', $name);
        $snakes = [];
        foreach ($parts as $p) {
            $p = trim($p);
            if ($p === '') {
                continue;
            }
            $classLike = Util::nameToClass($p);
            $snakes[] = trim(Util::classToName(basename(str_replace('\\', '/', $classLike))), '_');
        }
        $key = strtolower(implode('_', $snakes));
        $key = preg_replace('/_+/', '_', $key);
        return $key ?: strtolower(Util::classToName(Util::nameToClass($name)));
    }

    /**
     * @param string $baseKey
     * @param array<string,mixed> $config
     * @return string
     */
    private function nextAvailableProcessKey(string $baseKey, array $config): string
    {
        $baseKey = trim($baseKey);
        if ($baseKey === '') {
            $baseKey = 'process';
        }
        $i = 1;
        while (true) {
            $candidate = $baseKey . $i;
            if (!array_key_exists($candidate, $config)) {
                return $candidate;
            }
            $i++;
        }
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @param string $defaultKey
     * @param array<string,mixed> $config
     * @return string
     */
    private function askProcessKey(InputInterface $input, OutputInterface $output, string $defaultKey, array $config): string
    {
        $q = new Question($this->msg('ask_process_name', ['{default}' => $defaultKey]), $defaultKey);
        $q->setValidator(function (mixed $value) use ($defaultKey, $config) {
            $v = trim((string)$value);
            $v = ltrim($v, '=');
            if ($v === '') {
                $v = $defaultKey;
            }
            if ($v === '' || !preg_match('/^[A-Za-z0-9_]+$/', $v)) {
                throw new \RuntimeException($this->msg('err_invalid_process_name'));
            }
            if (array_key_exists($v, $config)) {
                throw new \RuntimeException($this->msg('err_process_name_exists', ['{key}' => $v]));
            }
            return $v;
        });
        $q->setMaxAttempts(3);
        /** @var string $key */
        $key = $this->askOrAbort($input, $output, $q);
        return $key;
    }

    /**
     * Infer plugin name for config update.
     * - Prefer explicit --plugin/-p.
     * - If not provided, but --path/-P points to plugin/<name>/..., infer <name>.
     *
     * @param string|null $plugin
     * @param string|null $path
     * @return string|null
     */
    private function inferPluginNameForConfig(?string $plugin, ?string $path): ?string
    {
        if ($plugin) {
            return trim($plugin);
        }
        if (!$path) {
            return null;
        }
        $pathNorm = $this->normalizeRelativePath($path);
        if (preg_match('#^plugin/([^/]+)/#i', $pathNorm, $m)) {
            $name = trim((string)($m[1] ?? ''));
            return $name !== '' ? $name : null;
        }
        return null;
    }

    /**
     * @param mixed $item
     * @return string
     */
    private function stringifyHandler(mixed $item): string
    {
        if (!is_array($item)) {
            return '(unknown)';
        }
        $handler = $item['handler'] ?? null;
        if (is_string($handler) && $handler !== '') {
            return $handler;
        }
        if (is_object($handler)) {
            return get_class($handler);
        }
        return '(unknown)';
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return string protocol: websocket|http|tcp|udp
     */
    private function askProtocol(InputInterface $input, OutputInterface $output): string
    {
        $default = '1';
        $prompt = $this->msg('ask_protocol');
        $q = new Question($prompt, $default);
        $q->setValidator(function (mixed $value) {
            $v = strtolower(trim((string)$value));
            $v = ltrim($v, '=');
            if ($v === '') {
                $v = '1';
            }
            if (isset(self::PROTOCOLS[$v])) {
                return self::PROTOCOLS[$v];
            }
            $v = str_replace([' ', '-'], '', $v);
            $aliases = [
                'ws' => 'websocket',
                'websocket' => 'websocket',
                'http' => 'http',
                'tcp' => 'tcp',
                'udp' => 'udp',
            ];
            if (isset($aliases[$v])) {
                return $aliases[$v];
            }
            throw new \RuntimeException($this->msg('err_invalid_protocol'));
        });
        $q->setMaxAttempts(3);
        /** @var string $protocol */
        $protocol = $this->askOrAbort($input, $output, $q);
        return $protocol;
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return string builtin|custom
     */
    private function askHttpMode(InputInterface $input, OutputInterface $output): string
    {
        $q = new Question($this->msg('ask_http_mode'), '1');
        $q->setValidator(function (mixed $value) {
            $v = strtolower(trim((string)$value));
            $v = ltrim($v, '=');
            if ($v === '' || $v === '1' || $v === 'builtin') {
                return 'builtin';
            }
            if ($v === '2' || $v === 'custom') {
                return 'custom';
            }
            throw new \RuntimeException($this->msg('err_invalid_http_mode'));
        });
        $q->setMaxAttempts(3);
        /** @var string $mode */
        $mode = $this->askOrAbort($input, $output, $q);
        return $mode;
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @param string $snakeKey
     * @param string $protocol
     * @return string listen string
     */
    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return string none|port|unixsocket
     */
    private function askListenMode(InputInterface $input, OutputInterface $output): string
    {
        $q = new Question($this->msg('ask_listen_mode'), '');
        $q->setValidator(function (mixed $value) {
            $v = strtolower(trim((string)$value));
            $v = ltrim($v, '=');
            if ($v === '' || $v === 'n' || $v === 'no' || $v === '0') {
                return 'none';
            }
            if ($v === '1' || $v === 'port') {
                return 'port';
            }
            if ($v === '2' || $v === 'unix' || $v === 'unixsocket' || $v === 'sock') {
                return 'unixsocket';
            }
            throw new \RuntimeException($this->msg('err_invalid_listen_mode'));
        });
        $q->setMaxAttempts(3);
        /** @var string $mode */
        $mode = $this->askOrAbort($input, $output, $q);
        return $mode;
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return string ip
     */
    private function askIp(InputInterface $input, OutputInterface $output): string
    {
        $ips = $this->collectIps();

        $menu = [];
        $menu['1'] = '0.0.0.0';
        $menu['2'] = '127.0.0.1';
        $i = 3;
        if (!empty($ips['lan'])) {
            $menu[(string)$i] = $ips['lan'];
            $i++;
        }
        if (!empty($ips['wan'])) {
            $menu[(string)$i] = $ips['wan'];
            $i++;
        }

        $lines = [];
        $lines[] = $this->msg('ask_ip');
        $lines[] = $this->msg('ask_ip_options', ['{options}' => $this->formatIpOptions($menu, $ips)]);
        $prompt = implode("\n", $lines);

        $q = new Question($prompt, '1');
        $q->setValidator(function (mixed $value) use ($menu) {
            $v = trim((string)$value);
            $v = ltrim($v, '=');
            if ($v === '') {
                $v = '1';
            }
            if (isset($menu[$v])) {
                return $menu[$v];
            }
            // allow manual ip input
            if (filter_var($v, FILTER_VALIDATE_IP)) {
                return $v;
            }
            throw new \RuntimeException($this->msg('err_invalid_ip'));
        });
        $q->setMaxAttempts(3);
        /** @var string $ip */
        $ip = $this->askOrAbort($input, $output, $q);
        return $ip;
    }

    /**
     * @param array<string,string> $menu
     * @param array{lan?:string,wan?:string} $ips
     * @return string
     */
    private function formatIpOptions(array $menu, array $ips): string
    {
        $labels = [];
        foreach ($menu as $k => $ip) {
            $suffix = '';
            if ($ip === '0.0.0.0') {
                $suffix = $this->msg('ip_any_suffix');
            } else if ($ip === '127.0.0.1') {
                $suffix = $this->msg('ip_loopback_suffix');
            } else if (($ips['lan'] ?? null) === $ip) {
                $suffix = $this->msg('ip_lan_suffix');
            } else if (($ips['wan'] ?? null) === $ip) {
                $suffix = $this->msg('ip_wan_suffix');
            }
            $labels[] = "  [{$k}] {$ip}{$suffix}";
        }
        $labels[] = '  ' . $this->msg('ip_manual_hint');
        return implode("\n", $labels);
    }

    /**
     * Ask port and warn if conflicts exist in app/plugin process configs.
     *
     * @param InputInterface $input
     * @param OutputInterface $output
     * @param array<string,mixed> $targetConfig The config array loaded from the target process.php file.
     * @param string $configFile Absolute path of target config file (for display).
     * @return int
     */
    private function askPortWithConflictCheck(InputInterface $input, OutputInterface $output, array $targetConfig, string $configFile): int
    {
        while (true) {
            $port = $this->askPort($input, $output);
            $conflicts = $this->findPortConflicts($port, $targetConfig, $configFile);
            if ($conflicts === []) {
                return $port;
            }

            $output->writeln($this->msg('warn_port_conflict', [
                '{port}' => (string)$port,
                '{items}' => $this->formatPortConflictItems($conflicts),
            ]));

            $q = new ConfirmationQuestion($this->msg('ask_port_conflict_continue'), false);
            $useAnyway = (bool)$this->askOrAbort($input, $output, $q);
            if ($useAnyway) {
                return $port;
            }
        }
    }

    /**
     * @param int $port
     * @param array<string,mixed> $targetConfig
     * @param string $configFile
     * @return array<int,array{key:string,listen:string,source:string}>
     */
    private function findPortConflicts(int $port, array $targetConfig, string $configFile): array
    {
        $items = [];
        foreach ($this->collectProcessConfigFiles($configFile) as $file) {
            $cfg = $file === $configFile ? $targetConfig : $this->loadPhpConfigArray($file);
            if ($cfg === null || !is_array($cfg) || $cfg === []) {
                continue;
            }
            foreach ($this->extractProcessListenItems($cfg, $this->toRelativePath($file)) as $it) {
                $p = $this->extractPortFromListen($it['listen']);
                if ($p !== null && $p === $port) {
                    $items[] = $it;
                }
            }
        }

        // De-dup by (source file + key).
        $seen = [];
        $uniq = [];
        foreach ($items as $it) {
            $sig = (string)($it['source'] ?? '') . "\n" . (string)($it['key'] ?? '');
            if (isset($seen[$sig])) {
                continue;
            }
            $seen[$sig] = true;
            $uniq[] = $it;
        }
        return $uniq;
    }

    /**
     * @param string $targetConfigFile
     * @return array<int,string> absolute file paths
     */
    private function collectProcessConfigFiles(string $targetConfigFile): array
    {
        $files = [];
        $targetConfigFile = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $targetConfigFile);
        if ($targetConfigFile !== '') {
            $files[] = $targetConfigFile;
        }
        $main = config_path() . DIRECTORY_SEPARATOR . 'process.php';
        $files[] = $main;

        $pluginRoot = base_path('plugin');
        $pluginPattern = rtrim((string)$pluginRoot, "\\/") . DIRECTORY_SEPARATOR . '*' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'process.php';
        $pluginFiles = glob($pluginPattern) ?: [];
        foreach ($pluginFiles as $f) {
            if (is_string($f) && $f !== '') {
                $files[] = $f;
            }
        }

        // unique, existing only
        $seen = [];
        $uniq = [];
        foreach ($files as $f) {
            $f = (string)$f;
            if ($f === '' || !is_file($f)) {
                continue;
            }
            $k = strtolower(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $f));
            if (isset($seen[$k])) {
                continue;
            }
            $seen[$k] = true;
            $uniq[] = $f;
        }
        return $uniq;
    }

    /**
     * @param array<string,mixed> $processConfig
     * @param string $source
     * @return array<int,array{key:string,listen:string,source:string}>
     */
    private function extractProcessListenItems(array $processConfig, string $source): array
    {
        $items = [];
        foreach ($processConfig as $key => $cfg) {
            if (!is_array($cfg)) {
                continue;
            }
            $listen = $cfg['listen'] ?? null;
            if (!is_string($listen) || $listen === '') {
                continue;
            }
            $items[] = [
                'key' => is_string($key) ? $key : (string)$key,
                'listen' => $listen,
                'source' => $source,
            ];
        }
        return $items;
    }

    /**
     * @param array<int,array{key:string,listen:string,source:string}> $items
     * @return string
     */
    private function formatPortConflictItems(array $items): string
    {
        $lines = [];
        foreach ($items as $it) {
            $key = (string)($it['key'] ?? '');
            $src = (string)($it['source'] ?? '');
            $lines[] = $src !== '' ? "  - {$src}  <comment>({$key})</comment>" : "  - {$key}";
        }
        return implode("\n", $lines);
    }

    private function extractPortFromListen(string $listen): ?int
    {
        if (str_starts_with($listen, 'unix://')) {
            return null;
        }
        if (str_contains($listen, '://')) {
            $p = parse_url($listen, PHP_URL_PORT);
            if (is_int($p)) {
                return $p;
            }
            if (is_string($p) && ctype_digit($p)) {
                return (int)$p;
            }
            return null;
        }
        if (preg_match('/:(\d{1,5})$/', $listen, $m)) {
            $p = (int)$m[1];
            return ($p >= 1 && $p <= 65535) ? $p : null;
        }
        return null;
    }

    private function buildListenString(string $protocol, string $ip, int $port): string
    {
        $scheme = match ($protocol) {
            'websocket' => 'websocket://',
            'http' => 'http://',
            'tcp' => 'tcp://',
            'udp' => 'udp://',
            default => '',
        };
        return $scheme . $ip . ':' . $port;
    }

    /**
     * @return array{lan?:string,wan?:string}
     */
    private function collectIps(): array
    {
        $lan = null;
        try {
            $host = gethostname();
            if ($host) {
                $ip = gethostbyname($host);
                if ($ip && filter_var($ip, FILTER_VALIDATE_IP) && !str_starts_with($ip, '127.')) {
                    $lan = $ip;
                }
            }
        } catch (\Throwable) {
        }

        $wan = null;
        try {
            $context = stream_context_create([
                'http' => ['timeout' => 2],
                'https' => ['timeout' => 2],
            ]);
            $ip = @file_get_contents('https://api.ipify.org', false, $context);
            $ip = is_string($ip) ? trim($ip) : '';
            if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) {
                $wan = $ip;
            }
        } catch (\Throwable) {
        }

        return array_filter(['lan' => $lan, 'wan' => $wan], static fn($v) => is_string($v) && $v !== '');
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int port
     */
    private function askPort(InputInterface $input, OutputInterface $output): int
    {
        $q = new Question($this->msg('ask_port'));
        $q->setValidator(function (mixed $value) {
            $v = trim((string)$value);
            $v = ltrim($v, '=');
            if ($v === '' || !ctype_digit($v)) {
                throw new \RuntimeException($this->msg('err_invalid_port'));
            }
            $port = (int)$v;
            if ($port < 1 || $port > 65535) {
                throw new \RuntimeException($this->msg('err_invalid_port_range'));
            }
            return $port;
        });
        $q->setMaxAttempts(3);
        /** @var int $port */
        $port = $this->askOrAbort($input, $output, $q);
        return $port;
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @param string $snakeKey
     * @return string
     */
    private function askUnixSocketPathRelative(InputInterface $input, OutputInterface $output, string $snakeKey): string
    {
        $default = $snakeKey . '.sock';
        $q = new Question($this->msg('ask_unixsocket', ['{default}' => 'runtime/' . $default]), $default);
        $q->setValidator(function (mixed $value) {
            $v = trim((string)$value);
            $v = ltrim($v, '=');
            if ($v === '') {
                throw new \RuntimeException($this->msg('err_invalid_unixsocket_path'));
            }
            $v = str_replace('\\', '/', $v);
            $v = trim($v);
            if ($v === '' || str_contains($v, '://')) {
                throw new \RuntimeException($this->msg('err_invalid_unixsocket_path'));
            }
            // normalize: allow "runtime/foo.sock" but store "foo.sock"
            $v = preg_replace('#^runtime/+?#i', '', $v);
            $v = ltrim($v, '/');
            if ($v === '' || $this->isAbsolutePath($v) || str_starts_with($v, '../') || str_contains($v, '/..')) {
                throw new \RuntimeException($this->msg('err_invalid_unixsocket_path'));
            }
            return $v;
        });
        $q->setMaxAttempts(3);
        /** @var string $path */
        $path = $this->askOrAbort($input, $output, $q);
        return $path;
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @param string|null $protocol
     * @param string|null $httpMode
     * @return array{kind:string,value:int|string} kind=int|raw
     */
    private function askProcessCount(InputInterface $input, OutputInterface $output, ?string $protocol, ?string $httpMode): array
    {
        $default = '1';
        $defaultRaw = null;
        if ($protocol === 'http' && $httpMode === 'builtin') {
            $default = '';
            $defaultRaw = 'cpu_count() * 4';
        }

        $usedDefault = false;
        $usedDefaultValue = '';
        $prompt = $this->msg('ask_count', [
            '{default}' => $defaultRaw ?: $default,
        ]);
        $q = new Question($prompt, $default);
        $q->setValidator(function (mixed $value) use ($defaultRaw, $default, &$usedDefault, &$usedDefaultValue) {
            $v = trim((string)$value);
            $v = ltrim($v, '=');
            if ($v === '') {
                if ($defaultRaw) {
                    $usedDefault = true;
                    $usedDefaultValue = $defaultRaw;
                    return ['kind' => 'raw', 'value' => $defaultRaw];
                }
                $usedDefault = true;
                $usedDefaultValue = $default;
                return ['kind' => 'int', 'value' => (int)$default];
            }
            if (!ctype_digit($v)) {
                throw new \RuntimeException($this->msg('err_invalid_count_int'));
            }
            $count = (int)$v;
            if ($count < 1) {
                throw new \RuntimeException($this->msg('err_invalid_count_min'));
            }
            return ['kind' => 'int', 'value' => $count];
        });
        $q->setMaxAttempts(3);
        /** @var array{kind:string,value:int|string} $count */
        $count = $this->askOrAbort($input, $output, $q);

        if ($usedDefault && $usedDefaultValue !== '') {
            $output->writeln($this->msg('used_default_count', ['{value}' => $usedDefaultValue]));
        }
        return $count;
    }

    /**
     * Build handler FQN.
     *
     * @param string $namespace
     * @param string $class
     * @param string|null $pluginForConfig
     * @param string|null $protocol
     * @param string|null $httpMode
     * @return string class FQN without leading backslash
     */
    private function buildHandlerFqn(string $namespace, string $class, ?string $pluginForConfig, ?string $protocol, ?string $httpMode): string
    {
        if ($protocol === 'http' && $httpMode === 'builtin') {
            // Always reuse the project built-in http process class.
            return 'app\process\Http';
        }
        return trim($namespace . '\\' . $class, '\\');
    }

    /**
     * @param string $key
     * @param string $handlerFqn
     * @param array{kind:string,value:string}|null $listenValue
     * @param array{kind:string,value:int|string} $countValue
     * @param string|null $protocol
     * @param string|null $httpMode
     * @return string config entry text with indentation (4 spaces)
     */
    private function buildProcessConfigEntry(
        string $key,
        string $handlerFqn,
        mixed $listenValue,
        array $countValue,
        ?string $protocol,
        ?string $httpMode
    ): string {
        $eol = "\n";
        $lines = [];
        $lines[] = "    " . var_export($key, true) . " => [";
        $lines[] = "        'handler' => {$handlerFqn}::class,";

        if (is_array($listenValue)) {
            $kind = (string)($listenValue['kind'] ?? '');
            $value = $listenValue['value'] ?? null;
            if ($kind === 'raw' && is_string($value) && $value !== '') {
                $lines[] = "        'listen' => {$value},";
            } else if ($kind === 'string' && is_string($value) && $value !== '') {
                $lines[] = "        'listen' => " . var_export($value, true) . ",";
            }
        }

        // count (optional in webman, but we always write for clarity)
        if (($countValue['kind'] ?? '') === 'raw') {
            $lines[] = "        'count' => {$countValue['value']},";
        } else {
            $lines[] = "        'count' => " . (int)$countValue['value'] . ",";
        }

        if ($protocol === 'http' && $httpMode === 'builtin') {
            // Align with webman built-in http process config style.
            $lines[] = "        'user' => '',";
            $lines[] = "        'group' => '',";
            $lines[] = "        'reusePort' => false,";
            $lines[] = "        'eventLoop' => '',";
            $lines[] = "        'context' => [],";
            $lines[] = "        'constructor' => [";
            $lines[] = "            'requestClass' => \\support\\Request::class,";
            $lines[] = "            'logger' => \\support\\Log::channel('default'),";
            $lines[] = "            'appPath' => app_path(),";
            $lines[] = "            'publicPath' => public_path(),";
            $lines[] = "        ],";
        }

        $lines[] = "    ],";
        return implode($eol, $lines);
    }

    /**
     * Append a single entry to process config file without rewriting the whole file
     * (to preserve existing code, e.g. global $argv usage).
     *
     * @param string $configFile
     * @param string $entryText
     * @return bool
     */
    private function appendProcessConfigEntry(string $configFile, string $entryText): bool
    {
        $eol = "\n";
        if (is_file($configFile)) {
            $content = file_get_contents($configFile);
            if (!is_string($content) || trim($content) === '') {
                // Treat empty/broken file as new config file to avoid leaving it unusable.
                $header = $this->getPhpHeaderWithDocblock($configFile);
                $body = "return [{$eol}{$entryText}{$eol}];{$eol}";
                return $this->writeFileSafelyWithBackup($configFile, $header . $body);
            }
            if (str_contains($content, "\r\n")) {
                $eol = "\r\n";
                $entryText = str_replace("\n", "\r\n", $entryText);
            }

            $pos = strrpos($content, '];');
            if ($pos === false) {
                return false;
            }

            $head = substr($content, 0, $pos);
            $tail = substr($content, $pos); // starts with ];
            $headTrim = rtrim($head);
            $last = $headTrim !== '' ? substr($headTrim, -1) : '';
            // Avoid leading comma for empty arrays: return [ ... ];
            $needsComma = ($last !== '' && $last !== '[' && $last !== ',');
            $insert = ($needsComma ? ',' : '') . $eol . $entryText . $eol;
            $newContent = $headTrim . $insert . $tail;
            return $this->writeFileSafelyWithBackup($configFile, $newContent);
        }

        // Create new config file.
        $this->ensureParentDir($configFile);
        $header = "<?php{$eol}{$eol}";
        $body = "return [{$eol}{$entryText}{$eol}];{$eol}";
        return $this->writeFileSafelyWithBackup($configFile, $header . $body);
    }

    private function writeFileSafelyWithBackup(string $file, string $content): bool
    {
        $this->ensureParentDir($file);
        $dir = pathinfo($file, PATHINFO_DIRNAME);
        $tmp = tempnam($dir ?: sys_get_temp_dir(), 'webman_process_');
        if (!is_string($tmp) || $tmp === '') {
            return false;
        }
        $written = file_put_contents($tmp, $content, LOCK_EX);
        if (!is_int($written) || $written < 0) {
            @unlink($tmp);
            return false;
        }

        $bak = $file . '.bak';
        if (is_file($bak)) {
            @unlink($bak);
        }

        // Two-step replace: move original to .bak, then move tmp to target.
        if (is_file($file)) {
            if (!@rename($file, $bak)) {
                @unlink($tmp);
                return false;
            }
        }

        if (!@rename($tmp, $file)) {
            // Try to restore.
            @unlink($tmp);
            if (is_file($bak)) {
                @rename($bak, $file);
            }
            return false;
        }
        return true;
    }

    /**
     * @param string|null $protocol
     * @param string|null $httpMode
     * @param string $namespace
     * @param string $class
     * @param string $file
     * @param string $snakeKey
     * @param string|null $listen
     * @return void
     */
    private function createProcessFile(
        ?string $protocol,
        ?string $httpMode,
        string $namespace,
        string $class,
        string $file,
        string $snakeKey,
        ?string $listen
    ): void {
        $this->ensureParentDir($file);
        $content = $this->renderProcessClass($protocol, $httpMode, $namespace, $class, $snakeKey, $listen);
        file_put_contents($file, $content);
    }

    /**
     * @param string|null $protocol
     * @param string|null $httpMode
     * @param string $namespace
     * @param string $class
     * @param string $snakeKey
     * @param string|null $listen
     * @return string
     */
    private function renderProcessClass(
        ?string $protocol,
        ?string $httpMode,
        string $namespace,
        string $class,
        string $snakeKey,
        ?string $listen
    ): string {
        $protocol = $protocol ?: 'none';

        // Non-listening or unknown: generate a minimal template.
        if ($protocol === 'none') {
            return $this->renderNonListeningProcess($namespace, $class);
        }

        if ($protocol === 'http' && $httpMode === 'custom') {
            return $this->renderCustomHttpProcess($namespace, $class);
        }

        if ($protocol === 'websocket') {
            return $this->renderWebsocketProcess($namespace, $class);
        }

        if ($protocol === 'udp') {
            return $this->renderUdpProcess($namespace, $class);
        }

        // tcp/unixsocket use TcpConnection template
        return $this->renderTcpProcess($namespace, $class);
    }

    private function renderNonListeningProcess(string $namespace, string $class): string
    {
        return <<<PHP
<?php

namespace {$namespace};

use Workerman\\Worker;

class {$class}
{
    /**
     * Called when the worker process starts.
     *
     * @param Worker \$worker
     * @return void
     */
    public function onWorkerStart(Worker \$worker)
    {
        // TODO: Write your business logic here.
    }
}

PHP;
    }

    private function renderCustomHttpProcess(string $namespace, string $class): string
    {
        return <<<PHP
<?php

namespace {$namespace};

use Workerman\\Connection\\TcpConnection;
use Workerman\\Protocols\\Http\\Request;
use Workerman\\Worker;

class {$class}
{
    /**
     * Called when the worker process starts.
     *
     * @param Worker \$worker
     * @return void
     */
    public function onWorkerStart(Worker \$worker)
    {
    }

    /**
     * Called when a HTTP request is received.
     *
     * @param TcpConnection \$connection
     * @param Request \$request
     * @return void
     */
    public function onMessage(TcpConnection \$connection, Request \$request)
    {
        \$connection->send('Hello $class');
    }
}

PHP;
    }

    private function renderTcpProcess(string $namespace, string $class): string
    {
        return <<<PHP
<?php

namespace {$namespace};

use Workerman\\Connection\\TcpConnection;
use Workerman\\Worker;

class {$class}
{
    /**
     * Called when the worker process starts.
     *
     * @param Worker \$worker
     * @return void
     */
    public function onWorkerStart(Worker \$worker)
    {
    }

    /**
     * Called when a new connection is established.
     *
     * @param TcpConnection \$connection
     * @return void
     */
    public function onConnect(TcpConnection \$connection)
    {
    }

    /**
     * Called when a message is received from the client.
     *
     * @param TcpConnection \$connection
     * @param string \$data
     * @return void
     */
    public function onMessage(TcpConnection \$connection, string \$data)
    {
        \$connection->send(\$data);
    }

    /**
     * Called when the connection is closed.
     *
     * @param TcpConnection \$connection
     * @return void
     */
    public function onClose(TcpConnection \$connection)
    {
    }
}

PHP;
    }

    private function renderUdpProcess(string $namespace, string $class): string
    {
        return <<<PHP
<?php

namespace {$namespace};

use Workerman\\Connection\\UdpConnection;
use Workerman\\Worker;

class {$class}
{
    /**
     * Called when the worker process starts.
     *
     * @param Worker \$worker
     * @return void
     */
    public function onWorkerStart(Worker \$worker)
    {
    }

    /**
     * Called when a message is received from the client.
     *
     * @param UdpConnection \$connection
     * @param string \$data
     * @return void
     */
    public function onMessage(UdpConnection \$connection, string \$data)
    {
        \$connection->send(\$data);
    }
}

PHP;
    }

    private function renderWebsocketProcess(string $namespace, string $class): string
    {
        return <<<PHP
<?php

namespace {$namespace};

use Workerman\\Connection\\TcpConnection;
use Workerman\\Protocols\\Http\\Request;
use Workerman\\Worker;

class {$class}
{
    /**
     * Called when the worker process starts.
     *
     * @param Worker \$worker
     * @return void
     */
    public function onWorkerStart(Worker \$worker)
    {
    }

    /**
     * Called when a new connection is established.
     *
     * @param TcpConnection \$connection
     * @return void
     */
    public function onConnect(TcpConnection \$connection)
    {
    }

    /**
     * Called when WebSocket handshake is completed.
     *
     * @param TcpConnection \$connection
     * @param Request \$request
     * @return void
     */
    public function onWebSocketConnect(TcpConnection \$connection, Request \$request)
    {        
    }

    /**
     * Called when a message is received from the client.
     *
     * @param TcpConnection \$connection
     * @param string \$data
     * @return void
     */
    public function onMessage(TcpConnection \$connection, string \$data)
    {
        \$connection->send(\$data);
    }

    /**
     * Called when the connection is closed.
     *
     * @param TcpConnection \$connection
     * @return void
     */
    public function onClose(TcpConnection \$connection)
    {
    }
}

PHP;
    }

    /**
     * @return string
     */
    protected function buildHelpText(): string
    {
        return Util::selectByLocale(Messages::getMakeProcessHelpText());
    }

    protected function msg(string $key, array $replace = []): string
    {
        return strtr(Util::selectLocaleMessages(Messages::getMakeProcessMessages())[$key] ?? $key, $replace);
    }
}
