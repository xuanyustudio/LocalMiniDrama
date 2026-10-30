<?php

namespace Workerman\Coroutine\Context;

use ArrayObject;

/**
 * Interface ContextInterface
 */
interface ContextInterface
{
    /**
     * Get the value from the context with the specified name.
     * If the name does not exist, return the default value.
     *
     * @param string|null $name The name of the value to get.
     * @param mixed $default The default value to return if the name does not exist.
     * @return mixed The value from the context or the default value.
     */
    public static function get(?string $name = null, mixed $default = null): mixed;

    /**
     * Set the value in the context with the specified name.
     *
     * @param string $name The name of the value to set.
     * @param mixed $value The value to set.
     */
    public static function set(string $name, mixed $value): void;

    /**
     * Check if the specified name exists in the context.
     *
     * @param string $name The name to check.
     * @return bool True if the name exists, otherwise false.
     */
    public static function has(string $name): bool;

    /**
     * Initialize the context with an array of data.
     *
     * @param ArrayObject|null $data The array of data to initialize the context.
     */
    public static function reset(?ArrayObject $data = null): void;

    /**
     * Destroy the context.
     */
    public static function destroy(): void;

}
