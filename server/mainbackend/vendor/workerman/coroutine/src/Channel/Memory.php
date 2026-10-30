<?php

declare(strict_types=1);

namespace Workerman\Coroutine\Channel;

class Memory implements ChannelInterface
{
    private array $data = [];
    private int $capacity;
    private bool $closed = false;

    public function __construct(int $capacity = 0)
    {
        $this->capacity = $capacity;
    }

    public function push(mixed $data, float $timeout = -1): bool
    {
        if ($this->closed) {
            return false;
        }
        if ($this->capacity > 0 && count($this->data) >= $this->capacity) {
            // Channel is full
            return false;
        }
        $this->data[] = $data;
        return true;
    }

    public function pop(float $timeout = -1): mixed
    {
        if (count($this->data) > 0) {
            return array_shift($this->data);
        }
        return false;
    }

    public function length(): int
    {
        return count($this->data);
    }

    public function getCapacity(): int
    {
        return $this->capacity;
    }

    /**
     * @inheritDoc
     */
    public function hasConsumers(): bool
    {
        return false;
    }

    /**
     * @inheritDoc
     */
    public function hasProducers(): bool
    {
        return false;
    }

    public function close(): void
    {
        $this->closed = true;
    }
}
