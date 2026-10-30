<?php

declare(strict_types=1);

namespace tests;

use PHPUnit\Framework\TestCase;
use Workerman\Coroutine\Locker;
use RuntimeException;
use Workerman\Coroutine;
use ReflectionClass;
use Workerman\Timer;

class LockerTest extends TestCase
{

    public function testLock()
    {
        $key = 'testLock';
        Locker::lock($key);
        $timeStart = microtime(true);
        $timeDiff2 = 0;
        Coroutine::create(function () use ($key, $timeStart, &$timeDiff2) {
            $this->assertChannelExists($key);
            Locker::lock($key);
            $timeDiff = microtime(true) - $timeStart;
            $this->assertGreaterThan($timeDiff2, $timeDiff);
            Locker::unlock($key);
        });
        usleep(100000);
        $timeDiff2 = microtime(true) - $timeStart;
        Locker::unlock($key);
    }

    public function testLockAndUnlock()
    {
        $key = 'testLockAndUnlock';
        $this->assertTrue(Locker::lock($key));
        $this->assertTrue(Locker::unlock($key));
        $this->assertChannelRemoved($key);
    }

    public function testUnlockWithoutLockThrowsException()
    {
        $this->expectException(RuntimeException::class);
        Locker::unlock('non_existent_key');
    }

    public function testRelockAfterUnlock()
    {
        $key = 'testRelockAfterUnlock';
        Locker::lock($key);
        Locker::unlock($key);

        $this->assertTrue(Locker::lock($key));
        Locker::unlock($key);
        $this->assertChannelRemoved($key);
    }

    public function testMultipleCoroutinesLocking()
    {
        $key = 'testMultipleCoroutinesLocking';
        $results = [];
        Coroutine::create(function () use ($key, &$results) {
            Coroutine::create(function () use ($key, &$results) {
                Locker::lock($key);
                $results[] = 'A';
                Timer::sleep(0.1);
                usleep(100000);
                Locker::unlock($key);
            });

            Coroutine::create(function () use ($key, &$results) {
                Timer::sleep(0.05);
                Locker::lock($key);
                $results[] = 'B';
                Locker::unlock($key);
            });

            Coroutine::create(function () use ($key, &$results) {
                Timer::sleep(0.05);
                Locker::lock($key);
                $results[] = 'C';
                Locker::unlock($key);
            });

        });

        Timer::sleep(0.3);
        $this->assertEquals(['A', 'B', 'C'], $results);
        $this->assertChannelRemoved($key);
    }

    public function testChannelRemainsWhenWaiting()
    {
        $key = 'testChannelRemainsWhenWaiting';
        Locker::lock($key);

        Coroutine::create(function () use ($key) {
            Coroutine::create(function () use ($key) {
                Locker::lock($key);
                Locker::unlock($key);
            });

            Locker::unlock($key);

            $this->assertChannelRemoved($key);
        });
    }

    private function assertChannelExists(string $key): void
    {
        $channels = $this->getChannels();
        $this->assertArrayHasKey($key, $channels, "Channel for key '$key' should exist");
    }

    private function assertChannelRemoved(string $key): void
    {
        $channels = $this->getChannels();
        $this->assertArrayNotHasKey($key, $channels, "Channel for key '$key' should be removed");
    }

    private function getChannels(): array
    {
        $reflector = new ReflectionClass(Locker::class);
        $property = $reflector->getProperty('channels');
        return $property->getValue();
    }

}