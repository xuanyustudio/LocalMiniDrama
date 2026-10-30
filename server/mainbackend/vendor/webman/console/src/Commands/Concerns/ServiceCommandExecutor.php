<?php

namespace Webman\Console\Commands\Concerns;

use Symfony\Component\Console\Command\Command;
use Webman\Console\Application;

/**
 * Shared execution logic for service management commands
 * (start, stop, restart, reload, status, connections)
 */
trait ServiceCommandExecutor
{
    /**
     * Execute service command by delegating to appropriate application runner
     *
     * @return int
     */
    protected function executeServiceCommand(): int
    {
        if (\class_exists(\Support\App::class)) {
            \Support\App::run();
            return Command::SUCCESS;
        }
        Application::run();
        return Command::SUCCESS;
    }
}
