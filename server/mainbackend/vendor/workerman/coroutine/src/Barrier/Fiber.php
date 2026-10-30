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

use Revolt\EventLoop;
use RuntimeException;
use Workerman\Coroutine\Utils\DestructionWatcher;
use Workerman\Timer;
use Fiber as BaseFiber;
use Workerman\Worker;

/**
 * Class Fiber
 */
class Fiber implements BarrierInterface
{

    /**
     * @inheritDoc
     */
    public static function wait(object &$barrier, int $timeout = -1): void
    {
        $coroutine = BaseFiber::getCurrent();
        $resumed = false;
        $timerId = null;

        if ($timeout > 0 && $coroutine) {
            $timerId = Timer::delay($timeout, function() use ($coroutine, &$resumed) {
                if (!$resumed) {
                    $resumed = true;
                    $coroutine->resume();
                }
            });
        }

        $coroutine && DestructionWatcher::watch($barrier, function() use ($coroutine, &$resumed, &$timerId) {
            if (!$resumed) {
                $resumed = true;
                if ($timerId !== null) {
                    Timer::del($timerId);
                }
                // In PHP 8.4.0 and earlier,
                // switching fibers during the execution of an object's destructor method is not allowed,
                // so we implemented a delay.
                if ($coroutine instanceof BaseFiber) {
                    Timer::delay(0.00001, function() use ($coroutine) {
                        $coroutine->resume();
                    });
                    return;
                }
                EventLoop::defer(function () use ($coroutine) {
                    $coroutine->resume();
                });
            }
        });
        $barrier = null;
        $coroutine && BaseFiber::suspend();
    }

    /**
     * @inheritDoc
     */
    public static function create(): object
    {
        if (!Worker::isRunning()) {
            throw new RuntimeException('Fiber barrier only support in workerman runtime');
        }
        return new self();
    }

}
