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
use Webman\Console\Commands\Concerns\MakeCommandHelpers;
use Webman\Console\Messages;

#[AsCommand('make:controller', 'Make controller')]
class MakeControllerCommand extends Command
{
    use MakeCommandHelpers;

    /**
     * @return void
     */
    protected function configure()
    {
        $this->addArgument('name', InputArgument::REQUIRED, 'Controller name');
        $this->addOption('plugin', 'p', InputOption::VALUE_REQUIRED, 'Plugin name under plugin/. e.g. admin');
        $this->addOption('path', 'P', InputOption::VALUE_REQUIRED, 'Target directory (relative to base path). e.g. plugin/admin/app/controller');
        $this->addOption('force', 'f', InputOption::VALUE_NONE, 'Override existing file without confirmation.');

        $this->setHelp($this->buildHelpText());

        $this->addUsage('User');
        $this->addUsage('User -p admin');
        $this->addUsage('User -P plugin/admin/app/controller');
        $this->addUsage('admin/User -f');
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        try {
            $name = Util::nameToClass((string)$input->getArgument('name'));
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

            // When "-p/--plugin" is provided, controller suffix should come from the plugin config,
            // not from the main project config.
            if ($plugin) {
                $suffix = (string)config("plugin.$plugin.app.controller_suffix", 'Controller');
            } else {
                $suffix = (string)config('app.controller_suffix', 'Controller');
            }
            $name = str_replace('\\', '/', $name);
            $name = $this->applySuffixToLastSegment($name, $suffix);

            // When path is not provided: in interactive mode prompt for path (same UX as make:crud).
            if (!$path && $input->isInteractive()) {
                $pathDefault = Util::getDefaultAppRelativePath('controller', $plugin ?: null);
                $path = $this->promptForControllerPath($input, $output, $pathDefault);
            }

            if ($plugin || $path) {
                $resolved = $this->resolveTargetByPluginOrPath(
                    $name,
                    $plugin,
                    $path,
                    $output,
                    fn(string $p) => Util::getDefaultAppRelativePath('controller', $p),
                    fn(string $key, array $replace = []) => $this->msg($key, $replace)
                );
                if ($resolved === null) {
                    return Command::FAILURE;
                }
                [$class, $namespace, $file] = $resolved;

                if (!$this->isControllerNamespace($namespace)) {
                    $output->writeln(Util::selectByLocale(Messages::getPathMissingControllerMessage()));
                    return Command::FAILURE;
                }
            } else {
                [$class, $namespace, $file] = $this->resolveAppControllerTarget($name);
            }

            $output->writeln($this->msg('make_controller', ['{name}' => $class]));

            if (is_file($file) && !$force) {
                $relative = $this->toRelativePath($file);
                $prompt = $this->msg('override_prompt', ['{path}' => $relative]);
                $question = new ConfirmationQuestion($prompt, true);
                $yes = (bool)$this->askOrAbort($input, $output, $question);
                if (!$yes) {
                    return Command::SUCCESS;
                }
            }

            $this->createController($class, $namespace, $file);
            $output->writeln($this->msg('created', ['{path}' => $this->toRelativePath($file)]));
            return self::SUCCESS;
        } catch (\Throwable $e) {
            throw $e;
        }
    }

    /**
     * @param $name
     * @param $namespace
     * @param $file
     * @return void
     */
    protected function createController($name, $namespace, $file)
    {
        $path = pathinfo($file, PATHINFO_DIRNAME);
        if (!is_dir($path)) {
            mkdir($path, 0777, true);
        }
        $controller_content = <<<EOF
<?php

namespace $namespace;

use support\Request;
use support\Response;

class $name
{
    public function index(Request \$request): Response
    {
        return response('Hello, $name');
    }

}

EOF;
        file_put_contents($file, $controller_content);
    }

    /**
     * Check if namespace contains a "controller" segment (case-insensitive).
     */
    protected function isControllerNamespace(string $namespace): bool
    {
        $segments = preg_split('/[\\\\\/]/', strtolower($namespace));
        return in_array('controller', $segments, true);
    }

    /**
     * Apply controller suffix to the last segment only.
     *
     * @param string $name
     * @param string $suffix
     * @return string
     */
    protected function applySuffixToLastSegment(string $name, string $suffix): string
    {
        $suffix = trim($suffix);
        if ($suffix === '') {
            return $name;
        }
        $pos = strrpos($name, '/');
        if ($pos === false) {
            return str_ends_with($name, $suffix) ? $name : ($name . $suffix);
        }
        $prefix = substr($name, 0, $pos + 1);
        $last = substr($name, $pos + 1);
        if (!str_ends_with($last, $suffix)) {
            $last .= $suffix;
        }
        return $prefix . $last;
    }

    /**
     * Resolve controller namespace/file path under app/ (backward compatible).
     *
     * @param string $name
     * @return array{0:string,1:string,2:string} [class, namespace, file]
     */
    protected function resolveAppControllerTarget(string $name): array
    {
        $controllerRelPath = Util::getDefaultAppRelativePath('controller');
        $controllerStr = Util::getDefaultAppPath('controller');

        if (!($pos = strrpos($name, '/'))) {
            $class = ucfirst($name);
            $file = app_path() . DIRECTORY_SEPARATOR . $controllerStr . DIRECTORY_SEPARATOR . "{$class}.php";
            $namespace = Util::pathToNamespace($controllerRelPath);
            return [$class, $namespace, $file];
        }

        $nameStr = substr($name, 0, $pos);
        $realNameStr = null;
        if ($tmp = Util::guessPath(app_path(), $nameStr)) {
            $realNameStr = $tmp;
            $nameStr = $tmp;
        } else if ($realSectionName = Util::guessPath(app_path(), strstr($nameStr, '/', true))) {
            $upper = strtolower($realSectionName[0]) !== $realSectionName[0];
        } else {
            $upper = strtolower($controllerStr[0]) !== $controllerStr[0];
        }
        $upper = $upper ?? strtolower($nameStr[0]) !== $nameStr[0];

        if ($upper && !$realNameStr) {
            $nameStr = preg_replace_callback('/\/([a-z])/', static function ($matches) {
                return '/' . strtoupper($matches[1]);
            }, ucfirst($nameStr));
        }

        $appDirName = Util::detectAppDirName();
        $path = "{$nameStr}/{$controllerStr}";
        $class = ucfirst(substr($name, $pos + 1));
        $file = app_path() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path) . DIRECTORY_SEPARATOR . "{$class}.php";
        $namespace = str_replace('/', '\\', $appDirName . '/' . $path);
        return [$class, $namespace, $file];
    }

    /**
     * @param string $plugin
     * @return string relative path
     */
    protected function getPluginControllerRelativePath(string $plugin): string
    {
        return Util::getDefaultAppRelativePath('controller', $plugin);
    }

    /**
     * Prompt for controller path (interactive). Reuses enter_path_prompt from make:crud messages.
     *
     * @param InputInterface $input
     * @param OutputInterface $output
     * @param string $defaultPath
     * @return string
     */
    protected function promptForControllerPath(InputInterface $input, OutputInterface $output, string $defaultPath): string
    {
        $defaultPath = $this->normalizeRelativePath($defaultPath);
        $label = Util::selectLocaleMessages(Messages::getTypeLabels())['controller'] ?? 'Controller';
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
     * Command help text (multilingual).
     *
     * @return string
     */
    protected function buildHelpText(): string
    {
        return Util::selectByLocale(Messages::getMakeControllerHelpText());
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
        return strtr(Util::selectLocaleMessages(Messages::getMakeControllerMessages())[$key] ?? $key, $replace);
    }
}
