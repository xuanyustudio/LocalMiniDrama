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

namespace Workerman\Coroutine\Channel;

use Fiber as BaseFiber;
use RuntimeException;
use Workerman\Timer;
use WeakMap;
use Workerman\Worker;

/**
 * Channel
 */
class Fiber implements ChannelInterface
{
    /**
     * @var array
     */
    private array $queue = [];

    /**
     * @var WeakMap
     */
    private WeakMap $waitingPush;

    /**
     * @var WeakMap
     */
    private WeakMap $waitingPop;

    /**
     * @var int
     */
    private int $capacity;

    /**
     * @var bool
     */
    private bool $closed = false;

    /**
     * Constructor
     *
     * @param int $capacity
     */
    public function __construct(int $capacity = 1)
    {
        $this->capacity = $capacity;
        $this->waitingPush = new WeakMap();
        $this->waitingPop = new WeakMap();
    }

    /**
     * @inheritDoc
     */
    public function push(mixed $data, float $timeout = -1): bool
    {
        if ($this->closed) {
            return false;
        }

        if (count($this->queue) >= $this->capacity) {

            if ($timeout == 0) {
                return false;
            }

            $fiber = BaseFiber::getCurrent();
            if ($fiber === null) {
                throw new RuntimeException("Fiber::getCurrent() returned null. Ensure this method is called within a Fiber context.");
            }

            $this->waitingPush[$fiber] = true;

            $timedOut = false;
            $timerId = null;
            if ($timeout > 0 && Worker::isRunning()) {
                $timerId = Timer::delay($timeout, function () use ($fiber, &$timedOut) {
                    $timedOut = true;
                    if ($fiber->isSuspended()) {
                        unset($this->waitingPush[$fiber]);
                        $fiber->resume(false);
                    }
                });
            }

            BaseFiber::suspend();
            unset($this->waitingPush[$fiber]);

            if (!$timedOut && $timerId) {
                Timer::del($timerId);
            }

            if ($timedOut) {
                return false;
            }

            // If the channel is closed while waiting, return false.
            if ($this->closed) {
                return false;
            }

        }

        foreach ($this->waitingPop as $popFiber => $_) {
            unset($this->waitingPop[$popFiber]);
            if ($popFiber->isSuspended()) {
                $popFiber->resume($data);
                return true;
            }
        }

        $this->queue[] = $data;
        return true;
    }

    /**
     * @inheritDoc
     */
    public function pop(float $timeout = -1): mixed
    {
        if ($this->closed && empty($this->queue)) {
            return false;
        }

        if (empty($this->queue)) {
            if ($timeout == 0) {
                return false;
            }

            $fiber = BaseFiber::getCurrent();
            if ($fiber === null) {
                throw new RuntimeException("Fiber::getCurrent() returned null. Ensure this method is called within a Fiber context.");
            }

            $this->waitingPop[$fiber] = true;

            $timedOut = false;
            $timerId = null;
            if ($timeout > 0) {
                Worker::isRunning() && $timerId = Timer::delay($timeout, function () use ($fiber, &$timedOut) {
                    $timedOut = true;
                    if ($fiber->isSuspended()) {
                        unset($this->waitingPop[$fiber]);
                        $fiber->resume(false);
                    }
                });
            }

            $data = BaseFiber::suspend();

            unset($this->waitingPop[$fiber]);

            if (!$timedOut && $timerId !== null) {
                Timer::del($timerId);
            }

            if ($timedOut) {
                return false;
            }

            if ($data === false && $this->closed) {
                return false;
            }

            return $data;
        }

        $value = array_shift($this->queue);

        foreach ($this->waitingPush as $pushFiber => $_) {
            unset($this->waitingPush[$pushFiber]);
            if ($pushFiber->isSuspended()) {
                $pushFiber->resume();
                break;
            }
        }

        return $value;
    }

    /**
     * @inheritDoc
     */
    public function length(): int
    {
        return count($this->queue);
    }

    /**
     * @inheritDoc
     */
    public function getCapacity(): int
    {
        return $this->capacity;
    }

    /**
     * @inheritDoc
     */
    public function hasConsumers(): bool
    {
        return count($this->waitingPop) > 0;
    }

    /**
     * @inheritDoc
     */
    public function hasProducers(): bool
    {
        return count($this->waitingPush) > 0;
    }

    /**
     * @inheritDoc
     */
    public function close(): void
    {
        $this->closed = true;

        foreach ($this->waitingPush as $fiber => $_) {
            unset($this->waitingPush[$fiber]);
            if ($fiber->isSuspended()) {
                $fiber->resume(false);
            }
        }
        $this->waitingPush = new WeakMap();

        foreach ($this->waitingPop as $fiber => $_) {
            unset($this->waitingPop[$fiber]);
            if ($fiber->isSuspended()) {
                $fiber->resume(false);
            }
        }
        $this->waitingPop = new WeakMap();
    }

}