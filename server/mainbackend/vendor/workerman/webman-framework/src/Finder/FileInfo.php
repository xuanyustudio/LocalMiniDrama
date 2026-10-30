<?php
/**
 * This file is part of webman.
 *
 * Licensed under The MIT License
 * For full copyright and license information, please see the MIT-LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @author    walkor<walkor@workerman.net>
 * @copyright walkor<walkor@workerman.net>
 * @link      http://www.workerman.net/
 * @license   http://www.opensource.org/licenses/mit-license.php MIT License
 */

namespace Webman\Finder;

use Webman\File;

/**
 * Class FileInfo
 * @package Webman\Finder
 */
class FileInfo extends File
{
    /**
     * @var array PHP file meta info (hasAttributes, type, class, psr4, etc.)
     */
    protected array $meta = [];

    /**
     * @var string Root directory this file belongs to
     */
    protected string $rootDir = '';

    // Root namespace is intentionally not stored.
    /**
     * Constructor.
     * @param string $path
     * @param array $meta
     * @param string $rootDir
     */
    public function __construct(string $path, array $meta = [], string $rootDir = '')
    {
        parent::__construct($path);
        $this->meta = $meta;
        $this->rootDir = $rootDir;
    }

    /**
     * Get PHP file meta info.
     * @return array
     */
    public function meta(): array
    {
        return $this->meta;
    }

    /**
     * Get declared class (FQCN) from meta.
     * Example: "App\\Controller\\IndexController"
     *
     * @return string|null
     */
    public function class(): ?string
    {
        $class = $this->meta['class'] ?? null;
        if (!is_string($class) || $class === '') {
            return null;
        }
        return ltrim($class, '\\');
    }

    /**
     * Get declared short class name (without namespace).
     * Example: "IndexController"
     *
     * @return string|null
     */
    public function className(): ?string
    {
        $fqcn = $this->class();
        if ($fqcn === null) {
            return null;
        }
        $pos = strrpos($fqcn, '\\');
        return $pos === false ? $fqcn : substr($fqcn, $pos + 1);
    }

    /**
     * Get declared namespace.
     * Example: "App\\Controller"
     *
     * @return string|null
     */
    public function namespace(): ?string
    {
        $fqcn = $this->class();
        if ($fqcn === null) {
            return null;
        }
        $pos = strrpos($fqcn, '\\');
        return $pos === false ? null : substr($fqcn, 0, $pos);
    }

    /**
     * Set meta info.
     * @param array $meta
     * @return $this
     */
    public function setMeta(array $meta): static
    {
        $this->meta = $meta;
        return $this;
    }

    /**
     * Get root directory.
     * @return string
     */
    public function rootDir(): string
    {
        return $this->rootDir;
    }

    /**
     * Get relative pathname from root directory.
     * @return string
     */
    public function relativePathname(): string
    {
        if ($this->rootDir === '') {
            return $this->getPathname();
        }
        $rootDir = rtrim(str_replace('\\', '/', $this->rootDir), '/');
        $pathname = str_replace('\\', '/', $this->getPathname());
        $rootLen = strlen($rootDir);
        if (strncasecmp($pathname, $rootDir, $rootLen) === 0) {
            return ltrim(substr($pathname, $rootLen), '/');
        }
        return $this->getPathname();
    }
}
