<?php

namespace tests;

use ArrayObject;
use PHPUnit\Framework\TestCase;
use Workerman\Coroutine\Context;
use Workerman\Coroutine;

// Now, the test cases
class ContextTest extends TestCase
{
    public function testContextSetAndGetWithinCoroutine()
    {
        Coroutine::create(function () {
            $key = 'testContextSetAndGetWithinCoroutine';
            Context::set($key, 'value');
            $this->assertEquals('value', Context::get($key));
        });
    }

    public function testContextGet()
    {
        Context::reset(new ArrayObject(['not_exist' => 'value']));
        $key = 'testContextGet';
        Context::reset(new ArrayObject([$key => 'value']));
        $context = Context::get();
        $this->assertArrayNotHasKey('not_exist', $context);
        $this->assertObjectNotHasProperty('not_exist', $context);
        $this->assertArrayHasKey($key, $context);
        $this->assertObjectHasProperty($key, $context);
        $this->assertEquals('value', $context[$key]);
        $this->assertEquals('value', $context->$key);
        $this->assertInstanceOf('ArrayObject', $context);
        unset($context[$key]);
        $this->assertNull(Context::get($key));
        $context[$key] = 'value';
        $this->assertEquals('value', Context::get($key));
        unset($context->$key);
        $this->assertNull(Context::get($key));
        $context->$key = 'value';
        $this->assertEquals('value', Context::get($key));
    }

    public function testContextIsolationBetweenCoroutines()
    {
        $values = [];

        Coroutine::create(function () use (&$values) {
            Context::set('key', 'value1');
            $values[] = Context::get('key');
            // Ensure the value is not available after coroutine ends
            Context::destroy();
        });

        Coroutine::create(function () use (&$values) {
            Context::set('key', 'value2');
            $values[] = Context::get('key');
            // Ensure the value is not available after coroutine ends
            Context::destroy();
        });

        $this->assertEquals(['value1', 'value2'], $values);
    }

    public function testContextDestroyedAfterCoroutineEnds()
    {
        Coroutine::create(function () {
            Context::set('key', 'value');
            $this->assertTrue(Context::has('key'));
            // Simulate coroutine end and context destruction
            Context::destroy();
        });

        // After coroutine ends, the context should be destroyed
        // Need to simulate this by trying to access context outside coroutine
        $this->assertNull(Context::get('key'));
        $this->assertFalse(Context::has('key'));
    }

    public function testContextHasMethod()
    {
        Coroutine::create(function () {
            $this->assertFalse(Context::has('key'));
            Context::set('key', 'value');
            $this->assertTrue(Context::has('key'));
        });
    }

    public function testContextResetMethod()
    {
        Coroutine::create(function () {
            Context::reset(new ArrayObject(['key3' => 'value1']));
            Context::reset(new ArrayObject(['key1' => 'value1', 'key2' => 'value2']));
            $this->assertEquals('value1', Context::get('key1'));
            $this->assertEquals('value2', Context::get('key2'));
            // Test that other keys are not set
            $this->assertNull(Context::get('key3'));
        });
    }

    public function testContextDataNotSharedBetweenCoroutines()
    {
        $result = [];

        Coroutine::create(function () use (&$result) {
            Context::set('counter', 1);
            $result[] = Context::get('counter');
            Context::destroy();
        });

        Coroutine::create(function () use (&$result) {
            $this->assertNull(Context::get('counter'));
            Context::set('counter', 2);
            $result[] = Context::get('counter');
            Context::destroy();
        });

        $this->assertEquals([1, 2], $result);
    }

    public function testContextDefaultValues()
    {
        Coroutine::create(function () {
            $this->assertEquals('default', Context::get('non_existing_key', 'default'));
        });
    }

    public function testContextSetOverrideValue()
    {
        Coroutine::create(function () {
            Context::set('key', 'initial');
            $this->assertEquals('initial', Context::get('key'));
            Context::set('key', 'overridden');
            $this->assertEquals('overridden', Context::get('key'));
        });
    }

    public function testContextMultipleKeys()
    {
        Coroutine::create(function () {
            Context::set('key1', 'value1');
            Context::set('key2', 'value2');
            $this->assertEquals('value1', Context::get('key1'));
            $this->assertEquals('value2', Context::get('key2'));
        });
    }

    public function testContextPersistenceWithinCoroutine()
    {
        Coroutine::create(function () {
            Context::set('key', 'value');

            // Simulate asynchronous operation within coroutine
            $this->someAsyncOperation(function () {
                $this->assertEquals('value', Context::get('key'));
            });

            // Context should persist throughout the coroutine
            $this->assertEquals('value', Context::get('key'));
        });
    }

    private function someAsyncOperation(callable $callback)
    {
        // Simulate async operation
        $callback();
    }
}
