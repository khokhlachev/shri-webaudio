window.AudioContext = window.AudioContext || window.webkitAudioContext;

(function (window) {
    window.Sound = function Sound(file, options, callback) {
        var _this = this;

        this.media = {
            source: null,
            sourceNode: null,
            audioCtx: new AudioContext()
        };

        this._decodeFile(file, callback);

        this.state = {
            currentTime: 0,
            startedAt: null,
            pausedAt: null,
            paused: true,
            loop: options && options.loop || false,
            autoplay: options && options.autoplay || false
        }

        Object.defineProperties(this, {
            'paused': {
                'get': function () {
                    return _this.state.paused;
                }
            },
            'currentTime': {
                'get': function () {
                    return _this.state.currentTime;
                }
            },
            'duration': {
                'get': function () {
                    return _this.state.duration;
                }
            },
            'source': {
                'get': function () {
                    return _this.media.source;
                }
            },
            'sourceNode': {
                'get': function () {
                    return _this.media.sourceNode;
                }
            },
            'audioCtx': {
                'get': function () {
                    return _this.media.audioCtx;
                }
            }
        });

        // events
        this.ontimeupdate = null;
        this.onended = null;
        this.onloaded = null;
    }

    Sound.prototype.setTime = function (seconds) {
        if (seconds < 0 || seconds > this.state.duration) {
            console.log('invalid time input');
            return false;
        }

        this.pause();
        this.state.currentTime = seconds;
        this.play();
    }

    Sound.prototype._start = function (offset) {
        var _this = this;
        var audioBufferSourceNode = this.media.audioCtx.createBufferSource();
        offset = offset || 0;

        audioBufferSourceNode.connect(this.media.audioCtx.destination);
        audioBufferSourceNode.buffer = this.media.source;
        audioBufferSourceNode.loop = this.state.loop;

        this.media.sourceNode = audioBufferSourceNode;

        this.media.sourceNode.start(0, offset);
    }

    Sound.prototype.play = function () {
        console.log('play');
        if (this.state.paused && this.state.currentTime) {
            this._start(this.state.currentTime);
        } else {
            this._start();
        }

        this.state.paused = false;
        this.state.startedAt = Date.now();
        this._trackTime();
    }

    Sound.prototype.pause = function () {
        if (this.state.paused) {
            return false;
        }

        this.state.pausedAt = Date.now();
        this.stop(true);
    }

    Sound.prototype.stop = function (isPause) {
        this.media.sourceNode.stop(0);
        this._trackTimeStop();

        this.state.paused = true;

        if (! isPause) {
            this.state.currentTime = 0;
        }
    }

    Sound.prototype._trackTime = function () {
        var _this = this;

        this._trackTimeInterval = setInterval(function () {
            _this.state.currentTime += 100 / 1000;

            if (_this.state.currentTime >= _this.duration) {
                _this.state.currentTime = _this.duration;
                _this._trackTimeStop();
                _this.stop();

                if (typeof _this.onended === 'function') {
                    _this.onended();
                }
            }

            if (typeof _this.ontimeupdate === 'function') {
                _this.ontimeupdate(_this.state.currentTime);
            }

            //console.log('_this.state.currentTime', _this.state.currentTime);
        }, 100);
    }

    Sound.prototype._trackTimeStop = function () {
        clearInterval(this._trackTimeInterval);
    }

    Sound.prototype._decodeFile = function (file, callback) {
        var _this = this;
        var fileReader = new FileReader();

        fileReader.onloadend = function () {
            _this.media.audioCtx.decodeAudioData(this.result, function (arrBuffer) {
                _this.media.source = arrBuffer;

                var audioBufferSourceNode = _this.media.audioCtx.createBufferSource();

                audioBufferSourceNode.connect(_this.media.audioCtx.destination);
                audioBufferSourceNode.buffer = _this.media.source;

                _this.media.sourceNode = audioBufferSourceNode;
                _this.state.duration = _this.media.source.duration;

                if (typeof callback === 'function') {
                    callback.apply(_this, null, _this.media.sourceNode);
                }

                if (typeof _this.onloaded === 'function') {
                    _this.onloaded();
                }
            }, function (e) {
                if (typeof callback === 'function') {
                    callback(e);
                }
            });
        }

        fileReader.readAsArrayBuffer(file);
    }
})(window);
