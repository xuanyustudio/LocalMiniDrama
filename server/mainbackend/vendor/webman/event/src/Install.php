<?php
namespace Webman\Event;

class Install
{
    const WEBMAN_PLUGIN = true;

    /**
     * @var array
     */
    protected static $pathRelation = array (
  'config/plugin/webman/event' => 'config/plugin/webman/event',
);

    /**
     * Install
     * @return void
     */
    public static function install()
    {
        static::installByRelation();
        $event_config_path = config_path() . '/event.php';
        if (!is_file($event_config_path)) {
            file_put_contents($event_config_path, "<?php\n\nreturn [\n    \n];\n");
        }
    }

    /**
     * Uninstall
     * @return void
     */
    public static function uninstall()
    {
        $event_config_path = config_path() . '/event.php';
        if (is_file($event_config_path)) {
            unlink($event_config_path);
        }
        self::uninstallByRelation();
    }

    /**
     * installByRelation
     * @return void
     */
    public static function installByRelation()
    {
        foreach (static::$pathRelation as $source => $dest) {
            if ($pos = strrpos($dest, '/')) {
                $parent_dir = base_path().'/'.substr($dest, 0, $pos);
                if (!is_dir($parent_dir)) {
                    mkdir($parent_dir, 0777, true);
                }
            }
            //symlink(__DIR__ . "/$source", base_path()."/$dest");
            copy_dir(__DIR__ . "/$source", base_path()."/$dest");
            echo "Create $dest
";
        }
    }

    /**
     * uninstallByRelation
     * @return void
     */
    public static function uninstallByRelation()
    {
        foreach (static::$pathRelation as $source => $dest) {
            $path = base_path()."/$dest";
            if (!is_dir($path) && !is_file($path)) {
                continue;
            }
            echo "Remove $dest
";
            if (is_file($path) || is_link($path)) {
                unlink($path);
                continue;
            }
            remove_dir($path);
        }
    }
    
}