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

namespace Workerman\Coroutine\Utils;

use WeakMap;

class DestructionWatcher
{
    /**
     * @var WeakMap
     */
    protected static WeakMap $objects;

    /**
     * @var callable[]
     */
    protected array $callbacks = [];

    /**
     * DestructionWatcher constructor.
     *
     * @param callable|null $callback
     */
    public function __construct(?callable $callback = null)
    {
        if ($callback) {
            $this->callbacks[] = $callback;
        }
    }

    /**
     * DestructionWatcher destructor.
     */
    public function __destruct()
    {
        foreach (array_reverse($this->callbacks) as $callback) {
            $callback();
        }
    }

    /**
     * Watch object destruction.
     *
     * @param object $object
     * @param callable $callback
     * @return void
     */
    public static function watch(object $object, callable $callback): void
    {
        static::$objects ??= new WeakMap();
        static::$objects[$object] ??= new static();
        static::$objects[$object]->callbacks[] = $callback;
    }

}