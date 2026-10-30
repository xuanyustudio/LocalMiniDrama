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

use support\Container;
use support\Request;
use support\Response;
use support\Translation;
use support\view\Blade;
use support\view\Raw;
use support\view\ThinkPHP;
use support\view\Twig;
use Twig\Error\LoaderError;
use Twig\Error\RuntimeError;
use Twig\Error\SyntaxError;
use Webman\App;
use Webman\Config;
use Webman\Route;
use Workerman\Protocols\Http\Session;
use Workerman\Worker;

/**
 * Get the base path of the application
 */
if (!defined('BASE_PATH')) {
    if (!$basePath = Phar::running()) {
        $basePath = getcwd();
        while ($basePath !== dirname($basePath)) {
            if (is_dir("$basePath/vendor") && is_file("$basePath/start.php")) {
                break;
            }
            $basePath = dirname($basePath);
        }
        if ($basePath === dirname($basePath)) {
            $basePath = __DIR__ . '/../../../../../';
        }
    }
    define('BASE_PATH', realpath($basePath) ?: $basePath);
}

if (!function_exists('run_path')) {
    /**
     * return the program execute directory
     * @param string $path
     * @return string
     */
    function run_path(string $path = ''): string
    {
        static $runPath = '';
        if (!$runPath) {
            $runPath = is_phar() ? dirname(Phar::running(false)) : BASE_PATH;
        }
        return path_combine($runPath, $path);
    }
}

if (!function_exists('base_path')) {
    /**
     * if the param $path equal false,will return this program current execute directory
     * @param string|false $path
     * @return string
     */
    function base_path($path = ''): string
    {
        if (false === $path) {
            return run_path();
        }
        return path_combine(BASE_PATH, $path);
    }
}

if (!function_exists('app_path')) {
    /**
     * App path
     * @param string $path
     * @return string
     */
    function app_path(string $path = ''): string
    {
        return path_combine(BASE_PATH . DIRECTORY_SEPARATOR . 'app', $path);
    }
}

if (!function_exists('public_path')) {
    /**
     * Public path
     * @param string $path
     * @param string|null $plugin
     * @return string
     */
    function public_path(string $path = '', ?string $plugin = null): string
    {
        static $publicPaths = [];
        $plugin = $plugin ?? '';
        if (isset($publicPaths[$plugin])) {
            $publicPath = $publicPaths[$plugin];
        } else {
            $prefix = $plugin ? "plugin.$plugin." : '';
            $pathPrefix = $plugin ? 'plugin' . DIRECTORY_SEPARATOR . $plugin . DIRECTORY_SEPARATOR : '';
            $publicPath = \config("{$prefix}app.public_path", run_path("{$pathPrefix}public"));
            if (count($publicPaths) > 32) {
                $publicPaths = [];
            }
            $publicPaths[$plugin] = $publicPath;
        }
        return $path === '' ? $publicPath : path_combine($publicPath, $path);
    }
}

if (!function_exists('config_path')) {
    /**
     * Config path
     * @param string $path
     * @return string
     */
    function config_path(string $path = ''): string
    {
        return path_combine(BASE_PATH . DIRECTORY_SEPARATOR . 'config', $path);
    }
}

if (!function_exists('runtime_path')) {
    /**
     * Runtime path
     * @param string $path
     * @return string
     */
    function runtime_path(string $path = ''): string
    {
        static $runtimePath = '';
        if (!$runtimePath) {
            $runtimePath = \config('app.runtime_path') ?: run_path('runtime');
        }
        return path_combine($runtimePath, $path);
    }
}

if (!function_exists('path_combine')) {
    /**
     * Generate paths based on given information
     * @param string $front
     * @param string $back
     * @return string
     */
    function path_combine(string $front, string $back): string
    {
        return $front . ($back ? (DIRECTORY_SEPARATOR . ltrim($back, DIRECTORY_SEPARATOR)) : $back);
    }
}

if (!function_exists('response')) {
    /**
     * Response
     * @param int $status
     * @param array $headers
     * @param string $body
     * @return Response
     */
    function response(string $body = '', int $status = 200, array $headers = []): Response
    {
        return new Response($status, $headers, $body);
    }
}

if (!function_exists('json')) {
    /**
     * Json response
     * @param $data
     * @param int $options
     * @return Response
     */
    function json($data, int $options = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR): Response
    {
        return new Response(200, ['Content-Type' => 'application/json'], json_encode($data, $options));
    }
}

if (!function_exists('xml')) {
    /**
     * Xml response
     * @param $xml
     * @return Response
     */
    function xml($xml): Response
    {
        if ($xml instanceof SimpleXMLElement) {
            $xml = $xml->asXML();
        }
        return new Response(200, ['Content-Type' => 'text/xml'], $xml);
    }
}

if (!function_exists('jsonp')) {
    /**
     * Jsonp response
     * @param $data
     * @param string $callbackName
     * @return Response
     */
    function jsonp($data, string $callbackName = 'callback'): Response
    {
        if (!is_scalar($data) && null !== $data) {
            $data = json_encode($data);
        }
        return new Response(200, [], "$callbackName($data)");
    }
}

if (!function_exists('redirect')) {
    /**
     * Redirect response
     * @param string $location
     * @param int $status
     * @param array $headers
     * @return Response
     */
    function redirect(string $location, int $status = 302, array $headers = []): Response
    {
        $response = new Response($status, ['Location' => $location]);
        if (!empty($headers)) {
            $response->withHeaders($headers);
        }
        return $response;
    }
}

if (!function_exists('view')) {
    /**
     * View response
     * @param mixed $template
     * @param array $vars
     * @param string|null $app
     * @param string|null $plugin
     * @return Response
     */
    function view(mixed $template = null, array $vars = [], ?string $app = null, ?string $plugin = null): Response
    {
        [$template, $vars, $app, $plugin] = template_inputs($template, $vars, $app, $plugin);
        $handler = \config($plugin ? "plugin.$plugin.view.handler" : 'view.handler');
        return new Response(200, [], $handler::render($template, $vars, $app, $plugin));
    }
}

if (!function_exists('raw_view')) {
    /**
     * Raw view response
     * @param mixed $template
     * @param array $vars
     * @param string|null $app
     * @param string|null $plugin
     * @return Response
     * @throws Throwable
     */
    function raw_view(mixed $template = null, array $vars = [], ?string $app = null, ?string $plugin = null): Response
    {
        return new Response(200, [], Raw::render(...template_inputs($template, $vars, $app, $plugin)));
    }
}

if (!function_exists('blade_view')) {
    /**
     * Blade view response
     * @param mixed $template
     * @param array $vars
     * @param string|null $app
     * @param string|null $plugin
     * @return Response
     */
    function blade_view(mixed $template = null, array $vars = [], ?string $app = null, ?string $plugin = null): Response
    {
        return new Response(200, [], Blade::render(...template_inputs($template, $vars, $app, $plugin)));
    }
}

if (!function_exists('think_view')) {
    /**
     * Think view response
     * @param mixed $template
     * @param array $vars
     * @param string|null $app
     * @param string|null $plugin
     * @return Response
     */
    function think_view(mixed $template = null, array $vars = [], ?string $app = null, ?string $plugin = null): Response
    {
        return new Response(200, [], ThinkPHP::render(...template_inputs($template, $vars, $app, $plugin)));
    }
}

if (!function_exists('twig_view')) {
    /**
     * Twig view response
     * @param mixed $template
     * @param array $vars
     * @param string|null $app
     * @param string|null $plugin
     * @return Response
     */
    function twig_view(mixed $template = null, array $vars = [], ?string $app = null, ?string $plugin = null): Response
    {
        return new Response(200, [], Twig::render(...template_inputs($template, $vars, $app, $plugin)));
    }
}

if (!function_exists('request')) {
    /**
     * Get request
     * @return \Webman\Http\Request|Request|null
     */
    function request()
    {
        return App::request();
    }
}

if (!function_exists('config')) {
    /**
     * Get config
     * @param string|null $key
     * @param mixed $default
     * @return mixed
     */
    function config(?string $key = null, mixed $default = null)
    {
        return Config::get($key, $default);
    }
}

if (!function_exists('route')) {
    /**
     * Create url
     * @param string $name
     * @param ...$parameters
     * @return string
     */
    function route(string $name, ...$parameters): string
    {
        $route = Route::getByName($name);
        if (!$route) {
            return '';
        }

        if (!$parameters) {
            return $route->url();
        }

        if (is_array(current($parameters))) {
            $parameters = current($parameters);
        }

        return $route->url($parameters);
    }
}

if (!function_exists('session')) {
    /**
     * Session
     * @param array|string|null $key
     * @param mixed $default
     * @return mixed|bool|Session
     * @throws Exception
     */
    function session(array|string|null $key = null, mixed $default = null): mixed
    {
        $session = \request()->session();
        if (null === $key) {
            return $session;
        }
        if (is_array($key)) {
            $session->put($key);
            return null;
        }
        if (strpos($key, '.')) {
            $keyArray = explode('.', $key);
            $value = $session->all();
            foreach ($keyArray as $index) {
                if (!isset($value[$index])) {
                    return $default;
                }
                $value = $value[$index];
            }
            return $value;
        }
        return $session->get($key, $default);
    }
}

if (!function_exists('trans')) {
    /**
     * Translation
     * @param string $id
     * @param array $parameters
     * @param string|null $domain
     * @param string|null $locale
     * @return string
     */
    function trans(string $id, array $parameters = [], ?string $domain = null, ?string $locale = null): string
    {
        $res = Translation::trans($id, $parameters, $domain, $locale);
        return $res === '' ? $id : $res;
    }
}

if (!function_exists('locale')) {
    /**
     * Locale
     * @param string|null $locale
     * @return string
     */
    function locale(?string $locale = null): string
    {
        if (!$locale) {
            return Translation::getLocale();
        }
        Translation::setLocale($locale);
        return $locale;
    }
}

if (!function_exists('not_found')) {
    /**
     * 404 not found
     * @return Response
     */
    function not_found(): Response
    {
        return new Response(404, [], file_get_contents(public_path() . '/404.html'));
    }
}

if (!function_exists('copy_dir')) {
    /**
     * Copy dir
     * @param string $source
     * @param string $dest
     * @param bool $overwrite
     * @return void
     */
    function copy_dir(string $source, string $dest, bool $overwrite = false)
    {
        if (is_dir($source)) {
            if (!is_dir($dest)) {
                mkdir($dest);
            }
            $files = scandir($source);
            foreach ($files as $file) {
                if ($file !== "." && $file !== "..") {
                    copy_dir("$source/$file", "$dest/$file", $overwrite);
                }
            }
        } else if (file_exists($source) && ($overwrite || !file_exists($dest))) {
            copy($source, $dest);
        }
    }
}

if (!function_exists('remove_dir')) {
    /**
     * Remove dir
     * @param string $dir
     * @return bool
     */
    function remove_dir(string $dir): bool
    {
        if (is_link($dir) || is_file($dir)) {
            return unlink($dir);
        }
        $files = array_diff(scandir($dir), array('.', '..'));
        foreach ($files as $file) {
            (is_dir("$dir/$file") && !is_link($dir)) ? remove_dir("$dir/$file") : unlink("$dir/$file");
        }
        return rmdir($dir);
    }
}

if (!function_exists('worker_bind')) {
    /**
     * Bind worker
     * @param $worker
     * @param $class
     */
    function worker_bind($worker, $class)
    {
        $callbackMap = [
            'onConnect',
            'onMessage',
            'onClose',
            'onError',
            'onBufferFull',
            'onBufferDrain',
            'onWorkerStop',
            'onWebSocketConnect',
            'onWorkerReload'
        ];
        foreach ($callbackMap as $name) {
            if (method_exists($class, $name)) {
                $worker->$name = [$class, $name];
            }
        }
        if (method_exists($class, 'onWorkerStart')) {
            call_user_func([$class, 'onWorkerStart'], $worker);
        }
    }
}

if (!function_exists('worker_start')) {
    /**
     * Start worker
     * @param $processName
     * @param $config
     * @return void
     */
    function worker_start($processName, $config)
    {
        if (isset($config['enable']) && !$config['enable']) {
            return;
        }
        // feat：custom worker class [default: Workerman\Worker]
        $class = is_a($class = $config['workerClass'] ?? '', Worker::class, true) ? $class : Worker::class;
        $worker = new $class($config['listen'] ?? null, $config['context'] ?? []);
        $properties = [
            'count',
            'user',
            'group',
            'reloadable',
            'reusePort',
            'transport',
            'protocol',
            'eventLoop',
        ];
        $worker->name = $processName;
        foreach ($properties as $property) {
            if (isset($config[$property])) {
                $worker->$property = $config[$property];
            }
        }

        $worker->onWorkerStart = function ($worker) use ($config) {
            require_once base_path('/support/bootstrap.php');
            if (isset($config['handler'])) {
                if (!class_exists($config['handler'])) {
                    echo "process error: class {$config['handler']} not exists\r\n";
                    return;
                }

                $instance = Container::make($config['handler'], $config['constructor'] ?? []);
                worker_bind($worker, $instance);
            }
        };
    }
}

if (!function_exists('get_realpath')) {
    /**
     * Get realpath
     * @param string $filePath
     * @return string
     */
    function get_realpath(string $filePath): string
    {
        if (strpos($filePath, 'phar://') === 0) {
            return $filePath;
        } else {
            return realpath($filePath);
        }
    }
}

if (!function_exists('is_phar')) {
    /**
     * Is phar
     * @return bool
     */
    function is_phar(): bool
    {
        return class_exists(Phar::class, false) && Phar::running();
    }
}

if (!function_exists('template_inputs')) {
    /**
     * Get template vars
     * @param mixed $template
     * @param array $vars
     * @param string|null $app
     * @param string|null $plugin
     * @return array
     */
    function template_inputs(mixed $template, array $vars, ?string $app, ?string $plugin): array
    {
        $request = \request();
        $plugin = $plugin === null ? ($request->plugin ?? '') : $plugin;
        if (is_array($template)) {
            $vars = $template;
            $template = null;
        }
        if ($template === null && $controller = $request->controller) {
            $controllerSuffix = config($plugin ? "plugin.$plugin.app.controller_suffix" : "app.controller_suffix", '');
            $controllerName = $controllerSuffix !== '' ? substr($controller, 0, -strlen($controllerSuffix)) : $controller;
            $path = str_replace(['controller', 'Controller', '\\'], ['view', 'view', '/'], $controllerName);
            $path = strtolower(preg_replace('/([a-z])([A-Z])/', '$1_$2', $path));
            $action = $request->action;
            $backtrace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
            foreach ($backtrace as $backtraceItem) {
                if (!isset($backtraceItem['class']) || !isset($backtraceItem['function'])) {
                    continue;
                }
                if ($backtraceItem['class'] === App::class) {
                    break;
                }
                if (preg_match('/\\\\controller\\\\/i', $backtraceItem['class'])) {
                    $action = $backtraceItem['function'];
                    break;
                }
            }
            $actionFileBaseName = strtolower(preg_replace('/([a-z])([A-Z])/', '$1_$2', $action));
            $template = "/$path/$actionFileBaseName";
        }
        return [$template, $vars, $app, $plugin];
    }
}

if (!function_exists('cpu_count')) {
    /**
     * Get cpu count
     * @return int
     */
    function cpu_count(): int
    {
        // Windows does not support the number of processes setting.
        if (DIRECTORY_SEPARATOR === '\\') {
            return 1;
        }
        $count = 4;
        if (is_callable('shell_exec')) {
            if (strtolower(PHP_OS) === 'darwin') {
                $count = (int)shell_exec('sysctl -n machdep.cpu.core_count');
            } else {
                try {
                    $count = (int)shell_exec('nproc');
                } catch (\Throwable $ex) {
                    // Do nothing
                }
            }
        }
        return $count > 0 ? $count : 4;
    }
}

if (!function_exists('input')) {
    /**
     * Get request parameters, if no parameter name is passed, an array of all values is returned, default values is supported
     * @param string|null $param param's name
     * @param mixed $default default value
     * @return mixed
     */
    function input(?string $param = null, mixed $default = null): mixed
    {
        return is_null($param) ? request()->all() : request()->input($param, $default);
    }
}
