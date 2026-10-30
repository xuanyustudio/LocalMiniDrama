layui.define(['message', 'table', 'jquery', 'element', 'yaml', 'form', 'tab', 'menu', 'frame', 'theme', 'convert','fullscreen'],
	function(exports) {
		"use strict";

		var $ = layui.jquery,
			form = layui.form,
			element = layui.element,
			yaml = layui.yaml,
			pearTab = layui.tab,
			convert = layui.convert,
			pearMenu = layui.menu,
			pearFrame = layui.frame,
			pearTheme = layui.theme,
			message = layui.message,
			fullscreen=layui.fullscreen;

		var bodyFrame;
		var sideMenu;
		var bodyTab;
		var config;
		var logout = function() {};
		var msgInstance;
		var body = $('body');

		var pearAdmin = new function() {

			var configType = 'yml';
			var configPath = 'pear.config.yml';

			this.setConfigPath = function(path) {
				configPath = path;
			}

			this.setConfigType = function(type) {
				configType = type;
			}

			this.render = function(initConfig) {
				if (initConfig !== undefined) {
					applyConfig(initConfig);
				} else {
					applyConfig(pearAdmin.readConfig());
				}
			}

			this.readConfig = function() {
				if (configType === "yml") {
					return yaml.load(configPath);
				} else {
					var data;
					$.ajax({
						url: configPath,
						type: 'get',
						dataType: 'json',
						async: false,
						success: function(result) {
							data = result;
						}
					})
					return data;
				}
			}

			this.messageRender = function(option) {
				var option = {
					elem: '.message',
					url: option.header.message,
					height: '250px'
				};
				msgInstance = message.render(option);
			}

			this.logoRender = function(param) {
				$(".layui-logo .logo").attr("src", param.logo.image);
				$(".layui-logo .title").html(param.logo.title);
				$("title").html(param.logo.title); //变更
			}

			this.menuRender = function(param) {
				sideMenu = pearMenu.render({
					elem: 'sideMenu',
					async: param.menu.async !== undefined ? param.menu.async : true,
					theme: "dark-theme",
					height: '100%',
					method: param.menu.method,
					control: isControl(param) === 'true' || isControl(param) === true ? 'control' : false, // control
					controlWidth: param.menu.controlWidth,
					defaultMenu: 0,
					accordion: param.menu.accordion,
					url: param.menu.data,
					data: param.menu.data,
					parseData: false,
					change: function() {
						compatible();
					},
					done: function() {
						sideMenu.isCollapse = param.menu.collapse;
						sideMenu.selectItem(param.menu.select);
						pearAdmin.collapse(param);
					}
				});
			}

			this.bodyRender = function(param) {

				body.on("click", ".refresh", function() {
					refresh();
				})

				if (isMuiltTab(param) === "true" || isMuiltTab(param) === true) {
					bodyTab = pearTab.render({
						elem: 'content',
						roll: true,
						tool: true,
						width: '100%',
						height: '100%',
						session: param.tab.session,
						index: 0,
						tabMax: param.tab.max,
						preload: param.tab.preload,
						closeEvent: function(id) {
							sideMenu.selectItem(id);
						},
						data: [{
							id: param.tab.index.id,
							url: param.tab.index.href,
							title: param.tab.index.title,
							close: false
						}],
						success: function(id) {
							if (param.tab.session) {
								setTimeout(function() {
									sideMenu.selectItem(id);
									bodyTab.positionTab();
								}, 500)
							}
						}
					});

					bodyTab.click(function(id) {
						if (!param.tab.keepState) {
							bodyTab.refresh(false);
						}
						bodyTab.positionTab();
						sideMenu.selectItem(id);
					})

					sideMenu.click(function(dom, data) {
						bodyTab.addTabOnly({
							id: data.menuId,
							title: data.menuTitle,
							url: data.menuUrl,
							icon: data.menuIcon,
							close: true
						}, 300);
						compatible();
					})
				} else {
					bodyFrame = pearFrame.render({
						elem: 'content',
						title: '首页',
						url: param.tab.index.href,
						width: '100%',
						height: '100%'
					});

					sideMenu.click(function(dom, data) {
						bodyFrame.changePage(data.menuUrl, true);
						compatible()
					})
				}
			}

			this.keepLoad = function(param) {
				compatible()
				setTimeout(function() {
					$(".loader-main").fadeOut(200);
				}, param.other.keepLoad)
			}

			this.themeRender = function(option) {
				if (option.theme.allowCustom === false) {
					$(".setting").remove();
				}
				var colorId = localStorage.getItem("theme-color");
				var currentColor = getColorById(colorId);
				localStorage.setItem("theme-color", currentColor.id);
				localStorage.setItem("theme-color-color", currentColor.color);
				localStorage.setItem("theme-color-second", currentColor.second);
				pearTheme.changeTheme(window, isAutoHead(config));

				var menu = localStorage.getItem("theme-menu");
				if (menu === null) {
					menu = option.theme.defaultMenu;
				} else {
					if (option.theme.allowCustom === false) {
						menu = option.theme.defaultMenu;
					}
				}

				var header = localStorage.getItem("theme-header");
				if (header === null) {
					header = option.theme.defaultHeader;
				} else {
					if (option.theme.allowCustom === false) {
						header = option.theme.defaultHeader;
					}
				}

				var banner = localStorage.getItem("theme-banner");
				if (banner === null) {
					banner = option.theme.banner;
				} else {
					if (option.theme.allowCustom === false) {
						banner = option.theme.banner;
					}
				}

				var autoHead = localStorage.getItem("auto-head");
				if (autoHead === null) {
					autoHead = option.other.autoHead;
				} else {
					if (option.theme.allowCustom === false) {
						autoHead = option.other.autoHead;
					}
				}

				var muiltTab = localStorage.getItem("muilt-tab");
				if (muiltTab === null) {
					muiltTab = option.tab.enable;
				} else {
					if (option.theme.allowCustom === false) {
						muiltTab = option.tab.enable;
					}
				}

				var control = localStorage.getItem("control");
				if (control === null) {
					control = option.menu.control;
				} else {
					if (option.theme.allowCustom === false) {
						control = option.menu.control;
					}
				}

				var footer = localStorage.getItem("footer");
				if( footer === null) {
					footer = option.other.footer;
				}else{
					if (option.theme.allowCustom === false) {
						footer = option.other.footer;
					}
				}

				localStorage.setItem("muilt-tab", muiltTab);
				localStorage.setItem("theme-banner", banner);
				localStorage.setItem("theme-menu", menu);
				localStorage.setItem("theme-header", header);
				localStorage.setItem("auto-head", autoHead);
				localStorage.setItem("control", control);
				localStorage.setItem("footer", footer);
				this.menuSkin(menu);
				this.headerSkin(header);
				this.bannerSkin(banner);
				this.footer(footer);
			}

			this.footer = function(footer){
				var bodyDOM = $(".pear-admin .layui-body");
				var footerDOM = $(".pear-admin .layui-footer");
				if (footer === true || footer === "true") {
					footerDOM.removeClass("close");
					bodyDOM.css("bottom", footerDOM.outerHeight());
				} else {
					footerDOM.addClass("close");
					bodyDOM.css("bottom", "");
				}
			}

			this.bannerSkin = function(theme) {
				var pearAdmin = $(".pear-admin");
				pearAdmin.removeClass("banner-layout");
				if (theme === true || theme === "true") {
					pearAdmin.addClass("banner-layout");
				}
			}

			this.collapse = function(param) {
				if (param.menu.collapse) {
					if ($(window).width() >= 768) {
						collapse()
					}
				}
			}

			this.menuSkin = function(theme) {
				var pearAdmin = $(".pear-admin .layui-side");
				pearAdmin.removeClass("light-theme");
				pearAdmin.removeClass("dark-theme");
				pearAdmin.addClass(theme);
			}

			this.headerSkin = function(theme) {
				var pearAdmin = $(".pear-admin .layui-header");
				pearAdmin.removeClass("light-theme");
				pearAdmin.removeClass("dark-theme");
				pearAdmin.addClass(theme);
			}

			this.logout = function(callback) {
				logout = callback;
			}

			this.message = function(callback) {
				if (callback != null) {
					msgInstance.click(callback);
				}
			}

			this.collapseSide = function() {
				collapse()
			}

			this.refreshThis = function() {
				refresh()
			}

			this.refresh = function(id) {
				$("iframe[id='"+ id +"']").attr('src', $("iframe[id='"+ id +"']").attr('src'));
			}

			this.addTab = function(id, title, url) {
				if (isMuiltTab(config) === "true" || isMuiltTab(config) === true) {
					bodyTab.addTabOnly({
						id: id,
						title: title,
						url: url,
						icon: null,
						close: true
					}, 400);
				} else {
					return;
				}
			}

			this.closeTab = function(id) {
				if (isMuiltTab(config) === "true" || isMuiltTab(config) === true) {
					pearTab.delTabByElem('content', id, function(currentId){
						sideMenu.selectItem(currentId);
					});
				} else {
					return;
				}
			}

			this.closeCurrentTab = function() {
				if (isMuiltTab(config) === "true" || isMuiltTab(config) === true) {
					pearTab.delCurrentTabByElem('content', function(id){
						sideMenu.selectItem(id);
					});
				} else {
					return;
				}
			}
			
			this.closeOtherTab = function() {
				if (isMuiltTab(config) === "true" || isMuiltTab(config) === true) {
					pearTab.delOtherTabByElem('content', function(id){
						sideMenu.selectItem(id);
					});
				} else {
					return;
				}
			}
			
			this.closeAllTab = function() {
				if (isMuiltTab(config) === "true" || isMuiltTab(config) === true) {
					pearTab.delAllTabByElem('content', function(id){
						sideMenu.selectItem(id);
					});
				} else {
					return;
				}
			}

			this.changeTabTitle = function(id, title) {
				pearTab.changeTabTitleById('content', id ,title);
			}
			
			this.changeIframe = function(id, title, url) {
				if (isMuiltTab(config) === "true" || isMuiltTab(config) === true) {
					return;
				} else {
					sideMenu.selectItem(id);
					bodyFrame.changePage(url, true);
				}
			}

			this.jump = function(id, title, url) {
				if (isMuiltTab(config) === "true" || isMuiltTab(config) === true) {
					pearAdmin.addTab(id, title, url)
				} else {
					pearAdmin.changeIframe(id, title, url)
				}
			}
			
			this.fullScreen = function() {
				if ($(".fullScreen").hasClass("layui-icon-screen-restore")) {
					screenFun(2).then(function() {
						$(".fullScreen").eq(0).removeClass("layui-icon-screen-restore");
					});
				} else {
					screenFun(1).then(function() {
						$(".fullScreen").eq(0).addClass("layui-icon-screen-restore");
					});
				}
			}
		};

		function refresh() {
			var refreshA = $(".refresh a");
			refreshA.removeClass("layui-icon-refresh-1");
			refreshA.addClass("layui-anim");
			refreshA.addClass("layui-anim-rotate");
			refreshA.addClass("layui-anim-loop");
			refreshA.addClass("layui-icon-loading");
			if (isMuiltTab(config) === "true" || isMuiltTab(config) === true) bodyTab.refresh(true);
			else bodyFrame.refresh(true);
			setTimeout(function() {
				refreshA.addClass("layui-icon-refresh-1");
				refreshA.removeClass("layui-anim");
				refreshA.removeClass("layui-anim-rotate");
				refreshA.removeClass("layui-anim-loop");
				refreshA.removeClass("layui-icon-loading");
			}, 600)
		}

		function collapse() {
			sideMenu.collapse();
			var admin = $(".pear-admin");
			var left = $(".layui-icon-spread-left")
			var right = $(".layui-icon-shrink-right")
			if (admin.is(".pear-mini")) {
				left.addClass("layui-icon-shrink-right")
				left.removeClass("layui-icon-spread-left")
				admin.removeClass("pear-mini");
				sideMenu.isCollapse = false;
			} else {
				right.addClass("layui-icon-spread-left")
				right.removeClass("layui-icon-shrink-right")
				admin.addClass("pear-mini");
				sideMenu.isCollapse = true;
			}
		}

		body.on("click", ".logout", function() {
			if (logout() && bodyTab) {
				bodyTab.clear();
			}
		})

		body.on("click", ".collapse,.pear-cover", function() {
			collapse();
		});

		body.on("click", ".menuSearch", function () {
			// 过滤菜单
			var filterHandle = function (filterData, val) {
				if (!val) return [];
				var filteredMenus = [];
				filterData = $.extend(true, {}, filterData);
				$.each(filterData, function (index, item) {
					if (item.children && item.children.length) {
						var children = filterHandle(item.children, val)
						var obj = $.extend({}, item, { children: children });
						if (children && children.length) {
							filteredMenus.push(obj);
						} else if (item.title.indexOf(val) >= 0) {
							item.children = []; // 父级匹配但子级不匹配,就去除子级
							filteredMenus.push($.extend({}, item));
						}
					} else if (item.title.indexOf(val) >= 0) {
						filteredMenus.push(item);
					}
				})
				return filteredMenus;
			}

			// 树转路径
			var tiledHandle = function (data) {
				var tiledMenus = [];
				var treeTiled = function (data, content) {
					var path = "";
					var separator = " / ";
					// 上级路径
					if (!content) content = "";
					$.each(data, function (index, item) {
						if (item.children && item.children.length) {
							path += content + item.title + separator;
							var childPath = treeTiled(item.children, path);
							path += childPath;
							if (!childPath) path = ""; // 重置路径
						} else {
							path += content + item.title
							tiledMenus.push({ path: path, info: item });
							path = ""; //重置路径
						}
					})
					return path;
				};
				treeTiled(data);

				return tiledMenus;
			}

			// 创建搜索列表
			var createList = function (data) {
				var _listHtml = '';
				$.each(data, function (index, item) {
					_listHtml += '<li smenu-id="' + item.info.id + '" smenu-icon="' + item.info.icon + '" smenu-url="' + item.info.href + '" smenu-title="' + item.info.title + '" smenu-type="' + item.info.type + '">';
					_listHtml += '  <span><i style="margin-right:10px" class=" ' + item.info.icon + '"></i>' + item.path + '</span>';
					_listHtml += '  <i class="layui-icon layui-icon-right"></i>';
					_listHtml += '</li>'
				})
				return _listHtml;
			}

			var _html = [
				'<div class="menu-search-content">',
				'  <div class="layui-form menu-search-input-wrapper">',
				'    <div class=" layui-input-wrap layui-input-wrap-prefix">',
				'      <div class="layui-input-prefix">',
				'        <i class="layui-icon layui-icon-search"></i>',
				'      </div>',
				'      <input type="text" name="menuSearch" value="" placeholder="搜索菜单" autocomplete="off" class="layui-input" lay-affix="clear">',
				'    </div>',
				'  </div>',
				'  <div class="menu-search-no-data">暂无搜索结果</div>',
				'  <ul class="menu-search-list">',
				'  </ul>',
				'</div>'
			].join('');

			layer.open({
				type: 1,
				offset: "10%",
				area: ['600px'],
				title: false,
				closeBtn: 0,
				shadeClose: true,
				anim: 0,
				move: false,
				content: _html,
				success: function(layero,layeridx){
					var $layer = layero;
					var $content = $(layero).children('.layui-layer-content');
					var $input = $(".menu-search-input-wrapper input");
					var $noData = $(".menu-search-no-data");
					var $list = $(".menu-search-list");
					var menuData = sideMenu.option.data;


					$layer.css("border-radius", "6px");
					$input.off("focus").focus();
					// 搜索菜单
					$input.off("input").on("input", debounce(function(){
						var keywords = $input.val().trim();
						var filteredMenus = filterHandle(menuData, keywords);

						if(filteredMenus.length){
							var tiledMenus = tiledHandle(filteredMenus);
							var listHtml = createList(tiledMenus);
							$noData.css("display", "none");
							$list.html("").append(listHtml).children(":first").addClass("this")
						}else{
							$list.html("");
							$noData.css("display", "flex");
						}
						var currentHeight = $(".menu-search-content").outerHeight()
						$layer.css("height", currentHeight);
						$content.css("height", currentHeight);
					}, 500)
					)
					// 搜索列表点击事件
					$list.off("click").on("click", "li", function () {
						var menuId = $(this).attr("smenu-id");
						var menuUrl = $(this).attr("smenu-url");
						var menuIcon = $(this).attr("smenu-icon");
						var menuTitle = $(this).attr("smenu-title");
						var menuType = $(this).attr("smenu-type");
						var openableWindow = menuType === "1" || menuType === 1;

						if(sideMenu.isCollapse){
							collapse();
						}
						if (openableWindow) {
							pearAdmin.jump(menuId, menuTitle, menuUrl)
						} else {
							sideMenu.selectItem(menuId);
						}
						compatible();
						layer.close(layeridx);
					})

					$list.off('mouseenter').on("mouseenter", "li", function () {
						$(".menu-search-list li.this").removeClass("this");
						$(this).addClass("this");
					}).off("mouseleave").on("mouseleave", "li", function(){
						$(this).removeClass("this");
					})

					// 监听键盘事件
					// Enter:13 Spacebar:32 UpArrow:38 DownArrow:40 Esc:27
					$(document).off("keydown").keydown(function (e) {
						if (e.keyCode === 13 || e.keyCode === 32) {
							e.preventDefault();
							var menuId = $(".menu-search-list li.this").attr("smenu-id");
							var menuUrl = $(".menu-search-list li.this").attr("smenu-url");
							var menuTitle = $(".menu-search-list li.this").attr("smenu-title");
							var menuType = $(".menu-search-list li.this").attr("smenu-type");
							var openableWindow = menuType === "1" || menuType === 1;
							if (sideMenu.isCollapse) {
								collapse();
							}
							if (openableWindow) {
								pearAdmin.jump(menuId, menuTitle, menuUrl)
							} else {
								sideMenu.selectItem(menuId);
							}
							compatible();
							layer.close(layeridx);
						}else if(e.keyCode === 38){
							e.preventDefault();
							var prevEl = $(".menu-search-list li.this").prev();
							$(".menu-search-list li.this").removeClass("this");
							if(prevEl.length !== 0){
								prevEl.addClass("this");
							}else{
								$list.children().last().addClass("this");
							}
						}else if(e.keyCode === 40){
							e.preventDefault();
							var nextEl = $(".menu-search-list li.this").next();
							$(".menu-search-list li.this").removeClass("this");
							if(nextEl.length !== 0){
								nextEl.addClass("this");
							}else{
								$list.children().first().addClass("this");
							}
						}else if(e.keyCode === 27){
							e.preventDefault();
							layer.close(layeridx);
						}
					})
				}
			})
		});


		body.on("click", ".fullScreen", function() {
			if ($(this).hasClass("layui-icon-screen-restore")) {
				fullscreen.fullClose().then(function() {
					$(".fullScreen").eq(0).removeClass("layui-icon-screen-restore");
				});
			} else {
				fullscreen.fullScreen().then(function() {
					$(".fullScreen").eq(0).addClass("layui-icon-screen-restore");
				});
			}
		});

		body.on("click", '[user-menu-id]', function() {
			if (isMuiltTab(config) === "true" || isMuiltTab(config) === true) {
				bodyTab.addTabOnly({
					id: $(this).attr("user-menu-id"),
					title: $(this).attr("user-menu-title"),
					url: $(this).attr("user-menu-url"),
					icon: "",
					close: true
				}, 300);
			} else {
				bodyFrame.changePage($(this).attr("user-menu-url"), true);
			}
		});

		body.on("click", ".setting", function() {

			var menuItem =
				'<li class="layui-this" data-select-bgcolor="dark-theme" >' +
				'<a href="javascript:;" data-skin="skin-blue" style="" class="clearfix full-opacity-hover">' +
				'<div><span style="display:block; width: 20%; float: left; height: 12px; background: #28333E;"></span><span style="display:block; width: 80%; float: left; height: 12px; background: white;"></span></div>' +
				'<div><span style="display:block; width: 20%; float: left; height: 40px; background: #28333E;"></span><span style="display:block; width: 80%; float: left; height: 40px; background: #f4f5f7;"></span></div>' +
				'</a>' +
				'</li>';

			menuItem +=
				'<li  data-select-bgcolor="light-theme" >' +
				'<a href="javascript:;" data-skin="skin-blue" style="" class="clearfix full-opacity-hover">' +
				'<div><span style="display:block; width: 20%; float: left; height: 12px; background: white;"></span><span style="display:block; width: 80%; float: left; height: 12px; background: white;"></span></div>' +
				'<div><span style="display:block; width: 20%; float: left; height: 40px; background: white;"></span><span style="display:block; width: 80%; float: left; height: 40px; background: #f4f5f7;"></span></div>' +
				'</a>' +
				'</li>';

			var menuHtml =
				'<div class="pearone-color">\n' +
				'<div class="color-title">菜单风格</div>\n' +
				'<div class="color-content">\n' +
				'<ul>\n' + menuItem + '</ul>\n' +
				'</div>\n' +
				'</div>';

			var headItem =
				'<li class="layui-this" data-select-header="light-theme" >' +
				'<a href="javascript:;" data-skin="skin-blue" style="" class="clearfix full-opacity-hover">' +
				'<div><span style="display:block; width: 20%; float: left; height: 12px; background: #28333E;"></span><span style="display:block; width: 80%; float: left; height: 12px; background: white;"></span></div>' +
				'<div><span style="display:block; width: 20%; float: left; height: 40px; background: #28333E;"></span><span style="display:block; width: 80%; float: left; height: 40px; background: #f4f5f7;"></span></div>' +
				'</a>' +
				'</li>';

			headItem +=
				'<li  data-select-header="dark-theme" >' +
				'<a href="javascript:;" data-skin="skin-blue" style="" class="clearfix full-opacity-hover">' +
				'<div><span style="display:block; width: 20%; float: left; height: 12px; background: #28333E;"></span><span style="display:block; width: 80%; float: left; height: 12px; background: #28333E;"></span></div>' +
				'<div><span style="display:block; width: 20%; float: left; height: 40px; background: #28333E;"></span><span style="display:block; width: 80%; float: left; height: 40px; background: #f4f5f7;"></span></div>' +
				'</a>' +
				'</li>';

			var headHtml =
				'<div class="pearone-color">\n' +
				'<div class="color-title">顶部风格</div>\n' +
				'<div class="color-content">\n' +
				'<ul>\n' + headItem + '</ul>\n' +
				'</div>\n' +
				'</div>';

			var moreItem =
				'<div class="layui-form-item"><div class="layui-input-inline"><input type="checkbox" name="control" lay-filter="control" lay-skin="switch" lay-text="开|关"></div><span class="set-text">菜单</span></div>';

			moreItem +=
				'<div class="layui-form-item"><div class="layui-input-inline"><input type="checkbox" name="muilt-tab" lay-filter="muilt-tab" lay-skin="switch" lay-text="开|关"></div><span class="set-text">视图</span></div>';

			moreItem +=
				'<div class="layui-form-item"><div class="layui-input-inline"><input type="checkbox" name="banner" lay-filter="banner" lay-skin="switch" lay-text="开|关"></div><span class="set-text">通栏</span></div>';

			moreItem +=
				'<div class="layui-form-item"><div class="layui-input-inline"><input type="checkbox" name="auto-head" lay-filter="auto-head" lay-skin="switch" lay-text="开|关"></div><span class="set-text">通色</span></div>';

			moreItem +=
				'<div class="layui-form-item"><div class="layui-input-inline"><input type="checkbox" name="footer" lay-filter="footer" lay-skin="switch" lay-text="开|关"></div><span class="set-text">页脚</span></div>';

			var moreHtml = '<br><div class="pearone-color">\n' +
				'<div class="color-title">更多设置</div>\n' +
				'<div class="color-content">\n' +
				'<form class="layui-form">\n' + moreItem + '</form>\n' +
				'</div>\n' +
				'</div>';

			layer.open({
				type: 1,
				offset: 'r',
				area: ['320px', '100%'],
				title: false,
				shade: 0.1,
				closeBtn: 0,
				shadeClose: false,
				anim: -1,
				skin: 'layer-anim-right',
				move: false,
				content: menuHtml + headHtml + buildColorHtml() + moreHtml,
				success: function(layero, index) {

					form.render();

					var color = localStorage.getItem("theme-color");
					var menu = localStorage.getItem("theme-menu");
					var header = localStorage.getItem("theme-header");

					if (color !== "null") {
						$(".select-color-item").removeClass("layui-icon").removeClass("layui-icon-ok");
						$("*[color-id='" + color + "']").addClass("layui-icon").addClass("layui-icon-ok");
					}

					if (menu !== "null") {
						$("*[data-select-bgcolor]").removeClass("layui-this");
						$("[data-select-bgcolor='" + menu + "']").addClass("layui-this");
					}

					if (header !== "null") {
						$("*[data-select-header]").removeClass("layui-this");
						$("[data-select-header='" + header + "']").addClass("layui-this");
					}

					$('#layui-layer-shade' + index).click(function() {
						var $layero = $('#layui-layer' + index);
						$layero.animate({
							left: $layero.offset().left + $layero.width()
						}, 200, function() {
							layer.close(index);
						});
					})

					form.on('switch(control)', function(data) {
						localStorage.setItem("control", this.checked);
						window.location.reload();
					})

					form.on('switch(muilt-tab)', function(data) {
						localStorage.setItem("muilt-tab", this.checked);
						window.location.reload();
					})

					form.on('switch(auto-head)', function(data) {
						localStorage.setItem("auto-head", this.checked);
						pearTheme.changeTheme(window, this.checked);
					})

					form.on('switch(banner)', function(data) {
						localStorage.setItem("theme-banner", this.checked);
						pearAdmin.bannerSkin(this.checked);
					})

					form.on('switch(footer)', function (data) {
						localStorage.setItem("footer", this.checked);
						pearAdmin.footer(this.checked);
					})

					if (localStorage.getItem('theme-banner') === 'true') {
						$('input[name="banner"]').attr('checked', 'checked')
					} else {
						$('input[name="banner"]').removeAttr('checked')
					}

					if (localStorage.getItem('control') === 'true') {
						$('input[name="control"]').attr('checked', 'checked')
					} else {
						$('input[name="control"]').removeAttr('checked')
					}

					if (localStorage.getItem('muilt-tab') === 'true') {
						$('input[name="muilt-tab"]').attr('checked', 'checked')
					} else {
						$('input[name="muilt-tab"]').removeAttr('checked')
					}

					if (localStorage.getItem('auto-head') === 'true') {
						$('input[name="auto-head"]').attr('checked', 'checked')
					} else {
						$('input[name="auto-head"]').removeAttr('checked')
					}

					if (localStorage.getItem('footer') === 'true') {
						$('input[name="footer"]').attr('checked', 'checked')
					} else {
						$('input[name="footer"]').removeAttr('checked')
					}

					form.render('checkbox');
				}
			});
		});

		body.on('click', '[data-select-bgcolor]', function() {
			var theme = $(this).attr('data-select-bgcolor');
			$('[data-select-bgcolor]').removeClass("layui-this");
			$(this).addClass("layui-this");
			localStorage.setItem("theme-menu", theme);
			pearAdmin.menuSkin(theme);
		});

		body.on('click', '[data-select-header]', function() {
			var theme = $(this).attr('data-select-header');
			$('[data-select-header]').removeClass("layui-this");
			$(this).addClass("layui-this");
			localStorage.setItem("theme-header", theme);
			pearAdmin.headerSkin(theme);
		});

		body.on('click', '.select-color-item', function() {
			$(".select-color-item").removeClass("layui-icon").removeClass("layui-icon-ok");
			$(this).addClass("layui-icon").addClass("layui-icon-ok");
			var colorId = $(".select-color-item.layui-icon-ok").attr("color-id");
			var currentColor = getColorById(colorId);
			localStorage.setItem("theme-color", currentColor.id);
			localStorage.setItem("theme-color-color", currentColor.color);
			localStorage.setItem("theme-color-second", currentColor.second);
			pearTheme.changeTheme(window, isAutoHead(config));
		});

		function applyConfig(param) {
			config = param;
			pearAdmin.logoRender(param);
			pearAdmin.menuRender(param);
			pearAdmin.bodyRender(param);
			pearAdmin.themeRender(param);
			pearAdmin.keepLoad(param);
			if (param.header.message != false) {
				pearAdmin.messageRender(param);
			}
		}

		function getColorById(id) {
			var color;
			var flag = false;
			$.each(config.colors, function(i, value) {
				if (value.id === id) {
					color = value;
					flag = true;
				}
			})
			if (flag === false || config.theme.allowCustom === false) {
				$.each(config.colors, function(i, value) {
					if (value.id === config.theme.defaultColor) {
						color = value;
					}
				})
			}
			return color;
		}

		function buildColorHtml() {
			var colors = "";
			$.each(config.colors, function(i, value) {
				colors += "<span class='select-color-item' color-id='" + value.id + "' style='background-color:" + value.color +
					";'></span>";
			})
			return "<div class='select-color'><div class='select-color-title'>主题配色</div><div class='select-color-content'>" +
				colors + "</div></div>"
		}

		function compatible() {
			if ($(window).width() <= 768) {
				collapse()
			}
		}

		function isControl(option) {
			if (option.theme.allowCustom) {
				if (localStorage.getItem("control") != null) {
					return localStorage.getItem("control")
				} else {
					return option.menu.control
				}
			} else {
				return option.menu.control
			}
		}

		function isAutoHead(option) {
			if (option.theme.allowCustom) {
				if (localStorage.getItem("auto-head") != null) {
					return localStorage.getItem("auto-head");
				} else {
					return option.other.autoHead;
				}
			} else {
				return option.other.autoHead;
			}
		}

		function isMuiltTab(option) {
			if (option.theme.allowCustom) {
				if (localStorage.getItem("muilt-tab") != null) {
					return localStorage.getItem("muilt-tab")
				} else {
					return option.tab.enable
				}
			} else {
				return option.tab.enable
			}
		}

		window.onresize = function() {
			if (!fullscreen.isFullscreen()) {
				$(".fullScreen").eq(0).removeClass("layui-icon-screen-restore");
			}
		}

		$(window).on('resize', debounce(function () {
			if (sideMenu && !sideMenu.isCollapse && $(window).width() <= 768) {
				collapse();
			}
		},50));

		function debounce(fn, awaitTime) {
			var timerID = null
			return function () {
				var arg = arguments[0]
				if (timerID) {
					clearTimeout(timerID)
				}
				timerID = setTimeout(function () {
					fn(arg)
				}, awaitTime)
			}
		}
		exports('admin', pearAdmin);
	})
