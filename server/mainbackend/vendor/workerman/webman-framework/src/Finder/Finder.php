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

use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RecursiveCallbackFilterIterator;

/**
 * Class Finder
 * File finder with PHP file caching support.
 * @package Webman\Finder
 */
class Finder
{
    /**
     * @var string[] Root directories
     */
    protected array $roots = [];

    /**
     * @var bool Only match files (not directories)
     */
    protected bool $onlyFiles = false;

    /**
     * @var array File name patterns (glob or regex)
     */
    protected array $names = [];

    /**
     * @var array Path patterns (regex)
     */
    protected array $paths = [];

    /**
     * @var array Directories to exclude
     */
    protected array $excludeDirs = ['vendor', 'runtime', '.git', 'storage', 'tests', 'node_modules'];

    /**
     * @var bool Enable PHP meta analysis
     */
    protected bool $phpMetaEnabled = false;

    /**
     * @var bool|null Filter by hasAttributes
     */
    protected ?bool $filterHasAttributes = null;

    /**
     * @var array|null Filter by type
     */
    protected ?array $filterTypes = null;

    /**
     * @var bool|null Filter by psr4
     */
    protected ?bool $filterPsr4 = null;

    /**
     * @var array<string, array> PHP file cache: [path => meta, ...]
     */
    protected static array $phpCache = [];

    /**
     * @var array<string, bool> Cache dirty flags by root
     */
    protected static array $cacheDirty = [];

    /**
     * @var string Cache directory
     */
    protected static string $cacheDir = '';

    /**
     * Create a new Finder instance with root directories.
     * @param string|array $dirs
     * @return static
     */
    public static function in(string|array $dirs): static
    {
        $instance = new static();
        foreach ((array)$dirs as $dir) {
            if (is_dir($dir)) {
                $instance->roots[] = static::normalizePath($dir);
            }
        }
        return $instance;
    }

    /**
     * Create a new Finder instance.
     * Use in() to set search directories.
     * @return static
     */
    public static function create(): static
    {
        return new static();
    }

    /**
     * Set cache directory.
     * @param string $dir
     * @return void
     */
    public static function setCacheDir(string $dir): void
    {
        static::$cacheDir = rtrim($dir, '/\\');
    }

    /**
     * Get cache directory.
     * @return string
     */
    protected static function getCacheDir(): string
    {
        if (static::$cacheDir === '') {
            static::$cacheDir = rtrim(runtime_path('cache/framework/finder'), '/\\');
            if (!is_dir(static::$cacheDir)) {
                @mkdir(static::$cacheDir, 0755, true);
            }
        }
        return static::$cacheDir;
    }

    /**
     * Only match files.
     * @return $this
     */
    public function files(): static
    {
        $this->onlyFiles = true;
        return $this;
    }

    /**
     * Filter by file name pattern (glob or regex).
     * @param string|array $patterns
     * @return $this
     */
    public function name(string|array $patterns): static
    {
        $this->names = array_merge($this->names, (array)$patterns);
        return $this;
    }

    /**
     * Filter by path pattern (regex).
     * @param string|array $patterns
     * @return $this
     */
    public function path(string|array $patterns): static
    {
        $this->paths = array_merge($this->paths, (array)$patterns);
        return $this;
    }

    /**
     * Exclude directories.
     * @param string|array $dirs
     * @return $this
     */
    public function exclude(string|array $dirs): static
    {
        $this->excludeDirs = array_merge($this->excludeDirs, (array)$dirs);
        return $this;
    }

    /**
     * Set exclude directories (replace default).
     * @param array $dirs
     * @return $this
     */
    public function excludeDirs(array $dirs): static
    {
        $this->excludeDirs = $dirs;
        return $this;
    }

    /**
     * Enable PHP meta analysis and caching.
     * @return $this
     */
    public function withPhpMeta(): static
    {
        $this->phpMetaEnabled = true;
        return $this;
    }

    /**
     * Whether any PHP meta filters are requested.
     * @return bool
     */
    protected function phpFiltersRequested(): bool
    {
        return $this->filterHasAttributes !== null
            || $this->filterTypes !== null
            || $this->filterPsr4 !== null;
    }

    /**
     * Filter by hasAttributes.
     * @param bool $value
     * @return $this
     */
    public function hasAttributes(bool $value): static
    {
        // PHP-specific filter: enable PHP meta automatically.
        $this->phpMetaEnabled = true;
        $this->filterHasAttributes = $value;
        return $this;
    }

    /**
     * Filter by type (class, interface, trait, enum, non_class).
     * @param array $types
     * @return $this
     */
    public function typeIn(array $types): static
    {
        // PHP-specific filter: enable PHP meta automatically.
        $this->phpMetaEnabled = true;
        $this->filterTypes = $types;
        return $this;
    }

    /**
     * Filter by PSR-4 compliance.
     * @param bool $value
     * @return $this
     */
    public function psr4(bool $value): static
    {
        // PHP-specific filter: enable PHP meta automatically.
        $this->phpMetaEnabled = true;
        $this->filterPsr4 = $value;
        return $this;
    }

    /**
     * Find files and return FileInfo array.
     * @return FileInfo[]
     */
    public function find(): array
    {
        $results = [];
        $phpFiltersRequested = $this->phpFiltersRequested();
        // phpMetaEnabled can be turned on explicitly (withPhpMeta) or implicitly (by PHP filters).
        $phpMetaEnabled = $this->phpMetaEnabled || $phpFiltersRequested;

        foreach ($this->roots as $rootDir) {

            // Load cache for this root
            if ($phpMetaEnabled) {
                $this->loadCache($rootDir);
            }

            // Scan directory
            $files = $this->scanDirectory($rootDir);

            // Apply filters
            foreach ($files as $filePath) {
                // Apply name filter
                if (!$this->matchesName($filePath)) {
                    continue;
                }

                // Apply path filter
                if (!$this->matchesPath($filePath, $rootDir)) {
                    continue;
                }

                // Get or compute PHP meta
                $meta = [];
                if ($phpMetaEnabled) {
                    // If any PHP filters were requested, skip non-PHP files.
                    if ($phpFiltersRequested && !$this->isPhpFile($filePath)) {
                        continue;
                    }
                    if ($this->isPhpFile($filePath)) {
                        $meta = $this->getPhpMeta($filePath, $rootDir);

                        // Apply PHP meta filters
                        if ($phpFiltersRequested && !$this->matchesPhpFilters($meta, $filePath, $rootDir)) {
                            continue;
                        }
                    }
                }

                $results[] = new FileInfo($filePath, $meta, $rootDir);
            }

            // Save cache if dirty
            if ($phpMetaEnabled) {
                $this->saveCache($rootDir);
            }
        }

        return $results;
    }

    /**
     * Find files and return paths array.
     * @return string[]
     */
    public function findPaths(): array
    {
        return array_map(fn(FileInfo $f) => $f->getPathname(), $this->find());
    }

    /**
     * Scan directory recursively.
     * @param string $dir
     * @return array
     */
    protected function scanDirectory(string $dir): array
    {
        $files = [];
        $excludeSet = array_flip($this->excludeDirs);

        try {
            $directoryIterator = new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS);
            $filterIterator = new RecursiveCallbackFilterIterator(
                $directoryIterator,
                function (\SplFileInfo $current) use ($excludeSet) {
                    if ($current->isDir()) {
                        return !isset($excludeSet[$current->getBasename()]);
                    }
                    return true;
                }
            );
            $iterator = new RecursiveIteratorIterator($filterIterator, RecursiveIteratorIterator::SELF_FIRST);

            foreach ($iterator as $item) {
                /** @var \SplFileInfo $item */
                $basename = $item->getBasename();

                // Skip excluded directories
                if ($item->isDir()) {
                    continue;
                }

                // Skip if only files mode and not a file
                if ($this->onlyFiles && !$item->isFile()) {
                    continue;
                }

                $files[] = static::normalizePath($item->getPathname());
            }
        } catch (\Throwable $e) {
            // Ignore unreadable directories
        }

        return $files;
    }

    /**
     * Check if file matches name patterns.
     * @param string $filePath
     * @return bool
     */
    protected function matchesName(string $filePath): bool
    {
        if (empty($this->names)) {
            return true;
        }

        $basename = basename($filePath);
        foreach ($this->names as $pattern) {
            if ($this->matchPattern($basename, $pattern)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if file matches path patterns.
     * @param string $filePath
     * @param string $rootDir
     * @return bool
     */
    protected function matchesPath(string $filePath, string $rootDir): bool
    {
        if (empty($this->paths)) {
            return true;
        }

        // Use relative path for matching
        $relativePath = $this->getRelativePath($filePath, $rootDir);

        foreach ($this->paths as $pattern) {
            if ($this->isRegex($pattern) && preg_match($pattern, $relativePath)) {
                return true;
            }
            if (!$this->isRegex($pattern) && stripos($relativePath, $pattern) !== false) {
                return true;
            }
        }
        return false;
    }

    /**
     * Match a pattern (glob or regex).
     * @param string $value
     * @param string $pattern
     * @return bool
     */
    protected function matchPattern(string $value, string $pattern): bool
    {
        // Regex pattern
        if ($this->isRegex($pattern)) {
            return (bool)preg_match($pattern, $value);
        }

        // Glob pattern
        return fnmatch($pattern, $value, FNM_CASEFOLD);
    }

    /**
     * Check if pattern is a regex.
     * @param string $pattern
     * @return bool
     */
    protected function isRegex(string $pattern): bool
    {
        if ($pattern === '') {
            return false;
        }
        $delimiter = $pattern[0];
        if (!in_array($delimiter, ['/', '#', '~', '%'], true)) {
            return false;
        }
        return (bool)preg_match('/^' . preg_quote($delimiter, '/') . '.*' . preg_quote($delimiter, '/') . '[imsxuADU]*$/', $pattern);
    }

    /**
     * Check if file is a PHP file.
     * @param string $filePath
     * @return bool
     */
    protected function isPhpFile(string $filePath): bool
    {
        return strtolower(pathinfo($filePath, PATHINFO_EXTENSION)) === 'php';
    }

    /**
     * Get PHP file meta, using cache when possible.
     * @param string $filePath
     * @param string $rootDir
     * @return array
     */
    protected function getPhpMeta(string $filePath, string $rootDir): array
    {
        $cacheKey = $this->getCacheKey($rootDir);
        $mtime = @filemtime($filePath);

        // Check cache
        if (isset(static::$phpCache[$cacheKey][$filePath])) {
            $cached = static::$phpCache[$cacheKey][$filePath];
            if (isset($cached['mtime']) && $cached['mtime'] === $mtime) {
                return $cached;
            }
        }

        // Compute new meta
        $meta = $this->computePhpMeta($filePath, $mtime);

        // Update cache
        static::$phpCache[$cacheKey][$filePath] = $meta;
        static::$cacheDirty[$cacheKey] = true;

        return $meta;
    }

    /**
     * Ensure psr4 is computed and cached in meta.
     * Only computes once per (file, mtime) cache entry.
     * @param string $filePath
     * @param string $rootDir
     * @param array $meta
     * @return array Updated meta
     */
    protected function ensurePsr4Cached(string $filePath, string $rootDir, array $meta): array
    {
        if (array_key_exists('psr4', $meta)) {
            return $meta;
        }

        $psr4 = $this->checkPsr4($filePath, $rootDir, $meta['class'] ?? null);
        $meta['psr4'] = $psr4;

        $cacheKey = $this->getCacheKey($rootDir);
        static::$phpCache[$cacheKey][$filePath] = $meta;
        static::$cacheDirty[$cacheKey] = true;

        return $meta;
    }

    /**
     * Compute PHP file meta info.
     * @param string $filePath
     * @param int|false $mtime
     * @return array
     */
    protected function computePhpMeta(string $filePath, int|false $mtime): array
    {
        $meta = [
            'mtime' => $mtime ?: 0,
            'hasAttributes' => false,
            'class' => null,
        ];

        $code = @file_get_contents($filePath);
        if ($code === false || $code === '') {
            $meta['type'] = 'non_class';
            return $meta;
        }

        // Fast check for attributes
        $meta['hasAttributes'] = str_contains($code, '#[');

        // Parse to get type and declared class
        $parseResult = $this->parsePhpFile($code);
        $meta['type'] = $parseResult['type'];
        $meta['class'] = $parseResult['class'];

        return $meta;
    }

    /**
     * Parse PHP file to extract type and declared class.
     * @param string $code
     * @return array{type: string, class: string|null}
     */
    protected function parsePhpFile(string $code): array
    {
        $result = [
            'type' => 'non_class',
            'class' => null,
        ];

        try {
            $tokens = token_get_all($code);
        } catch (\Throwable $e) {
            return $result;
        }

        $namespace = '';
        $count = count($tokens);
        $prevSignificant = null;

        for ($i = 0; $i < $count; $i++) {
            $token = $tokens[$i];
            $id = is_array($token) ? $token[0] : null;

            // Extract namespace
            if ($id === T_NAMESPACE) {
                $ns = '';
                for ($j = $i + 1; $j < $count; $j++) {
                    $t = $tokens[$j];
                    if (is_array($t)) {
                        if ($t[0] === T_STRING || $t[0] === T_NS_SEPARATOR) {
                            $ns .= $t[1];
                            continue;
                        }
                        if (defined('T_NAME_QUALIFIED') && $t[0] === T_NAME_QUALIFIED) {
                            $ns .= $t[1];
                            continue;
                        }
                        if ($t[0] === T_WHITESPACE) {
                            continue;
                        }
                    } else {
                        if ($t === ';' || $t === '{') {
                            break;
                        }
                    }
                }
                $namespace = trim($ns, '\\');
                continue;
            }

            // Detect class/interface/trait/enum
            if ($id === T_CLASS || $id === T_INTERFACE || $id === T_TRAIT || (defined('T_ENUM') && $id === T_ENUM)) {
                // Skip ::class usage
                if ($prevSignificant === T_DOUBLE_COLON) {
                    $prevSignificant = null;
                    continue;
                }
                // Skip anonymous class
                if ($id === T_CLASS && $prevSignificant === T_NEW) {
                    continue;
                }

                // Determine type
                $type = match ($id) {
                    T_CLASS => 'class',
                    T_INTERFACE => 'interface',
                    T_TRAIT => 'trait',
                    default => defined('T_ENUM') && $id === T_ENUM ? 'enum' : 'class',
                };

                // Extract class name
                for ($j = $i + 1; $j < $count; $j++) {
                    $t = $tokens[$j];
                    if (!is_array($t)) {
                        continue;
                    }
                    if ($t[0] === T_WHITESPACE) {
                        continue;
                    }
                    if ($t[0] === T_STRING) {
                        $className = $t[1];
                        $result['type'] = $type;
                        $result['class'] = $namespace !== '' ? ($namespace . '\\' . $className) : $className;
                        return $result; // Return first declaration only
                    }
                    break;
                }
            }

            // Track previous significant token
            if (is_array($token)) {
                if ($id !== T_WHITESPACE && $id !== T_COMMENT && $id !== T_DOC_COMMENT) {
                    $prevSignificant = $id;
                }
            } else {
                if (trim($token) !== '') {
                    $prevSignificant = $token;
                }
            }
        }

        return $result;
    }

    /**
     * Check if meta matches PHP filters.
     * @param array $meta
     * @param string $filePath
     * @param string $rootDir
     * @return bool
     */
    protected function matchesPhpFilters(array $meta, string $filePath, string $rootDir): bool
    {
        // Filter by hasAttributes
        if ($this->filterHasAttributes !== null && $meta['hasAttributes'] !== $this->filterHasAttributes) {
            return false;
        }

        // Filter by type
        if ($this->filterTypes !== null && !in_array($meta['type'], $this->filterTypes, true)) {
            return false;
        }

        // Filter by PSR-4
        if ($this->filterPsr4 !== null) {
            $meta = $this->ensurePsr4Cached($filePath, $rootDir, $meta);
            $psr4Ok = $meta['psr4'];
            if ($psr4Ok !== $this->filterPsr4) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if file complies with PSR-4.
     * @param string $filePath
     * @param string $rootDir
     * @param string|null $declaredClass
     * @return bool
     */
    protected function checkPsr4(string $filePath, string $rootDir, ?string $declaredClass): bool
    {
        if ($declaredClass === null) {
            return false;
        }

        // Namespace-agnostic check:
        // declared class must end with the PSR-4 relative class path derived from file path.
        $relativePath = $this->getRelativePath($filePath, $rootDir);
        if ($relativePath === '' || !str_ends_with($relativePath, '.php')) {
            return false;
        }
        $relativeClassPath = substr($relativePath, 0, -4);
        $relativeClassPath = str_replace('/', '\\', $relativeClassPath);
        if (!$this->isValidPsr4ClassPath($relativeClassPath)) {
            return false;
        }

        $declaredClass = ltrim($declaredClass, '\\');
        $suffix = '\\' . $relativeClassPath;
        return $declaredClass === $relativeClassPath || str_ends_with($declaredClass, $suffix);
    }

    /**
     * Derive expected class name from file path (PSR-4 style).
     * @param string $filePath
     * @param string $rootDir
     * @param string $rootNamespace
     * @return string|null
     */
    protected function classFromFile(string $filePath, string $rootDir, string $rootNamespace): ?string
    {
        $rootDir = rtrim(static::normalizePath($rootDir), '/');
        $filePath = static::normalizePath($filePath);

        $rootLen = strlen($rootDir);
        if (strncasecmp($filePath, $rootDir, $rootLen) !== 0) {
            return null;
        }

        $relative = ltrim(substr($filePath, $rootLen), '/');
        if ($relative === '' || !str_ends_with($relative, '.php')) {
            return null;
        }

        $relative = substr($relative, 0, -4); // Remove .php
        $relative = str_replace('/', '\\', $relative);

        if (!$this->isValidPsr4ClassPath($relative)) {
            return null;
        }

        return rtrim($rootNamespace, '\\') . '\\' . $relative;
    }

    /**
     * Check if relative class path is valid PSR-4.
     * @param string $relativeClassPath
     * @return bool
     */
    protected function isValidPsr4ClassPath(string $relativeClassPath): bool
    {
        return (bool)preg_match('/^[A-Za-z_][A-Za-z0-9_]*(\\\\[A-Za-z_][A-Za-z0-9_]*)*$/', $relativeClassPath);
    }

    /**
     * Get relative path from root directory.
     * @param string $filePath
     * @param string $rootDir
     * @return string
     */
    protected function getRelativePath(string $filePath, string $rootDir): string
    {
        $rootDir = rtrim(static::normalizePath($rootDir), '/');
        $filePath = static::normalizePath($filePath);
        $rootLen = strlen($rootDir);

        if (strncasecmp($filePath, $rootDir, $rootLen) === 0) {
            return ltrim(substr($filePath, $rootLen), '/');
        }

        return $filePath;
    }

    /**
     * Get cache key for a root directory.
     * @param string $rootDir
     * @return string
     */
    protected function getCacheKey(string $rootDir): string
    {
        return hash('sha256', $rootDir);
    }

    /**
     * Get cache file path for a root directory.
     * @param string $rootDir
     * @return string
     */
    protected function getCacheFile(string $rootDir): string
    {
        $cacheKey = $this->getCacheKey($rootDir);
        return static::getCacheDir() . DIRECTORY_SEPARATOR . "php_files_{$cacheKey}.php";
    }

    /**
     * Load cache for a root directory.
     * @param string $rootDir
     * @return void
     */
    protected function loadCache(string $rootDir): void
    {
        $cacheKey = $this->getCacheKey($rootDir);
        if (isset(static::$phpCache[$cacheKey])) {
            return; // Already loaded
        }

        $cacheFile = $this->getCacheFile($rootDir);
        if (is_file($cacheFile)) {
            try {
                $data = include $cacheFile;
                if (is_array($data)) {
                    static::$phpCache[$cacheKey] = $data;
                    return;
                }
            } catch (\Throwable $e) {
                // Ignore corrupted cache
            }
        }

        static::$phpCache[$cacheKey] = [];
    }

    /**
     * Save cache for a root directory.
     * @param string $rootDir
     * @return void
     */
    protected function saveCache(string $rootDir): void
    {
        $cacheKey = $this->getCacheKey($rootDir);
        if (empty(static::$cacheDirty[$cacheKey])) {
            return;
        }

        $cacheFile = $this->getCacheFile($rootDir);
        $cacheDir = dirname($cacheFile);

        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0755, true);
        }

        $data = static::$phpCache[$cacheKey] ?? [];

        // Clean up deleted files
        foreach ($data as $path => $meta) {
            if (!is_file($path)) {
                unset($data[$path]);
            }
        }

        static::$phpCache[$cacheKey] = $data;

        $content = "<?php\nreturn " . var_export($data, true) . ";\n";
        $suffix = (string)getmypid();
        try {
            $suffix .= '.' . bin2hex(random_bytes(6));
        } catch (\Throwable $e) {
            $suffix .= '.' . uniqid('', true);
        }
        $tempFile = $cacheFile . '.tmp.' . $suffix;

        // No locks: write temp file then atomic rename.
        if (@file_put_contents($tempFile, $content) !== false) {
            // On Windows, rename() fails if target exists. Use a backup to swap.
            if (!@rename($tempFile, $cacheFile)) {
                $backupFile = $cacheFile . '.bak.' . $suffix;
                // Best-effort: move old cache away, then move new cache in.
                @rename($cacheFile, $backupFile);
                if (@rename($tempFile, $cacheFile)) {
                    @unlink($backupFile);
                } else {
                    // Restore old cache if possible.
                    @rename($backupFile, $cacheFile);
                    @unlink($tempFile);
                }
            }
        }

        static::$cacheDirty[$cacheKey] = false;
    }

    /**
     * Clear all caches.
     * @return void
     */
    public static function clearCache(): void
    {
        static::$phpCache = [];
        static::$cacheDirty = [];
    }

    /**
     * Normalize path separators.
     * @param string $path
     * @return string
     */
    protected static function normalizePath(string $path): string
    {
        $realPath = realpath($path);
        if ($realPath !== false) {
            return str_replace('\\', '/', $realPath);
        }
        return str_replace('\\', '/', $path);
    }
}
