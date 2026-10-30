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

use Throwable;
use Workerman\Coroutine;

/**
 * Class Parallel
 */
class Parallel
{
    /**
     * @var Channel|null
     */
    protected ?Channel $channel = null;

    /**
     * @var array
     */
    protected array $callbacks = [];

    /**
     * @var array
     */
    protected array $results = [];

    /**
     * @var array
     */
    protected array $exceptions = [];

    /**
     * Constructor.
     *
     * @param int $concurrent
     */
    public function __construct(int $concurrent = -1)
    {
        if ($concurrent > 0) {
            $this->channel = new Channel($concurrent);
        }
    }

    /**
     * Add a coroutine.
     *
     * @param callable $callable
     * @param string|null $key
     * @return void
     */
    public function add(callable $callable, ?string $key = null): void
    {
        if ($key === null) {
            $this->callbacks[] = $callable;
        } else {
            $this->callbacks[$key] = $callable;
        }
    }

    /**
     * Wait all coroutines complete and return results.
     *
     * @return array
     */
    public function wait(): array
    {
        $barrier = Barrier::create();
        foreach ($this->callbacks as $key => $callback) {
            $this->channel?->push(true);
            Coroutine::create(function () use ($callback, $key, $barrier) {
                try {
                    $this->results[$key] = $callback();
                } catch (Throwable $throwable) {
                    $this->exceptions[$key] = $throwable;
                } finally {
                    $this->channel?->pop();
                }
            });
        }
        Barrier::wait($barrier);
        return $this->results;
    }

    /**
     * Get failed results.
     *
     * @return array
     */
    public function getExceptions(): array
    {
        return $this->exceptions;
    }

}
