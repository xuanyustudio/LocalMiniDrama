<?php
namespace Webman\Console;

use Doctrine\Inflector\InflectorFactory;

class Util
{
    /**
     * Get current locale for CLI messages. Default is en.
     * All commands can use this to get the current language for prompts.
     *
     * @return string
     */
    public static function getLocale(): string
    {
        $locale = 'en';
        if (function_exists('config')) {
            $value = config('translation.locale', 'en');
            $value = is_string($value) ? trim($value) : '';
            if ($value !== '') {
                $locale = $value;
            }
        }
        return $locale;
    }

    /**
     * Select message map by current locale. Fallback: exact -> language prefix -> en -> zh_CN -> first.
     *
     * @param array<string, array<string, string>> $localeToMessages e.g. ['zh_CN' => ['key' => '...'], 'en' => [...]]
     * @return array<string, string>
     */
    public static function selectLocaleMessages(array $localeToMessages): array
    {
        $locale = self::getLocale();
        if (isset($localeToMessages[$locale])) {
            return $localeToMessages[$locale];
        }
        $lang = explode('_', $locale)[0] ?? '';
        if ($lang !== '' && isset($localeToMessages[$lang])) {
            return $localeToMessages[$lang];
        }
        // Use configured fallback locales if available, otherwise default to ['en'].
        $fallbacks = ['en'];
        if (function_exists('config')) {
            $cfg = config('translation.fallback_locale', $fallbacks);
            if (is_string($cfg)) {
                $cfg = [$cfg];
            }
            if (is_array($cfg) && !empty($cfg)) {
                $fallbacks = $cfg;
            }
        }
        foreach ($fallbacks as $fb) {
            if (isset($localeToMessages[$fb])) {
                return $localeToMessages[$fb];
            }
        }
        $first = reset($localeToMessages);
        return is_array($first) ? $first : [];
    }

    /**
     * Select one value by current locale. Fallback: exact -> language prefix -> en -> zh_CN -> first.
     *
     * @param array<string, string> $localeToValue e.g. ['zh_CN' => '简体', 'en' => 'English']
     * @return string
     */
    public static function selectByLocale(array $localeToValue): string
    {
        $locale = self::getLocale();
        if (isset($localeToValue[$locale])) {
            return $localeToValue[$locale];
        }
        $lang = explode('_', $locale)[0] ?? '';
        if ($lang !== '' && isset($localeToValue[$lang])) {
            return $localeToValue[$lang];
        }
        // Use configured fallback locales if available, otherwise default to ['en'].
        $fallbacks = ['en'];
        if (function_exists('config')) {
            $cfg = config('translation.fallback_locale', $fallbacks);
            if (is_string($cfg)) {
                $cfg = [$cfg];
            }
            if (is_array($cfg) && !empty($cfg)) {
                $fallbacks = $cfg;
            }
        }
        foreach ($fallbacks as $fb) {
            if (isset($localeToValue[$fb])) {
                return $localeToValue[$fb];
            }
        }
        $first = reset($localeToValue);
        return is_string($first) ? $first : '';
    }

    /**
     * Select an array by current locale (e.g. table headers). Fallback: exact -> language prefix -> en -> zh_CN -> first.
     *
     * @param array<string, array> $localeToArray e.g. ['zh_CN' => ['A','B'], 'en' => ['A','B']]
     * @return array
     */
    public static function selectLocaleArray(array $localeToArray): array
    {
        $locale = self::getLocale();
        if (isset($localeToArray[$locale])) {
            return $localeToArray[$locale];
        }
        $lang = explode('_', $locale)[0] ?? '';
        if ($lang !== '' && isset($localeToArray[$lang])) {
            return $localeToArray[$lang];
        }
        // Use configured fallback locales if available, otherwise default to ['en'].
        $fallbacks = ['en'];
        if (function_exists('config')) {
            $cfg = config('translation.fallback_locale', $fallbacks);
            if (is_string($cfg)) {
                $cfg = [$cfg];
            }
            if (is_array($cfg) && !empty($cfg)) {
                $fallbacks = $cfg;
            }
        }
        foreach ($fallbacks as $fb) {
            if (isset($localeToArray[$fb])) {
                return $localeToArray[$fb];
            }
        }
        $first = reset($localeToArray);
        return is_array($first) ? $first : [];
    }

    /**
     * Execute an external shell command using the best available PHP function.
     *
     * Non-interactive (default): captures output, stdin from null device to prevent blocking.
     *   Tries: proc_open -> exec -> system -> passthru -> popen
     *
     * Interactive ($interactive = true): passes I/O through to the terminal so the user
     *   can see prompts and respond. Output is not captured (returned as empty string).
     *   Tries: passthru -> system -> proc_open
     *   If no interactive-capable function is available, returns null.
     *
     * @param string $command
     * @param bool $interactive
     * @return array{output: string, exit_code: int}|null null if no suitable function is available
     */
    public static function exec(string $command, bool $interactive = false): ?array
    {
        return $interactive
            ? static::execInteractive($command)
            : static::execCapture($command);
    }

    /**
     * Run a command with terminal passthrough — user can see output and respond to prompts.
     */
    protected static function execInteractive(string $command): ?array
    {
        if (static::isCallable('passthru')) {
            $code = 0;
            passthru($command, $code);
            return ['output' => '', 'exit_code' => $code];
        }

        if (static::isCallable('system')) {
            $code = 0;
            system($command, $code);
            return ['output' => '', 'exit_code' => $code];
        }

        if (static::isCallable('proc_open') && defined('STDIN')) {
            $process = proc_open($command, [STDIN, STDOUT, STDERR], $pipes);
            if (is_resource($process)) {
                return ['output' => '', 'exit_code' => proc_close($process)];
            }
        }

        return null;
    }

    /**
     * Run a command non-interactively — capture output, stdin from null device to prevent blocking.
     */
    protected static function execCapture(string $command): ?array
    {
        $nullDevice = PHP_OS_FAMILY === 'Windows' ? 'NUL' : '/dev/null';

        if (static::isCallable('proc_open')) {
            $process = proc_open($command, [
                0 => ['file', $nullDevice, 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ], $pipes);
            if (is_resource($process)) {
                $stdout = (string)stream_get_contents($pipes[1]);
                $stderr = (string)stream_get_contents($pipes[2]);
                fclose($pipes[1]);
                fclose($pipes[2]);
                $exitCode = proc_close($process);
                return ['output' => trim($stdout . $stderr), 'exit_code' => $exitCode];
            }
        }

        $cmd = "$command < $nullDevice 2>&1";

        if (static::isCallable('exec')) {
            $lines = [];
            $code = 0;
            exec($cmd, $lines, $code);
            return ['output' => implode("\n", $lines), 'exit_code' => $code];
        }

        if (static::isCallable('system')) {
            ob_start();
            $code = 0;
            system($cmd, $code);
            return ['output' => trim((string)ob_get_clean()), 'exit_code' => $code];
        }

        if (static::isCallable('passthru')) {
            ob_start();
            $code = 0;
            passthru($cmd, $code);
            return ['output' => trim((string)ob_get_clean()), 'exit_code' => $code];
        }

        if (static::isCallable('popen')) {
            $handle = popen($cmd, 'r');
            if ($handle !== false) {
                $output = (string)stream_get_contents($handle);
                $exitCode = pclose($handle);
                return ['output' => trim($output), 'exit_code' => $exitCode];
            }
        }

        return null;
    }

    /**
     * Check whether a function exists and is not disabled.
     *
     * @param string $function
     * @return bool
     */
    public static function isCallable(string $function): bool
    {
        return function_exists($function) && is_callable($function);
    }

    public static function nameToNamespace($name)
    {
        $namespace = ucfirst($name);
        $namespace = preg_replace_callback(['/-([a-zA-Z])/', '/(\/[a-zA-Z])/'], function ($matches) {
            return strtoupper($matches[1]);
        }, $namespace);
        return str_replace('/', '\\' ,ucfirst($namespace));
    }

    public static function classToName($class)
    {
        $class = lcfirst($class);
        return preg_replace_callback(['/([A-Z])/'], function ($matches) {
            return '_' . strtolower($matches[1]);
        }, $class);
    }

    public static function nameToClass($class)
    {
        $class = preg_replace_callback(['/-([a-zA-Z])/', '/_([a-zA-Z])/'], function ($matches) {
            return strtoupper($matches[1]);
        }, $class);

        if (!($pos = strrpos($class, '/'))) {
            $class = ucfirst($class);
        } else {
            $path = substr($class, 0, $pos);
            $class = ucfirst(substr($class, $pos + 1));
            $class = "$path/$class";
        }
        return $class;
    }

    public static function guessPath($base_path, $name, $return_full_path = false)
    {
        if (!is_dir($base_path)) {
            return false;
        }
        $names = explode('/', trim(strtolower($name), '/'));
        $realname = [];
        $path = $base_path;
        foreach ($names as $name) {
            $finded = false;
            foreach (scandir($path) ?: [] as $tmp_name) {
                if (strtolower($tmp_name) === $name && is_dir("$path/$tmp_name")) {
                    $path = "$path/$tmp_name";
                    $realname[] = $tmp_name;
                    $finded = true;
                    break;
                }
            }
            if (!$finded) {
                return false;
            }
        }
        $realname = implode(DIRECTORY_SEPARATOR, $realname);
        return $return_full_path ? get_realpath($base_path . DIRECTORY_SEPARATOR . $realname) : $realname;
    }

    /**
     * Get the default directory name for a given type (controller, model, etc.)
     * by detecting the actual local directory structure.
     *
     * Priority when multiple matches exist:
     * 1. All lowercase (e.g. "controller")
     * 2. First-letter uppercase (e.g. "Controller")
     * 3. Any other casing found
     *
     * @param string $type Directory type, e.g. "controller", "model", "middleware", "bootstrap", "command", "process", "validation"
     * @param string|null $plugin Plugin name, e.g. "admin"
     * @return string The directory name with correct casing, e.g. "controller" or "Controller"
     */
    public static function getDefaultAppPath(string $type, ?string $plugin = null): string
    {
        $type = strtolower(trim($type));
        if ($type === '') {
            return '';
        }

        // Determine the base app directory.
        if ($plugin) {
            $appDirName = self::detectAppDirName($plugin);
            $baseDir = base_path('plugin' . DIRECTORY_SEPARATOR . trim($plugin) . DIRECTORY_SEPARATOR . $appDirName);
        } else {
            $baseDir = app_path();
        }

        // Try to find the exact directory on disk (case-insensitive).
        if (is_dir($baseDir)) {
            $matches = [];
            foreach (scandir($baseDir) ?: [] as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }
                if (strtolower($entry) === $type && is_dir($baseDir . DIRECTORY_SEPARATOR . $entry)) {
                    $matches[] = $entry;
                }
            }

            if (count($matches) === 1) {
                return $matches[0];
            }

            if (count($matches) > 1) {
                // Priority: all lowercase > first-letter uppercase > others
                foreach ($matches as $m) {
                    if ($m === $type) {
                        return $m; // all lowercase
                    }
                }
                $ucfirst = ucfirst($type);
                foreach ($matches as $m) {
                    if ($m === $ucfirst) {
                        return $m; // first-letter uppercase
                    }
                }
                return $matches[0]; // first found
            }
        }

        // No match found. Determine casing convention from existing siblings.
        return self::guessAppDirCase($type, $baseDir);
    }

    /**
     * Get the full relative path for a type directory with correct casing.
     *
     * Examples:
     * - getDefaultAppRelativePath('controller')         => "app/controller" or "app/Controller"
     * - getDefaultAppRelativePath('model', 'admin')     => "plugin/admin/app/model" or "plugin/admin/app/Model"
     *
     * @param string $type
     * @param string|null $plugin
     * @return string
     */
    public static function getDefaultAppRelativePath(string $type, ?string $plugin = null): string
    {
        $dirName = self::getDefaultAppPath($type, $plugin);
        if ($plugin) {
            $appDirName = self::detectAppDirName($plugin);
            return 'plugin/' . trim($plugin) . '/' . $appDirName . '/' . $dirName;
        }

        // Detect the actual "app" directory name casing.
        $appDirName = self::detectAppDirName($plugin);
        return $appDirName . '/' . $dirName;
    }

    /**
     * Convert a relative path to a PHP namespace, preserving the original casing.
     *
     * Examples:
     * - "app/controller"               => "app\controller"
     * - "App/Controller"               => "App\Controller"
     * - "plugin/admin/app/controller"   => "plugin\admin\app\controller"
     *
     * @param string $relativePath
     * @return string
     */
    public static function pathToNamespace(string $relativePath): string
    {
        $path = trim(str_replace('\\', '/', $relativePath), '/');
        return str_replace('/', '\\', $path);
    }

    /**
     * Detect the actual casing of the "app" directory under base_path().
     *
     * @param string|null $plugin
     * @return string "app" or "App" depending on what exists on disk
     */
    public static function detectAppDirName(?string $plugin = null): string
    {
        if ($plugin) {
            $parentDir = base_path('plugin' . DIRECTORY_SEPARATOR . trim($plugin));
        } else {
            $parentDir = base_path();
        }

        if (!is_dir($parentDir)) {
            return 'app';
        }

        foreach (scandir($parentDir) ?: [] as $entry) {
            if (strtolower($entry) === 'app' && is_dir($parentDir . DIRECTORY_SEPARATOR . $entry)) {
                return $entry;
            }
        }

        return 'app';
    }

    /**
     * Guess the directory name casing for a type that doesn't yet exist,
     * based on sibling directories' naming convention.
     *
     * Priority: if any siblings are all-lowercase, use lowercase.
     * If siblings are first-letter uppercase, use ucfirst.
     * Fallback: lowercase.
     *
     * @param string $type All-lowercase type name, e.g. "model"
     * @param string $baseDir The app directory to scan for siblings
     * @return string The type name with guessed casing
     */
    public static function guessAppDirCase(string $type, string $baseDir): string
    {
        $knownTypes = ['controller', 'model', 'middleware', 'bootstrap', 'command', 'process', 'validation', 'view', 'functions'];

        if (!is_dir($baseDir)) {
            return $type;
        }

        $hasLower = false;
        $hasUpper = false;

        foreach (scandir($baseDir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            if (!is_dir($baseDir . DIRECTORY_SEPARATOR . $entry)) {
                continue;
            }
            $lower = strtolower($entry);
            if (!in_array($lower, $knownTypes, true)) {
                continue;
            }
            if ($entry === $lower) {
                $hasLower = true;
            } else if ($entry === ucfirst($lower)) {
                $hasUpper = true;
            }
        }

        // Priority: lowercase > ucfirst > default lowercase
        if ($hasLower) {
            return $type;
        }
        if ($hasUpper) {
            return ucfirst($type);
        }
        return $type;
    }
}
