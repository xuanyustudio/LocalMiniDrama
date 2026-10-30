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

use RuntimeException;

/**
 * Class Locker
 */
class Locker
{
    /**
     * @var Channel[]
     */
    protected static array $channels = [];

    /**
     * Lock.
     *
     * @param string $key
     * @return bool
     */
    public static function lock(string $key): bool
    {
        if (!isset(static::$channels[$key])) {
            static::$channels[$key] = new Channel(1);
        }
        return static::$channels[$key]->push(true);
    }

    /**
     * Unlock.
     *
     * @param string $key
     * @return bool
     */
    public static function unlock(string $key): bool
    {
        if ($channel = static::$channels[$key] ?? null) {
            // Must check hasProducers before pop, because pop in swow will wake up the producer, leading to inaccurate judgment.
            $hasProducers = $channel->hasProducers();
            $result = $channel->pop();
            if (!$hasProducers) {
                $channel->close();
                unset(static::$channels[$key]);
            }
            return $result;
        }
        throw new RuntimeException("Unlock failed, because the key $key is not locked");
    }

}