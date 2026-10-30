<?php

namespace plugin\admin\app\controller;

use Exception;
use Intervention\Image\ImageManagerStatic as Image;
use plugin\admin\app\model\Upload;
use support\exception\BusinessException;
use support\Request;
use support\Response;
use Throwable;

/**
 * 附件管理
 */
class UploadController extends Crud
{
    /**
     * @var Upload
     */
    protected $model = null;

    /**
     * 只返回当前管理员数据
     * @var string
     */
    protected $dataLimit = 'personal';

    /**
     * 构造函数
     * @return void
     */
    public function __construct()
    {
        $this->model = new Upload;
    }

    /**
     * 浏览
     * @return Response
     * @throws Throwable
     */
    public function index(): Response
    {
        return raw_view('upload/index');
    }

    /**
     * 浏览附件
     * @return Response
     * @throws Throwable
     */
    public function attachment(): Response
    {
        return raw_view('upload/attachment');
    }

    /**
     * 查询附件
     * @param Request $request
     * @return Response
     * @throws BusinessException
     */
    public function select(Request $request): Response
    {
        [$where, $format, $limit, $field, $order] = $this->selectInput($request);
        if (!empty($where['ext']) && is_string($where['ext'])) {
            $where['ext'] = ['in', explode(',', $where['ext'])];
        }
        if (!empty($where['name']) && is_string($where['name'])) {
            $where['name'] = ['like', "%{$where['name']}%"];
        }
        $query = $this->doSelect($where, $field, $order);
        return $this->doFormat($query, $format, $limit);
    }

    /**
     * 更新附件
     * @param Request $request
     * @return Response
     * @throws BusinessException|Throwable
     */
    public function update(Request $request): Response
    {
        if ($request->method() === 'GET') {
            return raw_view('upload/update');
        }
        return parent::update($request);
    }

    /**
     * 添加附件
     * @param Request $request
     * @return Response
     * @throws Exception|Throwable
     */
    public function insert(Request $request): Response
    {
        if ($request->method() === 'GET') {
            return raw_view('upload/insert');
        }
        $file = current($request->file());
        if (!$file || !$file->isValid()) {
            return $this->json(1, '未找到文件');
        }
        $data = $this->base($request, '/upload/files/' . date('Ymd'));
        $upload = new Upload;
        $upload->admin_id = admin_id();
        $upload->name = $data['name'];
        [
            $upload->url,
            $upload->name,
            $_,
            $upload->file_size,
            $upload->mime_type,
            $upload->image_width,
            $upload->image_height,
            $upload->ext
        ] = array_values($data);
        $upload->category = $request->post('category');
        $upload->save();
        return $this->json(0, '上传成功', [
            'url' => $data['url'],
            'name' => $data['name'],
            'size' => $data['size'],
        ]);
    }

    /**
     * 上传文件
     * @param Request $request
     * @return Response
     * @throws Exception
     */
    public function file(Request $request): Response
    {
        $file = current($request->file());
        if (!$file || !$file->isValid()) {
            return $this->json(1, '未找到文件');
        }
        $img_exts = [
            'jpg',
            'jpeg',
            'png',
            'gif'
        ];
        if (in_array($file->getUploadExtension(), $img_exts)) {
            return $this->image($request);
        }
        $data = $this->base($request, '/upload/files/' . date('Ymd'));
        return $this->json(0, '上传成功', [
            'url' => $data['url'],
            'name' => $data['name'],
            'size' => $data['size'],
        ]);
    }

    /**
     * 上传图片
     * @param Request $request
     * @return Response
     * @throws Exception
     */
    public function image(Request $request): Response
    {
        $data = $this->base($request, '/upload/img/' . date('Ymd'));
        $realpath = $data['realpath'];
        try {
            $img = Image::make($realpath);
            $max_height = 1170;
            $max_width = 1170;
            $width = $img->width();
            $height = $img->height();
            $ratio = 1;
            if ($height > $max_height || $width > $max_width) {
                $ratio = $width > $height ? $max_width / $width : $max_height / $height;
            }
            $img->resize($width * $ratio, $height * $ratio)->save($realpath);
        } catch (Exception $e) {
            unlink($realpath);
            return json([
                'code' => 500,
                'msg' => '处理图片发生错误'
            ]);
        }
        return json([
            'code' => 0,
            'msg' => '上传成功',
            'data' => [
                'url' => $data['url'],
                'name' => $data['name'],
                'size' => $data['size'],
            ]
        ]);
    }

    /**
     * 上传头像
     * @param Request $request
     * @return Response
     * @throws Exception
     */
    public function avatar(Request $request): Response
    {
        $file = current($request->file());
        if ($file && $file->isValid()) {
            $ext = strtolower($file->getUploadExtension());
            if (!in_array($ext, ['jpg', 'jpeg', 'gif', 'png'])) {
                return json(['code' => 2, 'msg' => '仅支持 jpg jpeg gif png格式']);
            }
            $image = Image::make($file);
            $width = $image->width();
            $height = $image->height();
            $size = min($width, $height);
            $relative_path = 'upload/avatar/' . date('Ym');
            $real_path = base_path() . "/plugin/admin/public/$relative_path";
            if (!is_dir($real_path)) {
                mkdir($real_path, 0777, true);
            }
            $name = bin2hex(pack('Nn', time(), random_int(1, 65535)));
            $ext = $file->getUploadExtension();

            $image->crop($size, $size)->resize(300, 300);
            $path = base_path() . "/plugin/admin/public/$relative_path/$name.lg.$ext";
            $image->save($path);

            $image->resize(120, 120);
            $path = base_path() . "/plugin/admin/public/$relative_path/$name.md.$ext";
            $image->save($path);

            $image->resize(60, 60);
            $path = base_path() . "/plugin/admin/public/$relative_path/$name.$ext";
            $image->save($path);

            $image->resize(30, 30);
            $path = base_path() . "/plugin/admin/public/$relative_path/$name.sm.$ext";
            $image->save($path);

            return json([
                'code' => 0,
                'msg' => '上传成功',
                'data' => [
                    'url' => "/app/admin/$relative_path/$name.md.$ext"
                ]
            ]);
        }
        return json(['code' => 1, 'msg' => 'file not found']);
    }

    /**
     * 删除附件
     * @param Request $request
     * @return Response
     * @throws BusinessException
     */
    public function delete(Request $request): Response
    {
        $ids = $this->deleteInput($request);
        $primary_key = $this->model->getKeyName();
        $files = $this->model->whereIn($primary_key, $ids)->get()->toArray();
        $file_list = array_map(function ($item) {
            $path = $item['url'];
            if (preg_match("#^/app/admin#", $path)) {
                $admin_public_path = config('plugin.admin.app.public_path') ?: base_path() . "/plugin/admin/public";
                return $admin_public_path . str_replace("/app/admin", "", $item['url']);
            }
            return null;
        }, $files);
        $file_list = array_filter($file_list, function ($item) {
            return !empty($item);
        });
        $result = parent::delete($request);
        if (($res = json_decode($result->rawBody())) && $res->code === 0) {
            foreach ($file_list as $file) {
                @unlink($file);
            }
        }
        return $result;
    }

    /**
     * 获取上传数据
     * @param Request $request
     * @param $relative_dir
     * @return array
     * @throws BusinessException|\Random\RandomException
     */
    protected function base(Request $request, $relative_dir): array
    {
        $relative_dir = ltrim($relative_dir, '\\/');
        $file = current($request->file());
        if (!$file || !$file->isValid()) {
            throw new BusinessException('未找到上传文件', 400);
        }

        $admin_public_path = rtrim(config('plugin.admin.app.public_path', ''), '\\/');
        $base_dir = $admin_public_path ? $admin_public_path . DIRECTORY_SEPARATOR : base_path() . '/plugin/admin/public/';
        $full_dir = $base_dir . $relative_dir;
        if (!is_dir($full_dir)) {
            mkdir($full_dir, 0777, true);
        }

        $ext = $file->getUploadExtension() ?: null;
        $mime_type = $file->getUploadMimeType();
        $file_name = $file->getUploadName();
        $file_size = $file->getSize();

        if (!$ext && $file_name === 'blob') {
            [$___image, $ext] = explode('/', $mime_type);
            unset($___image);
        }

        $ext = strtolower($ext);
        $ext_forbidden_map = ['php', 'php3', 'php5', 'css', 'js', 'html', 'htm', 'asp', 'jsp'];
        if (in_array($ext, $ext_forbidden_map)) {
            throw new BusinessException('不支持该格式的文件上传', 400);
        }

        $relative_path = $relative_dir . '/' . bin2hex(pack('Nn', time(), random_int(1, 65535))) . ".$ext";
        $full_path = $base_dir . $relative_path;
        $file->move($full_path);
        $image_with = $image_height = 0;
        if ($img_info = getimagesize($full_path)) {
            [$image_with, $image_height] = $img_info;
            $mime_type = $img_info['mime'];
        }
        return [
            'url' => "/app/admin/$relative_path",
            'name' => $file_name,
            'realpath' => $full_path,
            'size' => $file_size,
            'mime_type' => $mime_type,
            'image_with' => $image_with,
            'image_height' => $image_height,
            'ext' => $ext,
        ];
    }

}
