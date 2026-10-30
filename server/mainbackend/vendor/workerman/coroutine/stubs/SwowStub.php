<?php

namespace Swow;

class Coroutine
{
    public function resume(mixed ...$args): mixed
    {
        // Stub for PHPStorm
        return null;
    }

    public static function getCurrent(): static
    {
        // Stub for PHPStorm
        return new Coroutine;
    }

    public static function yield (mixed ...$args) : mixed
    {
        // Stub for PHPStorm
        return null;
    }

    public function getId() : int
    {
        // Stub for PHPStorm
        return 0;
    }

    public static function run(callable $callable , mixed ... $args): static
    {
        // Stub for PHPStorm
        return new Coroutine;
    }
}
