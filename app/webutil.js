/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2012 Joel Martin
 * Copyright (C) 2013 NTT corp.
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 */

/*jslint bitwise: false, white: false, browser: true, devel: true */
/*global Util, window, document */

import { init_logging as main_init_logging } from '../core/util/logging.js'; 

// init log level reading the logging HTTP param
export function init_logging (level) {
    "use strict";
    if (typeof level !== "undefined") {
        main_init_logging(level);
    } else {
        var param = document.location.href.match(/logging=([A-Za-z0-9\._\-]*)/);
        main_init_logging(param || undefined);
    }
};

// Read a query string variable
export function getQueryVar (name, defVal) {
    "use strict";
    var re = new RegExp('.*[?&]' + name + '=([^&#]*)'),
        match = document.location.href.match(re);
    if (typeof defVal === 'undefined') { defVal = null; }
    if (match) {
        return decodeURIComponent(match[1]);
    } else {
        return defVal;
    }
};

// Read a hash fragment variable
export function getHashVar (name, defVal) {
    "use strict";
    var re = new RegExp('.*[&#]' + name + '=([^&]*)'),
        match = document.location.hash.match(re);
    if (typeof defVal === 'undefined') { defVal = null; }
    if (match) {
        return decodeURIComponent(match[1]);
    } else {
        return defVal;
    }
};

// Read a variable from the fragment or the query string
// Fragment takes precedence
export function getConfigVar (name, defVal) {
    "use strict";
    var val = getHashVar(name);
    if (val === null) {
        val = getQueryVar(name, defVal);
    }
    return val;
};

/*
 * Cookie handling. Dervied from: http://www.quirksmode.org/js/cookies.html
 */

// No days means only for this browser session
export function createCookie (name, value, days) {
    "use strict";
    var date, expires;
    if (days) {
        date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
    } else {
        expires = "";
    }

    var secure;
    if (document.location.protocol === "https:") {
        secure = "; secure";
    } else {
        secure = "";
    }
    document.cookie = name + "=" + value + expires + "; path=/" + secure;
};

export function readCookie (name, defaultValue) {
    "use strict";
    var nameEQ = name + "=",
        ca = document.cookie.split(';');

    for (var i = 0; i < ca.length; i += 1) {
        var c = ca[i];
        while (c.charAt(0) === ' ') { c = c.substring(1, c.length); }
        if (c.indexOf(nameEQ) === 0) { return c.substring(nameEQ.length, c.length); }
    }
    return (typeof defaultValue !== 'undefined') ? defaultValue : null;
};

export function eraseCookie (name) {
    "use strict";
    createCookie(name, "", -1);
};

/*
 * Setting handling.
 */

var settings = {};

export function initSettings (callback /*, ...callbackArgs */) {
    "use strict";
    var callbackArgs = Array.prototype.slice.call(arguments, 1);
    if (window.chrome && window.chrome.storage) {
        window.chrome.storage.sync.get(function (cfg) {
            settings = cfg;
            console.log(settings);
            if (callback) {
                callback.apply(this, callbackArgs);
            }
        });
    } else {
        // No-op
        if (callback) {
            callback.apply(this, callbackArgs);
        }
    }
};

// No days means only for this browser session
export function writeSetting (name, value) {
    "use strict";
    if (window.chrome && window.chrome.storage) {
        //console.log("writeSetting:", name, value);
        if (settings[name] !== value) {
            settings[name] = value;
            window.chrome.storage.sync.set(settings);
        }
    } else {
        localStorage.setItem(name, value);
    }
};

export function readSetting (name, defaultValue) {
    "use strict";
    var value;
    if (window.chrome && window.chrome.storage) {
        value = settings[name];
    } else {
        value = localStorage.getItem(name);
    }
    if (typeof value === "undefined") {
        value = null;
    }
    if (value === null && typeof defaultValue !== undefined) {
        return defaultValue;
    } else {
        return value;
    }
};

export function eraseSetting (name) {
    "use strict";
    if (window.chrome && window.chrome.storage) {
        window.chrome.storage.sync.remove(name);
        delete settings[name];
    } else {
        localStorage.removeItem(name);
    }
};

export function injectParamIfMissing (path, param, value) {
    // force pretend that we're dealing with a relative path
    // (assume that we wanted an extra if we pass one in)
    path = "/" + path;

    var elem = document.createElement('a');
    elem.href = path;

    var param_eq = encodeURIComponent(param) + "=";
    var query;
    if (elem.search) {
        query = elem.search.slice(1).split('&');
    } else {
        query = [];
    }

    if (!query.some(function (v) { return v.startsWith(param_eq); })) {
        query.push(param_eq + encodeURIComponent(value));
        elem.search = "?" + query.join("&");
    }

    // some browsers (e.g. IE11) may occasionally omit the leading slash
    // in the elem.pathname string. Handle that case gracefully.
    if (elem.pathname.charAt(0) == "/") {
        return elem.pathname.slice(1) + elem.search + elem.hash;
    } else {
        return elem.pathname + elem.search + elem.hash;
    }
};

// Emulate Element.setCapture() when not supported

var _captureElem = undefined;
var _captureRecursion = false;
export function _captureProxy (e) {
    // Recursion protection as we'll see our own event
    if (_captureRecursion) return;

    // Clone the event as we cannot dispatch an already dispatched event
    var newEv = new e.constructor(e.type, e);

    _captureRecursion = true;
    _captureElem.dispatchEvent(newEv);
    _captureRecursion = false;

    // Implicitly release the capture on button release
    if ((e.type === "mouseup") || (e.type === "touchend")) {
        releaseCapture();
    }
};

export function setCapture (elem) {
    if (elem.setCapture) {

        elem.setCapture();

        // IE releases capture on 'click' events which might not trigger
        elem.addEventListener('mouseup', releaseCapture);
        elem.addEventListener('touchend', releaseCapture);

    } else {
        // Safari on iOS 9 has a broken constructor for TouchEvent.
        // We are fine in this case however, since Safari seems to
        // have some sort of implicit setCapture magic anyway.
        if (window.TouchEvent !== undefined) {
            try {
                new TouchEvent("touchstart");
            } catch (TypeError) {
                return;
            }
        }

        var captureElem = document.getElementById("noVNC_mouse_capture_elem");

        if (captureElem === null) {
            captureElem = document.createElement("div");
            captureElem.id = "noVNC_mouse_capture_elem";
            captureElem.style.position = "fixed";
            captureElem.style.top = "0px";
            captureElem.style.left = "0px";
            captureElem.style.width = "100%";
            captureElem.style.height = "100%";
            captureElem.style.zIndex = 10000;
            captureElem.style.display = "none";
            document.body.appendChild(captureElem);

            captureElem.addEventListener('mousemove', _captureProxy);
            captureElem.addEventListener('mouseup', _captureProxy);

            captureElem.addEventListener('touchmove', _captureProxy);
            captureElem.addEventListener('touchend', _captureProxy);
        }

        _captureElem = elem;
        captureElem.style.display = null;

        // We listen to events on window in order to keep tracking if it
        // happens to leave the viewport
        window.addEventListener('mousemove', _captureProxy);
        window.addEventListener('mouseup', _captureProxy);

        window.addEventListener('touchmove', _captureProxy);
        window.addEventListener('touchend', _captureProxy);
    }
};

export function releaseCapture () {
    if (document.releaseCapture) {

        document.releaseCapture();

    } else {
        var captureElem = document.getElementById("noVNC_mouse_capture_elem");
        _captureElem = null;
        captureElem.style.display = "none";

        window.removeEventListener('mousemove', _captureProxy);
        window.removeEventListener('mouseup', _captureProxy);

        window.removeEventListener('touchmove', _captureProxy);
        window.removeEventListener('touchend', _captureProxy);
    }
};
