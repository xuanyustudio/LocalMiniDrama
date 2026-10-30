<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Question\ConfirmationQuestion;
use Symfony\Component\Console\Question\Question;
use Webman\Console\Util;
use Webman\Console\Messages;
use Webman\Console\Commands\Concerns\MakeCommandHelpers;

#[AsCommand('make:bootstrap', 'Make a bootstrap.')]
class MakeBootstrapCommand extends Command
{
    use MakeCommandHelpers;

    /**
     * @return void
     */
    protected function configure()
    {
        $this->addArgument('name', InputArgument::REQUIRED, $this->msg('arg_name'));
        $this->addArgument('enable', InputArgument::OPTIONAL, $this->msg('arg_enable'));
        $this->addOption('plugin', 'p', InputOption::VALUE_REQUIRED, $this->msg('opt_plugin'));
        $this->addOption('path', 'P', InputOption::VALUE_REQUIRED, $this->msg('opt_path'));
        $this->addOption('force', 'f', InputOption::VALUE_NONE, $this->msg('opt_force'));

        $this->setHelp($this->buildHelpText());

        $this->addUsage('MyBootstrap');
        $this->addUsage('MyBootstrap no');
        $this->addUsage('MyBootstrap -p admin');
        $this->addUsage('MyBootstrap -P plugin/admin/app/bootstrap');
        $this->addUsage('MyBootstrap -f');
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $name = Util::nameToClass((string)$input->getArgument('name'));
        $enable = $this->parseEnableArgument($input->getArgument('enable'));
        $plugin = $this->normalizeOptionValue($input->getOption('plugin'));
        $path = $this->normalizeOptionValue($input->getOption('path'));
        $force = (bool)$input->getOption('force');

        if ($plugin && (str_contains($plugin, '/') || str_contains($plugin, '\\'))) {
            $output->writeln($this->msg('invalid_plugin', ['{plugin}' => $plugin]));
            return Command::FAILURE;
        }
        if ($plugin && !$this->assertPluginExists($plugin, $output)) {
            return Command::FAILURE;
        }

        $name = str_replace('\\', '/', $name);

        if (!$path && $input->isInteractive()) {
            $pathDefault = $plugin ? Util::getDefaultAppRelativePath('bootstrap', $plugin) : Util::getDefaultAppRelativePath('bootstrap');
            $path = $this->promptForPathWithDefault($input, $output, 'bootstrap', $pathDefault);
        }

        if ($plugin || $path) {
            $resolved = $this->resolveTargetByPluginOrPath(
                $name,
                $plugin,
                $path,
                $output,
                fn(string $p) => Util::getDefaultAppRelativePath('bootstrap', $p),
                fn(string $key, array $replace = []) => $this->msg($key, $replace)
            );
            if ($resolved === null) {
                return Command::FAILURE;
            }
            [$class, $namespace, $file] = $resolved;
        } else {
            [$class, $namespace, $file] = $this->resolveAppBootstrapTarget($name);
        }

        $output->writeln($this->msg('make_bootstrap', ['{name}' => $class]));

        if (is_file($file) && !$force) {
            $relative = $this->toRelativePath($file);
            $prompt = $this->msg('override_prompt', ['{path}' => $relative]);
            $question = new ConfirmationQuestion($prompt, true);
            if (!$this->askOrAbort($input, $output, $question)) {
                return Command::SUCCESS;
            }
        }

        $this->createBootstrap($class, $namespace, $file);
        $output->writeln($this->msg('created', ['{path}' => $this->toRelativePath($file)]));

        if ($enable) {
            $bootstrapClass = "{$namespace}\\{$class}";
            $configFile = $plugin
                ? base_path('plugin' . DIRECTORY_SEPARATOR . $plugin . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'bootstrap.php')
                : (config_path() . '/bootstrap.php');

            $this->addClassToFlatClassListConfig($configFile, $bootstrapClass);
            $output->writeln($this->msg('enabled', ['{class}' => $bootstrapClass]));
        }

        return self::SUCCESS;
    }

    /**
     * Resolve bootstrap namespace/file path under app/ (backward compatible).
     *
     * @param string $name
     * @return array{0:string,1:string,2:string} [class, namespace, file]
     */
    protected function resolveAppBootstrapTarget(string $name): array
    {
        $bootstrapStr = Util::getDefaultAppPath('bootstrap');
        $bootstrapRelPath = Util::getDefaultAppRelativePath('bootstrap');
        $upper = strtolower($bootstrapStr[0]) !== $bootstrapStr[0];

        if (!($pos = strrpos($name, '/'))) {
            $class = ucfirst($name);
            $file = app_path() . DIRECTORY_SEPARATOR . $bootstrapStr . DIRECTORY_SEPARATOR . "{$class}.php";
            $namespace = Util::pathToNamespace($bootstrapRelPath);
            return [$class, $namespace, $file];
        }

        $dirPart = substr($name, 0, $pos);
        $realDirPart = Util::guessPath(app_path(), $dirPart);
        if ($realDirPart) {
            $dirPart = str_replace(DIRECTORY_SEPARATOR, '/', $realDirPart);
        } else if ($upper) {
            $dirPart = preg_replace_callback('/\/([a-z])/', static function ($matches) {
                return '/' . strtoupper($matches[1]);
            }, ucfirst($dirPart));
        }

        $appDirName = Util::detectAppDirName();
        $path = "{$bootstrapStr}/{$dirPart}";
        $class = ucfirst(substr($name, $pos + 1));
        $file = app_path() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path) . DIRECTORY_SEPARATOR . "{$class}.php";
        $namespace = str_replace('/', '\\', $appDirName . '/' . $path);
        return [$class, $namespace, $file];
    }

    /**
     * Default app bootstrap relative path.
     */
    protected function getAppBootstrapRelativePath(): string
    {
        return Util::getDefaultAppRelativePath('bootstrap');
    }

    /**
     * @param string $plugin
     * @return string relative path
     */
    protected function getPluginBootstrapRelativePath(string $plugin): string
    {
        return Util::getDefaultAppRelativePath('bootstrap', $plugin);
    }

    /**
     * Prompt for path (question style, input on new line). Reuses enter_path_prompt from make:crud.
     */
    protected function promptForPathWithDefault(InputInterface $input, OutputInterface $output, string $labelKey, string $defaultPath): string
    {
        $defaultPath = $this->normalizeRelativePath($defaultPath);
        $label = Util::selectLocaleMessages(Messages::getTypeLabels())[$labelKey] ?? $labelKey;
        $promptText = Util::selectLocaleMessages(Messages::getMakeCrudMessages())['enter_path_prompt']
            ?? 'Enter {label} path (Enter for default: {default}): ';
        $promptText = strtr($promptText, ['{label}' => $label, '{default}' => $defaultPath]);
        $promptText = '<question>' . trim($promptText) . "</question>\n";
        $question = new Question($promptText, $defaultPath);
        $path = $this->askOrAbort($input, $output, $question);
        $path = is_string($path) ? $path : $defaultPath;
        return $this->normalizeRelativePath($path ?: $defaultPath);
    }

    /**
     * @param $name
     * @param $namespace
     * @param $file
     * @return void
     */
    protected function createBootstrap($name, $namespace, $file)
    {
        $path = pathinfo($file, PATHINFO_DIRNAME);
        if (!is_dir($path)) {
            mkdir($path, 0777, true);
        }
        $bootstrap_content = <<<EOF
<?php

namespace $namespace;

use Webman\Bootstrap;

class $name implements Bootstrap
{
    public static function start(\$worker)
    {
        // Is it console environment ?
        \$is_console = !\$worker;
        if (\$is_console) {
            // If you do not want to execute this in console, just return.
            return;
        }


    }

}

EOF;
        file_put_contents($file, $bootstrap_content);
    }

    public function addConfig($class, $config_file)
    {
        $config = include $config_file;
        if(!in_array($class, $config ?? [])) {
            $config_file_content = file_get_contents($config_file);
            $config_file_content = preg_replace('/\];/', "    $class::class,\n];", $config_file_content);
            file_put_contents($config_file, $config_file_content);
        }
    }

    /**
     * Parse positional `enable` argument (backward compatible).
     *
     * @param mixed $value
     * @return bool
     */
    protected function parseEnableArgument(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }
        $v = strtolower(trim((string)$value));
        return !in_array($v, ['no', '0', 'false', 'n', 'off', 'disable', 'disabled'], true);
    }

    /**
     * Command help text (multilingual).
     *
     * @return string
     */
    protected function buildHelpText(): string
    {
        return Util::selectByLocale(Messages::getMakeBootstrapHelpText());
    }

    /**
     * Hardcoded CLI messages (bilingual) without translation module.
     *
     * @param string $key
     * @param array $replace
     * @return string
     */
    protected function msg(string $key, array $replace = []): string
    {
        return strtr(Util::selectLocaleMessages(Messages::getMakeBootstrapMessages())[$key] ?? $key, $replace);
    }
}
