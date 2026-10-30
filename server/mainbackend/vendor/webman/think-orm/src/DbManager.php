<?php

declare (strict_types = 1);

namespace Webman\ThinkOrm;

use MongoDB\Driver\Command;
use Webman\Context;
use Workerman\Coroutine\Pool;
use Throwable;
use think\db\ConnectionInterface;
use think\db\BaseQuery;
use think\db\Query;

/**
 * Class DbManager.
 *
 * @mixin BaseQuery
 * @mixin Query
 */
class DbManager extends \think\DbManager
{
    /**
     * Default heartbeat SQL (most SQL databases).
     *
     * @var string
     */
    private const HEARTBEAT_SQL_DEFAULT = 'SELECT 1 AS ping';

    /**
     * Oracle heartbeat SQL.
     *
     * @var string
     */
    private const HEARTBEAT_SQL_ORACLE = 'SELECT 1 AS ping FROM DUAL';

    /**
     * @var Pool[]
     */
    protected static array $pools = [];

    /**
     * Get instance of connection.
     *
     * @param array|string|null $name
     * @param bool $force
     * @return ConnectionInterface
     * @throws Throwable
     */
    protected function instance(array|string|null $name = null, bool $force = false): ConnectionInterface
    {
        if (empty($name)) {
            $name = $this->getConfig('default', 'mysql');
        }
        $key = "think-orm.connections.$name";
        $connection = Context::get($key);
        if (!$connection) {
            if (!isset(static::$pools[$name])) {
                $poolConfig = $this->config['connections'][$name]['pool'] ?? [];
                $pool = new Pool($poolConfig['max_connections'] ?? 10, $poolConfig);
                $pool->setConnectionCreator(function () use ($name) {
                    return $this->createConnection($name);
                });
                $pool->setConnectionCloser(function ($connection) use ($name) {
                    $this->closeConnection($connection, $name);
                });
                $pool->setHeartbeatChecker(function ($connection) {
                    $this->heartbeat($connection);
                });
                static::$pools[$name] = $pool;
            }
            try {
                $connection = static::$pools[$name]->get();
                Context::set($key, $connection);
            } finally {
                Context::onDestroy(function () use ($connection, $name) {
                    try {
                        $connection && static::$pools[$name]->put($connection);
                    } catch (Throwable) {
                        // ignore
                    }
                });
            }
        }
        return $connection;
    }

    /**
     * Heartbeat checker for pooled connections.
     *
     * @param mixed $connection
     * @return void
     */
    private function heartbeat(mixed $connection): void
    {
        $type = strtolower((string) $connection->getConfig('type'));

        if ($type === 'mongo') {
            $command = new Command(['ping' => 1]);
            $connection->command($command);
            return;
        }

        $connection->query($this->getHeartbeatSql($type));
    }

    /**
     * Get heartbeat SQL.
     *
     * @param string $type
     * @return string
     */
    private function getHeartbeatSql(string $type): string
    {
        $type = strtolower($type);

        return match ($type) {
            'oracle',
            'oci',
            'oci8' => self::HEARTBEAT_SQL_ORACLE,
            default => self::HEARTBEAT_SQL_DEFAULT,
        };
    }

    /**
     * Close connection.
     *
     * @param ConnectionInterface $connection
     * @param string|null $name Connection config name used for Context cache key.
     * @return void
     */
    protected function closeConnection(ConnectionInterface $connection, ?string $name = null): void
    {
        $connection->close();
        $clearProperties = function () {
            $this->db = null;
            $this->cache = null;
            $this->builder = null;
        };
        $clearProperties->call($connection);

        if ($name !== null) {
            $key = "think-orm.connections.$name";
            Context::set($key, null);
        }
    }
}
