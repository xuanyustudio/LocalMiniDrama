layui.define(['layer', 'form'], function(exports) {
	var layer = layui.layer,
		form = layui.form,
		$ = layui.$,
		key = '',
		allJS = '',
	    allHtml = '';
	    let module = ["form"];
	delHtml()
	$('button').on('click', function() {
		var _this = $(this),
			size = _this.data('size'),
			type = _this.data('type'),
			html = '';
		key = randStrName();
		switch (type) {
			case 'text':
				html = input(type, size)
				break;
			case 'password':
				html = input(type, size)
				break;
			case 'select':
				html = select(size)
				break;
			case 'checkbox_a':
				html = checkbox_a(size)
				break;
			case 'checkbox_b':
				html = checkbox_b(size)
				break;
			case 'radio':
				html = radio(size)
				break;
			case 'textarea':
				html = textarea(size)
				break;
			case 'icon':
				html = icon(size)
				$('form').append(html);
				form.render();
				setHtml(html);
				layui.use(['iconPicker'], function() {
					layui.iconPicker.render({
						elem: "#" + key,
						type: "fontClass",
					});
				});
				if (module.indexOf('iconPicker') === -1) module.push('iconPicker');
				allJS += '    // 图标选择\n' +
					'    layui.iconPicker.render({\n' +
					'       elem: "#' + key + '",\n' +
					'       type: "fontClass",\n' +
					'    });\n';
				$('.js-show').text(jscode())
				return;
			case 'multiSelect':
				html = multiSelect(size)
				$('form').append(html);
				form.render();
				setHtml(html);
				layui.use(['xmSelect'], function() {
					layui.xmSelect.render({
						el: "#" + key,
						name: key,
						data: [{value: 1, name: "深圳"},{value: 2, name: "上海"},{value: 3, name: "广州"}],
					});
				});
				if (module.indexOf('xmSelect') === -1) module.push('xmSelect');
				allJS += '    // 下拉多选\n' +
					'    layui.xmSelect.render({\n' +
					'       el: "#' + key + '",\n' +
					'       name: "' + key + '",\n' +
					'       data: [{value: 1, name: "深圳"},{value: 2, name: "上海"},{value: 3, name: "广州"}],\n' +
					'    });\n';
				$('.js-show').text(jscode())
				return;
			case 'tree':
				html = tree(size)
				$('form').append(html);
				form.render();
				setHtml(html);
				layui.use(['xmSelect'], function() {
					layui.xmSelect.render({
						el: "#" + key,
						name: key,
						tree: {show: true},
						data: [{value: 1, name: "广东省", children:[{value: 2, name: "深圳"},{value: 3, name: "广州"}]},{value: 4, name: "福建省", children:[{value: 5, name: "厦门"},{value: 6, name: "福州"}]}],
					});
				});
				if (module.indexOf('xmSelect') === -1) module.push('xmSelect');
				allJS += '    // 树多选\n' +
					'    layui.xmSelect.render({\n' +
					'       el: "#' + key + '",\n' +
					'       name: "' + key + '",\n' +
					'       tree: {show: true},\n' +
					'       data: [{value: 1, name: "广东省", children:[{value: 2, name: "深圳"},{value: 3, name: "广州"}]},{value: 4, name: "福建省", children:[{value: 5, name: "厦门"},{value: 6, name: "福州"}]}],\n' +
					'    });\n';
				$('.js-show').text(jscode())
				return;
			case 'treeSelectOne':
				html = treeSelectOne(size)
				$('form').append(html);
				form.render();
				setHtml(html);
				layui.use(['xmSelect'], function() {
					layui.xmSelect.render({
						el: "#" + key,
						name: key,
						model: {"icon":"hidden","label":{"type":"text"}},
						clickClose: true,
						radio: true,
						tree: {show: true, strict: false, clickCheck: true, clickExpand: false},
						data: [{value: 1, name: "广东省", children:[{value: 2, name: "深圳"},{value: 3, name: "广州"}]},{value: 4, name: "福建省", children:[{value: 5, name: "厦门"},{value: 6, name: "福州"}]}],
					});
				});
				if (module.indexOf('xmSelect') === -1) module.push('xmSelect');
				allJS += '    // 树多选\n' +
					'    layui.xmSelect.render({\n' +
					'       el: "#' + key + '",\n' +
					'       name: "' + key + '",\n' +
					'       model: {"icon":"hidden","label":{"type":"text"}},\n' +
					'       clickClose: true,\n' +
					'       radio: true,\n' +
					'       tree: {show: true, strict: false, clickCheck: true, clickExpand: false},\n' +
					'       data: [{value: 1, name: "广东省", children:[{value: 2, name: "深圳"},{value: 3, name: "广州"}]},{value: 4, name: "福建省", children:[{value: 5, name: "厦门"},{value: 6, name: "福州"}]}],\n' +
					'    });\n';
				$('.js-show').text(jscode())
				return;
			case 'upload':
				html = upload(size)
				$('form').append(html);
				form.render();
				setHtml(html);
				layui.use(['upload'], function() {
					let input = layui.$('#' + key).prev();
					input.prev().html(layui.util.escape(input.val()));
					layui.$("#attachment-choose-" + key).on('click', function() {
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
						elem: "#" + key,
						url: "/app/admin/upload/file",
						accept: "file",
						field: "__file__",
						done: function (res) {
							this.item.prev().val(res.data.url).prev().html(layui.util.escape(res.data.url));
						}
					});
				});
				if (module.indexOf('upload') === -1) module.push('upload');
				if (module.indexOf('util') === -1) module.push('util');
				allJS += '    // 上传文件\n' +
					'    layui.use([\'upload\'], function() {\n' +
					'      let input = layui.$("#'+key+'").prev();\n' +
					'      input.prev().html(layui.util.escape(input.val()));\n' +
					'      layui.$("#attachment-choose-'+key+'").on("click", function() {\n' +
					'        parent.layer.open({\n' +
					'          type: 2,\n' +
					'          title: "选择附件",\n' +
					'          content: "/app/admin/upload/attachment",\n' +
					'          area: ["95%", "90%"],\n' +
					'          success: function (layero, index) {\n' +
					'            parent.layui.$("#layui-layer" + index).data("callback", function (data) {\n' +
					'              input.val(data.url).prev().html(layui.util.escape(data.url));\n' +
					'            });\n' +
					'          }\n' +
					'        });\n' +
					'      });\n' +
					'    });\n' +
					'    layui.upload.render({\n' +
					'       elem: "#' + key + '",\n' +
					'       url: "/app/admin/upload/file",\n' +
					'       accept: "file",\n' +
					'       field: "__file__",\n' +
					'       done: function (res) {\n' +
					'         this.item.prev().val(res.data.url).prev().html(layui.util.escape(res.data.url));\n' +
					'       }\n' +
					'    });\n';
				$('.js-show').text(jscode())
				return;
			case 'uploadImg':
				html = uploadImg(size)
				$('form').append(html);
				form.render();
				setHtml(html);
				layui.use(['upload'], function() {
					let input = layui.$('#' + key).prev();
					input.prev().attr('src', input.val());
					layui.$('#attachment-choose-' + key).on('click', function() {
						parent.layer.open({
							type: 2,
							title: '选择附件',
							content: '/app/admin/upload/attachment?ext=jpg,jpeg,png,gif,bmp',
							area: ["95%", "90%"],
							success: function (layero, index) {
								parent.layui.$("#layui-layer" + index).data("callback", function (data) {
									input.val(data.url).prev().attr("src", data.url);
								});
							}
						});
					});
					layui.upload.render({
						elem: "#" + key,
						url: "/app/admin/upload/image",
						acceptMime: "image/gif,image/jpeg,image/jpg,image/png",
						field: "__file__",
						done: function (res) {
							this.item.prev().val(res.data.url).prev().attr('src', res.data.url);
						}
					});
				});
				if (module.indexOf('upload') === -1) module.push('upload');
				allJS += '    // 上传图片\n' +
					'    layui.use([\'upload\'], function() {\n' +
					'      let input = layui.$("#'+key+'").prev();\n' +
					'      input.prev().attr(\'src\', input.val());\n' +
					'      layui.$("#attachment-choose-'+key+'").on("click", function() {\n' +
					'        parent.layer.open({\n' +
					'          type: 2,\n' +
					'          title: "选择附件",\n' +
					'          content: "/app/admin/upload/attachment?ext=jpg,jpeg,png,gif,bmp",\n' +
					'          area: ["95%", "90%"],\n' +
					'          success: function (layero, index) {\n' +
					'            parent.layui.$("#layui-layer" + index).data("callback", function (data) {\n' +
					'              input.val(data.url).prev().attr("src", data.url);\n' +
					'            });\n' +
					'          }\n' +
					'        });\n' +
					'      });\n' +
					'      layui.upload.render({\n' +
					'        elem: "#' + key + '",\n' +
					'        url: "/app/admin/upload/image",\n' +
					'        acceptMime: "image/gif,image/jpeg,image/jpg,image/png",\n' +
					'        field: "__file__",\n' +
					'        done: function (res) {\n' +
					'          this.item.prev().val(res.data.url).prev().attr(\'src\', res.data.url);\n' +
					'        }\n' +
					'     });\n' +
					'   });\n';
				$('.js-show').text(jscode())
				return;
			case 'submit':
				html = submits(size)
				break;
			case 'del':
				$('form').html("\n")
				delHtml()
				return false;
			default:
				layer.msg('类型错误', {
					icon: 2
				})
		}

		$('form').append(html);
		form.render();
		setHtml(html);
		$('.js-show').text(jscode())
	})

	function delHtml() {
		allHtml = '';
		allJS = '';
		$('.code-show').text('');
		$('.js-show').text(jscode());
	}

	function setHtml(html) {
		allHtml += html;
		$('.code-show').text('<form class="layui-form" action="" onsubmit="return false">\n' + allHtml + '</form>')
	}

	function icon(size) {
		var html = '  <div class="layui-form-item">\n' +
			'    <label class="layui-form-label">图标选择</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <input name="'+key+'" id="'+key+'" />\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function multiSelect(size) {
		var html = '  <div class="layui-form-item">\n' +
			'    <label class="layui-form-label">下拉多选</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <div name="'+key+'" id="'+key+'" ></div>\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function tree(size) {
		var html = '  <div class="layui-form-item">\n' +
			'    <label class="layui-form-label">树多选</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <div name="'+key+'" id="'+key+'" ></div>\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function treeSelectOne(size) {
		var html = '  <div class="layui-form-item">\n' +
			'    <label class="layui-form-label">树单选</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <div name="'+key+'" id="'+key+'" ></div>\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function upload(size) {
		let uploadWords = size === "block" ? "上传文件" : "上传";
		let selectWords = size === "block" ? "选择文件" : "选择";
		var html = '  <div class="layui-form-item">\n' +
			'    <label class="layui-form-label">上传文件</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <span></span>\n' +
			'      <input type="text" style="display:none" name="'+key+'" value="" />\n' +
			'      <button type="button" class="pear-btn pear-btn-primary pear-btn-sm" id="'+key+'" permission="app.admin.upload.file">\n' +
			'        <i class="layui-icon layui-icon-upload"></i>'+uploadWords+'\n' +
			'      </button>\n' +
			'      <button type="button" class="pear-btn pear-btn-primary pear-btn-sm" id="attachment-choose-'+key+'" permission="app.admin.upload.attachment">\n' +
			'	     <i class="layui-icon layui-icon-align-left"></i>'+selectWords+'\n' +
			'      </button>\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function uploadImg(size) {
		let uploadWords = size === "block" ? "上传文件" : "上传";
		let selectWords = size === "block" ? "选择图片" : "选择";
		var html = '  <div class="layui-form-item">\n' +
			'    <label class="layui-form-label">上传图片</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <img class="img-3" src=""/>\n' +
			'      <input type="text" style="display:none" name="'+key+'" value="" />\n' +
			'      <button type="button" class="pear-btn pear-btn-primary pear-btn-sm" id="'+key+'" permission="app.admin.upload.image">\n' +
			'        <i class="layui-icon layui-icon-upload"></i>'+uploadWords+'\n' +
		    '      </button>\n' +
			'      <button type="button" class="pear-btn pear-btn-primary pear-btn-sm" id="attachment-choose-'+key+'" permission="app.admin.upload.attachment">\n' +
			'	     <i class="layui-icon layui-icon-align-left"></i>'+selectWords+'\n' +
			'      </button>\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function input(type, size) {
		var name = type === 'text' ? '输入框' : (type === 'password' ? '密码框' : '');
		var html = '  <div class="layui-form-item">\n' +
			'    <label class="layui-form-label">' + name + '</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <input type="' + type + '" name="' + key + '" required  lay-verify="required" placeholder="请输入' + name +
			'内容" autocomplete="off" class="layui-input">\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function select(size) {
		var html = '  <div class="layui-form-item">\n' +
			'    <label class="layui-form-label">选择框</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <select name="' + key + '" lay-verify="required" lay-search>\n' +
			'        <option value=""></option>\n' +
			'        <option value="0">北京</option>\n' +
			'        <option value="1">上海</option>\n' +
			'        <option value="2">广州</option>\n' +
			'        <option value="3">深圳</option>\n' +
			'        <option value="4">杭州</option>\n' +
			'      </select>\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function checkbox_a(size) {
		var html = '  <div class="layui-form-item">\n' +
			'    <label class="layui-form-label">复选框</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <input type="checkbox" name="' + key + '[]" title="写作">\n' +
			'      <input type="checkbox" name="' + key + '[]" title="阅读" checked>\n' +
			'      <input type="checkbox" name="' + key + '[]" title="发呆">\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function checkbox_b(size) {
		var html = '  <div class="layui-form-item">\n' +
			'    <label class="layui-form-label">开关</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <input type="checkbox" name="' + key + '" lay-skin="switch">\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function radio(size) {
		var html = '  <div class="layui-form-item">\n' +
			'    <label class="layui-form-label">单选框</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <input type="radio" name="' + key + '" value="男" title="男">\n' +
			'      <input type="radio" name="' + key + '" value="女" title="女" checked>\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function textarea(size) {
		var html = '  <div class="layui-form-item layui-form-text">\n' +
			'    <label class="layui-form-label">文本域</label>\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <textarea name="' + key + '" placeholder="请输入内容" class="layui-textarea"></textarea>\n' +
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function submits(size) {
		var html = '  <div class="layui-form-item">\n' +
			'    <div class="layui-input-' + size + '">\n' +
			'      <button class="pear-btn pear-btn-primary" lay-submit="" lay-filter="formDemo">立即提交</button>\n' + //变更
			'      <button type="reset" class="pear-btn">重置</button>\n' + //变更
			'    </div>\n' +
			'  </div>\n';
		return html;
	}

	function jscode() {
		var html = '<script>\n' +
			'  layui.use('+JSON.stringify(module)+', function(){\n' +
			'    var form = layui.form;\n' +
			''+ allJS +
			'    // 提交表单\n' +
			'    form.on(\'submit(formDemo)\', function(data){\n' +
			'      layer.msg(JSON.stringify(data.field));\n' +
			'      return false;\n' +
			'    });\n' +
			'  });\n' +
			'</script>';
		return html;
	}

	function randStrName() {
		return 'a' + Math.random().toString(36).substr(9);
	}
	form.on('submit(formDemo)', function(data) {
		layer.msg(JSON.stringify(data.field));
		return false;
	});
	exports('design', {});
});
