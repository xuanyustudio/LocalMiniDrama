<?php
declare(strict_types=1);

namespace tests;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionException;
use stdClass;
use Workerman\Coroutine\Channel;
use PHPUnit\Framework\Attributes\DataProvider;
use Workerman\Coroutine\Channel\Memory;
use Workerman\Coroutine;

class ChannelTest extends TestCase
{
    /**
     * Test initializing channel with valid capacity.
     */
    public function testInitializeWithValidCapacity()
    {
        $channel = new Channel(1);
        $this->assertInstanceOf(Channel::class, $channel);
        $this->assertEquals(1, $channel->getCapacity());
    }

    /**
     * Test initializing channel with invalid capacities.
     */
    #[DataProvider('invalidCapacitiesProvider')]
    public function testInitializeWithInvalidCapacity($capacity)
    {
        $this->expectException(InvalidArgumentException::class);
        new Channel($capacity);
    }

    /**
     * Data provider for invalid capacities.
     */
    public static function invalidCapacitiesProvider(): array
    {
        return [
            [0],
            [-1],
            [-100]
        ];
    }

    /**
     * Test pushing and popping data.
     */
    public function testPushAndPop()
    {
        $channel = new Channel(2);
        $data1 = 'test data 1';
        $data2 = 'test data 2';

        // Push data into the channel
        $this->assertTrue($channel->push($data1));
        $this->assertTrue($channel->push($data2));

        // Verify the length of the channel
        $this->assertEquals(2, $channel->length());

        // Pop data from the channel
        $this->assertEquals($data1, $channel->pop());
        $this->assertEquals($data2, $channel->pop());
    }

    /**
     * Test pushing data when the channel is full.
     * @throws ReflectionException
     */
    public function testPushWhenFull()
    {
        // Memory driver does not support push with timeout
        if ($this->driverIsMemory()) {
            $this->assertTrue(true);
            return;
        }
        $channel = new Channel(1);
        $this->assertTrue($channel->push('data1'));

        $timeout = 0.5;
        // Attempt to push when the channel is full with a timeout
        $startTime = microtime(true);
        $this->assertFalse($channel->push('data2', $timeout));
        $elapsedTime = microtime(true) - $startTime;

        // Verify that the push operation timed out
        $this->assertTrue(0.1 > abs($elapsedTime - $timeout));
    }

    /**
     * Test popping data when the channel is empty.
     * @throws ReflectionException
     */
    public function testPopWhenEmpty()
    {
        // Memory driver does not support push with timeout
        if ($this->driverIsMemory()) {
            $this->assertTrue(true);
            return;
        }
        $channel = new Channel(1);

        // Attempt to pop when the channel is empty with a timeout
        $startTime = microtime(true);
        $this->assertFalse($channel->pop(0.1));
        $elapsedTime = microtime(true) - $startTime;

        // Verify that the pop operation timed out
        $this->assertGreaterThanOrEqual(0.09, $elapsedTime);
    }

    /**
     * Test closing the channel and its effects.
     */
    public function testCloseChannel()
    {
        $channel = new Channel(1);
        $this->assertTrue($channel->push('data'));

        // Close the channel
        $channel->close();

        // Attempt to push after closing
        $this->assertFalse($channel->push('new data'));

        // Pop the remaining data
        $this->assertEquals('data', $channel->pop());

        // Attempt to pop after channel is empty and closed
        $this->assertFalse($channel->pop());
    }

    /**
     * Test that push and pop return false when channel is closed.
     */
    public function testPushAndPopReturnFalseWhenClosed()
    {
        $channel = new Channel(1);
        $channel->close();

        $this->assertFalse($channel->push('data'));
        $this->assertFalse($channel->pop());
    }

    /**
     * Test the length and capacity methods.
     */
    public function testLengthAndCapacity()
    {
        $channel = new Channel(5);
        $this->assertEquals(0, $channel->length());
        $this->assertEquals(5, $channel->getCapacity());

        $channel->push('data1');
        $channel->push('data2');

        $this->assertEquals(2, $channel->length());
    }

    /**
     * Test pushing and popping with different data types.
     */
    #[DataProvider('dataTypesProvider')]
    public function testPushAndPopWithDifferentDataTypes($data)
    {
        $channel = new Channel(1);
        $this->assertTrue($channel->push($data));
        $this->assertSame($data, $channel->pop());
    }

    /**
     * Data provider for different data types.
     */
    public static function dataTypesProvider(): array
    {
        return [
            ['string'],
            [123],
            [123.456],
            [true],
            [false],
            [null],
            [[]],
            [['key' => 'value']],
            [new stdClass()],
            [fopen('php://memory', 'r')],
        ];
    }

    /**
     * Test pushing to a closed channel immediately returns false.
     */
    public function testPushToClosedChannel()
    {
        $channel = new Channel(1);
        $channel->close();
        $this->assertFalse($channel->push('data', 0));
    }

    /**
     * Test popping from a closed and empty channel immediately returns false.
     */
    public function testPopFromClosedAndEmptyChannel()
    {
        $channel = new Channel(1);
        $channel->close();
        $this->assertFalse($channel->pop(0));
    }

    /**
     * @return bool
     * @throws ReflectionException
     */
    protected function driverIsMemory(): bool
    {
        $reflectionClass = new ReflectionClass(Channel::class);
        $instance = $reflectionClass->newInstance();
        $property = $reflectionClass->getProperty('driver');
        $driverValue = $property->getValue($instance);
        return $driverValue instanceof Memory;
    }

    /**
     * 测试 hasConsumers 当没有消费者时返回 false
     */
    public function testHasConsumersWhenNoConsumers()
    {
        if (!Coroutine::isCoroutine()) {
            $this->assertTrue(true);
            return;
        }
        $channel = new Channel(1);
        $this->assertFalse($channel->hasConsumers());
        $channel->close();
    }

    /**
     * 测试 hasConsumers 当有消费者等待时返回 true
     * @throws ReflectionException
     */
    public function testHasConsumersWhenConsumersWaiting()
    {
        if ($this->driverIsMemory()) {
            $this->assertTrue(true);
            return;
        }
        $channel = new Channel(1);
        $sync = new Channel(1);

        Coroutine::create(function () use ($channel, $sync) {
            $sync->push(true);
            $channel->pop();
        });

        $sync->pop();

        $this->assertTrue($channel->hasConsumers());

        Coroutine::create(function () use ($channel) {
            $channel->push('data');
        });
        $channel->close();
    }

    /**
     * 测试 hasProducers 当没有生产者时返回 false
     * @throws ReflectionException
     */
    public function testHasProducersWhenNoProducers()
    {
        if ($this->driverIsMemory()) {
            $this->assertTrue(true);
            return;
        }
        $channel = new Channel(1);
        $this->assertFalse($channel->hasProducers());
        $channel->close();
    }

    /**
     * 测试 hasProducers 当有生产者等待时返回 true
     * @throws ReflectionException
     */
    public function testHasProducersWhenProducersWaiting()
    {
        if ($this->driverIsMemory()) {
            $this->assertTrue(true);
            return;
        }
        $channel = new Channel(1);
        $channel->push('data1');

        $sync = new Channel(1);

        Coroutine::create(function () use ($channel, $sync) {
            $sync->push(true);
            $channel->push('data2');
        });

        $sync->pop();

        $this->assertTrue($channel->hasProducers());

        $channel->pop();
        $channel->close();
    }

}
