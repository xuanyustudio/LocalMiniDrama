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
use ZipArchive;
use Exception;
use RecursiveIteratorIterator;
use RecursiveDirectoryIterator;

#[AsCommand('app-plugin:zip', 'App Plugin Zip')]
class AppPluginZipCommand extends Command
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
        return Util::selectByLocale(Messages::getAppPluginZipHelpText());
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $name = $this->normalizeAppPluginName($input->getArgument('name'));
        $this->writeln($output, $this->msg('zip_title', ['{name}' => $name]));

        if (!$this->isValidAppPluginName($name)) {
            $this->writeln($output, $this->msg('bad_name', ['{name}' => $name]));
            return Command::FAILURE;
        }

        $sourceDir = $this->appPluginBasePath($name);
        $zipFilePath = base_path('plugin' . DIRECTORY_SEPARATOR . $name . '.zip');
        if (!is_dir($sourceDir)) {
            $this->writeln($output, $this->msg('plugin_not_exists', ['{path}' => $this->toRelativePath($sourceDir)]));
            return Command::FAILURE;
        }

        if (is_file($zipFilePath)) {
            if (!@unlink($zipFilePath) && is_file($zipFilePath)) {
                $this->writeln($output, $this->msg('zip_delete_failed', ['{path}' => $this->toRelativePath($zipFilePath)]));
                return Command::FAILURE;
            }
        }

        $excludePaths = ['node_modules', '.git', '.idea', '.vscode', '__pycache__'];

        try {
            $this->zipDirectory($name, $sourceDir, $zipFilePath, $excludePaths);
        } catch (\Throwable $e) {
            $this->writeln($output, $this->msg('failed', ['{error}' => $e->getMessage()]));
            return Command::FAILURE;
        }

        $this->writeln($output, $this->msg('zip_saved', ['{path}' => $this->toRelativePath($zipFilePath)]));
        $this->writeln($output, $this->msg('done'));
        return Command::SUCCESS;
    }

    /**
     * @param $name
     * @param $sourceDir
     * @param $zipFilePath
     * @param array $excludePaths
     * @return bool
     * @throws Exception
     */
    protected function zipDirectory($name, $sourceDir, $zipFilePath, array $excludePaths = []): bool
    {
        $zip = new ZipArchive();

        if ($zip->open($zipFilePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
            throw new Exception($this->msg('zip_open_failed', ['{path}' => $zipFilePath]));
        }

        $rawSourceDir = $sourceDir;
        $sourceDir = realpath($sourceDir);
        if ($sourceDir === false) {
            throw new Exception($this->msg('source_not_exists', ['{path}' => $rawSourceDir]));
        }

        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourceDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            if (!$file->isDir()) {
                $filePath = $file->getRealPath();
                // 关键修复：统一使用正斜杠 '/'，避免 Windows 反斜杠污染 ZIP
                $relativePath = $name . '/' . str_replace('\\', '/', substr($filePath, strlen($sourceDir) + 1));

                // 修正排除目录的判断逻辑，确保所有层级都能排除
                $shouldExclude = false;
                foreach ($excludePaths as $excludePath) {
                    // 统一路径分隔符为正斜杠，兼容 Windows
                    $normalizedRelativePath = str_replace('\\', '/', $relativePath);
                    $normalizedExcludePath = str_replace('\\', '/', $excludePath);
                    if (preg_match('#/(?:' . preg_quote($normalizedExcludePath, '#') . ')(/|$)#i', $normalizedRelativePath)) {
                        $shouldExclude = true;
                        break;
                    }
                }
                if ($shouldExclude) {
                    continue;
                }

                $zip->addFile($filePath, $relativePath);
            }
        }

        return $zip->close();
    }
}
