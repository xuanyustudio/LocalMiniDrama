<?php
/**
 * @author workbunny/Chaz6chez
 * @email chaz6chez1993@outlook.com
 */
declare(strict_types=1);

namespace Workerman\Coroutine\WaitGroup;

use Swow\Sync\WaitGroup;
use Throwable;

class Swow implements WaitGroupInterface
{

    /** @var WaitGroup */
    protected WaitGroup $waitGroup;

    /** @var int count */
    protected int $count;

    public function __construct()
    {
        $this->waitGroup = new WaitGroup();
        $this->count = 0;
    }

    /** @inheritdoc  */
    public function add(int $delta = 1): bool
    {
        $this->waitGroup->add($delta = max($delta, 1));
        $this->count += $delta;

        return true;
    }

    /** @inheritdoc  */
    public function done(): bool
    {
        if ($this->count() > 0) {
            $this->count--;
            $this->waitGroup->done();
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
        try {
            $this->waitGroup->wait($timeout > 0 ? (int) ($timeout * 1000) : $timeout);
            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
