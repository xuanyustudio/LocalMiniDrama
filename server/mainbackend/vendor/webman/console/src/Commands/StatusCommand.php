<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Input\InputOption;
use Webman\Console\Commands\Concerns\ServiceCommandExecutor;
use Webman\Console\Messages;
use Webman\Console\Util;

#[AsCommand('status', 'Get worker status. Use mode -d to show live status.')]
class StatusCommand extends Command
{
    use ServiceCommandExecutor;

    protected function configure() : void
    {
        $messages = Util::selectLocaleMessages(Messages::getServiceMessages());
        $this->setDescription($messages['status_desc']);
        $this->addOption('live', 'd', InputOption::VALUE_NONE, $messages['live_status']);
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
