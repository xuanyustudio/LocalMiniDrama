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


use Closure;
use ReflectionAttribute;
use support\annotation\Middleware as MiddlewareAttribute;
use Webman\Route\Route;
use ReflectionClass;
use ReflectionMethod;
use RuntimeException;
use function array_merge;
use function array_reverse;
use function is_array;
use function method_exists;

class Middleware
{

    /**
     * @var array
     */
    protected static $instances = [];

    /**
     * @var array Cache for controller middleware resolved via reflection/attributes.
     */
    protected static $controllerMiddlewareCache = [];

    /**
     * @param mixed $allMiddlewares
     * @param string $plugin
     * @return void
     */
    public static function load($allMiddlewares, string $plugin = '')
    {
        if (!is_array($allMiddlewares)) {
            return;
        }
        foreach ($allMiddlewares as $appName => $middlewares) {
            if (!is_array($middlewares)) {
                throw new RuntimeException('Bad middleware config');
            }
            if ($appName === '@') {
                $plugin = '';
            }
            if (strpos($appName, 'plugin.') !== false) {
                $explode = explode('.', $appName, 4);
                $plugin = $explode[1];
                $appName = $explode[2] ?? '';
            }
            foreach ($middlewares as $className) {
                if (method_exists($className, 'process')) {
                    static::$instances[$plugin][$appName][] = [$className, 'process'];
                } else {
                    // @todo Log
                    echo "middleware $className::process not exsits\n";
                }
            }
        }
    }

    /**
     * @param string $plugin
     * @param string $appName
     * @param string|array|Closure $controller
     * @param Route|null $route
     * @param bool $withGlobalMiddleware
     * @return array
     */
    public static function getMiddleware(string $plugin, string $appName, string|array|Closure $controller, Route|null $route, bool $withGlobalMiddleware = true): array
    {
        $isController = is_array($controller) && is_string($controller[0]);
        $globalMiddleware = $withGlobalMiddleware ? static::$instances['']['@'] ?? [] : [];
        $appGlobalMiddleware = $withGlobalMiddleware && isset(static::$instances[$plugin]['']) ? static::$instances[$plugin][''] : [];
        $middlewares = $routeMiddlewares = [];
        // Route middleware
        if ($route) {
            foreach (array_reverse($route->getMiddleware()) as $className) {
                $routeMiddlewares[] = [$className, 'process'];
            }
        }
        if ($isController && $controller[0] && class_exists($controller[0])) {
            $cacheKey = $controller[0] . '::' . $controller[1];
            if (isset(static::$controllerMiddlewareCache[$cacheKey])) {
                $cached = static::$controllerMiddlewareCache[$cacheKey];
                $middlewares = array_merge($cached['before_route'], $routeMiddlewares, $cached['after_route']);
            } else {
                $beforeRoute = [];
                $afterRoute = [];
                // Controller middleware annotation
                $reflectionClass = new ReflectionClass($controller[0]);
                self::prepareAttributeMiddlewares($beforeRoute, $reflectionClass);
                // Controller middleware property
                if ($reflectionClass->hasProperty('middleware')) {
                    $defaultProperties = $reflectionClass->getDefaultProperties();
                    $middlewaresClasses = $defaultProperties['middleware'];
                    foreach ((array)$middlewaresClasses as $className) {
                        $beforeRoute[] = [$className, 'process'];
                    }
                }
                // Method middleware annotation (route must be between controller and method)
                if ($reflectionClass->hasMethod($controller[1])) {
                    self::prepareAttributeMiddlewares($afterRoute, $reflectionClass->getMethod($controller[1]));
                }
                $middlewares = array_merge($beforeRoute, $routeMiddlewares, $afterRoute);
                static::$controllerMiddlewareCache[$cacheKey] = ['before_route' => $beforeRoute, 'after_route' => $afterRoute];
                if (count(static::$controllerMiddlewareCache) > 1024) {
                    unset(static::$controllerMiddlewareCache[key(static::$controllerMiddlewareCache)]);
                }
            }
        } else {
            // Route middleware
            $middlewares = array_merge($middlewares, $routeMiddlewares);
        }
        if ($appName === '') {
            return array_reverse(array_merge($globalMiddleware, $appGlobalMiddleware, $middlewares));
        }
        $appMiddleware = static::$instances[$plugin][$appName] ?? [];
        return array_reverse(array_merge($globalMiddleware, $appGlobalMiddleware, $appMiddleware, $middlewares));
    }

    /**
     * @param array $middlewares
     * @param ReflectionClass|ReflectionMethod $reflection
     * @return void
     */
    private static function prepareAttributeMiddlewares(array &$middlewares, ReflectionClass|ReflectionMethod $reflection): void
    {
        if ($reflection instanceof ReflectionClass && $parent_ref = $reflection->getParentClass()) {
            self::prepareAttributeMiddlewares($middlewares, $parent_ref);
        }
        $middlewareAttributes = $reflection->getAttributes(MiddlewareAttribute::class, ReflectionAttribute::IS_INSTANCEOF);
        foreach ($middlewareAttributes as $middlewareAttribute) {
            $middlewareAttributeInstance = $middlewareAttribute->newInstance();
            $middlewares = array_merge($middlewares, $middlewareAttributeInstance->getMiddlewares());
        }
    }

    /**
     * @return void
     * @deprecated
     */
    public static function container($_)
    {

    }
}
