<?php

namespace Webman;

use Psr\Container\ContainerInterface;
use Webman\Exception\NotFoundException;
use function array_key_exists;
use function class_exists;

/**
 * Class Container
 * @package Webman
 */
class Container implements ContainerInterface
{

    /**
     * @var array
     */
    protected $instances = [];
    /**
     * @var array
     */
    protected $definitions = [];

    /**
     * Get.
     * @param string $name
     * @return mixed
     * @throws NotFoundException
     */
    public function get(string $name)
    {
        if (!isset($this->instances[$name])) {
            if (isset($this->definitions[$name])) {
                $this->instances[$name] = call_user_func($this->definitions[$name], $this);
            } else {
                if (!class_exists($name)) {
                    throw new NotFoundException("Class '$name' not found");
                }
                $this->instances[$name] = new $name();
            }
        }
        return $this->instances[$name];
    }

    /**
     * Has.
     * @param string $name
     * @return bool
     */
    public function has(string $name): bool
    {
        return array_key_exists($name, $this->instances)
            || array_key_exists($name, $this->definitions);
    }

    /**
     * Make.
     * @param string $name
     * @param array $constructor
     * @return mixed
     * @throws NotFoundException
     */
    public function make(string $name, array $constructor = [])
    {
        if (!class_exists($name)) {
            throw new NotFoundException("Class '$name' not found");
        }
        return new $name(... array_values($constructor));
    }

    /**
     * AddDefinitions.
     * @param array $definitions
     * @return $this
     */
    public function addDefinitions(array $definitions): Container
    {
        $this->definitions = array_merge($this->definitions, $definitions);
        return $this;
    }

}
