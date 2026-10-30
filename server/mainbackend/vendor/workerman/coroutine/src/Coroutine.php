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

namespace Workerman;

use Workerman\Coroutine\Coroutine\CoroutineInterface;
use Workerman\Coroutine\Coroutine\Fiber;
use Workerman\Worker;
use Workerman\Coroutine\Coroutine\Swoole as SwooleCoroutine;
use Workerman\Coroutine\Coroutine\Swow as SwowCoroutine;
use Workerman\Events\Swoole as SwooleEvent;
use Workerman\Events\Swow as SwowEvent;

/**
 * Class Coroutine
 */
class Coroutine implements CoroutineInterface
{
    /**
     * @var class-string<CoroutineInterface>
     */
    protected static string $driverClass;

    /**
     * @var CoroutineInterface
     */
    public CoroutineInterface $driver;

    /**
     * Coroutine constructor.
     *
     * @param callable $callable
     */
    public function __construct(callable $callable)
    {
        $this->driver = new static::$driverClass($callable);
    }

    /**
     * @inheritDoc
     */
    public static function create(callable $callable, ...$args): CoroutineInterface
    {
        return static::$driverClass::create($callable, ...$args);
    }

    /**
     * @inheritDoc
     */
    public function start(mixed ...$args): mixed
    {
        return $this->driver->start(...$args);
    }

    /**
     * @inheritDoc
     */
    public function resume(mixed ...$args): mixed
    {
        return $this->driver->resume(...$args);
    }

    /**
     * @inheritDoc
     */
    public function id(): int
    {
        return $this->driver->id();
    }

    /**
     * @inheritDoc
     */
    public static function defer(callable $callable): void
    {
        static::$driverClass::defer($callable);
    }

    /**
     * @inheritDoc
     */
    public static function suspend(mixed $value = null): mixed
    {
        return static::$driverClass::suspend($value);
    }

    /**
     * @inheritDoc
     */
    public static function getCurrent(): CoroutineInterface
    {
        return static::$driverClass::getCurrent();
    }

    /**
     * @inheritDoc
     */
    public static function isCoroutine(): bool
    {
        return static::$driverClass::isCoroutine();
    }

    /**
     * @return void
     */
    public static function init(): void
    {
        static::$driverClass = match (Worker::$eventLoopClass ?? null) {
            SwooleEvent::class => SwooleCoroutine::class,
            SwowEvent::class => SwowCoroutine::class,
            default => Fiber::class,
        };
    }

}
Coroutine::init();
