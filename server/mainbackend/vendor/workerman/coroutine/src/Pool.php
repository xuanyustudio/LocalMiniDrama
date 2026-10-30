<?php
/**
 * This file is part of workerman.
 *
 * Licensed under The MIT License
 * For full copyright and license information, please see the MIT-LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @author    walkor<walkor@workerman.net>
 * @copyright walkor<walkor@workerman.net>
 * @link      http://www.workerman.net/
 * @license   http://www.opensource.org/licenses/mit-license.php MIT License
 */

declare(strict_types=1);

namespace Workerman\Coroutine;

use Closure;
use Psr\Log\LoggerInterface;
use stdClass;
use Throwable;
use WeakMap;
use Workerman\Coroutine;
use Workerman\Coroutine\Exception\PoolException;
use Workerman\Coroutine\Utils\DestructionWatcher;
use Workerman\Timer;
use Workerman\Worker;

/**
 * Class Pool
 */
class Pool implements PoolInterface
{
    /**
     * @var Channel
     */
    protected Channel $channel;

    /**
     * @var int
     */
    protected int $minConnections = 1;

    /**
     * @var WeakMap
     */
    protected WeakMap $connections;

    /**
     * @var ?object
     */
    protected ?object $nonCoroutineConnection = null;

    /**
     * @var WeakMap
     */
    protected WeakMap $lastUsedTimes;

    /**
     * @var WeakMap
     */
    protected WeakMap $lastHeartbeatTimes;

    /**
     * @var Closure|null
     */
    protected ?Closure $connectionCreateHandler = null;

    /**
     * @var Closure|null
     */
    protected ?Closure $connectionDestroyHandler = null;

    /**
     * @var Closure|null
     */
    protected ?Closure $connectionHeartbeatHandler = null;

    /**
     * @var float
     */
    protected float $idleTimeout = 60;

    /**
     * @var float
     */
    protected float $heartbeatInterval = 50;

    /**
     * @var float
     */
    protected float $waitTimeout = 10;

    /**
     * @var LoggerInterface|Closure|null
     */
    protected LoggerInterface|Closure|null $logger = null;

    /**
     * @var array|string[]
     */
    private array $configurableProperties = [
        'minConnections',
        'idleTimeout',
        'heartbeatInterval',
        'waitTimeout',
    ];

    /**
     * Constructor.
     *
     * @param int $maxConnections
     * @param array $config
     */
    public function __construct(protected int $maxConnections = 1, protected array $config = [])
    {
        foreach ($config as $key => $value) {
            $camelCaseKey = lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $key))));
            if (in_array($camelCaseKey, $this->configurableProperties, true)) {
                $this->$camelCaseKey = $value;
            }
        }

        $this->channel = new Channel($maxConnections);
        $this->lastUsedTimes = new WeakMap();
        $this->lastHeartbeatTimes = new WeakMap();
        $this->connections = new WeakMap();

        if (Worker::isRunning()) {
            Timer::repeat(1, function () {
                $this->checkConnections();
            });
        }
    }

    /**
     * Set the connection creator.
     *
     * @param callable $connectionCreateHandler
     * @return $this
     */
    public function setConnectionCreator(callable $connectionCreateHandler): self
    {
        $this->connectionCreateHandler = $connectionCreateHandler;
        return $this;
    }

    /**
     * Set the connection closer.
     *
     * @param callable $connectionDestroyHandler
     * @return $this
     */
    public function setConnectionCloser(callable $connectionDestroyHandler): self
    {
        $this->connectionDestroyHandler = $connectionDestroyHandler;
        return $this;
    }

    /**
     * Set the connection heartbeat checker.
     *
     * @param callable $connectionHeartbeatHandler
     * @return $this
     */
    public function setHeartbeatChecker(callable $connectionHeartbeatHandler): self
    {
        $this->connectionHeartbeatHandler = $connectionHeartbeatHandler;
        return $this;
    }

    /**
     * Get connection.
     *
     * @return object
     * @throws Throwable
     */
    public function get(): object
    {
        if (!Coroutine::isCoroutine()) {
            if (!$this->nonCoroutineConnection) {
                $this->nonCoroutineConnection = $this->createConnection();
            }
            return $this->nonCoroutineConnection;
        }
        $num = $this->channel->length();
        if ($num === 0 && $this->getConnectionCount() < $this->maxConnections) {
            return $this->createConnection();
        }
        $connection = $this->channel->pop($this->waitTimeout);
        if (!$connection) {
            throw new PoolException("Failed to get a connection from the pool within the wait timeout ($this->waitTimeout seconds). The connection pool is exhausted.");
        }
        $this->lastUsedTimes[$connection] = time();
        return $connection;
    }

    /**
     * Put connection to pool.
     *
     * @param object $connection
     * @return void
     * @throws Throwable
     */
    public function put(object $connection): void
    {
        // This connection does not belong to the connection pool.
        // It may have been closed by $this->closeConnection($connection).
        if (!isset($this->connections[$connection])) {
            throw new PoolException('The connection does not belong to the connection pool.');
        }
        if ($connection === $this->nonCoroutineConnection) {
            return;
        }
        try {
            $this->channel->push($connection);
        } catch (Throwable $throwable) {
            $this->closeConnection($connection);
            throw $throwable;
        }
    }

    /**
     * Check if the connection is valid.
     *
     * @param $connection
     * @return bool
     */
    protected function isValidConnection($connection): bool
    {
        return is_object($connection);
    }

    /**
     * Create connection.
     *
     * @return object
     * @throws Throwable
     */
    public function createConnection(): object
    {
        if ($this->getConnectionCount() >= $this->maxConnections) {
            throw new PoolException('CreateConnection failed, maximum connection limit reached.');
        }
        // Create a placeholder to ensure the correct value of getConnectionCount().
        $placeholder = new stdClass;
        $this->connections[$placeholder] = 0;
        try {
            // Coroutines will switch here, so we need $placeholder to ensure the correct value of getConnectionCount().
            $connection = ($this->connectionCreateHandler)();
            if (!$this->isValidConnection($connection)) {
                throw new PoolException('CreateConnection failed, expected a connection object, but got ' . gettype($connection) . '.');
            }
            unset($this->connections[$placeholder]);
            $this->connections[$connection] = $this->lastUsedTimes[$connection] = $this->lastHeartbeatTimes[$connection] = time();
        } catch (Throwable $throwable) {
            unset($this->connections[$placeholder]);
            throw $throwable;
        }
        return $connection;
    }

    /**
     * Close the connection and remove the connection from the connection pool.
     *
     * @param object $connection
     * @return void
     */
    public function closeConnection(object $connection): void
    {
        if (!isset($this->connections[$connection])) {
            return;
        }
        // Mark this connection as no longer belonging to the connection pool.
        unset($this->lastUsedTimes[$connection], $this->lastHeartbeatTimes[$connection], $this->connections[$connection]);
        if ($this->nonCoroutineConnection === $connection) {
            $this->nonCoroutineConnection = null;
        }
        if (!$this->connectionDestroyHandler) {
            return;
        }
        try {
            ($this->connectionDestroyHandler)($connection);
        } catch (Throwable $throwable) {
            $this->log($throwable);
        }
    }

    /**
     * Cleanup idle connections.
     *
     * @return void
     */
    protected function checkConnections(): void
    {
        $num = $this->channel->length();
        $time = time();
        for($i = $num; $i > 0; $i--) {
            $connection = $this->channel->pop(0.001);
            if (!$connection) {
                return;
            }
            $lastUsedTime = $this->lastUsedTimes[$connection];
            if ($time - $lastUsedTime > $this->idleTimeout && $this->channel->length() >= $this->minConnections) {
                $this->closeConnection($connection);
                continue;
            }
            $this->trySendHeartbeat($connection) && $this->channel->push($connection);
        }
        if ($this->nonCoroutineConnection) {
            $this->trySendHeartbeat($this->nonCoroutineConnection);
        }
    }

    /**
     * Try to send heartbeat.
     *
     * @param $connection
     * @return bool
     */
    private function trySendHeartbeat($connection): bool
    {
        $lastHeartbeatTime = $this->lastHeartbeatTimes[$connection] ?? 0;
        $time = time();
        if ($this->connectionHeartbeatHandler && $time - $lastHeartbeatTime >= $this->heartbeatInterval) {
            try {
                ($this->connectionHeartbeatHandler)($connection);
                $this->lastHeartbeatTimes[$connection] = $time;
            } catch (Throwable $throwable) {
                $this->log($throwable);
                $this->closeConnection($connection);
                return false;
            }
        }
        return true;
    }

    /**
     * Get the number of connections in the connection pool.
     *
     * @return int
     */
    public function getConnectionCount(): int
    {
        return count($this->connections);
    }

    /**
     * Close connections.
     *
     * @return void
     */
    public function closeConnections(): void
    {
        $num = $this->channel->length();
        for ($i = $num; $i > 0; $i--) {
            $connection = $this->channel->pop(0.001);
            if (!$connection) {
                return;
            }
            $this->closeConnection($connection);
        }
        $this->nonCoroutineConnection && $this->closeConnection($this->nonCoroutineConnection);
    }

    /**
     * Log.
     *
     * @param $message
     * @return void
     */
    protected function log($message): void
    {
        if (!$this->logger) {
            echo $message . PHP_EOL;
            return;
        }
        if ($this->logger instanceof Closure) {
            ($this->logger)($message);
            return;
        }
        $this->logger->info((string)$message);
    }

}
