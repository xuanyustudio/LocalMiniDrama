<?php
/**
 * @author workbunny/Chaz6chez
 * @email chaz6chez1993@outlook.com
 */
declare(strict_types=1);

namespace Workerman\Coroutine\WaitGroup;

use Workerman\Coroutine\Channel\Fiber as Channel;

class Fiber implements WaitGroupInterface
{

    /** @var int */
    protected int $count;

    /**
     * @var Channel
     */
    protected Channel $channel;

    public function __construct()
    {
        $this->count = 0;
        $this->channel = new Channel(1);
    }

    /** @inheritdoc  */
    public function add(int $delta = 1): bool
    {
        $this->count += max($delta, 1);

        return true;
    }

    /** @inheritdoc  */
    public function done(): bool
    {
        $this->count--;
        if ($this->count <= 0) {
            $this->channel->push(true);
        }

        return true;
    }

    /** @inheritdoc  */
    public function count(): int
    {
        return $this->count;
    }

    /** @inheritdoc  */
    public function wait(int|float $timeout = -1): bool
    {
       if ($this->count() > 0) {
           return $this->channel->pop($timeout);
       }
       return true;
    }

}