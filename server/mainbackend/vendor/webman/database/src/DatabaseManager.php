<?php

namespace Webman\Database;

use Illuminate\Database\DatabaseManager as BaseDatabaseManager;
use Throwable;
use Webman\Context;
use Workerman\Coroutine\Pool;

/**
 * Class DatabaseManager
 */
class DatabaseManager extends BaseDatabaseManager
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
     * @inheritDoc
     */
    public function __construct(...$args)
    {
        parent::__construct(...$args);
        $this->reconnector = function ($connection) {
            $name = $connection->getNameWithReadWriteType();
            [$database, $type] = $this->parseConnectionName($name);
            $fresh = $this->configure(
                $this->makeConnection($database), $type
            );
            $connection->setPdo($fresh->getRawPdo());
        };
    }

    /**
     * Get connection
     *
     * @param $name
     * @return mixed
     * @throws Throwable
     */
    public function connection($name = null): mixed
    {
        $name = $name ?: $this->getDefaultConnection();
        [$database, $type] = $this->parseConnectionName($name);
        
        $key = "database.connections.$name";
        $connection = Context::get($key);
        if (!$connection) {
            if (!isset(static::$pools[$name])) {
                $poolConfig = $this->app['config']['database.connections'][$name]['pool'] ?? [];
                $pool = new Pool($poolConfig['max_connections'] ?? 6, $poolConfig);
                $pool->setConnectionCreator(function () use ($database, $type) {
                    return $this->configure($this->makeConnection($database), $type);
                });
                $pool->setConnectionCloser(function ($connection) {
                    $this->closeAndFreeConnection($connection);
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
                // We cannot use Coroutine::defer() because we may not be in a coroutine environment currently.
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
        $driver = strtolower((string)$connection->getDriverName());

        // MongoDB (mongodb/laravel-mongodb or jenssegers/mongodb)
        if ($driver === 'mongodb') {
            $connection->command(['ping' => 1]);
            return;
        }

        $sql = $this->getHeartbeatSql($driver);
        if ($sql !== '') {
            $connection->select($sql);
        }
    }

    /**
     * Get heartbeat SQL by driver name.
     *
     * Illuminate\Database supports mysql/mariadb/pgsql/sqlite/sqlsrv by default.
     * Oracle (oracle/oci/oci8) may be provided by third-party drivers.
     *
     * @param string $driver
     * @return string
     */
    private function getHeartbeatSql(string $driver): string
    {
        return match ($driver) {
            'oracle', 'oci', 'oci8' => self::HEARTBEAT_SQL_ORACLE,
            default => self::HEARTBEAT_SQL_DEFAULT,
        };
    }

    /**
     * Close connection.
     *
     * @param $connection
     * @return void
     */
    protected function closeAndFreeConnection($connection): void
    {
        // Remove connection from Context
        $name = $connection->getNameWithReadWriteType();
        $key = "database.connections.$name";
        Context::set($key, null);

        $connection->disconnect();
        $clearProperties = function () {
            $this->queryGrammar = null;
        };
        $clearProperties->call($connection);
    }

}
