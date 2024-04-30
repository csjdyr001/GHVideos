(function () {
    var DanMu = function (options) {
        this.options = $.extend({}, this.defaults, options);
        this._init();
    };
 
    DanMu.prototype = {
        defaults: {
            // 宿主元素ID
            hostContainer: null,
            // 弹幕画板参数
            canvas: {
                id: null,
                width: null,
                height: null
            },
            // 是否启用弹幕插件
            isEnable: false,
            // 是否显示log
            displayLog: true,
            // 发送到弹幕参数
            sendData: {
                //发送弹幕间隔时间
                interval: null,
                intervalCallBack: null,
                // 发送弹幕ajax url
                url: null,
                // ajax 参数
                params: {},
                // 成功后回调
                successCallBack: function () {
                },
                // 失败后回调
                errorCallBack: function () {
                },
            },
            // 加载弹幕列表
            loadData: {
                url: null,
                params: {},
                successCallBack: function () {
                },
                errorCallBack: function () {
                },
            },
            // 宿主弹幕类型、暂时只有video
            host: {
                type: "VIDEO",
                object: null
            },
        },
        // 弹幕列表数据
        // 字段名限制
        // type=video [content:'这是一条弹幕', anchor: 10000]
        // type: other 暂无
        items: new Array(),
        // 总条数
        total: 0,
        // 当前时间、用于触发弹幕
        currentPlayDate: null,
        // 画板对象
        canvas: null,
        // 弹幕插件对象
        barrage: null,
        // 存储弹幕复制数据
        tmpItem: [],
        isRun: true,
        isSend: false,
        _hostType: function () {
            let _this = this;
            if (_this.options.host != null) {
                let type = _this.options.host.type.toUpperCase();
                switch (type) {
                    case "VIDEO":
                        _this._videoDanMuMethods.init(_this);
                        break;
                }
            }
        },
        _videoDanMuMethods: {
            parent: null,
            vplayer: null,
            isFirst: true,
            isSeeking: false,
            tmpPlayCurrent: [],
            init: function (parent) {
                try {
                    this.parent = parent;
                    this.vplayer = this.parent.options.host.object;
                    this.parent._createDanMuElement();
                    this.eventBinding();
                } catch (error) {
                    parent.errorLogHandle(error);
                }
 
            },
            eventBinding: function () {
                let _this = this;
                _this.vplayer.on('firstplay', function (event) {
                    _this.isFirst = false;
                    // 复制数据
                    _this.copyData();
                });
                _this.vplayer.on('seeking', function (event) {
                    _this.isSeeking = true;
                });
                _this.vplayer.on('timeupdate', function (event) {
                    _this.timeupdate();
                });
                _this.vplayer.on('seeked', function (event) {
                    _this.seeked();
                });
 
            },
            seeked: function () {
                let _this = this;
                _this.isSeeking = false;
                _this.tmpPlayCurrent = [];
                _this.copyData();
            },
            copyData: function () {
                let _this = this;
                _this.parent.tmpItem = _this.parent.items.slice(0);
            },
            timeupdate: function () {
                let _this = this;
                _this.parent.currentDate = Math.floor(this.vplayer.currentTime());
                if (!_this.isFirst && !_this.isSeeking) {
                    // 判断是否当前时间已经调用，因为timeupdate方法有可能会调用1-N次
                    if (!_this.tmpPlayCurrent.includes(_this.parent.currentDate)) {
                        _this.parent.infoLogHandle("vplay timeupdate event，当前播放进度时间：" + _this.parent.currentDate);
                        _this.tmpPlayCurrent.push(_this.parent.currentDate);
                        // 循环取出弹幕
                        if (_this.parent.isRun) {
                            for (let i = 0; i < _this.parent.tmpItem.length; i++) {
                                let sendTime = _this.parent.tmpItem[i].anchor;
                                let content = _this.parent.tmpItem[i].content;
                                if ((sendTime / 1000) == _this.parent.currentDate) {
                                    _this.parent.infoLogHandle("显示一个弹幕：" + content + "，当前播放时间：" + _this.parent.currentDate);
                                    _this.parent.barrage.shoot(content);
                                }
                            }
                        }
                    }
                }
            }
        },
        _send: function (data) {
            let _this = this;
            _this.barrage.shoot(data);
        },
        start: function () {
            this.isRun = true;
            $("#" + this.options.canvas.id).show();
        },
        stop: function () {
            this.isRun = false;
            $("#" + this.options.canvas.id).hide();
        },
        send: function (content) {
            let _this = this;
            if (_this.options.sendData.interval != null || _this.options.sendData.interval > 0) {
                if (_this.isSend) {
                    if (typeof (_this.options.sendData.intervalCallBack) != "undefined" && typeof (_this.options.sendData.intervalCallBack) == "function") {
                        _this.options.sendData.intervalCallBack();
                    }
                } else {
                    _this.options.sendData.params.content = content;
                    _this.options.sendData.params.anchor = _this.currentDate * 1000;
                    _this._sendDanMuData();
                    setTimeout(function () {
                        _this.isSend = false;
                    }, 10000);
                }
            }
 
        },
        _createDanMuElement: function () {
            let _this = this;
            $(_this.options.hostContainer).css("position", "relative");
            $(_this.options.hostContainer).append('<canvas id="' + _this.options.canvas.id + '" width="' + _this.options.canvas.width + '" height="' + _this.options.canvas.height + '" style="z-index:0;position:absolute;top:0;left:0;pointer-events: none;">您的浏览器不支持canvas标签。</canvas>');
            _this.barrage = new Barrage(_this.options.canvas.id);
            _this.barrage.draw();
        },
        _init: function () {
            this.infoLogHandle("_init method!!!");
            let _this = this;
            _this._checkOptions().then(function () {
                _this._hostType();
                _this._loadDanMuPoolData();
            }).catch(function (error) {
                _this.errorLogHandle("不满足danmu.js要求!!!" + error);
            });
        },
        _sendDanMuData: function () {
            let _this = this;
            _this.isSend = true;
            new Promise(function (resolve, reject) {
                ajaxSubmit({
                    url: _this.options.sendData.url,
                    params: _this.options.sendData.params,
                    async: true,
                    onSuccess: function (data, textStatus) {
                        _this.infoLogHandle("发送了成功一条弹幕：" + data);
                        _this._send(data);
                        //将新发送成功的弹幕放到弹幕列表中
                        let newData = {
                            anchor: _this.currentDate * 1000,
                            content: data
                        }
                        _this.items.push(newData);
                        _this.options.sendData.successCallBack(data, textStatus);
                        resolve();
                    },
                    onError: function (error) {
                        if (typeof (_this.options.sendData.errorCallBack) != "undefined" && typeof (_this.options.sendData.errorCallBack) == "function") {
                            _this.options.sendData.errorCallBack(error);
                            reject();
                        }
                    }
                });
            });
 
        },
        _loadDanMuPoolData: function () {
            let _this = this;
            _this.infoLogHandle("_loadDanMuPoolData method!!!");
            ajaxSubmit({
                url: _this.options.loadData.url,
                async: true,
                params: _this.options.loadData.params,
                onSuccess: function (data, textStatus) {
                    //避免返回结构不同，所以返回给前台处理完数据后在返回给插件显示弹幕
                    let loadData = _this.options.loadData.successCallBack(data, textStatus);
                    if (typeof (loadData) != "undefined") {
                        _this.items = loadData;
                    }
                    _this.total = _this.items.length;
                },
                onError: function (error) {
                    if (typeof (_this.options.loadData.errorCallBack) != "undefined" && typeof (_this.options.loadData.errorCallBack) == "function") {
                        _this.options.loadData.errorCallBack(error);
                    }
                }
            });
        },
        _checkOptions: function () {
            let _this = this;
            return (new Promise(function (resolve, reject) {
                if (_this.options.isEnable == false) {
                    _this.errorLogHandle("弹幕插件未启用!!!");
                    reject();
                }
                if (typeof (Barrage) == "undefined" || typeof (Barrage) != "function") {
                    _this.errorLogHandle("请在danmu.js之前加载jquery、jquery.ui.js、framework.barrage.js、inserttest.js才能使用danmu.js!!!");
                    reject();
                }
                if (_this.options.hostContainer == null) {
                    _this.errorLogHandle("请配置参数[options > hostContainer]!!!");
                    reject();
                }
                if (_this.options.host.object == null) {
                    _this.errorLogHandle("请配置参数[options host > object]!!!");
                    reject();
                }
                resolve();
            }));
        },
        infoLogHandle: function (logMsg) {
            let _this = this;
            if (_this.options.displayLog) {
                console.log("DANMU INFO LOG:", logMsg, new Date());
            }
        },
        errorLogHandle: function (logMsg) {
            console.error("DANMU ERROR LOG:", logMsg, new Date());
        },
    }
 
    window.DanMu = DanMu;
}());