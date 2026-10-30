<?php

namespace plugin\admin\app\common;

use support\exception\BusinessException;

class Layui
{

    /**
     * 生成的html代码
     * @var string
     */
    protected $htmlContent = '';

    /**
     * 生成的js代码
     * @var string
     */
    protected $jsContent = '';

    /**
     * 获取生成的html代码
     * @param $indent
     * @return string
     */
    public function html($indent = 0): string
    {
        return str_replace("\n", "\n" . str_repeat('    ', $indent), $this->htmlContent);
    }

    /**
     * 获取生成的js代码
     * @param $indent
     * @return string
     */
    public function js($indent = 0): string
    {
        return str_replace("\n", "\n" . str_repeat('    ', $indent), $this->jsContent);
    }

    /**
     * 获取控件及相关参数
     * @param $options
     * @return array
     */
    protected function options($options): array
    {
        array_walk_recursive($options, function (&$item, $key) {
            if (is_string($item)) {
                $item = htmlspecialchars($item);
                if ($key === 'url') {
                    $item = str_replace('&amp;', '&', $item);
                }
            }
        });
        $field = $options['field'] ?? '';
        $props = !empty($options['props']) ? $options['props'] : [];
        $verify_string = !empty($props['lay-verify']) ? ' lay-verify="' . $props['lay-verify'] . '"' : '';
        $required_string = strpos($verify_string, 'required') ? ' required' : '';
        $label = !empty($options['label']) ? '<label class="layui-form-label' . $required_string . '">' . $options['label'] . '</label>' : '';
        $value = $props['value'] ?? '';
        $class = $props['class'] ?? 'layui-input-block';

        return [$label, $field, $value, $props, $verify_string, $required_string, $class];
    }

    /**
     * input输入框
     * @param $options
     * @return void
     */
    public function input($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);

        $placeholder_string = !empty($props['placeholder']) ? ' placeholder="' . $props['placeholder'] . '"' : '';
        $autocomplete_string = !empty($props['autocomplete']) ? ' autocomplete="' . $props['autocomplete'] . '"' : '';
        $disabled_string = !empty($props['disabled']) ? ' disabled' : '';
        $type = $props['type'] ?? 'text';

        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <input type="$type" name="$field" value="$value"$disabled_string$required_string$verify_string$placeholder_string$autocomplete_string class="layui-input">
    </div>
</div>

EOF;
    }

    /**
     * input数字输入框
     * @param $options
     * @return void
     */
    public function inputNumber($options)
    {
        $options['props']['type'] = 'number';
        $this->input($options);
    }

    /**
     * 输入框范围
     * @param $options
     * @return void
     */
    public function inputRange($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);
        $type = $props['type'] ?? 'text';

        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <div class="layui-input-block">
            <input type="$type" autocomplete="off" name="{$field}[]" class="layui-input inline-block" placeholder="开始">
            -
            <input type="$type" autocomplete="off" name="{$field}[]" class="layui-input inline-block" placeholder="结束">
        </div>
    </div>
</div>

EOF;
    }

    /**
     * 输入框模糊查询
     * @param $options
     * @return void
     */
    public function inputLike($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);
        $type = $props['type'] ?? 'text';

        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <div class="layui-input-block">
            <input type="hidden" autocomplete="off" name="{$field}[]" value="like" class="layui-input inline-block">
            <input type="$type" autocomplete="off" name="{$field}[]" class="layui-input">
        </div>
    </div>
</div>

EOF;
    }

    /**
     * 数字输入框范围
     * @param $options
     * @return void
     */
    public function inputNumberRange($options)
    {
        $options['props']['type'] = 'number';
        $this->inputRange($options);
    }

    /**
     * 数字输入框模糊查询
     * @param $options
     * @return void
     */
    public function inputNumberLike($options)
    {
        $options['props']['type'] = 'number';
        $this->inputLike($options);
    }

    /**
     * 密码输入框
     * @param $options
     * @return void
     */
    public function inputPassword($options)
    {
        $options['props']['type'] = 'password';
        $this->input($options);
    }

    /**
     * 文本域
     * @param $options
     * @return void
     */
    public function textArea($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);

        $placeholder_string = !empty($props['placeholder']) ? ' placeholder="' . $props['placeholder'] . '"' : '';
        $disabled_string = !empty($props['disabled']) ? ' disabled' : '';

        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <textarea name="$field"$required_string$verify_string$placeholder_string$disabled_string class="layui-textarea">$value</textarea>
    </div>
</div>

EOF;
    }

    /**
     * 富文本
     * @param $options
     * @return void
     */
    public function richText($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);

        $placeholder_string = !empty($props['placeholder']) ? ' placeholder="' . $props['placeholder'] . '"' : '';
        $disabled_string = !empty($props['disabled']) ? ' disabled' : '';
        $id = $field;

        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <textarea id="$id" name="$field"$required_string$verify_string$placeholder_string$disabled_string class="layui-textarea">$value</textarea>
    </div>
</div>

EOF;

        $options_string = '';
        if (!isset($props['images_upload_url'])) {
            $props['images_upload_url'] = '/app/admin/upload/image';
        }
        $props = $this->prepareProps($props);
        $options_string .= "\n" . $this->preparePropsToJsObject($props, 1, true);
        $this->jsContent .= <<<EOF

// 字段 {$options['label']} $field
layui.use(["tinymce"], function() {
    var tinymce = layui.tinymce
    var edit = tinymce.render({
        elem: "#$id",$options_string
    });
    edit.on("blur", function(){
        layui.$("#$id").val(edit.getContent());
    });
});

EOF;
    }

    /**
     * json编辑框
     * @param $options
     * @return void
     */
    public function jsonEditor($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);

        $placeholder_string = !empty($props['placeholder']) ? ' placeholder="' . $props['placeholder'] . '"' : '';
        $autocomplete_string = !empty($props['autocomplete']) ? ' autocomplete="' . $props['autocomplete'] . '"' : '';
        $disabled_string = !empty($props['disabled']) ? ' disabled' : '';
        $type = $props['type'] ?? 'text';
        if (empty($value)) {
            $value = '{}';
        }
        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <input type="$type" name="$field"id="$field" value="$value"$disabled_string$required_string$verify_string$placeholder_string$autocomplete_string class="layui-input">
    </div>
</div>
EOF;
        $this->jsContent .= <<<EOF
jsonArea({
    el: "#$field",
    change: function(data) {
        console.log(data);
    }
});
EOF;

    }

    /**
     * 上传组件
     * @param $options
     * @return void
     */
    public function upload($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);

        $props['accept'] = $props['accept'] ?? 'file';
        $props['url'] = $props['url'] ?? '/app/admin/upload/file';
        $id = $this->createId($field);

        $props['field'] = $props['field'] ?? '__file__';
        unset($props['lay-verify']);
        $options_string = '';
        $props = $this->prepareProps($props);
        $options_string .= "\n" . $this->preparePropsToJsObject($props, 1, true);

        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <span>$value</span>
        <input type="text" style="display:none" name="$field" value="$value" />
        <button type="button" class="pear-btn pear-btn-primary pear-btn-sm" id="$id" permission="app.admin.upload.file">
            <i class="layui-icon layui-icon-upload"></i>上传文件
        </button>
        <button type="button" class="pear-btn pear-btn-primary pear-btn-sm" id="attachment-choose-$id" permission="app.admin.upload.attachment">
            <i class="layui-icon layui-icon-align-left"></i>选择文件
        </button>
    </div>
</div>

EOF;
        $this->jsContent .= <<<EOF

// 字段 {$options['label']} $field
layui.use(["upload", "layer", "popup", "util"], function() {
    let input = layui.$("#$id").prev();
    input.prev().html(layui.util.escape(input.val()));
    layui.$("#attachment-choose-$id").on("click", function() {
        parent.layer.open({
            type: 2,
            title: "选择附件",
            content: "/app/admin/upload/attachment",
            area: ["95%", "90%"],
            success: function (layero, index) {
                parent.layui.$("#layui-layer" + index).data("callback", function (data) {
                    input.val(data.url).prev().html(layui.util.escape(data.url));
                });
            }
        });
    });
    layui.upload.render({
        elem: "#$id",$options_string
        done: function (res) {
            if (res.code) return layui.popup.failure(res.msg);
            this.item.prev().val(res.data.url).prev().html(layui.util.escape(res.data.url));
        }
    });
});

EOF;
    }

    /**
     * 图片上传组件
     * @param $options
     * @return void
     */
    public function uploadImage($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);
        $props['acceptMime'] = $props['acceptMime'] ?? 'image/gif,image/jpeg,image/jpg,image/png';
        $props['url'] = $props['url'] ?? '/app/admin/upload/image';
        $props['multiple'] = $props['multiple'] ?? 0;

        $id = $this->createId($field);

        unset($props['lay-verify']);
        $props['field'] = $props['field'] ?? '__file__';
        $options_string = '';
        $props = $this->prepareProps($props);
        $options_string .= "\n" . $this->preparePropsToJsObject($props, 1, true);

        if ($props['multiple'] == 0) {
            $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <img class="img-3" src=""/>
        <input type="text" style="display:none" name="$field" value="$value" />
        <button type="button" class="pear-btn pear-btn-primary pear-btn-sm" id="$id"  permission="app.admin.upload.image">
            <i class="layui-icon layui-icon-upload"></i>上传图片
        </button>
        <button type="button" class="pear-btn pear-btn-primary pear-btn-sm" id="attachment-choose-$id"  permission="app.admin.upload.attachment">
            <i class="layui-icon layui-icon-align-left"></i>选择图片
        </button>
    </div>
</div>

EOF;
            $this->jsContent .= <<<EOF

// 字段 {$options['label']} $field
layui.use(["upload", "layer"], function() {
    let input = layui.$("#$id").prev();
    input.prev().attr("src", input.val());
    layui.$("#attachment-choose-$id").on("click", function() {
        parent.layer.open({
            type: 2,
            title: "选择附件",
            content: "/app/admin/upload/attachment?ext=jpg,jpeg,png,gif,bmp",
            area: ["95%", "90%"],
            success: function (layero, index) {
                parent.layui.$("#layui-layer" + index).data("callback", function (data) {
                    input.val(data.url).prev().attr("src", data.url);
                });
            }
        });
    });
    layui.upload.render({
        elem: "#$id",$options_string
        done: function (res) {
            if (res.code > 0) return layui.layer.msg(res.msg);
            this.item.prev().val(res.data.url).prev().attr("src", res.data.url);
        }
    });
});

EOF;
        } else {
            $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
    
        <div class="layui-upload">
           <input type="text" class="uploader-list" style="display:none" name="$field" value="$value" id="$id"/>
           <blockquote class="layui-elem-quote layui-quote-nm" style="margin-top: 10px;">
               预览图：
               <div class="layui-upload-list uploader-list" style="overflow: auto;" id="uploader-list-$id">
               </div>
           </blockquote>

           <button type="button" class="pear-btn pear-btn-primary pear-btn-sm" id="multi-upload-$id" permission="app.admin.upload.image">
               <i class="layui-icon layui-icon-upload"></i>多图上传
           </button>
           
           <button type="button" class="pear-btn pear-btn-primary pear-btn-sm" id="attachment-choose-$id"  permission="app.admin.upload.attachment">
            <i class="layui-icon layui-icon-align-left"></i>选择图片
          </button>
       </div>
    </div>
</div>

EOF;
            $this->jsContent .= <<<EOF

// 字段 {$options['label']} $field
layui.use(["upload", "layer"], function() {
    var upload = layui.upload;
    var $ = layui.$;
    let multiple_images = layui.$("#$id").attr("value") ? layui.$("#$id").attr("value").split(",") : [];
    
    
    $("#attachment-choose-$id").on("click", function() {
        parent.layer.open({
            type: 2,
            title: "选择附件",
            content: "/app/admin/upload/attachment?ext=jpg,jpeg,png,gif,bmp",
            area: ["95%", "90%"],
            success: function (layero, index) {
                parent.layui.$("#layui-layer" + index).data("callback", function (data) {
                            //上传完毕
       $('#uploader-list-$id').append(
           '<div class="file-iteme">' +
           '<div class="handle"><i class="layui-icon layui-icon-delete"></i></div>' +
           '<img src='+ data.url +' alt="'+ data.name +'" >' +
           '</div>'
       );

       //追加图片成功追加文件名至图片容器
       multiple_images.push(data.url);
       $('#$id').val(multiple_images);
                });
            }
        });
    });
    
    upload.render({
        elem: '#multi-upload-$id',$options_string
        before: function(obj){
       layer.msg('图片上传中...', {
           icon: 16,
           shade: 0.01,
           time: 0
       })
   },
   done: function(res){
       layer.close(layer.msg());//关闭上传提示窗口
       //上传完毕
       $('#uploader-list-$id').append(
           '<div class="file-iteme">' +
           '<div class="handle"><i class="layui-icon layui-icon-delete"></i></div>' +
           '<img src='+ res.data.url +' alt="'+ res.data.name +'" >' +
           '</div>'
       );

       //追加图片成功追加文件名至图片容器
       multiple_images.push(res.data.url);
       $('#$id').val(multiple_images);
   }
});

//鼠标悬浮事件
$(document).on("mouseenter mouseleave", ".file-iteme", function(event){
   if(event.type === "mouseenter"){
       //鼠标悬浮
       $(this).children(".info").fadeIn("fast");
       $(this).children(".handle").fadeIn("fast");
   }else if(event.type === "mouseleave") {
       //鼠标离开
       $(this).children(".info").hide();
       $(this).children(".handle").hide();
   }
});

// 删除图片
$(document).on("click", ".file-iteme .handle", function(event){
   var delImg = $(this).parent().children("img").attr("src")
   var index = multiple_images.indexOf(delImg);
   if (index !== -1) {
       multiple_images.splice(index, 1);
   }
   //重新赋值
   $('#$id').val(multiple_images);
   //删除标签
   $(this).parent().remove();
});
//多图上传 end

});

EOF;
        }


    }

    /**
     * 日期时间选择组件
     * @param $options
     * @return void
     */
    public function dateTimePicker($options)
    {
        $options['props']['type'] = 'datetime';
        $this->datePicker($options);
    }

    /**
     * 日期选择组件
     * @param $options
     * @return void
     */
    public function datePicker($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);
        $value_string = $value ? ' value="' . $value . '"' : '';
        $options_string = '';
        unset($props['required'], $props['lay-verify'], $props['value']);
        $props = $this->prepareProps($props);
        $options_string .= "\n" . $this->preparePropsToJsObject($props, 1, true);
        $id = $this->createId($field);

        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <input type="text" name="$field" id="$id"$value_string$required_string$verify_string autocomplete="off" class="layui-input">
    </div>
</div>

EOF;
        $this->jsContent .= <<<EOF

// 字段 {$options['label']} $field
layui.use(["laydate"], function() {
    layui.laydate.render({
        elem: "#$id",$options_string
    });
})

EOF;
    }

    /**
     * 日期时间范围选择组件
     * @param $options
     * @return void
     */
    public function dateTimePickerRange($options)
    {
        $options['props']['type'] = 'datetime';
        $this->datePickerRange($options);
    }

    /**
     * 日期范围选择组件
     * @param $options
     * @return void
     */
    public function datePickerRange($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);
        if (!isset($options['props']['type'])) {
            $options['props']['type'] = 'date';
        }
        $options_string = '';
        unset($props['required'], $props['lay-verify'], $props['value']);
        $props = $this->prepareProps($props);
        $options_string .= "\n" . $this->preparePropsToJsObject($props, 1, true);
        $id = $this->createId($field);
        $id_start = "$id-date-start";
        $id_end = "$id-date-end";
        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <div class="layui-input-block" id="$id">
            <input type="text" autocomplete="off" name="{$field}[]" id="$id_start" class="layui-input inline-block" placeholder="开始时间">
            -
            <input type="text" autocomplete="off" name="{$field}[]" id="$id_end" class="layui-input inline-block" placeholder="结束时间">
        </div>
    </div>
</div>

EOF;
        $this->jsContent .= <<<EOF

// 字段 {$options['label']} $field
layui.use(["laydate"], function() {
    layui.laydate.render({
        elem: "#$id",
        range: ["#$id_start", "#$id_end"],$options_string
    });
})

EOF;
    }

    /**
     * 创建id
     * @param $field
     * @return mixed
     */
    protected function createId($field)
    {
        return $field;
    }

    /**
     * 图标选择组件
     * @param $options
     * @return void
     */
    public function iconPicker($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);

        $value_string = $value ? ' value="' . $value . '"' : '';
        $id = $this->createId($field);
        $options_string = '';
        $props = $this->prepareProps($props);
        $options_string .= "\n" . $this->preparePropsToJsObject($props, 1, true);

        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <input name="$field" id="$id"$value_string$required_string$verify_string />
    </div>
</div>

EOF;

        $this->jsContent .= <<<EOF

// 字段 {$options['label']} $field
layui.use(["iconPicker"], function() {
    layui.iconPicker.render({
        elem: "#$id",
        type: "fontClass",
        page: false,$options_string
    });
});

EOF;

    }

    /**
     * switch组件
     * @param $options
     * @return void
     */
    public function switch($options)
    {
        [$label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);

        $value = (int)$value;
        $disabled_string = !empty($props['disabled']) ? ' disabled' : '';
        $lay_text = !empty($props['lay-text']) ? "lay-text=\"{$props['lay-text']}\"" : '';

        $id = $this->createId($field);

        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $label
    <div class="$class">
        <input type="checkbox" id="$id" lay-filter="$field"$disabled_string$required_string lay-skin="switch" $lay_text/>
        <input type="text" style="display:none" name="$field" value="$value"$required_string />
    </div>
</div>

EOF;

        $this->jsContent .= <<<EOF

// 字段 {$options['label']} $field
layui.use(["form"], function() {
    layui.$("#$id").attr("checked", layui.$('input[name="$field"]').val() != 0);
    layui.form.render();
    layui.form.on("switch($field)", function(data) {
        layui.$('input[name="$field"]').val(this.checked ? 1 : 0);
    });
})

EOF;

    }

    /**
     * 下拉选择组件
     * @return void
     */
    public function select($options)
    {
        $options['props']['model'] = array_merge_recursive([
            'icon' => 'hidden',
            'label' => [
                'type' => 'text',
            ]
        ], $options['props']['model'] ?? []);
        $options['props']['clickClose'] = $options['props']['clickClose'] ?? true;
        $options['props']['radio'] = $options['props']['radio'] ?? true;
        $this->apiSelect($options);
    }

    /**
     * 下拉多选组件
     * @return void
     */
    public function selectMulti($options)
    {
        $options['props']['toolbar'] = array_merge_recursive([
            'show' => true,
            'list' => ['ALL', 'CLEAR', 'REVERSE']
        ], $options['props']['toolbar'] ?? []);
        $this->apiSelect($options);
    }

    /**
     * 树单选组件
     * @return void
     */
    public function treeSelect($options)
    {
        $options['props']['model'] = array_merge_recursive([
            'icon' => 'hidden',
            'label' => [
                'type' => 'text',
            ]
        ], $options['props']['model'] ?? []);
        $options['props']['clickClose'] = $options['props']['clickClose'] ?? true;
        $options['props']['radio'] = $options['props']['radio'] ?? true;
        $options['props']['tree'] = array_merge_recursive([
            '$show' => true,
            '$strict' => false,
            '$clickCheck' => true,
            '$clickExpand' => false,
            '$expandedKeys' => '$initValue'
        ], $options['props']['tree'] ?? []);
        $this->apiSelect($options);
    }

    /**
     * 树多选组件
     * @return void
     */
    public function treeSelectMulti($options)
    {
        $options['props']['tree'] = array_merge_recursive(['show' => true,
            '$expandedKeys' => '$initValue'], $options['props']['tree'] ?? []);
        $options['props']['toolbar'] = array_merge_recursive([
            '$show' => true,
            '$list' => ['ALL', 'CLEAR', 'REVERSE']
        ], $options['props']['toolbar'] ?? []);
        $this->apiSelect($options);
    }

    /**
     * 选择框，支持单选、多选、树形选择
     * @see https://maplemei.gitee.io/xm-select/
     * @param $options
     * @return void
     */
    public function apiSelect($options)
    {
        [$select_label, $field, $value, $props, $verify_string, $required_string, $class] = $this->options($options);

        $default_value_string = isset($props['initValue']) && $props['initValue'] != '' ? $props['initValue'] : $value;
        $url = $props['url'] ?? '';
        $options_string = '';
        if (isset($props['lay-verify'])) {
            $props['layVerify'] = $props['lay-verify'];
        }
        unset($props['lay-verify'], $props['url']);
        foreach ($props as $key => $item) {
            if (is_array($item)) {
                $item = json_encode($item, JSON_UNESCAPED_UNICODE);
                $item = preg_replace('/"\$([^"]+)"/', '$1', $item);
                $options_string .= "\n" . ($url ? '                ' : '        ') . "$key: $item,";
            } else if (is_string($item)) {
                $options_string .= "\n" . ($url ? '                ' : '        ') . "$key: \"$item\",";
            } else {
                $options_string .= "\n" . ($url ? '                ' : '        ') . "$key: " . var_export($item, true) . ',';
            }
        }

        $id = $this->createId($field);
        if ($url) {
            $this->jsContent .= <<<EOF

// 字段 {$options['label']} $field
layui.use(["jquery", "xmSelect", "popup"], function() {
    layui.$.ajax({
        url: "$url",
        dataType: "json",
        success: function (res) {
            let value = layui.$("#$id").attr("value");
            let initValue = value ? value.split(",") : [];
            layui.xmSelect.render({
                el: "#$id",
                name: "$field",
                initValue: initValue,
                filterable: true,
                data: res.data, $options_string
            });
            if (res.code) {
                layui.popup.failure(res.msg);
            }
        }
    });
});

EOF;
        } else {
            $this->jsContent .= <<<EOF

// 字段 {$options['label']} $field
layui.use(["jquery", "xmSelect"], function() {
    let value = layui.$("#$id").attr("value");
    let initValue = value ? value.split(",") : [];
    layui.xmSelect.render({
        el: "#$id",
        name: "$field",
        filterable: true,
        initValue: initValue,$options_string
    })
});

EOF;
        }

        $this->htmlContent .= <<<EOF

<div class="layui-form-item">
    $select_label
    <div class="$class">
        <div name="$field" id="$id"$required_string value="$default_value_string" ></div>
    </div>
</div>

EOF;

    }

    /**
     * 构建表单
     * @param $table
     * @param string $type
     * @return Layui
     * @throws BusinessException
     */
    public static function buildForm($table, string $type = 'insert'): Layui
    {
        if (!in_array($type, ['insert', 'update', 'search'])) {
            $type = 'insert';
        }
        $filter = $type === 'search' ? 'searchable' : 'form_show';
        $form = new Layui();
        $schema = Util::getSchema($table);
        $forms = $schema['forms'];
        $columns = $schema['columns'];
        $primary_key = $schema['table']['primary_key'][0] ?? null;

        foreach ($forms as $key => $info) {
            if (empty($info[$filter])) {
                continue;
            }
            $field = $info['field'];
            $default = $columns[$key]['default'];
            $control = strtolower($info['control']);
            $auto_increment = $columns[$key]['auto_increment'];
            // 搜索框里上传组件替换为input
            if ($type == 'search' && in_array($control, ['upload', 'uploadimg'])) {
                $control = 'input';
                $info['control_args'] = '';
            }
            if ($type === 'search' && $control === 'switch') {
                $control = 'select';
                if (preg_match('/lay-text:(.+?)\|([^;]+)/', $info['control_args'], $matches)) {
                    $info['control_args'] = 'data:1:' . $matches[1] . ',0:' . $matches[2];
                } else {
                    $info['control_args'] = 'data:1:是,0:否';
                }
            }

            $props = Util::getControlProps($control, $info['control_args']);
            // 增加修改记录验证必填项
            if ($filter == 'form_show' && !$columns[$key]['nullable'] && $default === null && ($field !== 'password' || $type === 'insert')) {
                if (!isset($props['lay-verify'])) {
                    $props['lay-verify'] = 'required';
                    // 非类似字符串类型不允许传空
                } elseif (!in_array($columns[$key]['type'], ['string', 'text', 'mediumText', 'longText', 'char', 'binary', 'json'])
                    && strpos($props['lay-verify'], 'required') === false) {
                    $props['lay-verify'] = 'required|' . $props['lay-verify'];
                }
            }
            // 增加记录显示默认值
            if ($type === 'insert' && !isset($props['value']) && $default !== null) {
                $props['value'] = $default;
            }
            // 主键是自增字段或者表单是更新类型不显示主键
            if ($primary_key && $field == $primary_key && (($type == 'insert' && $auto_increment) || $type == 'update')) {
                continue;
            }
            // 查询类型
            if ($type == 'search') {
                if ($info['search_type'] == 'between' && method_exists($form, "{$control}Range")) {
                    $control = "{$control}Range";
                } elseif ($info['search_type'] == 'like' && method_exists($form, "{$control}Like")) {
                    $control = "{$control}Like";
                }
            }
            // 查询类型移除lay-verify
            if ($type == 'search' && !empty($props['lay-verify'])) {
                $props['lay-verify'] = '';
            }

            $options = [
                'label' => $info['comment'] ?: $field,
                'field' => $field,
                'props' => $props,
            ];

            $form->{$control}($options);
        }
        return $form;
    }

    /**
     * 构建表格
     * @param $table
     * @param int $indent
     * @return array|string|string[]
     * @throws BusinessException
     */
    public static function buildTable($table, int $indent = 0)
    {
        $schema = Util::getSchema($table);
        $forms = $schema['forms'];

        $codes = '';
        $cols = '';
        $api = '';
        $api_result = '';

        foreach ($forms as $info) {
            $title = $info['comment'] ?: $info['field'];
            $hide_str = $info['list_show'] ? '' : "\n		hide: true,";
            $sort_str = $info['enable_sort'] ? "\n		sort: true," : '';
            $field = $info['field'];
            $templet = '';
            $schema = <<<EOF
title: "$title",align: "center",
		field: "$field",$hide_str$sort_str
EOF;

            $control = strtolower($info['control']);
            switch ($control) {
                case 'switch':
                    $props = Util::getControlProps($info['control'], $info['control_args']);
                    $lay_text = $props['lay-text'] ?? '';
                    $templet = <<<EOF

		templet: function (d) {
			let field = "$field";
			form.on("switch("+field+")", function (data) {
				let load = layer.load();
				let postData = {};
				postData[field] = data.elem.checked ? 1 : 0;
				postData[PRIMARY_KEY] = this.value;
				$.post(UPDATE_API, postData, function (res) {
					layer.close(load);
					if (res.code) {
                        return layui.popup.failure(res.msg, function () {
                            data.elem.checked = !data.elem.checked;
                            form.render();
                        });
                    }
					return layui.popup.success("操作成功");
				})
			});
			let checked = d[field] === 1 ? "checked" : "";
			return '<input type="checkbox" value="'+util.escape(d[PRIMARY_KEY])+'" lay-filter="'+util.escape(field)+'" lay-skin="switch" lay-text="'+util.escape('$lay_text')+'" '+checked+'/>';
		}
EOF;
                    break;

                case 'iconpicker':
                    $templet = <<<EOF

		templet: function (d) {
			return '<i class="layui-icon ' + util.escape(d['$field']) + '"></i>';
		}
EOF;
                    break;
                case 'upload':
                    $templet = <<<EOF

		templet: function (d) {
			return '<a href="' + encodeURI(d['$field']) + '" target="_blank">' + util.escape(d['$field']) + '</a>';
		}
EOF;
                    break;
                case 'uploadimage':
                    $props = Util::getControlProps($info['control'], $info['control_args']);
                    $multiple = $props['multiple'] ?? 0;
                    if ($multiple == 0) {
                        $templet = <<<EOF

		templet: function (d) {
			return '<img src="'+encodeURI(d['$field'])+'" style="max-width:32px;max-height:32px;" alt="" />'
		}
EOF;
                    } else {
                        $templet = <<<EOF

		                templet: function (d) {
		                    let html = '';
		                    if(d['$field']){
		                    const images = d['$field'].split(',');
                        
                            for (let img of images) {
                                html += '<img src="' + encodeURI(img.trim()) + '" style="max-width:32px;max-height:32px;" alt="" />';
                            }
		                    }
                            
                            return html;
						}
EOF;
                    }
                    break;

            }

            if (in_array($control, ['select', 'selectmulti', 'treeselect', 'treeselectmulti'])) {
                $props = Util::getControlProps($info['control'], $info['control_args']);

                if (isset($props['url'])) {
                    $api .= "\napis.push([\"$field\", \"{$props['url']}\"]);";
                    $api_result .= "\napiResults[\"$field\"] = [];";
                } else if (!empty($props['data'])) {
                    $options = [];
                    foreach ($props['data'] as $option) {
                        if (isset($option['value']) && isset($option['name'])) {
                            $options[$option['value']] = $option['name'];
                        }
                    }
                    $api_result .= "\napiResults[\"$field\"] = " . json_encode($options, JSON_UNESCAPED_UNICODE) . ';';
                } else {
                    $api_result .= "\napiResults[\"$field\"] = [];";
                }

                $templet = <<<EOF

		templet: function (d) {
			let field = "$field";
			if (typeof d[field] == "undefined") return "";
			let items = [];
			layui.each((d[field] + "").split(","), function (k , v) {
				items.push(apiResults[field][v] || v);
			});
			return util.escape(items.join(","));
		}
EOF;

            }

            $cols .= <<<EOF
,{
		$schema$templet
	}
EOF;

        }

        $cols = <<<EOF

// 表头参数
let cols = [
	{
		type: "checkbox",
		align: "center"
	}$cols,{
		title: "操作",
		toolbar: "#table-bar",
		align: "center",
		fixed: "right",
		width: 120,
	}
];

EOF;
        if (!$api && $api_result) {
            $codes = <<<EOF
// 获取表格中下拉或树形组件数据
let apiResults = {};$api_result
EOF;
        } else if ($api && !$api_result) {
            $codes = <<<EOF
// 获取表格中下拉或树形组件数据
let apis = [];$api
EOF;
        } else if ($api && $api_result) {
            $codes = <<<EOF
// 获取表格中下拉或树形组件数据
let apis = [];$api
let apiResults = {};$api_result
EOF;
        }

        if ($api) {
            $codes = <<<EOF
$cols
// 渲染表格
function render()
{
    table.render({
        elem: "#data-table",
        url: SELECT_API,
        page: true,
        cols: [cols],
        skin: "line",
        size: "lg",
        toolbar: "#table-toolbar",
        autoSort: false,
        defaultToolbar: [{
            title: "刷新",
            layEvent: "refresh",
            icon: "layui-icon-refresh",
        }, "filter", "print", "exports"],
        done: function () {
            layer.photos({photos: 'div[lay-id="data-table"]', anim: 5});
        }
    });
}

$codes
let count = apis.length;
layui.each(apis, function (k, item) {
    let [field, url] = item;
    $.ajax({
        url: url,
        dateType: "json",
        success: function (res) {
            if (res.code) {
                return layui.popup.failure(res.msg);
            }
            function travel(items) {
                for (let k in items) {
                    let item = items[k];
                    apiResults[field][item.value] = item.name;
                    if (item.children) {
                        travel(item.children);
                    }
                }
            }
            travel(res.data);
        },
        complete: function () {
            if (--count === 0) {
                render();
            }
        }
    });
});
if (!count) {
    render();
}

EOF;

        } else {
            $codes = <<<EOF
$cols
// 渲染表格
table.render({
    elem: "#data-table",
    url: SELECT_API,
    page: true,
    cols: [cols],
    skin: "line",
    size: "lg",
    toolbar: "#table-toolbar",
    autoSort: false,
    defaultToolbar: [{
        title: "刷新",
        layEvent: "refresh",
        icon: "layui-icon-refresh",
    }, "filter", "print", "exports"],
    done: function () {
        layer.photos({photos: 'div[lay-id="data-table"]', anim: 5});
    }
});

$codes
EOF;

        }

        return str_replace("\n", "\n" . str_repeat('	', $indent), $codes);

    }

    /**
     * 预处理props
     */
    private function prepareProps($props)
    {
        $raw_list = ['true', 'false', 'null', 'undefined'];
        foreach ($props as $k => $v) {
            if (is_array($v)) {
                $props[$k] = $this->prepareProps($v);
            } elseif (!in_array($v, $raw_list) && !is_numeric($v)) {
                if (strpos($v, '#') === 0) {
                    $props[$k] = substr($v, 1);
                } else {
                    $props[$k] = "\"$v\"";
                }
            }
        }
        return $props;
    }

    private function preparePropsToJsObject($props, $indent = 0, $sub = false)
    {
        $string = '';
        $indent_string = str_repeat('    ', $indent);
        if (!$sub) {
            $string .= "$indent_string{\n";
        }
        foreach ($props as $k => $v) {
            if (!preg_match('#^[a-zA-Z0-9_]+$#', $k)) {
                $k = "'$k'";
            }
            if (is_array($v)) {
                $string .= "$indent_string    $k: {\n{$this->preparePropsToJsObject($v, $indent + 1, true)}\n$indent_string    },\n";
            } else {
                $string .= "$indent_string    $k: $v,\n";
            }
        }
        if (!$sub) {
            $string .= "$indent_string}\n";
        }
        return trim($string, "\n");
    }


}
