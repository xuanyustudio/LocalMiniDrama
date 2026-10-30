layui.define(['jquery', 'element'], function (exports) {
	"use strict";

	var $ = layui.jquery;

	var pearFrame = function (opt) {
		this.option = opt;
	};

	pearFrame.prototype.render = function (opt) {
		var option = {
			elem: opt.elem,
			url: opt.url,
			title: opt.title,
			width: opt.width,
			height: opt.height,
			done: opt.done ? opt.done : function () { console.log("菜单渲染成功"); }
		}
		createFrameHTML(option);
		$("#" + option.elem).width(option.width);
		$("#" + option.elem).height(option.height);
		return new pearFrame(option);
	}

	pearFrame.prototype.changePage = function (url, loading) {
		var $frameLoad = $("#" + this.option.elem).find(".pear-frame-loading");
		var $frame = $("#" + this.option.elem + " iframe");
		$frame.attr("src", url);
		frameLoading($frame, $frameLoad, loading);
	}

	pearFrame.prototype.changePageByElement = function (elem, url, title, loading) {
		var $frameLoad = $("#" + elem).find(".pear-frame-loading");
		var $frame = $("#" + elem + " iframe");
		$frame.attr("src", url);
		$("#" + elem + " .title").html(title);
		frameLoading($frame, $frameLoad, loading);
	}

	pearFrame.prototype.refresh = function (loading) {
		var $frameLoad = $("#" + this.option.elem).find(".pear-frame-loading");
		var $frame = $("#" + this.option.elem).find("iframe");
		$frame.attr("src", $frame.attr("src"));
		frameLoading($frame, $frameLoad, loading);
	}

	function createFrameHTML(option) {
		var iframe = "<iframe class='pear-frame-content' style='width:100%;height:100%;'  scrolling='auto' frameborder='0' src='" + option.url + "' allowfullscreen='true' ></iframe>";
		var loading = '<div class="pear-frame-loading">' +
			'<div class="ball-loader">' +
			'<span></span><span></span><span></span><span></span>' +
			'</div>' +
			'</div></div>';
		$("#" + option.elem).html("<div class='pear-frame'>" + iframe + loading + "</div>");
	}

	function frameLoading(iframeEl, loadingEl, isLoading) {
		if (isLoading) {
			loadingEl.css({ display: 'block' });
			$(iframeEl).on('load', function () {
				loadingEl.fadeOut(1000);
			})
		}
	}

	exports('frame', new pearFrame());
});
