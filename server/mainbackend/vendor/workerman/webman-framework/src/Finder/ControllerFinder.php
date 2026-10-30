<?php
/**
 * This file is part of webman.
 *
 * Licensed under The MIT License
 * For full copyright and license information, please see the MIT-LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @author    walkor<walkor@workerman.net>
 * @copyright walkor<walkor@workerman.net>
 * @link      http://www.workerman.net/
 * @license   http://www.opensource.org/licenses/mit-license.php MIT License
 */

namespace Webman\Finder;

use InvalidArgumentException;
use Webman\Config;

use function is_array;
use function is_dir;
use function preg_match;
use function preg_quote;
use function scandir;
use function str_starts_with;

/**
 * ControllerFinder
 *
 * Discover controller files in main app and/or plugins.
 *
 * Scope examples:
 * - null        : main app only
 * - '*'         : main app + all enabled plugins
 * - 'plugin.*'  : all enabled plugins
 * - 'plugin.xxx': single plugin (strict: throws when plugin directory/config missing)
 */
class ControllerFinder
{
    /**
     * Find controller files by scope.
     *
     * @param string|null $scope
     * @return FileInfo[]
     */
    public static function files(?string $scope = null): array
    {
        $roots = static::resolveRoots($scope);
        if (!$roots) {
            return [];
        }

        $resultsByPath = [];
        foreach ($roots as $root) {
            $dir = $root['dir'];
            $suffix = $root['suffix'] ?? '';
            $controllerFiles = static::findControllerFiles($dir, $suffix);
            foreach ($controllerFiles as $file) {
                $resultsByPath[$file->getPathname()] = $file;
            }
        }

        return array_values($resultsByPath);
    }

    /**
     * Resolve search roots by scope.
     *
     * @param string|null $scope
     * @return array<int, array{dir: string, suffix: string}>
     */
    protected static function resolveRoots(?string $scope): array
    {
        if ($scope === null) {
            return static::mainAppRoots();
        }

        if ($scope === '*') {
            return array_merge(static::mainAppRoots(), static::allPluginRoots());
        }

        if ($scope === 'plugin.*') {
            return static::allPluginRoots();
        }

        if (str_starts_with($scope, 'plugin.')) {
            $plugin = substr($scope, strlen('plugin.'));
            if ($plugin === '' || $plugin === '*') {
                throw new InvalidArgumentException("Invalid controller scope: $scope");
            }
            return static::singlePluginRoots($plugin);
        }

        throw new InvalidArgumentException("Invalid controller scope: $scope");
    }

    /**
     * Main app roots.
     *
     * @return array<int, array{dir: string, suffix: string}>
     */
    protected static function mainAppRoots(): array
    {
        $roots = [];
        $appRoot = app_path();
        if (is_dir($appRoot)) {
            $roots[] = [
                'dir' => $appRoot,
                'suffix' => (string)Config::get('app.controller_suffix', ''),
            ];
        }
        return $roots;
    }

    /**
     * Roots for all enabled plugins.
     *
     * Rule (A): if plugin app config is missing/empty, skip it silently.
     *
     * @return array<int, array{dir: string, suffix: string}>
     */
    protected static function allPluginRoots(): array
    {
        $roots = [];
        $pluginBase = base_path('plugin');
        if (!is_dir($pluginBase)) {
            return [];
        }

        foreach (scandir($pluginBase) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            if (!static::isValidIdentifier($entry)) {
                continue;
            }

            $pluginDir = $pluginBase . DIRECTORY_SEPARATOR . $entry;
            if (!is_dir($pluginDir)) {
                continue;
            }

            // Only load enabled plugins (same semantics as Route::loadAnnotationRoutes()).
            $pluginAppConfig = Config::get("plugin.$entry.app");
            if (!$pluginAppConfig) {
                continue;
            }

            $pluginAppDir = $pluginDir . DIRECTORY_SEPARATOR . 'app';
            if (!is_dir($pluginAppDir)) {
                continue;
            }

            $roots[] = [
                'dir' => $pluginAppDir,
                'suffix' => is_array($pluginAppConfig)
                    ? (string)($pluginAppConfig['controller_suffix'] ?? '')
                    : (string)Config::get("plugin.$entry.app.controller_suffix", ''),
            ];
        }

        return $roots;
    }

    /**
     * Roots for a single plugin (strict).
     *
     * @param string $plugin
     * @return array<int, array{dir: string, suffix: string}>
     */
    protected static function singlePluginRoots(string $plugin): array
    {
        if (!static::isValidIdentifier($plugin)) {
            throw new InvalidArgumentException("Invalid plugin identifier: $plugin");
        }

        $pluginBase = base_path('plugin');
        $pluginDir = $pluginBase . DIRECTORY_SEPARATOR . $plugin;
        if (!is_dir($pluginDir)) {
            throw new InvalidArgumentException("Plugin directory not found: $plugin");
        }

        $pluginAppConfig = Config::get("plugin.$plugin.app");
        if (!$pluginAppConfig) {
            throw new InvalidArgumentException("Plugin app config not found or empty: plugin.$plugin.app");
        }

        $pluginAppDir = $pluginDir . DIRECTORY_SEPARATOR . 'app';
        if (!is_dir($pluginAppDir)) {
            throw new InvalidArgumentException("Plugin app directory not found: plugin/$plugin/app");
        }

        return [[
            'dir' => $pluginAppDir,
            'suffix' => is_array($pluginAppConfig)
                ? (string)($pluginAppConfig['controller_suffix'] ?? '')
                : (string)Config::get("plugin.$plugin.app.controller_suffix", ''),
        ]];
    }

    /**
     * Find controller files.
     *
     * @param string $rootDir
     * @param string $controllerSuffix
     * @return FileInfo[]
     */
    protected static function findControllerFiles(string $rootDir, string $controllerSuffix = ''): array
    {
        $controllerPathRegex = $controllerSuffix !== ''
            ? ('/(^|[\/\\\\])controller[\/\\\\].*' . preg_quote($controllerSuffix, '/') . '\.php$/i')
            : '/(^|[\/\\\\])controller[\/\\\\].+\.php$/i';

        $finder = Finder::in($rootDir)
            ->files()
            ->path($controllerPathRegex)
            ->hasAttributes(true)
            ->typeIn(['class'])
            ->psr4(true);

        return $finder->find();
    }

    /**
     * Is valid identifier (plugin name).
     *
     * @param string $name
     * @return bool
     */
    protected static function isValidIdentifier(string $name): bool
    {
        return $name !== '' && (bool)preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name);
    }
}

