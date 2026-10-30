<?php

namespace Webman\Console\Commands\Concerns;

use Webman\Console\Messages;
use Webman\Console\Util;

trait MakeCommandHelpers
{
    /**
     * Check whether a plugin exists by config value.
     *
     * The existence rule is: config("plugin.<name>") is not empty.
     *
     * @param string $plugin
     * @return bool
     */
    protected function pluginExists(string $plugin): bool
    {
        $plugin = trim($plugin);
        if ($plugin === '') {
            return false;
        }
        $cfg = config("plugin.$plugin");
        if ($cfg === null) {
            return false;
        }
        if (is_array($cfg)) {
            return $cfg !== [];
        }
        if (is_string($cfg)) {
            return trim($cfg) !== '';
        }
        return (bool)$cfg;
    }

    /**
     * Extract plugin name from a relative path like "plugin/<name>/...".
     *
     * @param string|null $path
     * @return string|null
     */
    protected function extractPluginNameFromRelativePath(?string $path): ?string
    {
        $path = $this->normalizeOptionValue($path);
        if (!$path) {
            return null;
        }
        $path = $this->normalizeRelativePath($path);
        if (preg_match('#^plugin/([^/]+)/#i', $path, $m)) {
            $name = trim((string)($m[1] ?? ''));
            return $name !== '' ? $name : null;
        }
        return null;
    }

    /**
     * Validate plugin existence and output error message when missing.
     *
     * @param string|null $plugin
     * @param \Symfony\Component\Console\Output\OutputInterface $output
     * @return bool
     */
    protected function assertPluginExists(?string $plugin, \Symfony\Component\Console\Output\OutputInterface $output): bool
    {
        $plugin = $this->normalizeOptionValue($plugin);
        if (!$plugin) {
            return true;
        }
        if ($this->pluginExists($plugin)) {
            return true;
        }
        $output->writeln($this->renderPluginNotExistsMessage($plugin));
        return false;
    }

    /**
     * @param string $plugin
     * @return string
     */
    protected function renderPluginNotExistsMessage(string $plugin): string
    {
        $plugin = trim($plugin);
        $line1 = Util::selectByLocale([
            'zh_CN' => "<error>插件不存在：</error> <comment>{plugin}</comment>",
            'zh_TW' => "<error>外掛不存在：</error> <comment>{plugin}</comment>",
            'en' => "<error>Plugin does not exist:</error> <comment>{plugin}</comment>",
            'ja' => "<error>プラグインが存在しません:</error> <comment>{plugin}</comment>",
            'ko' => "<error>플러그인이 존재하지 않습니다:</error> <comment>{plugin}</comment>",
            'fr' => "<error>Le plugin n'existe pas :</error> <comment>{plugin}</comment>",
            'de' => "<error>Plugin existiert nicht:</error> <comment>{plugin}</comment>",
            'es' => "<error>El plugin no existe:</error> <comment>{plugin}</comment>",
            'pt_BR' => "<error>O plugin não existe:</error> <comment>{plugin}</comment>",
            'ru' => "<error>Плагин не существует:</error> <comment>{plugin}</comment>",
            'vi' => "<error>Plugin không tồn tại:</error> <comment>{plugin}</comment>",
            'tr' => "<error>Eklenti mevcut değil:</error> <comment>{plugin}</comment>",
            'id' => "<error>Plugin tidak ada:</error> <comment>{plugin}</comment>",
            'th' => "<error>ไม่พบปลั๊กอิน:</error> <comment>{plugin}</comment>",
        ]);
        $line2 = Util::selectByLocale([
            'zh_CN' => '请检查插件名是否输入正确，或确认插件已正确安装/启用。',
            'zh_TW' => '請檢查外掛名稱是否輸入正確，或確認外掛已正確安裝/啟用。',
            'en' => 'Please check the plugin name, or make sure the plugin is installed/enabled.',
            'ja' => 'プラグイン名を確認するか、プラグインがインストール/有効化されていることを確認してください。',
            'ko' => '플러그인 이름을 확인하거나, 플러그인이 설치/활성화되었는지 확인하세요.',
            'fr' => "Vérifiez le nom du plugin ou assurez-vous qu'il est installé/activé.",
            'de' => 'Bitte prüfen Sie den Plugin-Namen oder ob das Plugin installiert/aktiviert ist.',
            'es' => 'Compruebe el nombre del plugin o asegúrese de que esté instalado/habilitado.',
            'pt_BR' => 'Verifique o nome do plugin ou se o plugin está instalado/ativado.',
            'ru' => 'Проверьте имя плагина или убедитесь, что плагин установлен/включён.',
            'vi' => 'Hãy kiểm tra tên plugin hoặc đảm bảo plugin đã được cài đặt/bật.',
            'tr' => 'Eklenti adını kontrol edin veya eklentinin kurulu/etkin olduğundan emin olun.',
            'id' => 'Periksa nama plugin atau pastikan plugin sudah terpasang/diaktifkan.',
            'th' => 'โปรดตรวจสอบชื่อปลั๊กอิน หรือยืนยันว่าปลั๊กอินถูกติดตั้ง/เปิดใช้งานแล้ว',
        ]);
        return strtr($line1, ['{plugin}' => $plugin]) . "\n" . $line2;
    }

    /**
     * Symfony short options on some environments may return value like "=foo" for "-p=foo".
     * Normalize to "foo".
     *
     * @param mixed $value
     * @return string|null
     */
    protected function normalizeOptionValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim((string)$value);
        $value = ltrim($value, '=');
        return $value === '' ? null : $value;
    }

    /**
     * Normalize a relative path to use "/" separators and no leading/trailing slashes.
     *
     * @param string $path
     * @return string
     */
    protected function normalizeRelativePath(string $path): string
    {
        $path = trim($path);
        $path = str_replace('\\', '/', $path);
        $path = preg_replace('#^\\./+#', '', $path);
        $path = trim($path, '/');
        return $path;
    }

    /**
     * @param string $path
     * @return bool
     */
    protected function isAbsolutePath(string $path): bool
    {
        $path = trim($path);
        if ($path === '') {
            return false;
        }
        // Windows drive letter, UNC path, or root slash.
        if (preg_match('/^[a-zA-Z]:[\\\\\\/]/', $path)) {
            return true;
        }
        if (str_starts_with($path, '\\\\') || str_starts_with($path, '//')) {
            return true;
        }
        return str_starts_with($path, '/') || str_starts_with($path, '\\');
    }

    /**
     * Compare two relative paths on Windows-friendly rules.
     *
     * @param string $a
     * @param string $b
     * @return bool
     */
    protected function pathsEqual(string $a, string $b): bool
    {
        $a = strtolower($this->normalizeRelativePath($a));
        $b = strtolower($this->normalizeRelativePath($b));
        return $a === $b;
    }

    /**
     * Convert an absolute path to a workspace-relative path for nicer CLI output.
     *
     * @param string $path
     * @return string
     */
    protected function toRelativePath(string $path): string
    {
        $base = base_path();
        $baseNorm = rtrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $base), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        $pathNorm = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
        if (str_starts_with(strtolower($pathNorm), strtolower($baseNorm))) {
            $rel = substr($pathNorm, strlen($baseNorm));
        } else {
            $rel = $pathNorm;
        }
        // Use forward slashes for nicer CLI output.
        return str_replace(DIRECTORY_SEPARATOR, '/', $rel);
    }

    /**
     * Get current locale for CLI messages. Delegates to Util::getLocale().
     *
     * @return string
     */
    protected function getLocale(): string
    {
        return Util::getLocale();
    }

    /**
     * Ask a question with Ctrl+C safety.
     *
     * On Windows, Ctrl+C during a prompt can corrupt the console code page,
     * causing subsequent UTF-8 output to display as garbled text.
     * This method restores the code page after every prompt to prevent that.
     *
     * @param \Symfony\Component\Console\Input\InputInterface $input
     * @param \Symfony\Component\Console\Output\OutputInterface $output
     * @param \Symfony\Component\Console\Question\Question $question
     * @return mixed
     */
    protected function askOrAbort(
        \Symfony\Component\Console\Input\InputInterface $input,
        \Symfony\Component\Console\Output\OutputInterface $output,
        \Symfony\Component\Console\Question\Question $question
    ): mixed {
        $cpBefore = function_exists('sapi_windows_cp_get') ? sapi_windows_cp_get() : null;

        /** @var \Symfony\Component\Console\Helper\QuestionHelper $helper */
        $helper = $this->getHelper('question');
        try {
            $value = $helper->ask($input, $output, $question);
        } catch (\Throwable $e) {
            $this->restoreConsoleCodePage($cpBefore);
            throw $e;
        }

        $this->restoreConsoleCodePage($cpBefore);

        if ($value === null || (is_string($value) && str_contains($value, "\x03"))) {
            exit(130);
        }
        return $value;
    }

    /**
     * Restore console code page on Windows after an interactive prompt.
     * Ctrl+C can corrupt the code page; this resets it to what it was before.
     */
    private function restoreConsoleCodePage(?int $codepage): void
    {
        if ($codepage !== null && function_exists('sapi_windows_cp_set')) {
            sapi_windows_cp_set($codepage);
        }
    }

    /**
     * Resolve namespace/file path by --plugin/-p or --path/-P.
     * - --path/-P: must be a relative path (to project root).
     * - If both are provided, they must point to the same directory, otherwise it's an error.
     *
     * @param string $name Name like "admin/User"
     * @param string|null $plugin
     * @param string|null $path
     * @param \Symfony\Component\Console\Output\OutputInterface $output
     * @param callable(string):string $pluginDefaultPathResolver Returns relative dir like "plugin/admin/app/controller"
     * @param callable(string,array<string,string>):string $msg Message resolver: fn($key,$replace)=>string
     * @return array{0:string,1:string,2:string}|null [class, namespace, file]
     */
    protected function resolveTargetByPluginOrPath(
        string $name,
        ?string $plugin,
        ?string $path,
        \Symfony\Component\Console\Output\OutputInterface $output,
        callable $pluginDefaultPathResolver,
        callable $msg
    ): ?array {
        $pathNorm = $path ? $this->normalizeRelativePath($path) : null;
        if ($pathNorm !== null && $this->isAbsolutePath($pathNorm)) {
            $output->writeln($msg('invalid_path', ['{path}' => (string)$path]));
            return null;
        }

        // Validate plugin existence (from --plugin/-p or inferred from --path/-P).
        $pluginToCheck = $this->normalizeOptionValue($plugin) ?: $this->extractPluginNameFromRelativePath($pathNorm);
        if ($pluginToCheck && !$this->assertPluginExists($pluginToCheck, $output)) {
            return null;
        }

        $expected = null;
        if ($plugin) {
            $expected = $pluginDefaultPathResolver($plugin);
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
     * Load a php config file (return array).
     *
     * @param string $file
     * @return array|null null when file exists but does not return an array or cannot be included
     */
    protected function loadPhpConfigArray(string $file): ?array
    {
        if (!is_file($file)) {
            return [];
        }
        try {
            $data = include $file;
        } catch (\Throwable) {
            return null;
        }
        return is_array($data) ? $data : null;
    }

    /**
     * Get a simple PHP header, preserving the top docblock if present.
     *
     * @param string $file
     * @return string
     */
    protected function getPhpHeaderWithDocblock(string $file): string
    {
        $default = "<?php\n\n";
        if (!is_file($file)) {
            return $default;
        }
        $content = file_get_contents($file);
        if (!is_string($content) || $content === '') {
            return $default;
        }
        if (preg_match('/\A<\?php\s*(\/\*\*[\s\S]*?\*\/\s*)/i', $content, $m)) {
            $doc = rtrim($m[1]) . "\n\n";
            return "<?php\n" . $doc;
        }
        return $default;
    }

    /**
     * Ensure parent directory exists.
     *
     * @param string $file
     * @return void
     */
    protected function ensureParentDir(string $file): void
    {
        $dir = pathinfo($file, PATHINFO_DIRNAME);
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }
    }

    /**
     * Add a class to a flat config list (return [ClassA::class, ...]).
     *
     * @param string $file
     * @param string $classFqn e.g. app\bootstrap\Test
     * @return bool changed or not
     */
    protected function addClassToFlatClassListConfig(string $file, string $classFqn): bool
    {
        $config = $this->loadPhpConfigArray($file);
        if ($config === null) {
            return false;
        }
        $classFqn = ltrim(trim($classFqn), '\\');
        if (in_array($classFqn, $config, true)) {
            return false;
        }
        $config[] = $classFqn;
        $this->ensureParentDir($file);
        $header = $this->getPhpHeaderWithDocblock($file);
        $body = $this->renderFlatClassListConfig($config);
        file_put_contents($file, $header . $body);
        return true;
    }

    /**
     * Add a class to middleware config under empty key ''.
     * Return value format:
     * return [
     *     '' => [
     *         Foo::class,
     *     ],
     * ];
     *
     * @param string $file
     * @param string $classFqn e.g. app\middleware\StaticFile
     * @return bool changed or not
     */
    protected function addClassToMiddlewareConfig(string $file, string $classFqn): bool
    {
        $config = $this->loadPhpConfigArray($file);
        if ($config === null) {
            return false;
        }
        $classFqn = ltrim(trim($classFqn), '\\');

        if (!array_key_exists('', $config)) {
            // Put '' first for readability.
            $config = ['' => []] + $config;
        }
        $list = $config[''];
        if (!is_array($list)) {
            $list = [];
        }
        if (in_array($classFqn, $list, true)) {
            return false;
        }
        $list[] = $classFqn;
        $config[''] = $list;

        $this->ensureParentDir($file);
        $header = $this->getPhpHeaderWithDocblock($file);
        $body = $this->renderMiddlewareConfig($config);
        file_put_contents($file, $header . $body);
        return true;
    }

    /**
     * @param array<int,string> $classes
     * @return string
     */
    protected function renderFlatClassListConfig(array $classes): string
    {
        $lines = [];
        $lines[] = "return [";
        foreach ($classes as $c) {
            $c = ltrim((string)$c, '\\');
            if ($c === '') {
                continue;
            }
            $lines[] = "    {$c}::class,";
        }
        $lines[] = "];\n";
        return implode("\n", $lines);
    }

    /**
     * @param array<string,mixed> $config
     * @return string
     */
    protected function renderMiddlewareConfig(array $config): string
    {
        $lines = [];
        $lines[] = "return [";
        foreach ($config as $key => $value) {
            $keyExport = var_export((string)$key, true);
            $lines[] = "    {$keyExport} => [";
            $list = is_array($value) ? $value : [];
            foreach ($list as $c) {
                $c = ltrim((string)$c, '\\');
                if ($c === '') {
                    continue;
                }
                $lines[] = "        {$c}::class,";
            }
            $lines[] = "    ],";
        }
        $lines[] = "];\n";
        return implode("\n", $lines);
    }
}

