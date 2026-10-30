<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Helper\Table;
use Webman\Console\Commands\Concerns\BaseCommandHelpers;
use Webman\Console\Util;
use Webman\Console\Messages;
use Webman\Route;

#[AsCommand('route:list', 'Route list')]
class RouteListCommand extends Command
{
    use BaseCommandHelpers;

    protected function configure(): void
    {
        $desc = $this->msg('desc');
        $this->setDescription($desc);
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $output->writeln($this->msg('title'));
        $headers = $this->msg('headers');
        $closureLabel = $this->msg('closure_label');
        $rows = [];
        foreach (Route::getRoutes() as $route) {
            foreach ($route->getMethods() as $method) {
                $cb = $route->getCallback();
                $cb = $cb instanceof \Closure
                    ? $closureLabel
                    : (is_array($cb) ? json_encode($cb) : var_export($cb, 1));
                $rows[] = [$route->getPath(), $method, $cb, json_encode($route->getMiddleware() ?: null), $route->getName()];
            }
        }

        $table = new Table($output);
        $table->setHeaders($headers);
        $table->setRows($rows);
        $table->render();
        return Command::SUCCESS;
    }

    protected function msg(string $key, array $replace = []): mixed
    {
        $messages = Util::selectLocaleMessages(Messages::getRouteListMessages());
        return $this->getLocalizedMessage($messages, $key, $replace);
    }
}
