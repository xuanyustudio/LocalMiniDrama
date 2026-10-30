<?php

declare(strict_types=1);

namespace tests;

use PHPUnit\Framework\TestCase;
use Workerman\Coroutine\Barrier;
use Workerman\Coroutine;
use Workerman\Timer;

/**
 * Class FiberBarrierTest
 *
 * Tests for the Fiber Barrier implementation.
 */
class BarrierTest extends TestCase
{

    /**
     * Test that the barrier is set to null after calling wait.
     */
    public function testWaitSetsBarrierToNull()
    {
        $barrier = Barrier::create();
        $results = [0];
        Coroutine::create(function () use ($barrier, &$results) {
            Timer::sleep(0.1);
            $results[] = 1;
        });
        Coroutine::create(function () use ($barrier, &$results) {
            Timer::sleep(0.2);
            $results[] = 2;
        });
        Coroutine::create(function () use ($barrier, &$results) {
            Timer::sleep(0.3);
            $results[] = 3;
        });
        Barrier::wait($barrier);
        $this->assertNull($barrier, 'Barrier should be null after wait is called.');
        $this->assertEquals([0, 1, 2, 3], $results, 'All coroutines should have been executed.');
    }
}
