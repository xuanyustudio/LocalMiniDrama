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

namespace Workerman\Coroutine\Coroutine;

use RuntimeException;
use Swoole\Coroutine;
use WeakReference;

class Swoole implements CoroutineInterface
{

    /**
     * @var array
     */
    private static array $instances = [];

    /**
     * @var int
     */
    private int $id = 0;

    /**
     * @var callable|null
     */
    private $callable;

    /**
     * Coroutine constructor.
     *
     * @param callable|null $callable
     */
    public function __construct(?callable $callable = null)
    {
        $this->callable = $callable;
    }

    /**
     * @inheritDoc
     */
    public static function create(callable $callable, ...$args): CoroutineInterface
    {
        $id = Coroutine::create($callable, ...$args);
        if (isset(self::$instances[$id]) && $coroutine = self::$instances[$id]->get()) {
            return $coroutine;
        }
        $coroutine = new self($callable);
        $coroutine->id = $id;
        self::$instances[$id] = WeakReference::create($coroutine);
        return $coroutine;
    }

    /**
     * @inheritDoc
     */
    public function start(mixed  ...$args): CoroutineInterface
    {
        if ($this->id) {
            throw new RuntimeException('Coroutine has already started');
        }
        $this->id = Coroutine::create($this->callable, ...$args);
        $this->callable = null;
        if (isset(self::$instances[$this->id]) && $coroutine = self::$instances[$this->id]->get()) {
            return $coroutine;
        }
        self::$instances[$this->id] = WeakReference::create($this);
        return $this;
    }

    /**
     * @inheritDoc
     */
    public function resume(mixed ...$args): mixed
    {
        return Coroutine::resume($this->id, ...$args);
    }

    /**
     * @inheritDoc
     */
    public function id(): int
    {
        return $this->id;
    }

    /**
     * @inheritDoc
     */
    public static function defer(callable $callable): void
    {
        Coroutine::defer($callable);
    }

    /**
     * @inheritDoc
     */
    public static function suspend(mixed $value = null): mixed
    {
        return Coroutine::suspend($value);
    }

    /**
     * @inheritDoc
     */
    public static function getCurrent(): CoroutineInterface
    {
        $id = Coroutine::getCid();
        if ($id === -1) {
            throw new RuntimeException('Not in coroutine');
        }
        if (!isset(self::$instances[$id])) {
            $coroutine = new self();
            $coroutine->id = $id;
            self::$instances[$id] = WeakReference::create($coroutine);
        }
        return self::$instances[$id]->get();
    }

    /**
     * @inheritDoc
     */
    public static function isCoroutine(): bool
    {
        return Coroutine::getCid() > 0;
    }

    /**
     * Destructor.
     */
    public function __destruct()
    {
        unset(self::$instances[$this->id]);
    }

}
