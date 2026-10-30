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

#[AsCommand('start', 'Start worker in DEBUG mode. Use mode -d to start in DAEMON mode.')]
class StartCommand extends Command
{
    use ServiceCommandExecutor;

    protected function configure() : void
    {
        $messages = Util::selectLocaleMessages(Messages::getServiceMessages());
        $this->setDescription($messages['start_desc']);
        $this->addOption('daemon', 'd', InputOption::VALUE_NONE, $messages['daemon_option']);
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
