<?php

namespace test;

use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use ReflectionProperty;
use Workerman\Coroutine;
use Workerman\Coroutine\Exception\PoolException;
use Workerman\Coroutine\Pool;
use Psr\Log\LoggerInterface;
use ReflectionClass;
use stdClass;
use Exception;
use Workerman\Events\Event;
use Workerman\Events\Select;
use Workerman\Timer;
use Workerman\Worker;

class PoolTest extends TestCase
{

    public function testConstructorWithConfig()
    {
        $config = [
            'min_connections' => 2,
            'idle_timeout' => 30,
            'heartbeat_interval' => 10,
            'wait_timeout' => 5,
        ];
        $pool = new Pool(10, $config);

        $this->assertEquals(10, $this->getPrivateProperty($pool, 'maxConnections'));
        $this->assertEquals(2, $this->getPrivateProperty($pool, 'minConnections'));
        $this->assertEquals(30, $this->getPrivateProperty($pool, 'idleTimeout'));
        $this->assertEquals(10, $this->getPrivateProperty($pool, 'heartbeatInterval'));
        $this->assertEquals(5, $this->getPrivateProperty($pool, 'waitTimeout'));
    }

    public function testSetConnectionCreator()
    {
        $pool = new Pool(5);
        $connectionCreator = function () {
            return new stdClass();
        };
        $pool->setConnectionCreator($connectionCreator);
        $this->assertSame($connectionCreator, $this->getPrivateProperty($pool, 'connectionCreateHandler'));
    }

    public function testSetConnectionCloser()
    {
        $pool = new Pool(5);
        $connectionCloser = function ($conn) {
            // Close connection.
        };
        $pool->setConnectionCloser($connectionCloser);
        $this->assertSame($connectionCloser, $this->getPrivateProperty($pool, 'connectionDestroyHandler'));
    }

    public function testGetConnection()
    {
        $pool = new Pool(5);

        $connectionMock = $this->createMock(stdClass::class);

        // 设置连接创建器
        $pool->setConnectionCreator(function () use ($connectionMock) {
            return $connectionMock;
        });

        $connection = $pool->get();

        $this->assertSame($connectionMock, $connection);
        $this->assertEquals(1, $this->getCurrentConnections($pool));

        // 检查 WeakMap 是否更新
        $connections = $this->getPrivateProperty($pool, 'connections');
        $lastUsedTimes = $this->getPrivateProperty($pool, 'lastUsedTimes');
        $lastHeartbeatTimes = $this->getPrivateProperty($pool, 'lastHeartbeatTimes');

        $this->assertTrue($connections->offsetExists($connection));
        $this->assertTrue($lastUsedTimes->offsetExists($connection));
        $this->assertTrue($lastHeartbeatTimes->offsetExists($connection));
    }

    public function testPutConnection()
    {
        $pool = new Pool(5);

        $connectionMock = $this->createMock(stdClass::class);

        $pool->setConnectionCreator(function () use ($connectionMock) {
            return $connectionMock;
        });

        $connection = $pool->get();

        $pool->put($connection);

        if (Coroutine::isCoroutine()) {
            $channel = $this->getPrivateProperty($pool, 'channel');
            $this->assertEquals(1, $channel->length());
        }

        $this->assertEquals(1, $pool->getConnectionCount());
    }

    public function testPutConnectionDoesNotBelong()
    {
        $this->expectException(PoolException::class);
        $this->expectExceptionMessage('The connection does not belong to the connection pool.');

        $pool = new Pool(5);
        $connection = new stdClass();

        $pool->put($connection);
    }

    public function testCreateConnection()
    {
        $pool = new Pool(5);
        $connectionMock = $this->createMock(stdClass::class);

        $pool->setConnectionCreator(function () use ($connectionMock) {
            return $connectionMock;
        });

        $connection = $pool->createConnection();

        $this->assertSame($connectionMock, $connection);

        // 确保 currentConnections 增加
        $this->assertEquals(1, $this->getCurrentConnections($pool));

        // 检查 WeakMap 是否更新
        $connections = $this->getPrivateProperty($pool, 'connections');
        $lastUsedTimes = $this->getPrivateProperty($pool, 'lastUsedTimes');
        $lastHeartbeatTimes = $this->getPrivateProperty($pool, 'lastHeartbeatTimes');

        $this->assertTrue($connections->offsetExists($connection));
        $this->assertTrue($lastUsedTimes->offsetExists($connection));
        $this->assertTrue($lastHeartbeatTimes->offsetExists($connection));
    }

    public function testCreateMaxConnections()
    {
        if (in_array(Worker::$eventLoopClass, [Select::class, Event::class])) {
            $this->assertTrue(true);
            return;
        }
        $maxConnections = 2;
        $pool = new Pool($maxConnections);

        $pool->setConnectionCreator(function () {
            Timer::sleep(0.01);
            return $this->createMock(stdClass::class);
        });

        $connections = [];
        for ($i = 0; $i < 3; $i++) {
            Coroutine::create(function () use ($pool, &$connections) {
                $connections[] = $pool->get();
            });
        }

        Timer::sleep(0.1);
        $this->assertEquals($maxConnections, $this->getCurrentConnections($pool));

        $lastUsedTimes = $this->getPrivateProperty($pool, 'lastUsedTimes');
        $lastHeartbeatTimes = $this->getPrivateProperty($pool, 'lastHeartbeatTimes');

        $this->assertCount($maxConnections, $lastUsedTimes);
        $this->assertCount($maxConnections, $lastHeartbeatTimes);

        foreach ($connections as $connection) {
            $pool->put($connection);
        }

    }

    public function testCreateConnectionThrowsException()
    {
        $pool = new Pool(5);

        $pool->setConnectionCreator(function () {
            throw new Exception('Failed to create connection');
        });

        $this->expectException(Exception::class);
        $this->expectExceptionMessage('Failed to create connection');

        try {
            $pool->createConnection();
        } finally {
            // 确保 currentConnections 减少
            $this->assertEquals(0, $this->getCurrentConnections($pool));
        }
    }

    public function testCloseConnection()
    {
        $pool = new Pool(5);

        $connection = $this->createMock(ConnectionMock::class);

        // 模拟连接属于连接池
        $connections = $this->getPrivateProperty($pool, 'connections');
        $connections[$connection] = time();

        $connection->expects($this->once())->method('close');
        $pool->setConnectionCloser(function ($conn) {
            $conn->close();
        });

        $pool->closeConnection($connection);

        // 确保 currentConnections 减少
        $this->assertEquals(0, $this->getCurrentConnections($pool));

        // 确保连接从 WeakMap 中移除
        $this->assertFalse($connections->offsetExists($connection));
    }

    public function testCloseConnections()
    {
        $maxConnections = 5;

        $pool = new Pool($maxConnections);

        $pool->setConnectionCreator(function () {
            $connection = $this->createMock(ConnectionMock::class);
            $connection->expects($this->once())->method('close');
            return $connection;
        });

        $pool->setConnectionCloser(function ($conn) {
            $conn->close();
        });

        $connections = [];
        for ($i = 0; $i < $maxConnections; $i++) {
            $connections[] = $pool->get();
        }

        $this->assertEquals(Coroutine::isCoroutine() ? $maxConnections : 1, $this->getCurrentConnections($pool));

        $pool->closeConnections();
        $this->assertEquals(Coroutine::isCoroutine() ? $maxConnections : 0, $this->getCurrentConnections($pool));
        if (!Coroutine::isCoroutine()) {
            return;
        }

        foreach ($connections as $connection) {
            $pool->put($connection);
        }
        $this->assertEquals($maxConnections, $this->getCurrentConnections($pool));
        $pool->closeConnections();
        $this->assertEquals(0, $this->getCurrentConnections($pool));

        $connections = [];
        for ($i = 0; $i < $maxConnections; $i++) {
            $connections[] = $pool->get();
        }
        $this->assertEquals($maxConnections, $this->getCurrentConnections($pool));
        foreach ($connections as $connection) {
            $pool->put($connection);
        }
        $pool->closeConnections();
        unset($connections);
        $this->assertEquals(0, $this->getCurrentConnections($pool));
    }

    public function testCloseConnectionWithExceptionInDestroyHandler()
    {
        $pool = new Pool(5);

        $connection = $this->createMock(stdClass::class);

        // 模拟连接属于连接池
        $connections = $this->getPrivateProperty($pool, 'connections');
        $connections[$connection] = time();

        $exception = new Exception('Error closing connection');

        $pool->setConnectionCloser(function ($conn) use ($exception) {
            throw $exception;
        });

        // 设置日志记录器
        $loggerMock = $this->createMock(LoggerInterface::class);
        $loggerMock->expects($this->once())
            ->method('info')
            ->with($this->stringContains('Error closing connection'));

        $this->setPrivateProperty($pool, 'logger', $loggerMock);

        $pool->closeConnection($connection);

        // 确保 currentConnections 减少
        $this->assertEquals(0, $this->getCurrentConnections($pool));

        // 确保连接从 WeakMap 中移除
        $this->assertFalse($connections->offsetExists($connection));
    }

    public function testHeartbeatChecker()
    {
        $pool = $this->getMockBuilder(Pool::class)
            ->setConstructorArgs([5])
            ->onlyMethods(['closeConnection'])
            ->getMock();

        $connection = $this->createMock(stdClass::class);

        // 设置连接心跳检测器
        $pool->setHeartbeatChecker(function ($conn) {
            // 模拟心跳检测
        });

        // 模拟连接在通道中
        $channel = $this->getPrivateProperty($pool, 'channel');
        $channel->push($connection);

        // 设置连接的上次使用时间和心跳时间
        $connections = $this->getPrivateProperty($pool, 'connections');
        $connections[$connection] = time();

        $lastUsedTimes = $this->getPrivateProperty($pool, 'lastUsedTimes');
        $lastUsedTimes[$connection] = time();

        $lastHeartbeatTimes = $this->getPrivateProperty($pool, 'lastHeartbeatTimes');
        $lastHeartbeatTimes[$connection] = time() - 100; // 超过心跳间隔

        // 调用受保护的 checkConnections 方法
        $reflectedMethod = new ReflectionMethod($pool, 'checkConnections');
        $reflectedMethod->invoke($pool);

        // 检查心跳时间是否更新
        $lastHeartbeatTimes = $this->getPrivateProperty($pool, 'lastHeartbeatTimes');
        $this->assertGreaterThan(time() - 2, $lastHeartbeatTimes[$connection]);
    }

    public function testConnectionDestroyedWithoutReturn()
    {
        $pool = new Pool(5);

        // 设置连接创建器
        $pool->setConnectionCreator(function () {
            return new stdClass;
        });

        // 获取初始的 currentConnections
        $initialConnections = $this->getCurrentConnections($pool);

        // 从连接池获取一个连接
        $connection = $pool->get();

        // 检查 currentConnections 是否增加
        $this->assertEquals(Coroutine::isCoroutine() ? $initialConnections + 1 : 1, $this->getCurrentConnections($pool));

        // 不归还连接，并销毁连接对象
        unset($connection);

        // 检查 currentConnections 是否减少
        $this->assertEquals(Coroutine::isCoroutine() ? $initialConnections : 1, $this->getCurrentConnections($pool));
    }

    private function getPrivateProperty($object, string $property)
    {
        $prop = new ReflectionProperty($object, $property);
        return $prop->getValue($object);
    }

    private function setPrivateProperty($object, string $property, $value)
    {
        $prop = new ReflectionProperty($object, $property);
        $prop->setValue($object, $value);
    }

    private function getCurrentConnections($object): int
    {
        return $object->getConnectionCount();
    }

}

// 定义 ConnectionMock 类用于测试
class ConnectionMock
{
    public function close()
    {
        // 模拟关闭连接
    }
}
