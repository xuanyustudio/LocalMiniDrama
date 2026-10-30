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

namespace Workerman\Coroutine\Barrier;

/**
 * Interface BarrierInterface
 */
interface BarrierInterface
{
    /**
     * Wait for the barrier to be released.
     *
     * @param object $barrier
     * @param int $timeout
     * @return void
     */
    public static function wait(object &$barrier, int $timeout = -1): void;

    /**
     * Create a new barrier instance.
     *
     * @return BarrierInterface
     */
    public static function create(): object;
}
