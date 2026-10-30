<?php

namespace Webman;

use Workerman\Coroutine\Context as WorkermanContext;
use Workerman\Coroutine\Utils\DestructionWatcher;
use Closure;

/**
 * Class Context
 * @package Webman
 */
class Context extends WorkermanContext
{
    public static function onDestroy(Closure $closure): void
    {
        $obj = static::get('context.onDestroy');
        if (!$obj) {
            $obj = new \stdClass();
            static::set('context.onDestroy', $obj);
        }
        DestructionWatcher::watch($obj, $closure);
    }
}