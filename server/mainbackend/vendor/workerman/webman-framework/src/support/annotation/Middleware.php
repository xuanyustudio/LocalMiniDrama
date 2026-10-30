<?php

namespace support\annotation;

use Attribute;

/**
 * Attach middlewares to routes/controllers/functions via attributes.
 *
 * Example:
 *   #[Middleware(AuthMiddleware::class, RateLimitMiddleware::class)]
 */
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD | Attribute::TARGET_FUNCTION)]
class Middleware
{
    /**
     * @var array
     */
    protected array $middlewares = [];

    /**
     * @param mixed ...$middlewares Middleware class names.
     */
    public function __construct(...$middlewares)
    {
        $this->middlewares = $middlewares;
    }

    /**
     * Convert to webman middleware callable format: [MiddlewareClass, 'process'].
     * @return array
     */
    public function getMiddlewares(): array
    {
        $middlewares = [];
        foreach ($this->middlewares as $middleware) {
            $middlewares[] = [$middleware, 'process'];
        }
        return $middlewares;
    }
}