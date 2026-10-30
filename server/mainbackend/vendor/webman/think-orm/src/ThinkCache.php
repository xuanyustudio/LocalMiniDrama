<?php

declare(strict_types=1);

namespace Webman\ThinkOrm;

use DateInterval;
use DateTimeInterface;
use Psr\SimpleCache\CacheInterface;
use Psr\SimpleCache\InvalidArgumentException;
use ReflectionException;
use support\think\Cache;

/**
 * 缓存管理类
 */
class ThinkCache implements CacheInterface
{
    /**
     * 清空缓冲池
     * @access public
     * @return bool
     * @throws ReflectionException
     */
    public function clear(): bool
    {
        return Cache::clear();
    }

    /**
     * 读取缓存
     * @access public
     * @param string $key 缓存变量名
     * @param mixed $default 默认值
     * @return mixed
     * @throws InvalidArgumentException|ReflectionException
     */
    public function get($key, mixed $default = null): mixed
    {
        return Cache::get($key,  $default);
    }

    /**
     * 写入缓存
     * @access public
     * @param string $key 缓存变量名
     * @param mixed $value 存储数据
     * @param int|DateTimeInterface|DateInterval $ttl 有效时间 0为永久
     * @return bool
     * @throws InvalidArgumentException|ReflectionException
     */
    public function set($key, $value, $ttl = null): bool
    {
        return Cache::set($key,  $value, $ttl);
    }

    /**
     * 删除缓存
     * @access public
     * @param string $key 缓存变量名
     * @return bool
     * @throws InvalidArgumentException|ReflectionException
     */
    public function delete($key): bool
    {
        return Cache::delete($key);
    }

    /**
     * 读取缓存
     * @access public
     * @param iterable $keys 缓存变量名
     * @param mixed $default 默认值
     * @return iterable
     * @throws ReflectionException
     */
    public function getMultiple($keys, $default = null): iterable
    {
        return Cache::getMultiple($keys, $default);
    }

    /**
     * 写入缓存
     * @access public
     * @param iterable $values 缓存数据
     * @param null|int|DateInterval $ttl 有效时间 0为永久
     * @return bool
     * @throws ReflectionException
     */
    public function setMultiple($values, $ttl = null): bool
    {
        return Cache::setMultiple($values, $ttl);
    }

    /**
     * 删除缓存
     * @access public
     * @param iterable $keys 缓存变量名
     * @return bool
     * @throws ReflectionException
     */
    public function deleteMultiple($keys): bool
    {
        return Cache::deleteMultiple($keys);
    }

    /**
     * 判断缓存是否存在
     * @access public
     * @param string $key 缓存变量名
     * @return bool
     * @throws InvalidArgumentException|ReflectionException
     */
    public function has($key): bool
    {
        return Cache::has($key);
    }
}
