<?php

namespace Webman\Console\Commands\Concerns;

use Webman\Console\Commands\Concerns\MakeCommandHelpers;
use Webman\Console\Messages;
use Webman\Console\Util;

trait PluginCommandHelpers
{
    use MakeCommandHelpers;

    /**
     * Normalize plugin name input and canonicalize it to lowercase.
     *
     * @param mixed $value
     * @return string|null
     */
    protected function normalizePluginName(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim((string)$value);
        return $value === '' ? null : strtolower($value);
    }

    /**
     * Validate composer package name "vendor/name".
     * We accept input and canonicalize to lowercase in normalizePluginName().
     *
     * @param string $name lowercase package name
     * @return bool
     */
    protected function isValidComposerPackageName(string $name): bool
    {
        if (substr_count($name, '/') !== 1) {
            return false;
        }
        return (bool)preg_match('/^[a-z0-9](?:[a-z0-9_.-]*[a-z0-9])?\/[a-z0-9](?:[a-z0-9_.-]*[a-z0-9])?$/', $name);
    }

    /**
     * Check whether a plugin package exists in current project.
     *
     * Rules:
     * - Prefer directory existence under "<project>/vendor/<vendor>/<name>" (works for both composer-installed and local plugin skeletons).
     * - Fallback to Composer runtime API when available.
     *
     * @param string $name composer package name in vendor/name format (lowercase recommended)
     * @return bool
     */
    protected function pluginPackageExists(string $name): bool
    {
        $relativeVendorPath = 'vendor' . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $name);
        $vendorDir = base_path() . DIRECTORY_SEPARATOR . $relativeVendorPath;
        if (is_dir($vendorDir)) {
            return true;
        }

        if (class_exists(\Composer\InstalledVersions::class)) {
            return \Composer\InstalledVersions::isInstalled($name);
        }

        return false;
    }

    /**
     * Update "enable" flag in config/plugin/<name>/app.php with minimal diffs.
     *
     * @param string $configFile
     * @param bool $enable
     * @return array{ok:bool,changed:bool,already:bool,missingFile:bool,missingKey:bool,error:string|null}
     */
    protected function setPluginEnableFlag(string $configFile, bool $enable): array
    {
        $result = [
            'ok' => false,
            'changed' => false,
            'already' => false,
            'missingFile' => false,
            'missingKey' => false,
            'error' => null,
        ];

        if (!is_file($configFile)) {
            $result['missingFile'] = true;
            $result['ok'] = true;
            return $result;
        }

        $config = $this->loadPhpConfigArray($configFile);
        if ($config === null) {
            $result['error'] = "Bad config file: {$configFile}";
            return $result;
        }
        if (!array_key_exists('enable', $config)) {
            $result['missingKey'] = true;
            $result['ok'] = true;
            return $result;
        }

        $current = (bool)$config['enable'];
        if ($current === $enable) {
            $result['already'] = true;
            $result['ok'] = true;
            return $result;
        }

        $content = file_get_contents($configFile);
        if (!is_string($content) || $content === '') {
            $result['error'] = "Unable to read file: {$configFile}";
            return $result;
        }

        $target = $enable ? 'true' : 'false';
        $pattern = '/([\'"]enable[\'"]\s*=>\s*)(true|false)/i';
        $count = 0;
        $patched = preg_replace($pattern, '$1' . $target, $content, -1, $count);
        if (!is_string($patched) || $count === 0) {
            // Do not rewrite full config to preserve user formatting/comments.
            $result['error'] = "Config key 'enable' not found in file: {$configFile}";
            return $result;
        }

        if (file_put_contents($configFile, $patched) === false) {
            $result['error'] = "Unable to write file: {$configFile}";
            return $result;
        }

        $result['ok'] = true;
        $result['changed'] = true;
        return $result;
    }

    /**
     * CLI messages for plugin commands. Locale selected by getLocale() / Util fallback.
     *
     * @param string $key
     * @param array $replace
     * @return string
     */
    protected function pluginMsg(string $key, array $replace = []): string
    {
        return strtr(Util::selectLocaleMessages(Messages::getPluginMessages())[$key] ?? $key, $replace);
    }
}

