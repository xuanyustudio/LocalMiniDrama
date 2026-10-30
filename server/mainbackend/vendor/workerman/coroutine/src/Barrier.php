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

use Workerman\Coroutine\Barrier\BarrierInterface;
use Workerman\Events\Swoole;
use Workerman\Events\Swow;
use Workerman\Worker;

/**
 * Class Barrier
 */
class Barrier implements BarrierInterface
{

    /**
     * @var string
     */
    protected static string $driver;

    /**
     * Get driver.
     *
     * @return string
     */
    protected static function getDriver(): string
    {
        return static::$driver ??= match (Worker::$eventLoopClass) {
            Swoole::class => Barrier\Swoole::class,
            Swow::class => Barrier\Swow::class,
            default=> Barrier\Fiber::class,
        };
    }

    /**
     * @inheritDoc
     */
    public static function wait(object &$barrier, int $timeout = -1): void
    {
        static::getDriver()::wait($barrier, $timeout);
    }

    /**
     * @inheritDoc
     */
    public static function create(): object
    {
        return static::getDriver()::create();
    }

}