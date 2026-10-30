<?php

namespace tests;

use PHPUnit\Framework\TestCase;
use Workerman\Coroutine;
use Workerman\Coroutine\Coroutine\CoroutineInterface;
use Workerman\Events\Swoole;
use Workerman\Worker;

class CoroutineTest extends TestCase
{
    public function testCreateReturnsCoroutineInterface()
    {
        $callable = function() {};
        $coroutine = Coroutine::create($callable);
        $this->assertInstanceOf(CoroutineInterface::class, $coroutine);
    }

    public function testStartExecutesCoroutine()
    {
        $value = null;
        Coroutine::create(function() use (&$value) {
            $value = 'started';
        });
        $this->assertEquals('started', $value);
    }

    public function testSuspendAndResumeCoroutine()
    {
        if (Worker::$eventLoopClass === Swoole::class) {
            // Swoole does not support suspend and resume
            $this->assertTrue(true);
            return;
        }
        $value = [];
        $coroutine = Coroutine::create(function() use (&$value) {
            $value[] = 'before suspend';
            $resumedValue = Coroutine::suspend();
            $value[] = 'after resume';
            $value[] = $resumedValue;
        });
        $this->assertEquals(['before suspend'], $value);
        $coroutine->resume('resumed data');
        unset($coroutine);
        gc_collect_cycles();
        $this->assertEquals(['before suspend', 'after resume', 'resumed data'], $value);
    }

    public function testGetCurrentReturnsCurrentCoroutine()
    {
        $currentCoroutine = null;
        $coroutine = Coroutine::create(function() use (&$currentCoroutine) {
            $currentCoroutine = Coroutine::getCurrent();
        });
        $this->assertSame($coroutine, $currentCoroutine);
    }

    public function testCoroutineIdIsInteger()
    {
        $coroutine = Coroutine::create(function() {});
        $id = $coroutine->id();
        $this->assertIsInt($id);
    }

    public function testDeferExecutesAfterCoroutineDestruction()
    {
        $value = [];
        $coroutine = Coroutine::create(function() use (&$value) {
            Coroutine::defer(function() use (&$value) {
                $value[] = 'defer1';
            });
            Coroutine::defer(function() use (&$value) {
                $value[] = 'defer2';
            });
            $value[] = 'before suspend';
            Coroutine::suspend();
            $value[] = 'after resume';
        });
        $this->assertEquals(['before suspend'], $value);
        $coroutine->resume();
        unset($coroutine);
        gc_collect_cycles();
        $this->assertEquals(['before suspend', 'after resume', 'defer2', 'defer1'], $value);
    }

    public function testMultipleCoroutines()
    {
        $sequence = [];
        $coroutine1 = Coroutine::create(function() use (&$sequence) {
            $sequence[] = 'coroutine1 start';
            Coroutine::suspend();
            $sequence[] = 'coroutine1 resumed';
        });
        $coroutine2 = Coroutine::create(function() use (&$sequence) {
            $sequence[] = 'coroutine2 start';
            Coroutine::suspend();
            $sequence[] = 'coroutine2 resumed';
        });
        $this->assertEquals(['coroutine1 start', 'coroutine2 start'], $sequence);
        $coroutine1->resume();
        $coroutine2->resume();
        $this->assertEquals(
            ['coroutine1 start', 'coroutine2 start', 'coroutine1 resumed', 'coroutine2 resumed'],
            $sequence
        );
    }

    public function testCoroutineWithArguments()
    {
        $result = null;
        $coroutine = new Coroutine(function($a, $b) use (&$result) {
            $result = $a + $b;
        });
        $coroutine->start(2, 3);
        $this->assertEquals(5, $result);
    }

    public function testSuspendReturnsValue()
    {
        if (Worker::$eventLoopClass === Swoole::class) {
            // Swoole does not support suspend and resume
            $this->assertTrue(true);
            return;
        }
        $coroutine = new Coroutine(function() {
            $valueFromResume = Coroutine::suspend('first suspend');
            Coroutine::suspend($valueFromResume);
        });
        $first_suspend = $coroutine->start();
        $this->assertEquals('first suspend', $first_suspend);
        $result = $coroutine->resume('value from resume');
        $this->assertEquals('value from resume', $result);
    }

    public function testNestedCoroutines()
    {
        $sequence = [];
        $coroutine = Coroutine::create(function() use (&$sequence) {
            $sequence[] = 'outer start';
            $inner = Coroutine::create(function() use (&$sequence) {
                $sequence[] = 'inner start';
                Coroutine::suspend();
                $sequence[] = 'inner resumed';
            });
            Coroutine::suspend();
            $sequence[] = 'outer resumed';
            $inner->resume();
            $sequence[] = 'outer end';
        });
        $this->assertEquals(['outer start', 'inner start'], $sequence);
        $coroutine->resume();
        $this->assertEquals(['outer start', 'inner start', 'outer resumed', 'inner resumed', 'outer end'], $sequence);
    }

    /*public function testCoroutineExceptionHandling()
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Test exception');
        Coroutine::create(function() {
            throw new \Exception('Test exception');
        });
    }*/

    public function testDeferOrder()
    {
        $value = [];
        $coroutine = Coroutine::create(function() use (&$value) {
            Coroutine::defer(function() use (&$value) {
                $value[] = 'defer1';
            });
            Coroutine::defer(function() use (&$value) {
                $value[] = 'defer2';
            });
            $value[] = 'coroutine body';
        });
        unset($coroutine);
        // Force garbage collection
        gc_collect_cycles();
        $this->assertEquals(['coroutine body', 'defer2', 'defer1'], $value);
    }

}

