<?php

namespace Workerman\Coroutine\Context;

use ArrayObject;
use Swow\Coroutine;
use WeakMap;

class Swow implements ContextInterface
{
    /**
     * @var WeakMap
     */
    public static WeakMap $contexts;

    /**
     * @inheritDoc
     */
    public static function get(?string $name = null, mixed $default = null): mixed
    {
        $fiber = Coroutine::getCurrent();
        if ($name === null) {
            static::$contexts[$fiber] ??= new ArrayObject([], ArrayObject::ARRAY_AS_PROPS);
            return static::$contexts[$fiber];
        }
        return static::$contexts[$fiber][$name] ?? $default;
    }

    /**
     * @inheritDoc
     */
    public static function set(string $name, $value): void
    {
        $coroutine = Coroutine::getCurrent();
        static::$contexts[$coroutine] ??= new ArrayObject([], ArrayObject::ARRAY_AS_PROPS);
        static::$contexts[$coroutine][$name] = $value;
    }

    /**
     * @inheritDoc
     */
    public static function has(string $name): bool
    {
        $fiber = Coroutine::getCurrent();
        return isset(static::$contexts[$fiber]) && static::$contexts[$fiber]->offsetExists($name);
    }

    /**
     * @inheritDoc
     */
    public static function reset(?ArrayObject $data = null): void
    {
        $coroutine = Coroutine::getCurrent();
        $data->setFlags(ArrayObject::ARRAY_AS_PROPS);
        static::$contexts[$coroutine] = $data;
    }

    /**
     * @inheritDoc
     */
    public static function destroy(): void
    {
        unset(static::$contexts[Coroutine::getCurrent()]);
    }

    /**
     * Initialize the weakMap.
     *
     * @return void
     */
    public static function initContext(): void
    {
        self::$contexts = new WeakMap();
    }

}

Swow::initContext();