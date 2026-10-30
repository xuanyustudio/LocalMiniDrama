<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Webman\Console\Commands\Concerns\ServiceCommandExecutor;
use Webman\Console\Messages;
use Webman\Console\Util;

#[AsCommand('connections', 'Get worker connections')]
class ConnectionsCommand extends Command
{
    use ServiceCommandExecutor;

    protected function configure(): void
    {
        $messages = Util::selectLocaleMessages(Messages::getServiceMessages());
        $this->setDescription($messages['connections_desc'] ?? 'Get worker connections');
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        return $this->executeServiceCommand();
    }
}
