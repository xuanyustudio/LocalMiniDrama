<?php
namespace plugin\admin\app\common;


class Tree
{

    /**
     * 获取完整的树结构，包含祖先节点
     */
    const INCLUDE_ANCESTORS = 1;

    /**
     * 获取部分树，不包含祖先节点
     */
    const EXCLUDE_ANCESTORS = 0;

    /**
     * 数据
     * @var array
     */
    protected $data = [];

    /**
     * 哈希树
     * @var array
     */
    protected $hashTree = [];

    /**
     * 父级字段名
     * @var string
     */
    protected $pidName = 'pid';

    /**
     * @param $data
     * @param string $pid_name
     */
    public function __construct($data, string $pid_name = 'pid')
    {
        $this->pidName = $pid_name;
        if (is_object($data) && method_exists($data, 'toArray')) {
            $this->data = $data->toArray();
        } else {
            $this->data = (array)$data;
            $this->data = array_map(function ($item) {
                if (is_object($item) && method_exists($item, 'toArray')) {
                    return $item->toArray();
                }
                return $item;
            }, $this->data);
        }
        $this->hashTree = $this->getHashTree();
    }

    /**
     * 获取子孙节点
     * @param array $include
     * @param bool $with_self
     * @return array
     */
    public function getDescendant(array $include, bool $with_self = false): array
    {
        $items = [];
        foreach ($include as $id) {
            if (!isset($this->hashTree[$id])) {
                return [];
            }
            if ($with_self) {
                $item = $this->hashTree[$id];
                unset($item['children']);
                $items[$item['id']] = $item;
            }
            foreach ($this->hashTree[$id]['children'] ?? [] as $item) {
                unset($item['children']);
                $items[$item['id']] = $item;
                foreach ($this->getDescendant([$item['id']]) as $it) {
                    $items[$it['id']] = $it;
                }
            }
        }
        return array_values($items);
    }

    /**
     * 获取哈希树
     * @param array $data
     * @return array
     */
    protected function getHashTree(array $data = []): array
    {
        $data = $data ?: $this->data;
        $hash_tree = [];
        foreach ($data as $item) {
            $hash_tree[$item['id']] = $item;
        }
        foreach ($hash_tree as $index => $item) {
            if ($item[$this->pidName] && isset($hash_tree[$item[$this->pidName]])) {
                $hash_tree[$item[$this->pidName]]['children'][$hash_tree[$index]['id']] = &$hash_tree[$index];
            }
        }
        return $hash_tree;
    }

    /**
     * 获取树
     * @param array $include
     * @param int $type
     * @return array|null
     */
    public function getTree(array $include = [], int $type = 1): ?array
    {
        // $type === static::EXCLUDE_ANCESTORS
        if ($type === static::EXCLUDE_ANCESTORS) {
            $items = [];
            $include = array_unique($include);
            foreach ($include as $id) {
                if (!isset($this->hashTree[$id])) {
                    return [];
                }
                $items[] = $this->hashTree[$id];
            }
            return static::arrayValues($items);
        }

        // $type === static::INCLUDE_ANCESTORS
        $hash_tree = $this->hashTree;
        $items = [];
        if ($include) {
            $map = [];
            foreach ($include as $id) {
                if (!isset($hash_tree[$id])) {
                    continue;
                }
                $item = $hash_tree[$id];
                $max_depth = 100;
                while ($max_depth-- > 0 && $item[$this->pidName] && isset($hash_tree[$item[$this->pidName]])) {
                    $last_item = $item;
                    $pid = $item[$this->pidName];
                    $item = $hash_tree[$pid];
                    $item_id = $item['id'];
                    if (empty($map[$item_id])) {
                        $map[$item_id] = 1;
                        $hash_tree[$pid]['children'] = [];
                    }
                    $hash_tree[$pid]['children'][$last_item['id']] = $last_item;
                    $item = $hash_tree[$pid];
                }
                $items[$item['id']] = $item;
            }
        } else {
            $items = $hash_tree;
        }
        $formatted_items = [];
        foreach ($items as $item) {
            if (!$item[$this->pidName] || !isset($hash_tree[$item[$this->pidName]])) {
                $formatted_items[] = $item;
            }
        }

        return static::arrayValues($formatted_items);
    }

    /**
     * 递归重建数组下标
     * @param $array
     * @return array
     */
    public static function arrayValues($array): array
    {
        if (!$array) {
            return [];
        }
        if (!isset($array['children'])) {
            $current = current($array);
            if (!is_array($current)) {
                return $array;
            }
            $tree = array_values($array);
            foreach ($tree as $index => $item) {
                $tree[$index] = static::arrayValues($item);
            }
            return $tree;
        }
        $array['children'] = array_values($array['children']);
        foreach ($array['children'] as $index => $child) {
            $array['children'][$index] = static::arrayValues($child);
        }
        return $array;
    }

}
