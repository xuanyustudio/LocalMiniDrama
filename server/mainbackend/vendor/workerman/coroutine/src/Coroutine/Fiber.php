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

namespace Workerman\Coroutine\Coroutine;

use Fiber as BaseFiber;
use RuntimeException;
use WeakMap;
use Workerman\Coroutine\Utils\DestructionWatcher;

/**
 * Class Fiber
 */
class Fiber implements CoroutineInterface
{
    /**
     * @var BaseFiber|null
     */
    private ?BaseFiber $fiber;

    /**
     * @var WeakMap
     */
    private static WeakMap $instances;

    /**
     * @var int
     */
    private int $id;

    /**
     * @param callable|null $callable
     */
    public function __construct(?callable $callable = null)
    {
        static $id = 0;
        $this->id = ++$id;
        if ($callable) {
            $callable = function(...$args) use ($callable) {
                try {
                    $callable(...$args);
                } finally {
                    $this->fiber = null;
                }
            };
            $this->fiber = new BaseFiber($callable);
            self::$instances[$this->fiber] = $this;
        }
    }

    /**
     * @inheritDoc
     */
    public static function create(callable $callable, ...$args): CoroutineInterface
    {
        $fiber = new Fiber($callable);
        $fiber->start(...$args);
        return $fiber;
    }

    /**
     * @inheritDoc
     */
    public function start(mixed ...$args): mixed
    {
        return $this->fiber->start(...$args);
    }

    /**
     * @inheritDoc
     */
    public function resume(mixed ...$args): mixed
    {
        return $this->fiber->resume(...$args);
    }

    /**
     * @inheritDoc
     */
    public static function suspend(mixed $value = null): mixed
    {
        return BaseFiber::suspend($value);
    }

    /**
     * @inheritDoc
     */
    public function id(): int
    {
        return $this->id;
    }

    /**
     * @inheritDoc
     */
    public static function defer(callable $callable): void
    {
        $baseFiber = BaseFiber::getCurrent();
        if ($baseFiber === null) {
            throw new RuntimeException('Cannot defer outside of a fiber.');
        }
        DestructionWatcher::watch($baseFiber, $callable);
    }

    /**
     * @inheritDoc
     */
    public static function getCurrent(): CoroutineInterface
    {
        if (!$baseFiber = BaseFiber::getCurrent()) {
            throw new RuntimeException('Not in fiber context');
        }
        if (!isset(self::$instances[$baseFiber])) {
            $fiber = new Fiber();
            $fiber->fiber = $baseFiber;
            self::$instances[$baseFiber] = $fiber;
        }
        return self::$instances[$baseFiber];
    }

    /**
     * @inheritDoc
     */
    public static function isCoroutine(): bool
    {
        return BaseFiber::getCurrent() !== null;
    }

    /**
     * Initialize the fiber.
     *
     * @return void
     */
    public static function init(): void
    {
        self::$instances = new WeakMap();
    }

}

Fiber::init();
