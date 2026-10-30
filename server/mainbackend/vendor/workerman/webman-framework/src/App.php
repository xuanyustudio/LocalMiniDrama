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

use ArrayObject;
use Closure;
use Exception;
use FastRoute\Dispatcher;
use Illuminate\Database\Eloquent\Model;
use Psr\Log\LoggerInterface;
use ReflectionEnum;
use support\exception\InputValueException;
use support\exception\PageNotFoundException;
use think\Model as ThinkModel;
use Psr\Container\ContainerExceptionInterface;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;
use ReflectionClass;
use ReflectionException;
use ReflectionFunction;
use ReflectionFunctionAbstract;
use ReflectionMethod;
use support\exception\MissingInputException;
use support\exception\RecordNotFoundException;
use support\exception\InputTypeException;
use Throwable;
use Webman\Exception\ExceptionHandler;
use Webman\Exception\ExceptionHandlerInterface;
use Webman\Http\Request;
use Webman\Http\Response;
use Webman\Route\Route as RouteObject;
use support\annotation\route\Route as RouteAttribute;
use Workerman\Connection\TcpConnection;
use Workerman\Protocols\Http;
use Workerman\Worker;
use function array_merge;
use function array_pop;
use function array_reduce;
use function array_splice;
use function array_values;
use function class_exists;
use function clearstatcache;
use function count;
use function current;
use function end;
use function explode;
use function get_class_methods;
use function gettype;
use function implode;
use function is_a;
use function is_array;
use function is_dir;
use function is_file;
use function is_numeric;
use function is_object;
use function is_string;
use function key;
use function method_exists;
use function ob_get_clean;
use function ob_start;
use function pathinfo;
use function scandir;
use function str_replace;
use function strpos;
use function strtolower;
use function substr;
use function trim;

/**
 * Class App
 * @package Webman
 */
class App
{

    /**
     * @var callable[]
     */
    protected static $callbacks = [];

    /**
     * @var array<string, ReflectionFunctionAbstract>
     */
    protected static array $reflectorCache = [];

    /**
     * @var array<string, array<int, array<string, mixed>>>
     */
    protected static array $parameterMetadataCache = [];

    /**
     * @var Worker
     */
    protected static $worker = null;

    /**
     * @var ?LoggerInterface
     */
    protected static ?LoggerInterface $logger = null;

    /**
     * @var string
     */
    protected static $appPath = '';

    /**
     * @var string
     */
    protected static $publicPath = '';

    /**
     * @var string
     */
    protected static $requestClass = '';

    /**
     * App constructor.
     * @param string $requestClass
     * @param LoggerInterface $logger
     * @param string $appPath
     * @param string $publicPath
     */
    public function __construct(string $requestClass, LoggerInterface $logger, string $appPath, string $publicPath)
    {
        static::$requestClass = $requestClass;
        static::$logger = $logger;
        static::$publicPath = $publicPath;
        static::$appPath = $appPath;
    }

    /**
     * OnMessage.
     * @param TcpConnection|mixed $connection
     * @param Request|mixed $request
     * @return null
     * @throws Throwable
     */
    public function onMessage($connection, $request)
    {
        try {
            Context::reset(new ArrayObject([Request::class => $request]));
            $path = $request->path();
            $key = $request->method() . $path;
            if (isset(static::$callbacks[$key])) {
                [$callback, $request->plugin, $request->app, $request->controller, $request->action, $request->route] = static::$callbacks[$key];
                static::send($connection, $callback($request), $request);
                return null;
            }

            $status = 200;
            if (
                static::unsafeUri($connection, $path, $request) ||
                static::findFile($connection, $path, $key, $request) ||
                static::findRoute($connection, $path, $key, $request, $status)
            ) {
                return null;
            }

            $controllerAndAction = static::parseControllerAction($path);
            $plugin = $controllerAndAction['plugin'] ?? static::getPluginByPath($path);
            if (!$controllerAndAction || Route::isDefaultRouteDisabled($plugin, $controllerAndAction['app'] ?: '*') ||
                Route::isDefaultRouteDisabled($controllerAndAction['controller']) ||
                Route::isDefaultRouteDisabled([$controllerAndAction['controller'], $controllerAndAction['action']])) {
                $request->plugin = $plugin;
                $callback = static::getFallback($plugin, $status);
                $request->app = $request->controller = $request->action = '';
                static::send($connection, $callback($request), $request);
                return null;
            }
            $app = $controllerAndAction['app'];
            $controller = $controllerAndAction['controller'];
            $action = $controllerAndAction['action'];

            if ($methodNotAllowed = static::defaultRouteMethodNotAllowedResponse($controller, $action, $request->method())) {
                $callback = $methodNotAllowed;
                static::collectCallbacks($key, [$callback, $plugin, $app, $controller, $action, null]);
                [$callback, $request->plugin, $request->app, $request->controller, $request->action, $request->route] = static::$callbacks[$key];
                static::send($connection, $callback($request), $request);
                return null;
            }

            $callback = static::getCallback($plugin, $app, [$controller, $action]);
            static::collectCallbacks($key, [$callback, $plugin, $app, $controller, $action, null]);
            [$callback, $request->plugin, $request->app, $request->controller, $request->action, $request->route] = static::$callbacks[$key];
            static::send($connection, $callback($request), $request);
        } catch (Throwable $e) {
            static::send($connection, static::exceptionResponse($e, $request), $request);
        }
        return null;
    }

    /**
     * Method allowlist for default route (no explicit route path).
     * If action method has Route attributes with empty path, they are treated as allowed methods.
     * Returns a cached callback producing 405 response when current method is not allowed, otherwise null.
     * @param string $controllerClass
     * @param string $action
     * @param string $httpMethod
     * @return callable|null
     */
    protected static function defaultRouteMethodNotAllowedResponse(string $controllerClass, string $action, string $httpMethod): ?callable
    {
        $httpMethod = strtoupper($httpMethod);
        static $allowedCache = [];
        $cacheKey = $controllerClass . '::' . $action;

        if (!isset($allowedCache[$cacheKey])) {
            $allowed = [];
            try {
                if (method_exists($controllerClass, $action)) {
                    $ref = new ReflectionMethod($controllerClass, $action);
                    $attrs = $ref->getAttributes(RouteAttribute::class, \ReflectionAttribute::IS_INSTANCEOF);
                    foreach ($attrs as $attr) {
                        /** @var RouteAttribute $route */
                        $route = $attr->newInstance();
                        if ($route->path !== null) {
                            continue;
                        }
                        foreach ($route->methods as $m) {
                            $m = strtoupper((string)$m);
                            $allowed[$m] = $m;
                        }
                    }
                }
            } catch (Throwable $e) {
            }
            $allowedCache[$cacheKey] = $allowed;
            if (count($allowedCache) > 1024) {
                unset($allowedCache[key($allowedCache)]);
            }
        } else {
            $allowed = $allowedCache[$cacheKey];
        }

        if (!$allowed || isset($allowed[$httpMethod])) {
            return null;
        }

        $allowHeader = implode(', ', array_values($allowed));
        return static function () use ($allowHeader) {
            return new Response(405, ['Allow' => $allowHeader], '405 Method Not Allowed');
        };
    }

    /**
     * OnWorkerStart.
     * @param $worker
     * @return void
     */
    public function onWorkerStart($worker)
    {
        static::$worker = $worker;
        Http::requestClass(static::$requestClass);
    }

    /**
     * CollectCallbacks.
     * @param string $key
     * @param array $data
     * @return void
     */
    protected static function collectCallbacks(string $key, array $data)
    {
        static::$callbacks[$key] = $data;
        if (count(static::$callbacks) > 1024) {
            unset(static::$callbacks[key(static::$callbacks)]);
        }
    }

    /**
     * UnsafeUri.
     * @param TcpConnection $connection
     * @param string $path
     * @param $request
     * @return bool
     */
    protected static function unsafeUri(TcpConnection $connection, string $path, $request): bool
    {
        if (!$path || $path[0] !== '/' || static::containsPathTraversal($path)) {
            $callback = static::getFallback('', 400);
            $request->plugin = $request->app = $request->controller = $request->action = '';
            static::send($connection, $callback($request, 400), $request);
            return true;
        }
        return false;
    }

    /**
     * Check if a path contains directory traversal or dangerous sequences.
     * @param string $path
     * @return bool
     */
    protected static function containsPathTraversal(string $path): bool
    {
        return strpos($path, '/../') !== false
            || substr($path, -3) === '/..'
            || strpos($path, "\\") !== false
            || strpos($path, "\0") !== false;
    }

    /**
     * GetFallback.
     * @param string $plugin
     * @param int $status
     * @return Closure
     * @throws ContainerExceptionInterface
     * @throws NotFoundExceptionInterface
     * @throws ReflectionException
     */
    protected static function getFallback(string $plugin = '', int $status = 404): Closure
    {
        // When route, controller and action not found, try to use Route::fallback
        return Route::getFallback($plugin, $status) ?: function () {
            throw new PageNotFoundException();
        };
    }

    /**
     * ExceptionResponse.
     * @param Throwable $e
     * @param $request
     * @return Response
     */
    protected static function exceptionResponse(Throwable $e, $request): Response
    {
        try {
            $app = $request->app ?: '';
            $plugin = $request->plugin ?: '';
            $exceptionConfig = static::config($plugin, 'exception');
            $appExceptionConfig = static::config("", 'exception');
            if (!isset($exceptionConfig['']) && isset($appExceptionConfig['@'])) {
                //如果插件没有配置自己的异常处理器并且配置了全局@异常处理器 则使用全局异常处理器
                $defaultException = $appExceptionConfig['@'] ?? ExceptionHandler::class;
            } else {
                $defaultException = $exceptionConfig[''] ?? ExceptionHandler::class;
            }
            $exceptionHandlerClass = $exceptionConfig[$app] ?? $defaultException;

            /** @var ExceptionHandlerInterface $exceptionHandler */
            $exceptionHandler = (static::container($plugin) ?? static::container(''))->make($exceptionHandlerClass, [
                'logger' => static::$logger,
                'debug' => static::config($plugin, 'app.debug')
            ]);
            $exceptionHandler->report($e);
            $response = $exceptionHandler->render($request, $e);
            $response->exception($e);
            return $response;
        } catch (Throwable $e) {
            $response = new Response(500, [], static::config($plugin ?? '', 'app.debug') ? (string)$e : $e->getMessage());
            $response->exception($e);
            return $response;
        }
    }

    /**
     * GetCallback.
     * @param string $plugin
     * @param string $app
     * @param $call
     * @param array $args
     * @param bool $withGlobalMiddleware
     * @param RouteObject|null $route
     * @return callable
     * @throws ContainerExceptionInterface
     * @throws NotFoundExceptionInterface
     * @throws ReflectionException
     */
    public static function getCallback(string $plugin, string $app, $call, array $args = [], bool $withGlobalMiddleware = true, ?RouteObject $route = null)
    {
        $isController = is_array($call) && is_string($call[0]);
        $middlewares = Middleware::getMiddleware($plugin, $app, $call, $route, $withGlobalMiddleware);

        $container = static::container($plugin) ?? static::container('');
        foreach ($middlewares as $key => $item) {
            $middleware = $item[0];
            if (is_string($middleware)) {
                $middleware = $container->get($middleware);
            } elseif ($middleware instanceof Closure) {
                $middleware = call_user_func($middleware, $container);
            }
            $middlewares[$key][0] = $middleware;
        }

        $needInject = static::isNeedInject($call, $args);
        $anonymousArgs = array_values($args);
        // Pre-compute return type for Response check optimization in middleware chain
        $alwaysReturnsResponse = false;
        if ($middlewares) {
            try {
                $returnType = static::getReflector($call)->getReturnType();
                $alwaysReturnsResponse = $returnType instanceof \ReflectionNamedType
                    && !$returnType->allowsNull()
                    && is_a($returnType->getName(), Response::class, true);
            } catch (Throwable $e) {
            }
        }
        if ($isController) {
            $controllerReuse = static::config($plugin, 'app.controller_reuse', true);
            if (!$controllerReuse) {
                if ($needInject) {
                    // Pre-compute metadata at closure creation time
                    $reflector = static::getReflector($call);
                    $metadataList = static::getMethodParameterMetadata($reflector);
                    $debug = static::config($plugin, 'app.debug');
                    $call = function ($request) use ($call, $plugin, $args, $container, $metadataList, $debug) {
                        $call[0] = $container->make($call[0]);
                        $inputs = $args ? array_merge($request->all(), $args) : $request->all();
                        $resolvedArgs = array_values(static::resolveMethodDependenciesFromMetadata($container, $request, $inputs, $metadataList, $debug));
                        return $call(...$resolvedArgs);
                    };
                    $needInject = false;
                } else {
                    $call = function ($request, ...$anonymousArgs) use ($call, $plugin, $container) {
                        $call[0] = $container->make($call[0]);
                        return $call($request, ...$anonymousArgs);
                    };
                }
            } else {
                $call[0] = $container->get($call[0]);
            }
        }

        if ($needInject) {
            $call = static::resolveInject($container, $call, $args, static::config($plugin, 'app.debug'));
        }

        if ($middlewares) {
            if ($alwaysReturnsResponse) {
                $innermost = function ($request) use ($call, $anonymousArgs) {
                    try {
                        return $call($request, ...$anonymousArgs);
                    } catch (Throwable $e) {
                        return static::exceptionResponse($e, $request);
                    }
                };
            } else {
                $innermost = function ($request) use ($call, $anonymousArgs) {
                    try {
                        $response = $call($request, ...$anonymousArgs);
                    } catch (Throwable $e) {
                        return static::exceptionResponse($e, $request);
                    }
                    if (!$response instanceof Response) {
                        if (!is_string($response)) {
                            $response = static::stringify($response);
                        }
                        $response = new Response(200, [], $response);
                    }
                    return $response;
                };
            }
            $callback = array_reduce($middlewares, function ($carry, $pipe) {
                return function ($request) use ($carry, $pipe) {
                    try {
                        return $pipe($request, $carry);
                    } catch (Throwable $e) {
                        return static::exceptionResponse($e, $request);
                    }
                };
            }, $innermost);
        } else {
            if (!$anonymousArgs) {
                $callback = $call;
            } else {
                $callback = function ($request) use ($call, $anonymousArgs) {
                    return $call($request, ...$anonymousArgs);
                };
            }
        }
        return $callback;
    }

    /**
     * ResolveInject.
     * @param ContainerInterface $container
     * @param array|Closure $call
     * @param array $args
     * @param bool $debug
     * @return Closure
     * @see Dependency injection through reflection information
     */
    protected static function resolveInject(ContainerInterface $container, $call, array $args, bool $debug): Closure
    {
        // Pre-compute metadata at closure creation time (once), not at execution time (every request)
        $metadataList = static::getMethodParameterMetadata(static::getReflector($call));

        return function (Request $request) use ($container, $call, $args, $metadataList, $debug) {
            $inputs = $args ? array_merge($request->all(), $args) : $request->all();
            $resolvedArgs = array_values(static::resolveMethodDependenciesFromMetadata(
                $container, $request, $inputs, $metadataList, $debug
            ));
            return $call(...$resolvedArgs);
        };
    }

    /**
     * Check whether inject is required.
     * @param $call
     * @param array $args
     * @return bool
     * @throws ReflectionException
     */
    protected static function isNeedInject($call, array &$args): bool
    {
        if (is_array($call) && !method_exists($call[0], $call[1])) {
            return false;
        }
        $reflector = static::getReflector($call);
        $reflectionParameters = $reflector->getParameters();
        if (!$reflectionParameters) {
            return false;
        }
        $firstParameter = current($reflectionParameters);
        unset($reflectionParameters[key($reflectionParameters)]);
        $adaptersList = ['int', 'string', 'bool', 'array', 'object', 'float', 'mixed', 'resource'];
        $keys = [];
        $needInject = false;
        foreach ($reflectionParameters as $parameter) {
            $parameterName = $parameter->name;
            $keys[] = $parameterName;
            if ($parameter->hasType()) {
                $type = $parameter->getType();
                if (!$type instanceof \ReflectionNamedType) {
                    throw new \RuntimeException(
                        sprintf('Union/intersection types are not supported for controller parameter $%s. Use a single type instead.', $parameter->name)
                    );
                }
                $typeName = $type->getName();
                if (!in_array($typeName, $adaptersList)) {
                    $needInject = true;
                    continue;
                }
                if (!array_key_exists($parameterName, $args)) {
                    $needInject = true;
                    continue;
                }
                switch ($typeName) {
                    case 'int':
                    case 'float':
                        if (!is_numeric($args[$parameterName])) {
                            return true;
                        }
                        $args[$parameterName] = $typeName === 'int' ? (int)$args[$parameterName]: (float)$args[$parameterName];
                        break;
                    case 'bool':
                        $args[$parameterName] = (bool)$args[$parameterName];
                        break;
                    case 'array':
                    case 'object':
                        if (!is_array($args[$parameterName])) {
                            return true;
                        }
                        $args[$parameterName] = $typeName === 'array' ? $args[$parameterName] : (object)$args[$parameterName];
                        break;
                    case 'string':
                    case 'mixed':
                    case 'resource':
                        break;
                }
            }
        }
        if (array_keys($args) !== $keys) {
            return true;
        }
        if (!$firstParameter->hasType()) {
            return $firstParameter->getName() !== 'request';
        }
        $firstType = $firstParameter->getType();
        if (!$firstType instanceof \ReflectionNamedType) {
            return true;
        }
        if (!is_a(static::$requestClass, $firstType->getName(), true)) {
            return true;
        }

        return $needInject;
    }

    /**
     * Get reflector.
     * @param $call
     * @return ReflectionFunction|ReflectionMethod
     * @throws ReflectionException
     */
    protected static function getReflector($call)
    {
        $cacheKey = static::getReflectorCacheKey($call);
        if ($cacheKey !== null && isset(static::$reflectorCache[$cacheKey])) {
            return static::$reflectorCache[$cacheKey];
        }

        if ($call instanceof Closure || is_string($call)) {
            $reflector = new ReflectionFunction($call);
        } else {
            $reflector = new ReflectionMethod($call[0], $call[1]);
        }

        if ($cacheKey !== null) {
            static::$reflectorCache[$cacheKey] = $reflector;
            if (count(static::$reflectorCache) > 1024) {
                unset(static::$reflectorCache[key(static::$reflectorCache)]);
            }
        }

        return $reflector;
    }

    /**
     * Get reflector cache key.
     * @param mixed $call
     * @return string|null
     */
    protected static function getReflectorCacheKey($call): ?string
    {
        if (is_string($call)) {
            return 'func:' . $call;
        }
        if (is_array($call) && isset($call[0], $call[1])) {
            $class = is_object($call[0]) ? get_class($call[0]) : $call[0];
            return 'method:' . $class . '::' . $call[1];
        }
        // Closures may be short-lived; avoid caching to prevent key reuse risks.
        return null;
    }

    /**
     * Return dependent parameters
     * @param ContainerInterface $container
     * @param Request $request
     * @param array $inputs
     * @param ReflectionFunctionAbstract $reflector
     * @param bool $debug
     * @return array
     * @throws ReflectionException
     */
    protected static function resolveMethodDependencies(ContainerInterface $container, Request $request, array $inputs, ReflectionFunctionAbstract $reflector, bool $debug): array
    {
        $metadataList = static::getMethodParameterMetadata($reflector);
        return static::resolveMethodDependenciesFromMetadata($container, $request, $inputs, $metadataList, $debug);
    }

    /**
     * Return dependent parameters from pre-computed metadata.
     * @param ContainerInterface $container
     * @param Request $request
     * @param array $inputs
     * @param array $metadataList
     * @param bool $debug
     * @return array
     * @throws ReflectionException
     */
    protected static function resolveMethodDependenciesFromMetadata(ContainerInterface $container, Request $request, array $inputs, array $metadataList, bool $debug): array
    {
        $parameters = [];
        foreach ($metadataList as $metadata) {
            $parameterName = $metadata['name'];
            $typeName = $metadata['type'];

            if (!empty($metadata['isRequest'])) {
                $parameters[$parameterName] = $request;
                continue;
            }

            if (!array_key_exists($parameterName, $inputs)) {
                if (!$metadata['hasDefault']) {
                    if (!$typeName || (!$metadata['isClass'] && !$metadata['isEnum']) || $metadata['isEnum']) {
                        throw (new MissingInputException())->data([
                            'parameter' => $parameterName,
                        ])->debug($debug);
                    }
                } else {
                    $parameters[$parameterName] = $metadata['default'];
                    continue;
                }
            }

            $parameterValue = $inputs[$parameterName] ?? null;

            switch ($typeName) {
                case 'int':
                case 'float':
                    if (!is_numeric($parameterValue)) {
                        throw (new InputTypeException())->data([
                            'parameter' => $parameterName,
                            'exceptType' => $typeName,
                            'actualType' => gettype($parameterValue),
                        ])->debug($debug);
                    }
                    $parameters[$parameterName] = $typeName === 'float' ? (float)$parameterValue :  (int)$parameterValue;
                    break;
                case 'bool':
                    $parameters[$parameterName] = (bool)$parameterValue;
                    break;
                case 'array':
                case 'object':
                    if (!is_array($parameterValue)) {
                        throw (new InputTypeException())->data([
                            'parameter' => $parameterName,
                            'exceptType' => $typeName,
                            'actualType' => gettype($parameterValue),
                        ])->debug($debug);
                    }
                    $parameters[$parameterName] = $typeName === 'object' ? (object)$parameterValue : $parameterValue;
                    break;
                case 'string':
                case 'mixed':
                case 'resource':
                case null:
                    $parameters[$parameterName] = $parameterValue;
                    break;
                default:
                    $subInputs = is_array($parameterValue) ? $parameterValue : [];
                    if (!empty($metadata['isModel'])) {
                        $parameters[$parameterName] = $container->make($typeName, [
                            'attributes' => $subInputs
                        ]);
                        break;
                    }
                    if (!empty($metadata['isThinkModel'])) {
                        $parameters[$parameterName] = $container->make($typeName, [
                            'data' => $subInputs
                        ]);
                        break;
                    }
                    if (!empty($metadata['isEnum'])) {
                        // Use pre-computed enum case mappings (avoids per-request ReflectionEnum)
                        if (isset($metadata['enumCases'][$parameterValue])) {
                            $parameters[$parameterName] = $metadata['enumCases'][$parameterValue];
                            break;
                        }
                        if (!empty($metadata['enumIsBacked']) && isset($metadata['enumBackedValues'][$parameterValue])) {
                            $parameters[$parameterName] = $metadata['enumBackedValues'][$parameterValue];
                            break;
                        }
                        throw (new InputValueException())->data([
                            'parameter' => $parameterName,
                            'enum' => $typeName
                        ])->debug($debug);
                    }
                    if (is_array($subInputs) && !empty($metadata['hasConstructor'])) {
                        $constructorReflector = static::getReflector([$typeName, '__construct']);
                        $parameters[$parameterName] = $container->make($typeName, static::resolveMethodDependencies($container, $request, $subInputs, $constructorReflector, $debug));
                    } else {
                        $parameters[$parameterName] = $container->make($typeName);
                    }
                    break;
            }
        }
        return $parameters;
    }

    /**
     * Get method parameter metadata from cache.
     * @param ReflectionFunctionAbstract $reflector
     * @return array<int, array<string, mixed>>
     * @throws ReflectionException
     */
    protected static function getMethodParameterMetadata(ReflectionFunctionAbstract $reflector): array
    {
        $cacheKey = static::getParameterMetadataCacheKey($reflector);
        if ($cacheKey !== null && isset(static::$parameterMetadataCache[$cacheKey])) {
            return static::$parameterMetadataCache[$cacheKey];
        }

        $metadataList = [];
        foreach ($reflector->getParameters() as $parameter) {
            $type = $parameter->getType();
            if ($type !== null && !$type instanceof \ReflectionNamedType) {
                throw new \RuntimeException(
                    sprintf('Union/intersection types are not supported for controller parameter $%s. Use a single type instead.', $parameter->name)
                );
            }
            $typeName = $type?->getName();
            $hasDefault = $parameter->isDefaultValueAvailable();
            $isEnum = $typeName && enum_exists($typeName);
            $isClass = $typeName && class_exists($typeName);
            $isRequest = $typeName && is_a(static::$requestClass, $typeName, true);
            $isModel = $typeName && is_a($typeName, Model::class, true);
            $isThinkModel = $typeName && is_a($typeName, ThinkModel::class, true);
            $metadata = [
                'name' => $parameter->name,
                'type' => $typeName,
                'hasDefault' => $hasDefault,
                'default' => $hasDefault ? $parameter->getDefaultValue() : null,
                'isRequest' => $isRequest,
                'isEnum' => $isEnum,
                'isClass' => $isClass,
                'isModel' => $isModel,
                'isThinkModel' => $isThinkModel,
            ];
            // Pre-compute enum case mappings to avoid per-request ReflectionEnum
            if ($isEnum) {
                $enumReflection = new ReflectionEnum($typeName);
                $enumCases = [];
                $enumBackedValues = [];
                $isBacked = $enumReflection->isBacked();
                foreach ($enumReflection->getCases() as $case) {
                    $caseValue = $case->getValue();
                    $enumCases[$case->getName()] = $caseValue;
                    if ($isBacked) {
                        $enumBackedValues[$caseValue->value] = $caseValue;
                    }
                }
                $metadata['enumCases'] = $enumCases;
                $metadata['enumBackedValues'] = $enumBackedValues;
                $metadata['enumIsBacked'] = $isBacked;
            }
            // Pre-compute class constructor info to avoid per-request ReflectionClass
            if ($isClass && !$isRequest && !$isEnum && !$isModel && !$isThinkModel) {
                $classRef = new ReflectionClass($typeName);
                $constructor = $classRef->getConstructor();
                $metadata['hasConstructor'] = $constructor !== null;
                if ($constructor) {
                    // Pre-cache constructor reflector for use by getReflector()
                    $constructorKey = 'method:' . $typeName . '::__construct';
                    if (!isset(static::$reflectorCache[$constructorKey])) {
                        static::$reflectorCache[$constructorKey] = $constructor;
                    }
                }
            }
            $metadataList[] = $metadata;
        }

        if ($cacheKey !== null) {
            static::$parameterMetadataCache[$cacheKey] = $metadataList;
            if (count(static::$parameterMetadataCache) > 1024) {
                unset(static::$parameterMetadataCache[key(static::$parameterMetadataCache)]);
            }
        }

        return $metadataList;
    }

    /**
     * Get parameter metadata cache key.
     * @param ReflectionFunctionAbstract $reflector
     * @return string|null
     */
    protected static function getParameterMetadataCacheKey(ReflectionFunctionAbstract $reflector): ?string
    {
        if ($reflector instanceof ReflectionMethod) {
            return 'method:' . $reflector->getDeclaringClass()->getName() . '::' . $reflector->getName();
        }
        if ($reflector instanceof ReflectionFunction && $reflector->isClosure()) {
            return null;
        }
        if ($reflector instanceof ReflectionFunction) {
            return 'func:' . $reflector->getName();
        }
        return null;
    }

    /**
     * Container.
     * @param string $plugin
     * @return ContainerInterface
     */
    public static function container(string $plugin = '')
    {
        return static::config($plugin, 'container');
    }

    /**
     * Get request.
     * @return Request|\support\Request
     */
    public static function request()
    {
        return Context::get(Request::class);
    }

    /**
     * Get worker.
     * @return Worker
     */
    public static function worker(): ?Worker
    {
        return static::$worker;
    }

    /**
     * Find Route.
     * @param TcpConnection $connection
     * @param string $path
     * @param string $key
     * @param $request
     * @param $status
     * @return bool
     * @throws ContainerExceptionInterface
     * @throws NotFoundExceptionInterface
     * @throws ReflectionException|Throwable
     */
    protected static function findRoute(TcpConnection $connection, string $path, string $key, $request, &$status): bool
    {
        $routeInfo = Route::dispatch($request->method(), $path);
        if ($routeInfo[0] === Dispatcher::FOUND) {
            $status = 200;
            $routeInfo[0] = 'route';
            $callback = $routeInfo[1]['callback'];
            $route = clone $routeInfo[1]['route'];
            $app = $controller = $action = '';
            $args = !empty($routeInfo[2]) ? $routeInfo[2] : [];
            if ($args) {
                $route->setParams($args);
            }
            $args = array_merge($route->param(), $args);
            if (is_array($callback)) {
                $controller = $callback[0];
                $plugin = static::getPluginByClass($controller);
                $app = static::getAppByController($controller);
                $action = static::getRealMethod($controller, $callback[1]) ?? '';
            } else {
                $plugin = static::getPluginByPath($path);
            }
            $callback = static::getCallback($plugin, $app, $callback, $args, true, $route);
            static::collectCallbacks($key, [$callback, $plugin, $app, $controller ?: '', $action, $route]);
            [$callback, $request->plugin, $request->app, $request->controller, $request->action, $request->route] = static::$callbacks[$key];
            static::send($connection, $callback($request), $request);
            return true;
        }
        $status = $routeInfo[0] === Dispatcher::METHOD_NOT_ALLOWED ? 405 : 404;
        return false;
    }

    /**
     * Find File.
     * @param TcpConnection $connection
     * @param string $path
     * @param string $key
     * @param $request
     * @return bool
     * @throws ContainerExceptionInterface
     * @throws NotFoundExceptionInterface
     * @throws ReflectionException
     */
    protected static function findFile(TcpConnection $connection, string $path, string $key, $request): bool
    {
        if (preg_match('/%[0-9a-f]{2}/i', $path)) {
            $path = urldecode($path);
            if (static::unsafeUri($connection, $path, $request)) {
                return true;
            }
        }

        $pathExplodes = explode('/', trim($path, '/'));
        $plugin = '';
        if (isset($pathExplodes[1]) && $pathExplodes[0] === 'app') {
            $plugin = $pathExplodes[1];
            $publicDir = static::config($plugin, 'app.public_path') ?: BASE_PATH . "/plugin/$pathExplodes[1]/public";
            $path = substr($path, strlen("/app/$pathExplodes[1]/"));
        } else {
            $publicDir = static::$publicPath;
        }
        $file = "$publicDir/$path";
        if (!is_file($file)) {
            return false;
        }

        if (pathinfo($file, PATHINFO_EXTENSION) === 'php') {
            if (!static::config($plugin, 'app.support_php_files', false)) {
                return false;
            }
            static::collectCallbacks($key, [function () use ($file) {
                return static::execPhpFile($file);
            }, $plugin, '', '', '', null]);
            [, $request->plugin, $request->app, $request->controller, $request->action, $request->route] = static::$callbacks[$key];
            static::send($connection, static::execPhpFile($file), $request);
            return true;
        }

        if (!static::config($plugin, 'static.enable', false)) {
            return false;
        }

        static::collectCallbacks($key, [static::getCallback($plugin, '__static__', function ($request) use ($file, $plugin) {
            clearstatcache(true, $file);
            if (!is_file($file)) {
                $callback = static::getFallback($plugin);
                return $callback($request);
            }
            return (new Response())->file($file);
        }, [], false), '', '', '', '', null]);
        [$callback, $request->plugin, $request->app, $request->controller, $request->action, $request->route] = static::$callbacks[$key];
        static::send($connection, $callback($request), $request);
        return true;
    }

    /**
     * Send.
     * @param TcpConnection|mixed $connection
     * @param mixed|Response $response
     * @param Request|mixed $request
     * @return void
     */
    protected static function send($connection, $response, $request)
    {
        Context::destroy();
        // Remove the reference of request to session.
        unset($request->context['session']);
        $keepAlive = $request->header('connection');
        if ($keepAlive === null) {
            if ($request->protocolVersion() === '1.1') {
                $connection->send($response);
                return;
            }
        } elseif (\strcasecmp($keepAlive, 'keep-alive') === 0) {
            $connection->send($response);
            return;
        }
        if ($response instanceof Response && $response->getHeader('Transfer-Encoding') === 'chunked') {
            $connection->send($response);
            return;
        }
        $connection->close($response);
    }

    /**
     * ParseControllerAction.
     * @param string $path
     * @return array|false
     * @throws ReflectionException
     */
    protected static function parseControllerAction(string $path)
    {
        $path = str_replace(['-', '//'], ['', '/'], $path);
        if (static::containsPathTraversal($path)) {
            return false;
        }
        static $cache = [];
        if (isset($cache[$path])) {
            return $cache[$path];
        }
        $pathExplode = explode('/', trim($path, '/'));
        $isPlugin = isset($pathExplode[1]) && $pathExplode[0] === 'app';
        $configPrefix = $isPlugin ? "plugin.$pathExplode[1]." : '';
        $pathPrefix = $isPlugin ? "/app/$pathExplode[1]" : '';
        $classPrefix = $isPlugin ? "plugin\\$pathExplode[1]" : '';
        $suffix = Config::get("{$configPrefix}app.controller_suffix", '');
        $relativePath = trim(substr($path, strlen($pathPrefix)), '/');
        $pathExplode = $relativePath ? explode('/', $relativePath) : [];

        $action = 'index';
        if (!$controllerAction = static::guessControllerAction($pathExplode, $action, $suffix, $classPrefix)) {
            if (count($pathExplode) <= 1) {
                return false;
            }
            $action = end($pathExplode);
            unset($pathExplode[count($pathExplode) - 1]);
            $controllerAction = static::guessControllerAction($pathExplode, $action, $suffix, $classPrefix);
        }
        if ($controllerAction && !isset($path[256])) {
            $cache[$path] = $controllerAction;
            if (count($cache) > 1024) {
                unset($cache[key($cache)]);
            }
        }
        return $controllerAction;
    }

    /**
     * GuessControllerAction.
     * @param $pathExplode
     * @param $action
     * @param $suffix
     * @param $classPrefix
     * @return array|false
     * @throws ReflectionException
     */
    protected static function guessControllerAction($pathExplode, $action, $suffix, $classPrefix)
    {
        $map[] = trim("$classPrefix\\app\\controller\\" . implode('\\', $pathExplode), '\\');
        foreach ($pathExplode as $index => $section) {
            $tmp = $pathExplode;
            array_splice($tmp, $index, 1, [$section, 'controller']);
            $map[] = trim("$classPrefix\\" . implode('\\', array_merge(['app'], $tmp)), '\\');
        }
        foreach ($map as $item) {
            $map[] = $item . '\\index';
        }
        foreach ($map as $controllerClass) {
            // Remove xx\xx\controller
            if (substr($controllerClass, -11) === '\\controller') {
                continue;
            }
            $controllerClass .= $suffix;
            if ($controllerAction = static::getControllerAction($controllerClass, $action)) {
                return $controllerAction;
            }
        }
        return false;
    }

    /**
     * GetControllerAction.
     * @param string $controllerClass
     * @param string $action
     * @return array|false
     * @throws ReflectionException
     */
    protected static function getControllerAction(string $controllerClass, string $action)
    {
        // Disable calling magic methods
        if (strpos($action, '__') === 0) {
            return false;
        }
        if (($controllerClass = static::getController($controllerClass)) && ($action = static::getAction($controllerClass, $action))) {
            return [
                'plugin' => static::getPluginByClass($controllerClass),
                'app' => static::getAppByController($controllerClass),
                'controller' => $controllerClass,
                'action' => $action
            ];
        }
        return false;
    }

    /**
     * GetController.
     * @param string $controllerClass
     * @return string|false
     * @throws ReflectionException
     */
    protected static function getController(string $controllerClass)
    {
        if (class_exists($controllerClass)) {
            return (new ReflectionClass($controllerClass))->name;
        }
        $explodes = explode('\\', strtolower(ltrim($controllerClass, '\\')));
        $basePath = $explodes[0] === 'plugin' ? BASE_PATH . '/plugin' : static::$appPath;
        unset($explodes[0]);
        $fileName = array_pop($explodes) . '.php';
        $found = true;
        foreach ($explodes as $pathSection) {
            if (!$found) {
                break;
            }
            $dirs = Util::scanDir($basePath, false);
            $found = false;
            foreach ($dirs as $name) {
                $path = "$basePath/$name";

                if (is_dir($path) && strtolower($name) === $pathSection) {
                    $basePath = $path;
                    $found = true;
                    break;
                }
            }
        }
        if (!$found) {
            return false;
        }
        foreach (scandir($basePath) ?: [] as $name) {
            if (strtolower($name) === $fileName) {
                require_once "$basePath/$name";
                if (class_exists($controllerClass, false)) {
                    return (new ReflectionClass($controllerClass))->name;
                }
            }
        }
        return false;
    }

    /**
     * GetAction.
     * @param string $controllerClass
     * @param string $action
     * @return string|false
     */
    protected static function getAction(string $controllerClass, string $action)
    {
        $methods = get_class_methods($controllerClass);
        $lowerAction = strtolower($action);
        $found = false;
        foreach ($methods as $candidate) {
            if (strtolower($candidate) === $lowerAction) {
                $action = $candidate;
                $found = true;
                break;
            }
        }
        if ($found) {
            return $action;
        }
        // Action is not public method
        if (method_exists($controllerClass, $action)) {
            return false;
        }
        if (method_exists($controllerClass, '__call')) {
            return $action;
        }
        return false;
    }

    /**
     * GetPluginByClass.
     * @param string $controllerClass
     * @return mixed|string
     */
    public static function getPluginByClass(string $controllerClass)
    {
        $controllerClass = trim($controllerClass, '\\');
        $tmp = explode('\\', $controllerClass, 3);
        if ($tmp[0] !== 'plugin') {
            return '';
        }
        return $tmp[1] ?? '';
    }

    /**
     * GetPluginByPath.
     * @param string $path
     * @return mixed|string
     */
    public static function getPluginByPath(string $path)
    {
        $path = trim($path, '/');
        $tmp = explode('/', $path, 3);
        if ($tmp[0] !== 'app') {
            return '';
        }
        $plugin = $tmp[1] ?? '';
        if ($plugin && !static::config('', "plugin.$plugin.app")) {
            return '';
        }
        return $plugin;
    }

    /**
     * GetAppByController.
     * @param string $controllerClass
     * @return mixed|string
     */
    protected static function getAppByController(string $controllerClass)
    {
        $controllerClass = trim($controllerClass, '\\');
        $tmp = explode('\\', $controllerClass, 5);
        $pos = $tmp[0] === 'plugin' ? 3 : 1;
        if (!isset($tmp[$pos])) {
            return '';
        }
        return strtolower($tmp[$pos]) === 'controller' ? '' : $tmp[$pos];
    }

    /**
     * ExecPhpFile.
     * @param string $file
     * @return false|string
     */
    public static function execPhpFile(string $file)
    {
        ob_start();
        // Try to include php file.
        try {
            include $file;
        } catch (Throwable $e) {
            ob_get_clean();
            throw $e;
        }
        return ob_get_clean();
    }

    /**
     * GetRealMethod.
     * @param string $class
     * @param string $method
     * @return string
     */
    protected static function getRealMethod(string $class, string $method): string
    {
        $method = strtolower($method);
        $methods = get_class_methods($class);
        foreach ($methods as $candidate) {
            if (strtolower($candidate) === $method) {
                return $candidate;
            }
        }
        return $method;
    }

    /**
     * Config.
     * @param string $plugin
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    protected static function config(string $plugin, string $key, mixed $default = null)
    {
        return Config::get($plugin ? "plugin.$plugin.$key" : $key, $default);
    }


    /**
     * @param mixed $data
     * @return string
     */
    protected static function stringify($data): string
    {
        $type = gettype($data);
        switch ($type) {
            case 'boolean':
                return  $data ? 'true' : 'false';
            case 'NULL':
                return 'NULL';
            case 'array':
                return 'Array';
            case 'object':
                if (!method_exists($data, '__toString')) {
                    return 'Object';
                }
            default:
                return (string)$data;
        }
    }
}
