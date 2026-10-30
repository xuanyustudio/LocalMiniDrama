<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Webman\Console\Commands\Concerns\AppPluginCommandHelpers;
use Webman\Console\Messages;
use Webman\Console\Util;

#[AsCommand('app-plugin:update', 'Update App Plugin')]
class AppPluginUpdateCommand extends Command
{
    use AppPluginCommandHelpers;

    /**
     * @return void
     */
    protected function configure()
    {
        $this->addArgument('name', InputArgument::REQUIRED, $this->msg('description_name'));
        $this->addOption('from', 'f', InputOption::VALUE_REQUIRED, $this->msg('description_from'));
        $this->addOption('to', 't', InputOption::VALUE_REQUIRED, $this->msg('description_to'));
        $this->setHelp($this->buildHelpText());
    }

    protected function buildHelpText(): string
    {
        return Util::selectByLocale(Messages::getAppPluginUpdateHelpText());
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $name = $this->normalizeAppPluginName($input->getArgument('name'));
        $this->writeln($output, $this->msg('update_title', ['{name}' => $name]));

        if (!$this->isValidAppPluginName($name)) {
            $this->writeln($output, $this->msg('bad_name', ['{name}' => $name]));
            return Command::FAILURE;
        }

        $pluginBase = $this->appPluginBasePath($name);
        if (!is_dir($pluginBase)) {
            $this->writeln($output, $this->msg('plugin_not_exists', ['{path}' => $this->toRelativePath($pluginBase)]));
            return Command::FAILURE;
        }

        $current = $this->appPluginVersion($name);
        $from = trim((string)$input->getOption('from'));
        $to = trim((string)$input->getOption('to'));
        $from = $from !== '' ? $from : $current;
        $to = $to !== '' ? $to : $current;

        if ($from === $to) {
            $this->writeln($output, $this->msg('version_same', ['{version}' => $from]));
        }

        $class = $this->appPluginInstallClass($name);
        try {
            $context = null;
            if (method_exists($class, 'beforeUpdate')) {
                $this->writeln($output, $this->msg('running', [
                    '{class}' => $class,
                    '{method}' => 'beforeUpdate',
                    '{args}' => var_export([$from, $to], true),
                ]));
                $context = $this->callInstallMethod($class, 'beforeUpdate', [$from, $to]);
            }

            $this->writeln($output, $this->msg('running', [
                '{class}' => $class,
                '{method}' => 'update',
                '{args}' => var_export([$from, $to, $context], true),
            ]));
            $this->callInstallMethod($class, 'update', [$from, $to, $context]);
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
