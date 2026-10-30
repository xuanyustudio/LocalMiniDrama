<?php

namespace support\annotation\route;

use Attribute;

/**
 * Define an explicit route, or restrict allowed HTTP methods for default route when path is null.
 */
#[Attribute(Attribute::TARGET_METHOD | Attribute::IS_REPEATABLE)]
class Route
{
    /**
     * Route path. Null means "method restriction only" for default route.
     */
    public ?string $path;

    /**
     * @var string[]
     */
    public array $methods;

    /**
     * Route name for URL generation.
     */
    public ?string $name;

    /**
     * @param string|null $path Route path, must start with "/". Null means "method restriction only" for default route.
     * @param string|string[] $methods HTTP methods
     * @param string|null $name Route name
     */
    public function __construct(?string $path = null, array|string $methods = ['GET'], ?string $name = null)
    {
        $this->path = $path;
        $this->methods = is_array($methods) ? $methods : [$methods];
        $this->name = $name;
    }
}

