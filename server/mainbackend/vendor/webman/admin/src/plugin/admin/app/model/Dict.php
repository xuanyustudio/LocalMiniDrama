<?php

namespace plugin\admin\app\model;


use support\exception\BusinessException;

/**
 * 字典相关
 */
class Dict
{
    /**
     * 获取字典
     * @param $name
     * @return mixed|null
     */
    public static function get($name)
    {
        $value = Option::where('name', static::dictNameToOptionName($name))->value('value');
        return $value ? json_decode($value, true) : null;
    }

    /**
     * 保存字典
     * @param $name
     * @param $values
     * @return void
     * @throws BusinessException
     */
    public static function save($name, $values)
    {
        if (!preg_match('/[a-zA-Z]/', $name)) {
            throw new BusinessException('字典名只能包含字母');
        }
        $option_name = static::dictNameToOptionName($name);
        if (!$option = Option::where('name', $option_name)->first()) {
            $option = new Option;
        }
        $format_values = static::filterValue($values);
        $option->name = $option_name;
        $option->value = json_encode($format_values, JSON_UNESCAPED_UNICODE);
        $option->save();
    }

    /**
     * 删除字典
     * @param array $names
     * @return void
     */
    public static function delete(array $names)
    {
        foreach ($names as $index => $name) {
            $names[$index] = static::dictNameToOptionName($name);
        }
        Option::whereIn('name', $names)->delete();
    }

    /**
     * 字典名到option名转换
     * @param string $name
     * @return string
     */
    public static function dictNameToOptionName(string $name): string
    {
        return "dict_$name";
    }

    /**
     * option名到字典名转换
     * @param string $name
     * @return string
     */
    public static function optionNameToDictName(string $name): string
    {
        return substr($name, 5);
    }

    /**
     * 过滤值
     * @param array $values
     * @return array
     * @throws BusinessException
     */
    public static function filterValue(array $values): array
    {
        $format_values = [];
        foreach ($values as $item) {
            if (!isset($item['value']) || !isset($item['name'])) {
                throw new BusinessException('字典格式错误', 1);
            }
            $format_values[] =  ['value' => $item['value'], 'name' => $item['name']];
        }
        return $format_values;
    }
}
