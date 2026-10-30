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

/**
 * ChannelInterface
 */
interface ChannelInterface
{
    /**
     * Push data to channel.
     *
     * @param mixed $data
     * @param float $timeout
     * @return bool
     */
    public function push(mixed $data, float $timeout = -1): bool;

    /**
     * Pop data from channel.
     *
     * @param float $timeout
     * @return mixed
     */
    public function pop(float $timeout = -1): mixed;

    /**
     * Get the length of channel.
     *
     * @return int
     */
    public function length(): int;

    /**
     * Get the capacity of channel.
     *
     * @return int
     */
    public function getCapacity(): int;

    /**
     * Check if there are consumers waiting to pop data from the channel.
     *
     * @return bool
     */
    public function hasConsumers(): bool;

    /**
     * Check if there are producers waiting to push data to the channel.
     *
     * @return bool
     */
    public function hasProducers(): bool;

    /**
     * Close the channel.
     *
     * @return void
     */
    public function close(): void;

}
