<?php

declare(strict_types=1);

namespace tests;

use PHPUnit\Framework\TestCase;
use Workerman\Coroutine;
use Workerman\Timer;
use Workerman\Coroutine\WaitGroup;

/**
 * Class WaitGroupTest
 *
 * Tests for the Fiber WaitGroup implementation.
 */
class WaitGroupTest extends TestCase
{

    public function testWaitWaitGroupDone()
    {
        $waitGroup = new WaitGroup();
        $this->assertEquals(0, $waitGroup->count());
        $results = [0];
        $this->assertTrue($waitGroup->add());
        Coroutine::create(function () use ($waitGroup, &$results) {
            try {
                Timer::sleep(0.1);
                $results[] = 1;
            } finally {
                $this->assertTrue($waitGroup->done());
            }
        });
        $this->assertTrue($waitGroup->add());
        Coroutine::create(function () use ($waitGroup, &$results) {
            try {
                Timer::sleep(0.2);
                $results[] = 2;
            } finally {
                $this->assertTrue($waitGroup->done());
            }
        });
        $this->assertTrue($waitGroup->add());
        Coroutine::create(function () use ($waitGroup, &$results) {
            try {
                Timer::sleep(0.3);
                $results[] = 3;
            } finally {
                $this->assertTrue($waitGroup->done());
            }
        });
        $this->assertTrue($waitGroup->wait());
        $this->assertEquals(0, $waitGroup->count(), 'WaitGroup count should be 0 after wait is called.');
        $this->assertEquals([0, 1, 2, 3], $results, 'All coroutines should have been executed.');
    }
}
