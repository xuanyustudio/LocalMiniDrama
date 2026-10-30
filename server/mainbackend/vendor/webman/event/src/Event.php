<?php

namespace Webman\Event;

use Psr\Log\LoggerInterface;
use support\Log;

class Event
{
    /**
     * @var array
     */
    protected static $eventMap = [];

    /**
     * @var array
     */
    protected static $prefixEventMap = [];

    /**
     * @var int
     */
    protected static $id = 0;

    /**
     * @var LoggerInterface
     */
    protected static $logger;

    /**
     * @param mixed $event_name
     * @param callable $listener
     * @return int
     */
    public static function on($event_name, callable $listener): int
    {
        $is_prefix_name = $event_name[strlen($event_name) - 1] === '*';
        if ($is_prefix_name) {
            static::$prefixEventMap[substr($event_name, 0, -1)][++static::$id] = $listener;
        } else {
            static::$eventMap[$event_name][++static::$id] = $listener;
        }
        return static::$id;
    }

    /**
     * @param mixed $event_name
     * @param integer $id
     * @return int
     */
    public static function off($event_name, int $id): int
    {
        if (isset(static::$eventMap[$event_name][$id])) {
            unset(static::$eventMap[$event_name][$id]);
            return 1;
        }
        return 0;
    }

    /**
     * @param mixed $event_name
     * @param mixed $data
     * @param bool $halt
     * @return array|null|mixed
     */
    public static function emit($event_name, $data, bool $halt = false)
    {
        $listeners = static::getListeners($event_name);
        $responses = [];
        foreach ($listeners as $listener) {
            try {
                $response = $listener($data, $event_name);
            } catch (\Throwable $e) {
                $responses[] = $e;
                if (!static::$logger && is_callable('\support\Log::error')) {
                    static::$logger = Log::channel();
                }
                if (static::$logger) {
                    static::$logger->error($e);
                }
                continue;
            }
            $responses[] = $response;
            if ($halt && !is_null($response)) {
                return $response;
            }
            if ($response === false) {
                break;
            }
        }
        return $halt ? null : $responses;
    }
    
    /**
     * @param mixed $event_name
     * @param mixed $data
     * @param bool $halt
     * @return array|null|mixed
     */
    public static function dispatch($event_name, $data, bool $halt = false)
    {
        $listeners = static::getListeners($event_name);
        $responses = [];
        foreach ($listeners as $listener) {
            $response = $listener($data, $event_name);
            $responses[] = $response;
            if ($halt && !is_null($response)) {
                return $response;
            }
            if ($response === false) {
                break;
            }
        }
        return $halt ? null : $responses;
    }

    /**
     * @return array
     */
    public static function list(): array
    {
        $listeners = [];
        foreach (static::$eventMap as $event_name => $callback_items) {
            foreach ($callback_items as $id => $callback_item) {
                $listeners[$id] = [$event_name, $callback_item];
            }
        }
        foreach (static::$prefixEventMap as $event_name => $callback_items) {
            foreach ($callback_items as $id => $callback_item) {
                $listeners[$id] = [$event_name . '*', $callback_item];
            }
        }
        ksort($listeners);
        return $listeners;
    }

    /**
     * @param mixed $event_name
     * @return callable[]
     */
    public static function getListeners($event_name): array
    {
        $listeners = static::$eventMap[$event_name] ?? [];
        foreach (static::$prefixEventMap as $name => $callback_items) {
            if (strpos($event_name, $name) === 0) {
                $listeners = array_merge($listeners, $callback_items);
            }
        }
        ksort($listeners);
        return $listeners;
    }

    /**
     * @param mixed $event_name
     * @return bool
     */
    public static function hasListener($event_name): bool
    {
        return !empty(static::getListeners($event_name));
    }
}
