<?php

use PHPUnit\Framework\TestCase;
use Workerman\Coroutine\Channel\Fiber as Channel;
use Workerman\Timer;
use Fiber as BaseFiber;

class FiberChannelTest extends TestCase
{
    /**
     * Test basic push and pop operations.
     */
    public function testBasicPushPop()
    {
        $channel = new Channel();

        $fiber = new BaseFiber(function() use ($channel) {
            $channel->push('test data');
        });

        $fiber->start();

        $this->assertEquals('test data', $channel->pop());
    }

    /**
     * Test that pop will block until data is available or timeout occurs.
     */
    public function testPopWithTimeout()
    {
        $channel = new Channel();

        $fiber = new BaseFiber(function() use ($channel) {
            $result = $channel->pop(0.5);
            $this->assertFalse($result);
        });

        $startTime = microtime(true);

        $fiber->start();

        // Allow time for the fiber to suspend and wait
        Timer::sleep(0.2);  // 200 ms

        // Ensure that the fiber is still waiting (not timed out yet)
        $this->assertTrue($fiber->isSuspended());

        // Wait until the timeout should have occurred
        Timer::sleep(0.4);  // 400 ms

        $endTime = microtime(true);

        $this->assertTrue($fiber->isTerminated());
        $this->assertGreaterThanOrEqual(0.5, $endTime - $startTime);
    }

    /**
     * Test that push will block when capacity is reached and timeout occurs.
     */
    public function testPushWithTimeout()
    {
        $channel = new Channel(1);

        $this->assertTrue($channel->push('data1'));

        $fiber = new BaseFiber(function() use ($channel) {
            $result = $channel->push('data2', 0.5);
            $this->assertFalse($result);
        });

        $startTime = microtime(true);

        $fiber->start();

        // Allow time for the fiber to suspend and wait
        Timer::sleep(0.2);  // 200 ms

        // Ensure that the fiber is still waiting (not timed out yet)
        $this->assertTrue($fiber->isSuspended());

        // Wait until the timeout should have occurred
        Timer::sleep(0.4);  // 400 ms

        $endTime = microtime(true);

        $this->assertTrue($fiber->isTerminated());
        $this->assertGreaterThanOrEqual(0.5, $endTime - $startTime);
    }

    /**
     * Test that push returns false immediately if capacity is full and timeout is zero.
     */
    public function testPushNonBlockingWhenFull()
    {
        $channel = new Channel(1);

        $this->assertTrue($channel->push('data1'));

        $result = $channel->push('data2', 0);
        $this->assertFalse($result);
    }

    /**
     * Test that pop returns false immediately if the channel is empty and timeout is zero.
     */
    public function testPopNonBlockingWhenEmpty()
    {
        $channel = new Channel();

        $result = $channel->pop(0);
        $this->assertFalse($result);
    }

    /**
     * Test closing the channel.
     */
    public function testCloseChannel()
    {
        $channel = new Channel();

        $channel->close();

        $this->assertFalse($channel->push('data'));
        $this->assertFalse($channel->pop());
    }

    /**
     * Test that waiting pushers and poppers are resumed when the channel is closed.
     */
    public function testWaitersAreResumedOnClose()
    {
        $channelPush = new Channel(1);
        $channelPop = new Channel(1);

        $pushFiber = new BaseFiber(function() use ($channelPush) {
            $channelPush->push('data', 1);
            $result = $channelPush->push('data', 1);
            $this->assertFalse($result);
        });

        $popFiber = new BaseFiber(function() use ($channelPop) {
            $result = $channelPop->pop(1);
            $this->assertFalse($result);
        });

        $pushFiber->start();
        $popFiber->start();

        // Allow time for fibers to suspend
        Timer::sleep(0.1);  // 100 ms

        // Close the channel to resume fibers
        $channelPush->close();
        $channelPop->close();

        // Allow time for fibers to process after resuming
        Timer::sleep(0.1);  // 100 ms

        $this->assertTrue($pushFiber->isTerminated());
        $this->assertTrue($popFiber->isTerminated());
    }

    /**
     * Test that length and getCapacity methods return correct values.
     */
    public function testLengthAndCapacity()
    {
        $capacity = 2;
        $channel = new Channel($capacity);

        $this->assertEquals(0, $channel->length());
        $this->assertEquals($capacity, $channel->getCapacity());

        $channel->push('data1');
        $this->assertEquals(1, $channel->length());

        $channel->push('data2');
        $this->assertEquals(2, $channel->length());

        $channel->pop();
        $this->assertEquals(1, $channel->length());

        $channel->pop();
        $this->assertEquals(0, $channel->length());
    }

    /**
     * Test pushing to a closed channel.
     */
    public function testPushToClosedChannel()
    {
        $channel = new Channel();

        $channel->close();

        $result = $channel->push('data');
        $this->assertFalse($result);
    }

    /**
     * Test popping from a closed channel.
     */
    public function testPopFromClosedChannel()
    {
        $channel = new Channel();

        $channel->push('data');

        $channel->close();

        $this->assertEquals('data', $channel->pop());
        $this->assertFalse($channel->pop());
    }

    /**
     * Test multiple push and pop operations with fibers.
     */
    public function testMultiplePushPopWithFibers()
    {
        $channel = new Channel(2);

        $results = [];

        $producerFiber = new BaseFiber(function() use ($channel) {
            $channel->push('data1');
            $channel->push('data2');
            $channel->push('data3');
        });

        $consumerFiber = new BaseFiber(function() use ($channel, &$results) {
            $results[] = $channel->pop();
            $results[] = $channel->pop();
            $results[] = $channel->pop();
        });

        $producerFiber->start();
        $consumerFiber->start();

        // Allow time for fibers to execute
        usleep(500000);  // 500 ms

        $this->assertEquals(['data1', 'data2', 'data3'], $results);
    }

    /**
     * Test that fibers are properly blocked and resumed in push and pop operations.
     */
    public function testFiberBlockingAndResuming()
    {
        $channel = new Channel(1);

        $pushFiber = new BaseFiber(function() use ($channel) {
            $channel->push('data1');
            $channel->push('data2');
            $channel->push('data3');
        });

        $popFiber = new BaseFiber(function() use ($channel) {
            $this->assertEquals('data1', $channel->pop());
            $this->assertEquals('data2', $channel->pop());
            $this->assertEquals('data3', $channel->pop());
        });

        $pushFiber->start();
        $popFiber->start();

        // Allow time for fibers to execute
        Timer::sleep(0.5);  // 500 ms

        $this->assertTrue($pushFiber->isTerminated());
        $this->assertTrue($popFiber->isTerminated());
    }

    /**
     * Test that pushing data after capacity is reached blocks until space is available.
     */
    public function testPushBlocksWhenFull()
    {
        $channel = new Channel(1);

        $channel->push('data1');

        $pushFiber = new BaseFiber(function() use ($channel) {
            $channel->push('data2');
        });

        $popFiber = new BaseFiber(function() use ($channel) {
            Timer::sleep(0.2);  // Wait before popping
            $this->assertEquals('data1', $channel->pop());
        });

        $pushFiber->start();
        $popFiber->start();

        // Allow time for fibers to execute
        Timer::sleep(0.5);  // 500 ms

        $this->assertTrue($pushFiber->isTerminated());
        $this->assertTrue($popFiber->isTerminated());
    }

    /**
     * Test that popping data from an empty channel blocks until data is available.
     */
    public function testPopBlocksWhenEmpty()
    {
        $channel = new Channel();

        $popFiber = new BaseFiber(function() use ($channel) {
            $this->assertEquals('data1', $channel->pop());
        });

        $pushFiber = new BaseFiber(function() use ($channel) {
            Timer::sleep(0.2);  // Wait before pushing
            $channel->push('data1');
        });

        $popFiber->start();
        $pushFiber->start();

        // Allow time for fibers to execute
        Timer::sleep(0.5);  // 500 ms

        $this->assertTrue($pushFiber->isTerminated());
        $this->assertTrue($popFiber->isTerminated());
    }

    /**
     * Test pushing and popping with zero timeout.
     */
    public function testPushPopWithZeroTimeout()
    {
        $channel = new Channel(1);

        $this->assertTrue($channel->push('data1'));

        $result = $channel->push('data2', 0);
        $this->assertFalse($result);

        $result = $channel->pop(0);
        $this->assertEquals('data1', $result);

        $result = $channel->pop(0);
        $this->assertFalse($result);
    }
}
