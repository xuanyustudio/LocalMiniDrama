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

namespace support;

use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RegexIterator;
use Symfony\Component\Translation\Translator;
use Webman\Exception\NotFoundException;
use function basename;
use function config;
use function get_realpath;
use function pathinfo;
use function request;
use function substr;

/**
 * Class Translation
 * @package support
 * @method static string trans(?string $id, array $parameters = [], string $domain = null, string $locale = null)
 * @method static void setLocale(string $locale)
 * @method static string getLocale()
 */
class Translation
{

    /**
     * @var Translator[]
     */
    protected static $instance = [];

    /**
     * Instance.
     * @param string $plugin
     * @param array|null $config
     * @return Translator
     * @throws NotFoundException
     */
    public static function instance(string $plugin = '', ?array $config = null): Translator
    {
        if (!isset(static::$instance[$plugin])) {
            $config = $config ?? config($plugin ? "plugin.$plugin.translation" : 'translation', []);
            $paths = (array)($config['path'] ?? []);

            static::$instance[$plugin] = $translator = new Translator($config['locale']);
            $translator->setFallbackLocales($config['fallback_locale']);

            $classes = $config['loader'] ?? [
                'Symfony\Component\Translation\Loader\PhpFileLoader' => [
                    'extension' => '.php',
                    'format' => 'phpfile'
                ],
                'Symfony\Component\Translation\Loader\PoFileLoader' => [
                    'extension' => '.po',
                    'format' => 'pofile'
                ]
            ];
            foreach ($paths as $path) {
                // Phar support. Compatible with the 'realpath' function in the phar file.
                if (!$translationsPath = get_realpath($path)) {
                    continue;
                }

                foreach ($classes as $class => $opts) {
                    $translator->addLoader($opts['format'], new $class);
                    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($translationsPath, FilesystemIterator::SKIP_DOTS));
                    $files = new RegexIterator($iterator, '/^.+' . preg_quote($opts['extension']) . '$/i', RegexIterator::GET_MATCH);
                    foreach ($files as $file) {
                        $file = $file[0];
                        $domain = basename($file, $opts['extension']);
                        $dirName = pathinfo($file, PATHINFO_DIRNAME);
                        $locale = substr(strrchr($dirName, DIRECTORY_SEPARATOR), 1);
                        if ($domain && $locale) {
                            $translator->addResource($opts['format'], $file, $locale, $domain);
                        }
                    }
                }
            }
        }
        return static::$instance[$plugin];
    }

    /**
     * @param string $name
     * @param array $arguments
     * @return mixed
     * @throws NotFoundException
     */
    public static function __callStatic(string $name, array $arguments)
    {
        $request = request();
        $plugin = $request->plugin ?? '';
        return static::instance($plugin)->{$name}(... $arguments);
    }
}
