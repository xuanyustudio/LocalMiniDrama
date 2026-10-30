layui.define(['message', 'table', 'jquery', 'element', 'yaml', 'form', 'tab', 'menu', 'frame', 'theme', 'convert'],
    function(exports) {
        "use strict";
        var $ = layui.jquery;
        var defer = $.Deferred();
        var fullScreen = new function() {
            this.func = null;
            this.onFullchange = function(func){
                this.func = func;
                var evts = ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'];
                for(var i=0;i<evts.length && func;i++) {
                    window.addEventListener(evts[i], this.func);
                }
            }
            this.fullScreen = function(dom){
                    var docElm = dom && document.querySelector(dom) || document.documentElement;
                    if (docElm.requestFullscreen) {
                        docElm.requestFullscreen();
                    } else if (docElm.mozRequestFullScreen) {
                        docElm.mozRequestFullScreen();
                    } else if (docElm.webkitRequestFullScreen) {
                        docElm.webkitRequestFullScreen();
                    } else if (docElm.msRequestFullscreen) {
                        docElm.msRequestFullscreen();
                    }else{
                        defer.reject("");
                    }
                    defer.resolve("返回值");
                return defer.promise();
            }
            this.fullClose = function(){
                if(this.isFullscreen()) {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    } else if (document.webkitCancelFullScreen) {
                        document.webkitCancelFullScreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    }
                }
                defer.resolve("返回值");
                return defer.promise();
            }
            this.isFullscreen = function(){
                return document.fullscreenElement ||
                    document.msFullscreenElement ||
                    document.mozFullScreenElement ||
                    document.webkitFullscreenElement || false;
            }
        };
        exports('fullscreen', fullScreen);
    })
