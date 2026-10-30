<?php

namespace Workerman\Coroutine\Context;

use ArrayObject;
use Swoole\Coroutine;

class Swoole implements ContextInterface
{

    /**
     * @inheritDoc
     */
    public static function get(?string $name = null, mixed $default = null): mixed
    {
        $context = Coroutine::getContext();
        if (!$context) {
            return $default;
        }
        $context->setFlags(ArrayObject::ARRAY_AS_PROPS);
        if ($name === null) {
            return $context;
        }
        return $context[$name] ?? $default;
    }

    /**
     * @inheritDoc
     */
    public static function set(string $name, $value): void
    {
        Coroutine::getContext()[$name] = $value;
    }

    /**
     * @inheritDoc
     */
    public static function has(string $name): bool
    {
        $context = Coroutine::getContext();
        return $context->offsetExists($name);
    }

    /**
     * @inheritDoc
     */
    public static function reset(?ArrayObject $data = null): void
    {
        $context = Coroutine::getContext();
        $context->setFlags(ArrayObject::ARRAY_AS_PROPS);
        $context->exchangeArray($data ? $data->getArrayCopy() : []);
    }

    /**
     * @inheritDoc
     */
    public static function destroy(): void
    {
        $context = Coroutine::getContext();
        $context->exchangeArray([]);
    }

}
