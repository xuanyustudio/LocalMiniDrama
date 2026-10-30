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

/**
 * Interface PoolInterface
 */
interface PoolInterface
{

    /**
     * Get a connection from the pool.
     *
     * @return mixed
     */
    public function get(): mixed;

    /**
     * Put a connection back to the pool.
     *
     * @param object $connection
     * @return void
     */
    public function put(object $connection): void;

    /**
     * Create a connection.
     *
     * @return object
     */
    public function createConnection(): object;

    /**
     * Close the connection and remove the connection from the connection pool.
     *
     * @param object $connection
     * @return void
     */
    public function closeConnection(object $connection): void;

    /**
     * Get the number of connections in the connection pool.
     *
     * @return int
     */
    public function getConnectionCount(): int;

    /**
     * Close connections in the connection pool.
     *
     * @return void
     */
    public function closeConnections(): void;

}
