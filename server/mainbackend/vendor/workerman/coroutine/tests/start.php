<?php

use Workerman\Events\Event;
use Workerman\Events\Select;
use Workerman\Events\Swow;
use Workerman\Events\Swoole;
use Workerman\Events\Fiber;
use Workerman\Timer;
use Workerman\Worker;

require_once __DIR__ . '/../vendor/autoload.php';

$phpunitDisplayOptions = [
    '--colors=always',
    '--display-deprecations',
    '--display-phpunit-deprecations',
    '--display-errors',
    '--display-notices',
    '--display-warnings',
    '--display-incomplete',
    '--display-skipped',
];

if (DIRECTORY_SEPARATOR === '/' || (!extension_loaded('swow') && !class_exists(Revolt\EventLoop::class))) {
    create_test_worker(function () use ($phpunitDisplayOptions) {
        (new PHPUnit\TextUI\Application)->run([
            __DIR__ . '/../vendor/bin/phpunit',
            ...$phpunitDisplayOptions,
            __DIR__ . '/ChannelTest.php',
            __DIR__ . '/PoolTest.php',
            __DIR__ . '/BarrierTest.php',
            __DIR__ . '/ContextTest.php',
            __DIR__ . '/WaitGroupTest.php',
        ]);
    }, Select::class);
}

if (extension_loaded('event')) {
    create_test_worker(function () use ($phpunitDisplayOptions) {
        (new PHPUnit\TextUI\Application)->run([
            __DIR__ . '/../vendor/bin/phpunit',
            ...$phpunitDisplayOptions,
            __DIR__ . '/ChannelTest.php',
            __DIR__ . '/PoolTest.php',
            __DIR__ . '/BarrierTest.php',
            __DIR__ . '/ContextTest.php',
            __DIR__ . '/WaitGroupTest.php',
        ]);
    }, Event::class);
}

if (class_exists(Revolt\EventLoop::class) && (DIRECTORY_SEPARATOR === '/' || !extension_loaded('swow'))) {
    create_test_worker(function () use ($phpunitDisplayOptions) {
        (new PHPUnit\TextUI\Application)->run([
            __DIR__ . '/../vendor/bin/phpunit',
            ...$phpunitDisplayOptions,
            ...glob(__DIR__ . '/*Test.php')
        ]);
    }, Fiber::class);
}

if (extension_loaded('Swoole')) {
    create_test_worker(function () use ($phpunitDisplayOptions) {
        (new PHPUnit\TextUI\Application)->run([
            __DIR__ . '/../vendor/bin/phpunit',
            ...$phpunitDisplayOptions,
            ...glob(__DIR__ . '/*Test.php')
        ]);
    }, Swoole::class);
}

if (extension_loaded('Swow')) {
    create_test_worker(function () use ($phpunitDisplayOptions) {
        (new PHPUnit\TextUI\Application)->run([
            __DIR__ . '/../vendor/bin/phpunit',
            ...$phpunitDisplayOptions,
            ...glob(__DIR__ . '/*Test.php')
        ]);
    }, Swow::class);
}

function create_test_worker(Closure $callable, $eventLoopClass): void
{
    $worker = new Worker();
    $worker->eventLoop = $eventLoopClass;
    $worker->onWorkerStart = function () use ($callable, $eventLoopClass) {
        $fp = fopen(__FILE__, 'r+');
        flock($fp, LOCK_EX);
        echo PHP_EOL . PHP_EOL. PHP_EOL . '[TEST EVENT-LOOP: ' . basename(str_replace('\\', '/', $eventLoopClass)) . ']' . PHP_EOL;
        try {
            $callable();
        } catch (Throwable $e) {
            echo $e;
        } finally {
            flock($fp, LOCK_UN);
        }
        Timer::repeat(1, function () use ($fp) {
            if (flock($fp, LOCK_EX | LOCK_NB)) {
                if(function_exists('posix_kill')) {
                    posix_kill(posix_getppid(), SIGINT);
                } else {
                    Worker::stopAll();
                }
            }
        });
    };
}

Worker::runAll();
