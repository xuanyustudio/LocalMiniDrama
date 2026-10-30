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

use Fiber;
use Swow\Coroutine as SwowCoroutine;

/**
 * Interface CoroutineInterface
 */
interface CoroutineInterface
{

    /**
     * Create a coroutine.
     *
     * @param callable $callable
     * @param ...$data
     * @return CoroutineInterface
     */
    public static function create(callable $callable, ...$data): CoroutineInterface;

    /**
     * Start a coroutine.
     *
     * @param mixed ...$args
     * @return mixed
     */
    public function start(mixed ...$args): mixed;

    /**
     * Resume a coroutine.
     *
     * @param mixed ...$args
     * @return mixed
     */
    public function resume(mixed ...$args): mixed;

    /**
     * Get the id of the coroutine.
     *
     * @return int
     */
    public function id(): int;

    /**
     * Register a callable to be executed when the current fiber is destroyed
     *
     * @param callable $callable
     * @return void
     */
    public static function defer(callable $callable): void;

    /**
     * Yield the coroutine.
     *
     * @param mixed|null $value
     * @return mixed
     */
    public static function suspend(mixed $value = null): mixed;

    /**
     * Get the current coroutine.
     *
     * @return CoroutineInterface|Fiber|SwowCoroutine|static
     */
    public static function getCurrent(): CoroutineInterface|Fiber|SwowCoroutine|static;

    /**
     * Check if the current coroutine is in a coroutine.
     *
     * @return bool
     */
    public static function isCoroutine(): bool;

}