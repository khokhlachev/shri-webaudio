(function (window, rAF, cAF) {
    var lastTime = 0, vendors = ['ms', 'moz', 'webkit', 'o'], x;

    for (x = 0; x < vendors.length && !window[rAF]; ++x) {
        window[rAF] = window[vendors[x] + 'RequestAnimationFrame'];
        window[cAF] = window[vendors[x] + 'CancelAnimationFrame']
        || window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window[rAF]) {
        window[rAF] = function (callback) {
            var currTime = new Date().getTime(),
                timeToCall = Math.max(0, 16 - (currTime - lastTime)),
                id = window.setTimeout(function () { callback(currTime + timeToCall); }, timeToCall);

            lastTime = currTime + timeToCall;

            return id;
        };
    }

    if (! window[cAF]) {
        window[cAF] = function (id) {
            window.clearTimeout(id);
        };
    }
}(window, 'requestAnimationFrame', 'cancelAnimationFrame'));

window.AudioPlayer = function AudioPlayer(options) {
    this.$el = options.$el;
    this.el = options.$el[0];

    this.duration = this.el.duration;

    var defaults = {
        cssClass: 'b-audio-player',
        controls: ['play', 'timeline', 'file'],
        visualizer: {
            enabled: true,
            width: 600,
            height: 200
        }
    };

    this.options = $.extend(defaults, options);

    /**
     * константы
     * классов состояний
     */
    this.cssClasses = {
        'PLAY': 'is-play',
        'PAUSE': 'is-pause',
        'ENDED': 'is-ended'
    };

    this._initMarkup();
    this._initEvents();

    this.state = {
        title: null
    };

    this.sound = null;

    //return this;
};

AudioPlayer.prototype._updateTitle = function (string) {
    this.$elements.$title.html(string);
}

AudioPlayer.prototype._initEQ = function () {
    var _this = this;
    var midFrequenciesToFilter = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    var eqFilters = [];

    function _createFilter(frequency) {
        var filter = _this.sound.audioCtx.createBiquadFilter();

        filter.type = 'peaking';
        filter.frequency.value = frequency;
        filter.Q.value = 1;
        filter.gain.value = 0;

        return filter;
    }

    eqFilters = midFrequenciesToFilter.map(_createFilter);
    eqFilters.reduce(function (prev, curr) {
        prev.connect(curr);
        return curr;
    });

    this.eq = {
        connect: function () {
            _this.sound.sourceNode.connect(eqFilters[0]);
            eqFilters[eqFilters.length - 1].connect(_this.sound.audioCtx.destination);
        },
        set: function (i, value) {
            eqFilters[i].gain.value = value;
        }
    };

    this.eq.connect();
}

AudioPlayer.prototype._initVisual = function () {
    var _this = this;
    var analyser = this.sound.audioCtx.createAnalyser();
    var WIDTH = this.options.visualizer.width;
    var HEIGHT = this.options.visualizer.height;
    var canvas = this.$elements.$visualizer[0];
    var canvasCtx = canvas.getContext('2d');
    var capYPositionArray = [];
    var columnsCount = 64;
    var barWidth = Math.round(WIDTH / columnsCount);
    var allCapsHasFallen = false;

    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    this.sound.sourceNode.connect(analyser);
    analyser.connect(this.sound.audioCtx.destination);

    analyser.fftSize = 256;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -5;
    analyser.smoothingTimeConstant = 0.85;
    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    var bufferLength = analyser.frequencyBinCount;
    var freqDomain = new Uint8Array(bufferLength);
    var timeDomain = new Uint8Array(bufferLength);
    var step = Math.round(freqDomain.length / columnsCount);

    var gradient = canvasCtx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0.8, '#1944CD');
    gradient.addColorStop(0.45, '#6A10CA');
    gradient.addColorStop(0, '#CA1093');

    var animations = this.animations = {
        currentAnimationId: null,
        currentAnimationName: 'freqDomain',
        connect: function () {
            _this.sound.sourceNode.connect(analyser);
            analyser.connect(_this.sound.audioCtx.destination);
        },
        resume: function () {
            cancelAnimationFrame(animations.currentAnimationId);
            this.loop();
        },
        freqDomain: function drawFrequencyDomain() {
            console.log('drawFrequencyDomain');
            analyser.getByteFrequencyData(freqDomain);

            var barHeight;
            var value;
            var percent;

            if (_this.sound.paused) {
                for (var j = 0; j < freqDomain.length; j++) {
                    freqDomain[j] = 0;
                }

                allCapsHasFallen = true;

                capYPositionArray.forEach(function (cap) {
                    allCapsHasFallen = allCapsHasFallen && cap === 0;
                });

                if (allCapsHasFallen) {
                    cancelAnimationFrame(animations.currentAnimationId);
                    return false;
                }
            }

            canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

            for (var i = 0; i < columnsCount; i++) {
                value = freqDomain[i * step];
                percent = value / 256;
                barHeight = HEIGHT * percent;

                if (capYPositionArray.length <= columnsCount) {
                    capYPositionArray.push(barHeight);
                }

                canvasCtx.fillStyle = 'rgb(' + (value + 100) + ', 50, 50)';

                if (capYPositionArray[i] > barHeight) {
                    canvasCtx.fillRect(i * (barWidth + 2), HEIGHT - (--capYPositionArray[i]), barWidth, 2);
                } else {
                    canvasCtx.fillRect(i * (barWidth + 2), HEIGHT, barWidth, 2);
                    capYPositionArray[i] = barHeight;
                }

                canvasCtx.fillStyle = gradient;
                canvasCtx.fillRect(i * (barWidth + 2), HEIGHT, barWidth, barHeight * -1);
            }

            animations.loop();
        },
        timeDomain: function drawTimeDomain() {
            if (_this.sound.paused) {
                cancelAnimationFrame(animations.currentAnimationId);
                canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
                return false;
            }

            analyser.getByteTimeDomainData(timeDomain);
            canvasCtx.fillStyle = 'rgb(200, 200, 200)';
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = 'rgb(230, 230, 230)';

            canvasCtx.beginPath();

            var sliceWidth = WIDTH * 1.0 / bufferLength;
            var x = 0;

            canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

            for (var i = 0; i < bufferLength; i++) {
                var value = timeDomain[i] / 128;
                var y = value * HEIGHT / 2;

                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            canvasCtx.lineTo(WIDTH, HEIGHT / 2);
            canvasCtx.stroke();

            animations.loop();
        },
        loop: function () {
            this.currentAnimationId = requestAnimationFrame(animations[animations.currentAnimationName]);
        },
        setFftSize: function (fftSize) {
            analyser.fftSize = fftSize;
        }
    };

    animations.loop();
};

AudioPlayer.prototype.setAnimation = function (name) {
    this.animations.currentAnimationName = name;

    switch(name) {
        case 'freqDomain':
            this.animations.setFftSize(256);
            break;
        case 'timeDomain':
            this.animations.setFftSize(2048);
            break;
        default:
            return false;
    }
};

AudioPlayer.prototype.swapAnimation = function () {
    if (this.animations.currentAnimationName === 'freqDomain') {
        this.setAnimation('timeDomain');
    } else {
        this.setAnimation('freqDomain');
    }
}

AudioPlayer.prototype.play = function () {

    if (! this.sound) {
        this.$elements.$file.trigger('click');
        return false;
    }

    this.sound.play();

    if (this.animations && this.eq) {
        this.eq.connect();
        this.animations.connect();
        this.animations.resume();
    } else {
        this._initEQ();
        this._initVisual();
    }

    this._setClassName('PLAY');
}

AudioPlayer.prototype.pause = function () {
    this.sound.pause();
    this._setClassName('PAUSE');
}

AudioPlayer.prototype.stop = function () {
    this.sound.stop();
    this.sound = null;
}

AudioPlayer.prototype._initMarkup = function () {
    var _this = this;

    this.$elements = {
        $title: _this.$el.find('[data-audio-player-title]'),
        $file: _this.$el.find('[data-audio-player-input]'),
        $visualizer: _this.$el.find('[data-audio-player-canvas]'),
        $dragAndDropScreen: _this.$el.find('[data-audio-player-dropzone]'),
        $play: _this.$el.find('[data-audio-player-play-pause]'),
        $timelineWrapper: _this.$el.find('[data-audio-player-timeline-wrapper]'),
        $timeline: _this.$el.find('[data-audio-player-timeline]'),
        $timelineBg: _this.$el.find('[data-audio-player-timeline-bg]')
    };
}

AudioPlayer.prototype._setClassName = function (classNameConstant) {
    var restClassNames = [];

    for (key in this.cssClasses) {
        if (key !== classNameConstant) {
            restClassNames.push(this.cssClasses[key])
        }
    }

    this.$el.removeClass(restClassNames.join(' '));
    this.$el.addClass(this.cssClasses[classNameConstant]);
}

AudioPlayer.prototype._initEvents = function () {
    var _this = this;

    function _handleNewFile(file) {
        _this.state.fileName = file.name;

        _this._updateTitle('loading...');

        if (_this.sound) {
            _this.stop();
        }

        _this.sound = new Sound(file, null, function (err) {
            if (err) {
                throw new Error(err);
            }

            _this._updateTitle(file.name);

            if (_this.options.controls.indexOf('timeline') !== -1) {
                this.ontimeupdate = function () {
                    _this._timelineUpdate();
                }
            }

            _this.play();
        });
    }

    this.$elements.$file.on('change', function () {
        if (! this.files.length) {
            return false;
        }

        _handleNewFile(this.files[0]);
    });

    this.$elements.$play.on('click', function () {
        if (_this.sound.paused) {
            _this.play();
        } else {
            _this.pause();
        }
    });

    this.$elements.$timelineWrapper.on('mousedown', function (e) {
        _this._startSeek(e);
    });
    this.$elements.$timelineWrapper.on('mouseleave mouseup', function () {
        _this._stopSeek();
    });

    this.$elements.$visualizer.on('click', function () {
        _this.swapAnimation();
    });

    this.$el.find('[data-audio-player-eq-control]').each(function (i, el) {
        var $el = $(el);

        $el.on('change', function (e) {
            //console.log(e.target.value);
            _this.eq.set(i, e.target.value - 50);
        });
    });

    var dragCounter = 0;

    // drag and drop
    $(document).on('dragenter', function (e) {
        e.preventDefault();
        dragCounter++;
        _this.$elements.$dragAndDropScreen.addClass('is-shown');
    });

    $(document).on('dragleave', function () {
        dragCounter--;

        if (dragCounter === 0) {
            console.log('dragleave');
            _this.$elements.$dragAndDropScreen.removeClass('is-shown');
        }
    });

    $(document).on('dragover', function (e) {
        e.stopPropagation();
        e.preventDefault();

        e.originalEvent.dataTransfer.dropEffect = 'copy';
    });

    $(document).on('drop', function (e) {
        e.stopPropagation();
        e.preventDefault();

        _handleNewFile(e.originalEvent.dataTransfer.files[0]);
        _this.$elements.$dragAndDropScreen.removeClass('is-shown');
    });

}

/**
 * старт перемотки
 * @param eDown
 * @private
 */
AudioPlayer.prototype._startSeek = function (eDown) {
    console.log('_startSeek');
    var _this = this;
    var timelineWidth = this.$elements.$timelineWrapper.width();
    var offsetLeft = this.$elements.$timelineWrapper[0].offsetLeft;

    function _changeTime(e) {
        _this._setTimePerc((e.clientX - offsetLeft) / timelineWidth);
    }

    _changeTime(eDown);

    this.$elements.$timelineWrapper.on('mousemove', function (eMove) {
        //_this.pause();
        _changeTime(eMove);
    });


}

/**
 * стоп перемотки
 * @private
 */
AudioPlayer.prototype._stopSeek = function () {
    //this.play();
    this.$elements.$timelineWrapper.off('mousemove');
}

/**
 * установка текущего
 * времени воспроизведения
 * @param seconds
 * @private
 */
AudioPlayer.prototype._setTime = function (seconds) {
    if (! this.sound) {
        return false;
    }

    console.log('_setTime');
    this.sound.setTime(seconds);

    this.eq.connect();
    this.animations.connect();
}

/**
 * установка текущего
 * времени воспроизведения
 * в процентах
 * @param perc
 * @private
 */
AudioPlayer.prototype._setTimePerc = function (perc) {
    this._setTime(this.sound.duration * perc);
}


AudioPlayer.prototype._timelineUpdate = function () {
    var progress = this.sound.currentTime / this.sound.duration;
    this.$elements.$timeline.css('width', progress * 100 + '%');
}

AudioPlayer.prototype.destroy = function () {
    this.$el.off();
}

var $players = $('[data-audio-player]');
$players.each(function () {
    window.ThisPlayer = new AudioPlayer({
        $el: $(this)
    });
});




