<?php

namespace plugin\admin\app\controller;

use plugin\admin\app\common\Auth;
use plugin\admin\app\model\Admin;
use plugin\admin\app\model\AdminRole;
use support\exception\BusinessException;
use support\Request;
use support\Response;
use Throwable;

/**
 * 管理员列表 
 */
class AdminController extends Crud
{
    /**
     * 不需要鉴权的方法
     * @var array
     */
    protected $noNeedAuth = ['select'];

    /**
     * @var Admin
     */
    protected $model = null;

    /**
     * 开启auth数据限制
     * @var string
     */
    protected $dataLimit = 'auth';

    /**
     * 以id为数据限制字段
     * @var string
     */
    protected $dataLimitField = 'id';

    /**
     * 构造函数
     * @return void
     */
    public function __construct()
    {
        $this->model = new Admin;
    }

    /**
     * 浏览
     * @return Response
     * @throws Throwable
     */
    public function index(): Response
    {
        return raw_view('admin/index');
    }

    /**
     * 查询
     * @param Request $request
     * @return Response
     * @throws BusinessException
     */
    public function select(Request $request): Response
    {
        [$where, $format, $limit, $field, $order] = $this->selectInput($request);
        $query = $this->doSelect($where, $field, $order);
        if ($format === 'select') {
            return $this->formatSelect($query->get());
        }
        $paginator = $query->paginate($limit);
        $items = $paginator->items();
        $admin_ids = array_column($items, 'id');
        $roles = AdminRole::whereIn('admin_id', $admin_ids)->get();
        $roles_map = [];
        foreach ($roles as $role) {
            $roles_map[$role['admin_id']][] = $role['role_id'];
        }
        $login_admin_id = admin_id();
        foreach ($items as $index => $item) {
            $admin_id = $item['id'];
            $items[$index]['roles'] = isset($roles_map[$admin_id]) ? implode(',', $roles_map[$admin_id]) : '';
            $items[$index]['show_toolbar'] = $admin_id != $login_admin_id;
        }
        return json(['code' => 0, 'msg' => 'ok', 'count' => $paginator->total(), 'data' => $items]);
    }

    /**
     * 插入
     * @param Request $request
     * @return Response
     * @throws BusinessException|Throwable
     */
    public function insert(Request $request): Response
    {
        if ($request->method() === 'POST') {
            $data = $this->insertInput($request);
            unset($data['id']);
            $admin_id = $this->doInsert($data);
            $role_ids = $request->post('roles');
            $role_ids = $role_ids ? explode(',', $role_ids) : [];
            if (!$role_ids) {
                return $this->json(1, '至少选择一个角色组');
            }
            if (!Auth::isSuperAdmin() && array_diff($role_ids, Auth::getScopeRoleIds())) {
                return $this->json(1, '角色超出权限范围');
            }
            AdminRole::where('admin_id', $admin_id)->delete();
            foreach ($role_ids as $id) {
                $admin_role = new AdminRole;
                $admin_role->admin_id = $admin_id;
                $admin_role->role_id = $id;
                $admin_role->save();
            }
            return $this->json(0, 'ok', ['id' => $admin_id]);
        }
        return raw_view('admin/insert');
    }

    /**
     * 更新
     * @param Request $request
     * @return Response
     * @throws BusinessException|Throwable
     */
    public function update(Request $request): Response
    {
        if ($request->method() === 'POST') {

            [$id, $data] = $this->updateInput($request);
            $admin_id = $request->post('id');
            if (!$admin_id) {
                return $this->json(1, '缺少参数');
            }

            // 不能禁用自己
            if (isset($data['status']) && $data['status'] == 1 && $id == admin_id()) {
                return $this->json(1, '不能禁用自己');
            }

            // 需要更新角色
            $role_ids = $request->post('roles');
            if ($role_ids !== null) {
                if (!$role_ids) {
                    return $this->json(1, '至少选择一个角色组');
                }
                $role_ids = explode(',', $role_ids);

                $is_supper_admin = Auth::isSuperAdmin();
                $exist_role_ids = AdminRole::where('admin_id', $admin_id)->pluck('role_id')->toArray();
                $scope_role_ids = Auth::getScopeRoleIds();
                if (!$is_supper_admin && !array_intersect($exist_role_ids, $scope_role_ids)) {
                    return $this->json(1, '无权限更改该记录');
                }
                if (!$is_supper_admin && array_diff($role_ids, $scope_role_ids)) {
                    return $this->json(1, '角色超出权限范围');
                }

                // 删除账户角色
                $delete_ids = array_diff($exist_role_ids, $role_ids);
                AdminRole::whereIn('role_id', $delete_ids)->where('admin_id', $admin_id)->delete();
                // 添加账户角色
                $add_ids = array_diff($role_ids, $exist_role_ids);
                foreach ($add_ids as $role_id) {
                    $admin_role = new AdminRole;
                    $admin_role->admin_id = $admin_id;
                    $admin_role->role_id = $role_id;
                    $admin_role->save();
                }
            }

            $this->doUpdate($id, $data);
            return $this->json(0);
        }

        return raw_view('admin/update');
    }

    /**
     * 删除
     * @param Request $request
     * @return Response
     */
    public function delete(Request $request): Response
    {
        $primary_key = $this->model->getKeyName();
        $ids = $request->post($primary_key);
        if (!$ids) {
            return $this->json(0);
        }
        $ids = (array)$ids;
        if (in_array(admin_id(), $ids)) {
            return $this->json(1, '不能删除自己');
        }
        if (!Auth::isSuperAdmin() && array_diff($ids, Auth::getScopeAdminIds())) {
            return $this->json(1, '无数据权限');
        }
        $this->model->whereIn($primary_key, $ids)->each(function (Admin $admin) {
            $admin->delete();
        });
        AdminRole::whereIn('admin_id', $ids)->each(function (AdminRole $admin_role) {
            $admin_role->delete();
        });
        return $this->json(0);
    }


}
