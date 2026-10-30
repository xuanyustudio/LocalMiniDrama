<?php

namespace support\annotation\route;

use Attribute;

/**
 * Shortcut for #[Route(methods: 'DELETE', ...)].
 */
#[Attribute(Attribute::TARGET_METHOD | Attribute::IS_REPEATABLE)]
class Delete extends Route
{
    /**
     * @param string|null $path Route path. Null means default-route method restriction only.
     * @param string|null $name Route name
     */
    public function __construct(?string $path = null, ?string $name = null)
    {
        parent::__construct($path, 'DELETE', $name);
    }
}

