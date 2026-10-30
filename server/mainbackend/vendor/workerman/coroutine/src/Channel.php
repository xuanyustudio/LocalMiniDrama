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

use InvalidArgumentException;
use Workerman\Coroutine\Channel\ChannelInterface;
use Workerman\Coroutine\Channel\Memory as ChannelMemory;
use Workerman\Coroutine\Channel\Swoole as ChannelSwoole;
use Workerman\Coroutine\Channel\Swow as ChannelSwow;
use Workerman\Coroutine\Channel\Fiber as ChannelFiber;
use Workerman\Events\Fiber;
use Workerman\Events\Swoole;
use Workerman\Events\Swow;
use Workerman\Worker;

/**
 * Class Channel
 */
class Channel implements ChannelInterface
{

    /**
     * @var ChannelInterface
     */
    protected ChannelInterface $driver;

    /**
     * Channel constructor.
     *
     * @param int $capacity
     */
    public function __construct(int $capacity = 1)
    {
        if ($capacity < 1) {
            throw new InvalidArgumentException("The capacity must be greater than 0");
        }
        $this->driver = match (Worker::$eventLoopClass) {
            Swoole::class => new ChannelSwoole($capacity),
            Swow::class => new ChannelSwow($capacity),
            Fiber::class => new ChannelFiber($capacity),
            default => new ChannelMemory($capacity),
        };
    }

    /**
     * @inheritDoc
     */
    public function push(mixed $data, float $timeout = -1): bool
    {
        return $this->driver->push($data, $timeout);
    }

    /**
     * @inheritDoc
     */
    public function pop(float $timeout = -1): mixed
    {
        return $this->driver->pop($timeout);
    }

    /**
     * @inheritDoc
     */
    public function length(): int
    {
        return $this->driver->length();
    }

    /**
     * @inheritDoc
     */
    public function getCapacity(): int
    {
        return $this->driver->getCapacity();
    }

    /**
     * @inheritDoc
     */
    public function hasConsumers(): bool
    {
        return $this->driver->hasConsumers();
    }

    /**
     * @inheritDoc
     */
    public function hasProducers(): bool
    {
        return $this->driver->hasProducers();
    }

    /**
     * @inheritDoc
     */
    public function close(): void
    {
        $this->driver->close();
    }
}
