<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputOption;
use Webman\Console\Util;
use Webman\Console\Commands\Concerns\PluginCommandHelpers;

#[AsCommand('plugin:install', 'Execute plugin installation script')]
class PluginInstallCommand extends Command
{
    use PluginCommandHelpers;

    /**
     * @return void
     */
    protected function configure()
    {
        // Do NOT use "-n": Symfony Console already reserves "-n" for "--no-interaction".
        $this->addArgument('name', InputArgument::OPTIONAL, $this->pluginMsg('description_name'));
        $this->addOption('name', null, InputOption::VALUE_REQUIRED, $this->pluginMsg('description_name'));
        $this->setHelp($this->buildHelpText());
        $this->addUsage('foo/my-admin');
        $this->addUsage('--name foo/my-admin');
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $nameArg = $this->normalizePluginName($input->getArgument('name'));
        $nameOpt = $this->normalizePluginName($input->getOption('name'));
        if ($nameArg && $nameOpt && $nameArg !== $nameOpt) {
            $output->writeln($this->pluginMsg('name_conflict', ['{arg}' => $nameArg, '{opt}' => $nameOpt]));
            return Command::FAILURE;
        }
        $nameRaw = $nameOpt ?: $nameArg;
        if (!$nameRaw) {
            $output->writeln($this->pluginMsg('missing_name'));
            return Command::FAILURE;
        }
        if (!$this->isValidComposerPackageName($nameRaw)) {
            $output->writeln($this->pluginMsg('bad_name', ['{name}' => (string)$nameRaw]));
            return Command::FAILURE;
        }

        if (!$this->pluginPackageExists($nameRaw)) {
            $output->writeln($this->pluginMsg('plugin_not_found', [
                '{name}' => $nameRaw,
                '{path}' => "vendor/{$nameRaw}",
            ]));
            return Command::FAILURE;
        }

        $output->writeln($this->pluginMsg('install_title', ['{name}' => $nameRaw]));

        $namespace = Util::nameToNamespace($nameRaw);
        $installFunction = "\\{$namespace}\\Install::install";
        $pluginConst = "\\{$namespace}\\Install::WEBMAN_PLUGIN";
        if (!defined($pluginConst) || !is_callable($installFunction)) {
            $output->writeln($this->pluginMsg('script_missing'));
            return Command::SUCCESS;
        }

        try {
            $installFunction();
        } catch (\Throwable $e) {
            $output->writeln($this->pluginMsg('script_failed', ['{error}' => $e->getMessage()]));
            return Command::FAILURE;
        }

        $output->writeln($this->pluginMsg('script_ok'));
        return Command::SUCCESS;
    }

    protected function buildHelpText(): string
    {
        return Util::selectByLocale(\Webman\Console\Messages::getPluginInstallHelpText());
    }
}
