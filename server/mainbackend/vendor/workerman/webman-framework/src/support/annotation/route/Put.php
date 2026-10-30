<?php

namespace support\annotation\route;

use Attribute;

/**
 * Shortcut for #[Route(methods: 'PUT', ...)].
 */
#[Attribute(Attribute::TARGET_METHOD | Attribute::IS_REPEATABLE)]
class Put extends Route
{
    /**
     * @param string|null $path Route path. Null means default-route method restriction only.
     * @param string|null $name Route name
     */
    public function __construct(?string $path = null, ?string $name = null)
    {
        parent::__construct($path, 'PUT', $name);
    }
}

