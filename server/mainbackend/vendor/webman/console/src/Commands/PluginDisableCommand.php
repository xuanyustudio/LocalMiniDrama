<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputOption;
use Webman\Console\Commands\Concerns\PluginCommandHelpers;
use Webman\Console\Util;

#[AsCommand('plugin:disable', 'Disable plugin by name')]
class PluginDisableCommand extends Command
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

        $output->writeln($this->pluginMsg('disable_title', ['{name}' => $nameRaw]));

        $configFile = config_path() . "/plugin/{$nameRaw}/app.php";
        $output->writeln($this->pluginMsg('config_file', ['{path}' => $this->toRelativePath($configFile)]));

        $res = $this->setPluginEnableFlag($configFile, false);
        if (!$res['ok']) {
            $output->writeln($this->pluginMsg('update_failed', ['{error}' => (string)$res['error']]));
            return Command::FAILURE;
        }
        if ($res['missingFile']) {
            $output->writeln($this->pluginMsg('config_missing', ['{path}' => $this->toRelativePath($configFile)]));
            // Disable is idempotent: missing config means nothing to disable.
            $output->writeln($this->pluginMsg('disabled_ok', ['{name}' => $nameRaw]));
            return Command::SUCCESS;
        }
        if ($res['missingKey']) {
            $output->writeln($this->pluginMsg('enable_key_missing', ['{path}' => $this->toRelativePath($configFile)]));
            $output->writeln($this->pluginMsg('disabled_ok', ['{name}' => $nameRaw]));
            return Command::SUCCESS;
        }
        if ($res['already']) {
            $output->writeln($this->pluginMsg('already_disabled'));
            $output->writeln($this->pluginMsg('disabled_ok', ['{name}' => $nameRaw]));
            return Command::SUCCESS;
        }

        $output->writeln($this->pluginMsg('updated_ok', ['{path}' => $this->toRelativePath($configFile)]));
        $output->writeln($this->pluginMsg('disabled_ok', ['{name}' => $nameRaw]));
        return Command::SUCCESS;
    }

    protected function buildHelpText(): string
    {
        return Util::selectByLocale(\Webman\Console\Messages::getPluginDisableHelpText());
    }
}
