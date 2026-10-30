<?php

namespace Webman\Console\Commands\Concerns;

use Symfony\Component\Console\Output\OutputInterface;
use Webman\Console\Util;
use Webman\Console\Messages;

/**
 * Helpers for AppPlugin* commands (plugin/<name>).
 */
trait AppPluginCommandHelpers
{
    use MakeCommandHelpers;

    /**
     * Prefer admin plugin locale if available, fallback to global translation/app locale.
     *
     * @return string
     */
    protected function getLocale(): string
    {
        $locale = null;
        if (function_exists('config')) {
            $locale = config('plugin.admin.translation.locale')
                ?: config('translation.locale')
                ?: config('app.locale');
        }

        $locale = is_string($locale) ? trim($locale) : '';
        if ($locale === '') {
            $locale = $this->resolveLocaleFromAdminTranslationConfigFile() ?? '';
        }

        return $locale !== '' ? $locale : Util::getLocale();
    }

    /**
     * Resolve locale from admin plugin translation config file.
     * This is a fallback when config() is not ready or the admin plugin is not loaded.
     *
     * @return string|null
     */
    protected function resolveLocaleFromAdminTranslationConfigFile(): ?string
    {
        $ds = DIRECTORY_SEPARATOR;
        $candidates = [
            base_path('plugin' . $ds . 'admin' . $ds . 'config' . $ds . 'translation.php'),
            base_path('vendor' . $ds . 'webman' . $ds . 'admin' . $ds . 'src' . $ds . 'plugin' . $ds . 'admin' . $ds . 'config' . $ds . 'translation.php'),
        ];

        foreach ($candidates as $file) {
            $config = $this->loadPhpConfigArray($file);
            if ($config === null || $config === []) {
                continue;
            }
            $locale = $config['locale'] ?? null;
            $locale = is_string($locale) ? trim($locale) : '';
            if ($locale !== '') {
                return $locale;
            }
        }
        return null;
    }

    /**
     * @param mixed $value
     * @return string
     */
    protected function normalizeAppPluginName(mixed $value): string
    {
        return trim((string)$value);
    }

    /**
     * App plugin name is a folder name under plugin/<name>.
     *
     * @param string $name
     * @return bool
     */
    protected function isValidAppPluginName(string $name): bool
    {
        if ($name === '') {
            return false;
        }
        if (str_contains($name, '/') || str_contains($name, '\\')) {
            return false;
        }
        // Keep it safe for directory/namespace usage.
        return (bool)preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/', $name);
    }

    /**
     * @param string $name
     * @return string
     */
    protected function appPluginBasePath(string $name): string
    {
        return base_path('plugin' . DIRECTORY_SEPARATOR . $name);
    }

    /**
     * @param string $name
     * @return string
     */
    protected function appPluginInstallClass(string $name): string
    {
        return "\\plugin\\{$name}\\api\\Install";
    }

    /**
     * @param string $name
     * @return string
     */
    protected function appPluginVersion(string $name): string
    {
        $v = config("plugin.$name.app.version");
        $v = is_string($v) ? trim($v) : '';
        return $v !== '' ? $v : '1.0.0';
    }

    /**
     * Safely call plugin Install static method with signature tolerance.
     *
     * @param class-string $class
     * @param string $method
     * @param array<int,mixed> $args
     * @return mixed
     */
    protected function callInstallMethod(string $class, string $method, array $args): mixed
    {
        if (!class_exists($class)) {
            throw new \RuntimeException("Class $class not exists");
        }
        if (!method_exists($class, $method)) {
            throw new \RuntimeException("Method $class::$method not exists");
        }

        $ref = new \ReflectionMethod($class, $method);
        $required = $ref->getNumberOfRequiredParameters();
        $total = $ref->getNumberOfParameters();

        if (count($args) < $required) {
            throw new \RuntimeException("Method $class::$method requires $required parameter(s)");
        }

        $useArgs = array_slice($args, 0, $total);
        return $ref->invokeArgs(null, $useArgs);
    }

    /**
     * @param \Throwable $e
     * @return bool
     */
    protected function isScriptMissingThrowable(\Throwable $e): bool
    {
        $msg = $e->getMessage();
        return str_contains($msg, ' not exists') && (str_starts_with($msg, 'Class ') || str_starts_with($msg, 'Method '));
    }




    /**
     * CLI messages for app plugin commands. Locale selected by getLocale() / Util fallback.
     *
     * @param string $key
     * @param array<string,string> $replace
     * @return string
     */
    protected function msg(string $key, array $replace = []): string
    {
        $localeToMessages = Messages::getAppPluginMessages();
        $messages = Util::selectLocaleMessages($localeToMessages);
        $text = $messages[$key] ?? $key;
        return strtr($text, $replace);
    }

    /**
     * @param OutputInterface $output
     * @param string $message
     * @return void
     */
    protected function writeln(OutputInterface $output, string $message): void
    {
        $output->writeln($message);
    }
}

