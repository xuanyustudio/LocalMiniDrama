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

use Swow\Coroutine;

/**
 * Class Swow
 */
class Swow extends Coroutine implements CoroutineInterface
{

    /**
     * @var array
     */
    private array $callbacks = [];

    /**
     * @inheritDoc
     */
    public static function defer(callable $callable): void
    {
        $coroutine = static::getCurrent();
        $coroutine->callbacks[] = $callable;
    }

    /**
     * @inheritDoc
     */
    public static function create(callable $callable, ...$args): CoroutineInterface
    {
        return static::run($callable, ...$args);
    }

    /**
     * @inheritDoc
     */
    public function start(mixed ...$args): mixed
    {
        return $this->resume(...$args);
    }

    /**
     * @inheritDoc
     */
    public function id(): int
    {
        return $this->getId();
    }

    /**
     * @inheritDoc
     */
    public static function suspend(mixed $value = null): mixed
    {
        return Coroutine::yield($value);
    }

    /**
     * @inheritDoc
     */
    public static function isCoroutine(): bool
    {
        return true;
    }

    /**
     * Destructor.
     */
    public function __destruct()
    {
        foreach (array_reverse($this->callbacks) as $callable) {
            $callable();
        }
    }

}