<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Webman\Console\Commands\Concerns\MakeCommandHelpers;
use Webman\Console\Util;
use Webman\Console\Messages;

#[AsCommand('install', 'Execute webman installation script')]
class InstallCommand extends Command
{
    use MakeCommandHelpers;

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $output->writeln($this->msg('install_title'));
        $install_function = "\\Webman\\Install::install";
        if (is_callable($install_function)) {
            $install_function();
            $output->writeln($this->msg('done'));
            return self::SUCCESS;
        }
        $output->writeln($this->msg('require_version'));
        return self::FAILURE;
    }

    protected function msg(string $key, array $replace = []): string
    {
        return strtr(Util::selectLocaleMessages(Messages::getInstallMessages())[$key] ?? $key, $replace);
    }
}
