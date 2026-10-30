<?php
/**
 * This file is part of workerman.
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

declare(strict_types=1);

namespace Workerman\Coroutine;

use ArrayObject;
use Workerman\Coroutine\Context\ContextInterface;
use Workerman\Events\Swoole;
use Workerman\Events\Swow;
use Workerman\Worker;

/**
 * Class Context
 */
class Context implements ContextInterface
{

    /**
     * @var class-string<ContextInterface>
     */
    protected static string $driver;

    /**
     * @inheritDoc
     */
    public static function get(?string $name = null, mixed $default = null): mixed
    {
        return static::$driver::get($name, $default);
    }

    /**
     * @inheritDoc
     */
    public static function set(string $name, $value): void
    {
        static::$driver::set($name, $value);
    }

    /**
     * @inheritDoc
     */
    public static function has(string $name): bool
    {
        return static::$driver::has($name);
    }

    /**
     * @inheritDoc
     */
    public static function reset(?ArrayObject $data = null): void
    {
        static::$driver::reset($data);
    }

    /**
     * @inheritDoc
     */
    public static function destroy(): void
    {
        static::$driver::destroy();
    }

    /**
     * @return void
     */
    public static function initDriver(): void
    {
        static::$driver ??= match (Worker::$eventLoopClass) {
            Swoole::class => Context\Swoole::class,
            Swow::class => Context\Swow::class,
            default=> Context\Fiber::class,
        };
    }

}

Context::initDriver();