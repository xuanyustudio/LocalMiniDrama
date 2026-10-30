<?php

namespace support\annotation\route;

use Attribute;

/**
 * Group routes by controller-level prefix.
 */
#[Attribute(Attribute::TARGET_CLASS)]
class RouteGroup
{
    /**
     * Prefix for all routes in this controller.
     */
    public string $prefix;

    /**
     * @param string $prefix Route group prefix, e.g. "/api/v1"
     */
    public function __construct(string $prefix = '')
    {
        $this->prefix = $prefix;
    }
}

