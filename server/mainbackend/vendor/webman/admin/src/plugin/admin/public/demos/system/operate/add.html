<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<title>新增页面</title>
		<link rel="stylesheet" href="../../../component/pear/css/pear.css" />
	</head>
	<body>
		<form class="layui-form" action="">
			<div class="mainBox">
				<div class="main-container">
					<div class="layui-form-item">
						<label class="layui-form-label">账号</label>
						<div class="layui-input-block">
							<input type="text" name="username" lay-verify="title" autocomplete="off" placeholder="请输入标题"
								class="layui-input">
						</div>
					</div>
					<div class="layui-form-item">
						<label class="layui-form-label">姓名</label>
						<div class="layui-input-block">
							<input type="text" name="realName" lay-verify="title" autocomplete="off" placeholder="请输入标题"
								class="layui-input">
						</div>
					</div>
					<div class="layui-form-item">
						<label class="layui-form-label">邮箱</label>
						<div class="layui-input-block">
							<input type="text" name="email" lay-verify="title" autocomplete="off" placeholder="请输入标题"
								class="layui-input">
						</div>
					</div>
					<div class="layui-form-item">
						<label class="layui-form-label">密码</label>
						<div class="layui-input-block">
							<input type="text" name="password" lay-verify="title" autocomplete="off" placeholder="请输入标题"
								class="layui-input">
						</div>
					</div>
					<div class="layui-form-item">
						<label class="layui-form-label">电话</label>
						<div class="layui-input-block">
							<input type="text" name="phone" lay-verify="title" autocomplete="off" placeholder="请输入标题"
								class="layui-input">
						</div>
					</div>
					<div class="layui-form-item">
						<label class="layui-form-label">性别</label>
						<div class="layui-input-block">
							<input type="radio" name="sex" value="0" title="男">
							<input type="radio" name="sex" value="1" title="女" checked>
						</div>
					</div>
				</div>
			</div>
			<div class="bottom">
				<div class="button-container">
					<button type="submit" class="pear-btn pear-btn-primary pear-btn-sm" lay-submit=""
						lay-filter="user-save">
						<i class="layui-icon layui-icon-ok"></i>
						提交
					</button>
					<button type="reset" class="pear-btn pear-btn-sm">
						<i class="layui-icon layui-icon-refresh"></i>
						重置
					</button>
				</div>
			</div>
		</form>
		<script src="../../../component/layui/layui.js"></script>
		<script src="../../../component/pear/pear.js"></script>
		<script>
			layui.use(['form', 'jquery'], function() {
				let form = layui.form;
				let $ = layui.jquery;

				form.on('submit(user-save)', function(data) {
					$.ajax({
						url: '/system/user/save',
						data: JSON.stringify(data.field),
						dataType: 'json',
						contentType: 'application/json',
						type: 'post',
						success: function(result) {
							if (result.success) {
								layer.msg(result.msg, {
									icon: 1,
									time: 1000
								}, function() {
									parent.layer.close(parent.layer.getFrameIndex(window
										.name)); //关闭当前页
									parent.layui.table.reload("user-table");
								});
							} else {
								layer.msg(result.msg, {
									icon: 2,
									time: 1000
								});
							}
						}
					})
					return false;
				});
			})
		</script>
		<script>
		</script>
	</body>
</html>
