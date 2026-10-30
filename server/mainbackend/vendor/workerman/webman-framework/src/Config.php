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

namespace Webman;

use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use function array_replace_recursive;
use function array_reverse;
use function count;
use function explode;
use function in_array;
use function is_array;
use function is_dir;
use function is_file;
use function key;
use function str_replace;

class Config
{

    /**
     * @var array
     */
    protected static $config = [];

    /**
     * @var string
     */
    protected static $configPath = '';

    /**
     * @var bool
     */
    protected static $loaded = false;

    /**
     * @var array Flat cache for repeated get() lookups.
     */
    protected static $flatCache = [];

    /**
     * Load.
     * @param string $configPath
     * @param array $excludeFile
     * @param string|null $key
     * @return void
     */
    public static function load(string $configPath, array $excludeFile = [], ?string $key = null)
    {
        static::$configPath = $configPath;
        static::$flatCache = [];
        if (!$configPath) {
            return;
        }
        static::$loaded = false;
        $config = static::loadFromDir($configPath, $excludeFile);
        if (!$config) {
            static::$loaded = true;
            return;
        }
        if ($key !== null) {
            foreach (array_reverse(explode('.', $key)) as $k) {
                $config = [$k => $config];
            }
        }
        static::$config = array_replace_recursive(static::$config, $config);
        static::formatConfig();
        static::$loaded = true;
    }

    /**
     * This deprecated method will certainly be removed in the future.
     * @param string $configPath
     * @param array $excludeFile
     * @return void
     * @deprecated
     */
    public static function reload(string $configPath, array $excludeFile = [])
    {
        static::load($configPath, $excludeFile);
    }

    /**
     * Clear.
     * @return void
     */
    public static function clear()
    {
        static::$config = [];
        static::$flatCache = [];
    }

    /**
     * FormatConfig.
     * @return void
     */
    protected static function formatConfig()
    {
        $config = static::$config;
        // Merge log config
        foreach ($config['plugin'] ?? [] as $firm => $projects) {
            if (isset($projects['app'])) {
                foreach ($projects['log'] ?? [] as $key => $item) {
                    $config['log']["plugin.$firm.$key"] = $item;
                }
            }
            foreach ($projects as $name => $project) {
                if (!is_array($project)) {
                    continue;
                }
                foreach ($project['log'] ?? [] as $key => $item) {
                    $config['log']["plugin.$firm.$name.$key"] = $item;
                }
            }
        }
        // Merge database config
        foreach ($config['plugin'] ?? [] as $firm => $projects) {
            if (isset($projects['app'])) {
                foreach ($projects['database']['connections'] ?? [] as $key => $connection) {
                    $config['database']['connections']["plugin.$firm.$key"] = $connection;
                }
            }
            foreach ($projects as $name => $project) {
                if (!is_array($project)) {
                    continue;
                }
                foreach ($project['database']['connections'] ?? [] as $key => $connection) {
                    $config['database']['connections']["plugin.$firm.$name.$key"] = $connection;
                }
            }
        }
        if (!empty($config['database']['connections'])) {
            $config['database']['default'] = $config['database']['default'] ?? key($config['database']['connections']);
        }
        // Merge thinkorm config
        foreach ($config['plugin'] ?? [] as $firm => $projects) {
            if (isset($projects['app'])) {
                foreach ($projects['thinkorm']['connections'] ?? [] as $key => $connection) {
                    $config['thinkorm']['connections']["plugin.$firm.$key"] = $connection;
                }
                foreach ($projects['think-orm']['connections'] ?? [] as $key => $connection) {
                    $config['think-orm']['connections']["plugin.$firm.$key"] = $connection;
                }
            }
            foreach ($projects as $name => $project) {
                if (!is_array($project)) {
                    continue;
                }
                foreach ($project['thinkorm']['connections'] ?? [] as $key => $connection) {
                    $config['thinkorm']['connections']["plugin.$firm.$name.$key"] = $connection;
                }
                foreach ($project['think-orm']['connections'] ?? [] as $key => $connection) {
                    $config['think-orm']['connections']["plugin.$firm.$name.$key"] = $connection;
                }
            }
        }
        if (!empty($config['thinkorm']['connections'])) {
            $config['thinkorm']['default'] = $config['thinkorm']['default'] ?? key($config['thinkorm']['connections']);
        }
        if (!empty($config['think-orm']['connections'])) {
            $config['think-orm']['default'] = $config['think-orm']['default'] ?? key($config['think-orm']['connections']);
        }
        // Merge redis config
        foreach ($config['plugin'] ?? [] as $firm => $projects) {
            if (isset($projects['app'])) {
                foreach ($projects['redis'] ?? [] as $key => $connection) {
                    $config['redis']["plugin.$firm.$key"] = $connection;
                }
            }
            foreach ($projects as $name => $project) {
                if (!is_array($project)) {
                    continue;
                }
                foreach ($project['redis'] ?? [] as $key => $connection) {
                    $config['redis']["plugin.$firm.$name.$key"] = $connection;
                }
            }
        }
        static::$config = $config;
    }

    /**
     * LoadFromDir.
     * @param string $configPath
     * @param array $excludeFile
     * @return array
     */
    public static function loadFromDir(string $configPath, array $excludeFile = []): array
    {
        $allConfig = [];
        $dirIterator = new RecursiveDirectoryIterator($configPath, FilesystemIterator::FOLLOW_SYMLINKS);
        $iterator = new RecursiveIteratorIterator($dirIterator);
        foreach ($iterator as $file) {
            /** var SplFileInfo $file */
            if (is_dir($file) || $file->getExtension() != 'php' || in_array($file->getBaseName('.php'), $excludeFile)) {
                continue;
            }
            $appConfigFile = $file->getPath() . '/app.php';
            if (!is_file($appConfigFile)) {
                continue;
            }
            $relativePath = str_replace($configPath . DIRECTORY_SEPARATOR, '', substr($file, 0, -4));
            $explode = array_reverse(explode(DIRECTORY_SEPARATOR, $relativePath));
            if (count($explode) >= 2) {
                $appConfig = include $appConfigFile;
                if (empty($appConfig['enable'])) {
                    continue;
                }
            }
            $config = include $file;
            foreach ($explode as $section) {
                $tmp = [];
                $tmp[$section] = $config;
                $config = $tmp;
            }
            $allConfig = array_replace_recursive($allConfig, $config);
        }
        return $allConfig;
    }

    /**
     * Get.
     * @param string|null $key
     * @param mixed $default
     * @return mixed
     */
    public static function get(?string $key = null, mixed $default = null)
    {
        if ($key === null) {
            return static::$config;
        }
        if (isset(static::$flatCache[$key])) {
            return static::$flatCache[$key];
        }
        $keyArray = explode('.', $key);
        $value = static::$config;
        $found = true;
        foreach ($keyArray as $index) {
            if (!isset($value[$index])) {
                if (static::$loaded) {
                    return $default;
                }
                $found = false;
                break;
            }
            $value = $value[$index];
        }
        if ($found) {
            if (static::$loaded) {
                static::$flatCache[$key] = $value;
                if (count(static::$flatCache) > 1024) {
                    unset(static::$flatCache[key(static::$flatCache)]);
                }
            }
            return $value;
        }
        return static::read($key, $default);
    }

    /**
     * Read.
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    protected static function read(string $key, mixed $default = null)
    {
        $path = static::$configPath;
        if ($path === '') {
            return $default;
        }
        $keys = $keyArray = explode('.', $key);
        foreach ($keyArray as $index => $section) {
            unset($keys[$index]);
            if (is_file($file = "$path/$section.php")) {
                $config = include $file;
                return static::find($keys, $config, $default);
            }
            if (!is_dir($path = "$path/$section")) {
                return $default;
            }
        }
        return $default;
    }

    /**
     * Find.
     * @param array $keyArray
     * @param mixed $stack
     * @param mixed $default
     * @return array|mixed
     */
    protected static function find(array $keyArray, $stack, $default)
    {
        if (!is_array($stack)) {
            return $default;
        }
        $value = $stack;
        foreach ($keyArray as $index) {
            if (!isset($value[$index])) {
                return $default;
            }
            $value = $value[$index];
        }
        return $value;
    }

}
