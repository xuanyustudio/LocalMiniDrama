<?php
namespace Webman\Console;

class Install
{
    const WEBMAN_PLUGIN = true;

    /**
     * @var array
     */
    protected static $pathRelation = [
      'config/plugin/webman/console' => 'config/plugin/webman/console',
    ];

    /**
     * Install
     * @return void
     */
    public static function install()
    {
        $dest = base_path() . "/webman";
        if (is_dir($dest)) {
            echo "Installation failed, please remove directory $dest\n";
            return;
        }
        copy(__DIR__ . "/webman", $dest);
        chmod(base_path() . "/webman", 0755);

        static::installByRelation();
    }

    /**
     * Uninstall
     * @return void
     */
    public static function uninstall()
    {
        if (is_file(base_path()."/webman")) {
            unlink(base_path() . "/webman");
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
            copy_dir(__DIR__ . "/$source", base_path()."/$dest");
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
            remove_dir($path);
        }
    }
    
}
