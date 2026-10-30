<?php

namespace plugin\admin\app\model;

use plugin\admin\app\model\Base;

/**
 * @property integer $id 主键(主键)
 * @property string $name 名称
 * @property string $url url
 * @property integer $admin_id 管理员
 * @property integer $user_id 用户
 * @property integer $file_size 文件大小
 * @property string $mime_type mime类型
 * @property integer $image_width 图片宽度
 * @property integer $image_height 图片高度
 * @property string $ext 扩展名
 * @property string $storage 存储位置
 * @property string $created_at 上传时间
 * @property string $category 类别
 * @property string $updated_at 更新时间
 */
class Upload extends Base
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'wa_uploads';

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected $primaryKey = 'id';
    
    
    
    
}
