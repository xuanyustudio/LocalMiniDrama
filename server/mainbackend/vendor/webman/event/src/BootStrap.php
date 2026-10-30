<?php

namespace Webman\Event;

use support\Container;
use support\Log;

class BootStrap implements \Webman\Bootstrap
{

    /**
     * @var array
     */
    protected static $events = [];

    /**
     * @param $worker
     * @return mixed|void
     */
    public static function start($worker)
    {
        static::getEvents([config()]);
        foreach (static::$events as $name => $events) {
            // 支持排序，1 2 3 ... 9 a b c...z
            ksort($events, SORT_NATURAL);
            foreach ($events as $callbacks) {
                foreach ($callbacks as $callback) {
                    Event::on($name, $callback);
                }
            }
        }
    }

    /**
     * @param $callbacks
     * @return array|mixed
     */
    protected static function convertCallable($callbacks)
    {
        if (\is_array($callbacks)) {
            $callback = \array_values($callbacks);
            if (isset($callback[1]) && \is_string($callback[0]) && \class_exists($callback[0])) {
                return [Container::get($callback[0]), $callback[1]];
            }
        }
        return $callbacks;
    }

    /**
     * @param $configs
     * @return void
     */
    protected static function getEvents($configs)
    {
        foreach ($configs as $config) {
            if (!is_array($config)) {
                continue;
            }
            if (isset($config['event']) && is_array($config['event']) && !isset($config['event']['app']['enable'])) {
                foreach ($config['event'] as $event_name => $callbacks) {
                    $callbacks = static::convertCallable($callbacks);
                    if (is_callable($callbacks)) {
                        static::$events[$event_name][] = [$callbacks];
                        continue;
                    }
                    if (!is_array($callbacks)) {
                        $msg = "Events: $event_name => " .var_export($callbacks, true) . " is not callable\n";
                        echo $msg;
                        Log::error($msg);
                        continue;
                    }
                    ksort($callbacks, SORT_NATURAL);
                    foreach ($callbacks as $id => $callback) {
                        $callback = static::convertCallable($callback);
                        if (is_callable($callback)) {
                            static::$events[$event_name][$id][] = $callback;
                            continue;
                        }
                        $msg = "Events: $event_name => " . var_export($callback, true) . " is not callable\n";
                        echo $msg;
                        Log::error($msg);
                    }
                }
                unset($config['event']);
            }
            static::getEvents($config);
        }
    }

}
