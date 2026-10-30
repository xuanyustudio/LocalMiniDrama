<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Webman\Console\Commands\Concerns\AppPluginCommandHelpers;
use Webman\Console\Messages;
use Webman\Console\Util;

#[AsCommand('app-plugin:install', 'Install App Plugin')]
class AppPluginInstallCommand extends Command
{
    use AppPluginCommandHelpers;

    /**
     * @return void
     */
    protected function configure()
    {
        $this->addArgument('name', InputArgument::REQUIRED, $this->msg('description_name'));
        $this->setHelp($this->buildHelpText());
    }

    protected function buildHelpText(): string
    {
        return Util::selectByLocale(Messages::getAppPluginInstallHelpText());
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $name = $this->normalizeAppPluginName($input->getArgument('name'));
        $this->writeln($output, $this->msg('install_title', ['{name}' => $name]));

        if (!$this->isValidAppPluginName($name)) {
            $this->writeln($output, $this->msg('bad_name', ['{name}' => $name]));
            return Command::FAILURE;
        }

        $pluginBase = $this->appPluginBasePath($name);
        if (!is_dir($pluginBase)) {
            $this->writeln($output, $this->msg('plugin_not_exists', ['{path}' => $this->toRelativePath($pluginBase)]));
            return Command::FAILURE;
        }

        $class = $this->appPluginInstallClass($name);
        try {
            $version = $this->appPluginVersion($name);
            $this->writeln($output, $this->msg('running', [
                '{class}' => $class,
                '{method}' => 'install',
                '{args}' => var_export([$version], true),
            ]));
            $this->callInstallMethod($class, 'install', [$version]);
        } catch (\Throwable $e) {
            if ($this->isScriptMissingThrowable($e)) {
                $this->writeln($output, $this->msg('script_missing', ['{class}' => $class]));
            }
            $this->writeln($output, $this->msg('failed', ['{error}' => $e->getMessage()]));
            return Command::FAILURE;
        }

        $this->writeln($output, $this->msg('done'));
        return Command::SUCCESS;
    }

}
