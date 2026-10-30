<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Webman\Console\Commands\Concerns\MakeCommandHelpers;
use Webman\Console\Util;
use Webman\Console\Messages;

#[AsCommand('fix-disable-functions', 'Fix disbale_functions in php.ini')]
class FixDisbaleFunctionsCommand extends Command
{
    use MakeCommandHelpers;

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $php_ini_file = php_ini_loaded_file();
        if (!$php_ini_file) {
            $output->writeln($this->msg('no_ini'));
            return self::FAILURE;
        }
        $output->writeln($this->msg('location', ['{path}' => $php_ini_file]));
        $disable_functions_str = ini_get("disable_functions");
        if (!$disable_functions_str) {
            $output->writeln($this->msg('ok'));
            return self::SUCCESS;
        }

        $functions_required = [
            "stream_socket_server",
            "stream_socket_accept",
            "stream_socket_client",
            "pcntl_signal_dispatch",
            "pcntl_signal",
            "pcntl_alarm",
            "pcntl_fork",
            "posix_getuid",
            "posix_getpwuid",
            "posix_kill",
            "posix_setsid",
            "posix_getpid",
            "posix_getpwnam",
            "posix_getgrnam",
            "posix_getgid",
            "posix_setgid",
            "posix_initgroups",
            "posix_setuid",
            "posix_isatty",
            "proc_open",
            "proc_get_status",
            "proc_close",
            "shell_exec",
            "exec",
        ];

        $disable_functions = explode(",", $disable_functions_str);
        $disable_functions_removed = [];
        foreach ($disable_functions as $index => $func) {
            $func = trim($func);
            foreach ($functions_required as $func_prefix) {
                if (strpos($func, $func_prefix) === 0) {
                    $disable_functions_removed[$func] = $func;
                    unset($disable_functions[$index]);
                }
            }
        }

        $php_ini_content = file_get_contents($php_ini_file);
        if (!is_string($php_ini_content) || $php_ini_content === '') {
            $output->writeln($this->msg('ini_empty', ['{path}' => $php_ini_file]));
            return self::FAILURE;
        }

        $disable_functions = array_values(array_filter(array_map('trim', $disable_functions), static fn($v) => $v !== ''));
        $new_disable_functions_str = implode(",", $disable_functions);

        // Replace existing line if present, otherwise append.
        $pattern = '/(^|\\R)\\s*disable_functions\\s*=.*$/m';
        if (preg_match($pattern, $php_ini_content)) {
            $php_ini_content = preg_replace(
                $pattern,
                '$1disable_functions = ' . $new_disable_functions_str,
                $php_ini_content,
                1
            );
        } else {
            $php_ini_content = rtrim($php_ini_content) . PHP_EOL . 'disable_functions = ' . $new_disable_functions_str . PHP_EOL;
        }

        file_put_contents($php_ini_file, $php_ini_content);

        foreach ($disable_functions_removed as $func) {
            $output->writeln($this->msg('enabled', ['{func}' => $func]));
        }

        $output->writeln($this->msg('success'));
        return self::SUCCESS;
    }

    protected function msg(string $key, array $replace = []): string
    {
        return strtr(Util::selectLocaleMessages(Messages::getFixDisableFunctionsMessages())[$key] ?? $key, $replace);
    }
}
