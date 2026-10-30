<?php

namespace Webman\Database;

use Illuminate\Database\Connectors\ConnectionFactory;

/**
 * Class Manager
 */
class Manager extends \Illuminate\Database\Capsule\Manager
{
    /**
     * Build the database manager instance.
     *
     * @return void
     */
    protected function setupManager()
    {
        $factory = new ConnectionFactory($this->container);
        $this->manager = new DatabaseManager($this->container, $factory);
    }
}