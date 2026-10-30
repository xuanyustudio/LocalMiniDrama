<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Webman\Console\Commands\Concerns\BaseCommandHelpers;
use Webman\Console\Messages;
use Webman\Console\Util;

#[AsCommand('version', 'Show webman version')]
class VersionCommand extends Command
{
    use BaseCommandHelpers;

    protected function configure(): void
    {
        $messages = Util::selectLocaleMessages(Messages::getVersionMessages());
        $this->setDescription($messages['desc']);
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $version_info = [];
        $installed_file = base_path() . '/vendor/composer/installed.php';
        if (is_file($installed_file)) {
            $version_info = include $installed_file;
        }
        $webman_framework_version = $version_info['versions']['workerman/webman-framework']['pretty_version'] ?? null;
        $webman_framework_version = is_string($webman_framework_version) ? trim($webman_framework_version) : '';
        if ($webman_framework_version === '') {
            $output->writeln($this->msg('not_found'));
            return Command::FAILURE;
        }
        $output->writeln($this->msg('version', ['{version}' => $webman_framework_version]));
        return Command::SUCCESS;
    }

    protected function msg(string $key, array $replace = []): string
    {
        $messages = Util::selectLocaleMessages(Messages::getVersionMessages());
        return $this->getLocalizedMessage($messages, $key, $replace);
    }
}
