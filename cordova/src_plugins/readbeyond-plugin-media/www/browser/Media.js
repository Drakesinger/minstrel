//
//            _           _            _ 
//           (_)         | |          | |
//  _ __ ___  _ _ __  ___| |_ _ __ ___| |
// | '_ ` _ \| | '_ \/ __| __| '__/ _ \ |
// | | | | | | | | | \__ \ |_| | |  __/ |
// |_| |_| |_|_|_| |_|___/\__|_|  \___|_|
//
// Author:      Alberto Pettarin (www.albertopettarin.it)
// Copyright:   Copyright 2013-2015, ReadBeyond Srl (www.readbeyond.it)
// License:     MIT
// Email:       minstrel@readbeyond.it
// Web:         http://www.readbeyond.it/minstrel/
// Status:      Production
//

// based on the source code of the official Cordova Media plugin
// available under the Apache License Version 2.0 License
// https://github.com/apache/cordova-plugin-media

var argscheck = require('cordova/argscheck'),
    utils = require('cordova/utils');

var mediaObjects = {};

/**
 * Creates new Audio node and with necessary event listeners attached
 * @param  {Media} media Media object
 * @return {Audio}       Audio element 
 */
function createNode (media) {
    var node = new Audio();

    node.onloadstart = function () {
        Media.onStatus(media.id, Media.MEDIA_STATE, Media.MEDIA_STARTING);
    };

    node.onplaying = function () {
        Media.onStatus(media.id, Media.MEDIA_STATE, Media.MEDIA_RUNNING);
    };

    node.ondurationchange = function (e) {
        Media.onStatus(media.id, Media.MEDIA_DURATION, e.target.duration || -1);
    };

    node.onerror = function (e) {
        // Due to media.spec.15 It should return MediaError for bad filename
        var err = e.target.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ?
            { code: MediaError.MEDIA_ERR_ABORTED } :
            e.target.error;

        Media.onStatus(media.id, Media.MEDIA_ERROR, err);
    };

    node.onended = function () {
        Media.onStatus(media.id, Media.MEDIA_STATE, Media.MEDIA_STOPPED);
    };

    if (media.src) {
        node.src = media.src;
    }

    return node;
}

/**
 * This class provides access to the device media, interfaces to both sound and video
 *
 * @constructor
 * @param src                   The file name or url to play
 * @param successCallback       The callback to be called when the file is done playing or recording.
 *                                  successCallback()
 * @param errorCallback         The callback to be called if there is an error.
 *                                  errorCallback(int errorCode) - OPTIONAL
 * @param statusCallback        The callback to be called when media status has changed.
 *                                  statusCallback(int statusCode) - OPTIONAL
 */
var Media = function(src, successCallback, errorCallback, statusCallback) {
    // S = string, F = function
    argscheck.checkArgs('SFFF', 'Media', arguments);
    this.id = utils.createUUID();
    mediaObjects[this.id] = this;
    this.src = src;
    this.successCallback = successCallback;
    this.errorCallback = errorCallback;
    this.statusCallback = statusCallback;
    this._duration = -1;
    this._position = -1;

    Media.onStatus(this.id, Media.MEDIA_STATE, Media.MEDIA_STARTING);
    
    try {
        this.node = createNode(this);
    } catch (err) {
        Media.onStatus(this.id, Media.MEDIA_ERROR, { code: MediaError.MEDIA_ERR_ABORTED });
    }
};

// Media messages
Media.MEDIA_STATE = 1;
Media.MEDIA_DURATION = 2;
Media.MEDIA_POSITION = 3;
Media.MEDIA_ERROR = 9;

// Media states
Media.MEDIA_NONE = 0;
Media.MEDIA_STARTING = 1;
Media.MEDIA_RUNNING = 2;
Media.MEDIA_PAUSED = 3;
Media.MEDIA_STOPPED = 4;
Media.MEDIA_COMPLETED = 5;
Media.MEDIA_MSG = ["None", "Starting", "Running", "Paused", "Stopped", "Completed"];

/**
 * Start or resume playing audio file.
 */
Media.prototype.play = function() {

    // if Media was released, then node will be null and we need to create it again
    if (!this.node) {
        try {
            this.node = createNode(this);
        } catch (err) {
            Media.onStatus(this.id, Media.MEDIA_ERROR, { code: MediaError.MEDIA_ERR_ABORTED });
        }
    }

    this.node.play();
};

/**
 * Stop playing audio file.
 */
Media.prototype.stop = function() {
    try {
        this.pause();
        this.seekTo(0);
        Media.onStatus(this.id, Media.MEDIA_STATE, Media.MEDIA_STOPPED);
    } catch (err) {
        Media.onStatus(this.id, Media.MEDIA_ERROR, err);
    }
};

/**
 * Seek or jump to a new time in the track..
 */
Media.prototype.seekTo = function(milliseconds) {
    try {
        this.node.currentTime = milliseconds / 1000;
    } catch (err) {
        Media.onStatus(this.id, Media.MEDIA_ERROR, err);
    }
};

/**
 * Pause playing audio file.
 */
Media.prototype.pause = function() {
    try {
        this.node.pause();
        Media.onStatus(this.id, Media.MEDIA_STATE, Media.MEDIA_PAUSED);
    } catch (err) {
        Media.onStatus(this.id, Media.MEDIA_ERROR, err);
    }};

/**
 * Get duration of an audio file.
 * The duration is only set for audio that is playing, paused or stopped.
 *
 * @return      duration or -1 if not known.
 */
Media.prototype.getDuration = function() {
    return this._duration;
};

/**
 * Get position of audio.
 */
Media.prototype.getCurrentPosition = function(success, fail) {
    try {
        var p = this.node.currentTime;
        Media.onStatus(this.id, Media.MEDIA_POSITION, p);
        success(p);
    } catch (err) {
        fail(err);
    }
};

/**
 * Release the resources.
 */
Media.prototype.release = function() {
    try {
        delete this.node;
    } catch (err) {
        Media.onStatus(this.id, Media.MEDIA_ERROR, err);
    }};

/**
 * Adjust the volume.
 */
Media.prototype.setVolume = function(volume) {
    this.node.volume = volume;
};

/**
 * Adjust the playback speed.
 */
Media.prototype.setPlaybackSpeed = function(speed) {
    this.node.playbackRate = speed;
};

/**
 * Audio has status update.
 * PRIVATE
 *
 * @param id            The media object id (string)
 * @param msgType       The 'type' of update this is
 * @param value         Use of value is determined by the msgType
 */
Media.onStatus = function(id, msgType, value) {

    var media = mediaObjects[id];

    if(media) {
        switch(msgType) {
            case Media.MEDIA_STATE :
                media.statusCallback && media.statusCallback(value);
                if(value === Media.MEDIA_COMPLETED) {
                    media.successCallback && media.successCallback();
                }
                break;
            case Media.MEDIA_DURATION :
                media._duration = value;
                break;
            case Media.MEDIA_ERROR :
                media.errorCallback && media.errorCallback(value);
                break;
            case Media.MEDIA_POSITION :
                media._position = Number(value);
                break;
            default :
                console.error && console.error("Unhandled Media.onStatus :: " + msgType);
                break;
        }
    } else {
         console.error && console.error("Received Media.onStatus callback for unknown media :: " + id);
    }
};

module.exports = Media;
