<?php
namespace Webman\Database;

class Install
{
    const WEBMAN_PLUGIN = true;

    /**
     * @var array
     */
    protected static array $pathRelation = [];

    /**
     * Install
     * @return void
     */
    public static function install(): void
    {
        $database_file = config_path('database.php');
        if (!is_file($database_file)) {
            echo 'Create config/database.php' . PHP_EOL;
            copy(__DIR__ . '/config/database.php', $database_file);
        }
        static::installByRelation();
        static::removeLaravelDbFromBootstrap();
    }

    /**
     * @return void
     */
    protected static function removeLaravelDbFromBootstrap(): void
    {
        $file = base_path('config/bootstrap.php');
        if (!is_file($file)) {
            return;
        }
        $pattern = '/^\s*support\\\\bootstrap\\\\LaravelDb::class,\s*?\r?\n/m';
        $content = file_get_contents($file);
        if (preg_match($pattern, $content)) {
            $updatedContent = preg_replace($pattern, '', $content);
            file_put_contents($file, $updatedContent);
        }
    }

    /**
     * Uninstall
     * @return void
     */
    public static function uninstall(): void
    {
        $database_file = config_path('database.php');
        if (is_file($database_file)) {
            echo 'Remove config/database.php' . PHP_EOL;
            unlink($database_file);
        }
        self::uninstallByRelation();
    }

    /**
     * installByRelation
     * @return void
     */
    public static function installByRelation(): void
    {
        foreach (static::$pathRelation as $source => $dest) {
            if ($pos = strrpos($dest, '/')) {
                $parent_dir = base_path().'/'.substr($dest, 0, $pos);
                if (!is_dir($parent_dir)) {
                    mkdir($parent_dir, 0777, true);
                }
            }
            copy_dir(__DIR__ . "/$source", base_path()."/$dest");
        }
    }

    /**
     * uninstallByRelation
     * @return void
     */
    public static function uninstallByRelation(): void
    {
        foreach (static::$pathRelation as $source => $dest) {
            $path = base_path()."/$dest";
            if (!is_dir($path) && !is_file($path)) {
                continue;
            }
            remove_dir($path);
        }
    }

}