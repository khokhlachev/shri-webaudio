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
    var drawVisual;
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
    //var timeDomain = new Uint8Array(bufferLength);
    var step = Math.round(freqDomain.length / columnsCount);

    var gradient = canvasCtx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0.9, '#00ff00');
    gradient.addColorStop(0.6, '#ffff00');
    gradient.addColorStop(0, '#ff0000');

    //analyser.getByteFrequencyData(freqDomain);
    //canvasCtx.fillStyle = 'rgb(0, 0, 0)';
    //canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    function drawFrequencyDomain() {
        //console.log('drawFrequencyDomain');
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

            //console.log('allCapsHasFallen', allCapsHasFallen);

            if (allCapsHasFallen) {
                console.log('allCapsHasFallen', allCapsHasFallen);
                cancelAnimationFrame(drawVisual);
                return false;
            }

        }

        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

        for (var i = 0; i < columnsCount; i++) {
            //console.log('i * step', i * step);
            value = freqDomain[i * step];
            //console.log('value', value);
            percent = value / 256;
            barHeight = HEIGHT * percent;

            if (capYPositionArray.length <= columnsCount) {
                capYPositionArray.push(barHeight);
            }

            canvasCtx.fillStyle = 'rgb(' + (value + 100) + ', 50, 50)';

            if (capYPositionArray[i] > barHeight) {
                canvasCtx.fillRect(i * barWidth, HEIGHT - (--capYPositionArray[i]), barWidth, 2);
            } else {
                canvasCtx.fillRect(i * barWidth, HEIGHT, barWidth, 2);
                capYPositionArray[i] = barHeight;
            }

            canvasCtx.fillStyle = gradient;
            canvasCtx.fillRect(i * barWidth, HEIGHT, barWidth, barHeight * -1);
        }

        drawVisual = requestAnimationFrame(drawFrequencyDomain);
    };

    drawFrequencyDomain();

    //function drawTimeDomain() {
    //    drawVisual = requestAnimationFrame(drawTimeDomain);
    //    analyser.getByteTimeDomainData(timeDomain);
    //
    //    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
    //    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    //    canvasCtx.lineWidth = 2;
    //    canvasCtx.strokeStyle = 'rgb(10, 10, 10)';
    //
    //    canvasCtx.beginPath();
    //    //
    //    var sliceWidth = WIDTH * 1.0 / bufferLength;
    //    var x = 0;
    //
    //    for (var i = 0; i < bufferLength; i++) {
    //        var value = timeDomain[i] / 128;
    //        var y = value * HEIGHT / 2;
    //
    //        if (i === 0) {
    //            canvasCtx.moveTo(x, y);
    //        } else {
    //            canvasCtx.lineTo(x, y);
    //        }
    //
    //        x += sliceWidth;
    //    }
    //
    //
    //    canvasCtx.lineTo(WIDTH, HEIGHT / 2);
    //    canvasCtx.stroke();
    //};

    //drawTimeDomain();
};

AudioPlayer.prototype.play = function () {

    if (! this.sound) {
        this.$elements.$file.trigger('click');
        return false;
    }

    this.sound.play();
    this._initVisual();
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

    this.$elements.$timelineBg.on('mousedown', function (e) {
        _this._startSeek(e);
    });
    this.$elements.$timelineBg.on('mouseleave mouseup', function () {
        _this._stopSeek();
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
    var timelineWidth = this.$elements.$timelineBg.width();
    var offsetLeft = this.$elements.$timelineWrapper[0].offsetLeft;

    function _changeTime(e) {
        _this._setTimePerc((e.clientX - offsetLeft) / timelineWidth);
    }

    _changeTime(eDown);

    this.$elements.$timelineBg.on('mousemove', function (eMove) {
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
    this.$elements.$timelineBg.off('mousemove');
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
    new AudioPlayer({
        $el: $(this)
    });
});




