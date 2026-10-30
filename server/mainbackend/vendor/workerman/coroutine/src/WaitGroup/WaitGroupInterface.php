<?php
/**
 * @author workbunny/Chaz6chez
 * @email chaz6chez1993@outlook.com
 */
declare(strict_types=1);

namespace Workerman\Coroutine\WaitGroup;

interface WaitGroupInterface
{

    /**
     * Increment count
     *
     * @param int $delta
     * @return bool
     */
    public function add(int $delta = 1): bool;

    /**
     * Complete count
     *
     * @return bool
     */
    public function done(): bool;

    /**
     * Return count
     *
     * @return int
     */
    public function count(): int;

    /**
     * Wait
     *
     * @param int|float $timeout second
     * @return bool timeout:false success:true
     */
    public function wait(int|float $timeout = -1): bool;
}
