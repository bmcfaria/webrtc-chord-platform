/*
    Copyright 2015 Bruno Faria, Instituto de Telecomunicações

    This file is part of WebRTC Chord Platform.

    WebRTC Chord Platform is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    WebRTC Chord Platform is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with WebRTC Chord Platform.  If not, see <http://www.gnu.org/licenses/>.
*/

var args = process.argv.slice(2);

var configFileName = 'config-default.json';

if (typeof args[0] !== 'undefined') {
    configFileName = args[0];
}

var debug = false;
var url = 'http://localhost:8080';
var m = 3;
var sha1 = false;

var configFile = require('./'+configFileName);

if (typeof configFile !== 'undefined') {
    if (typeof configFile.debug !== 'undefined') {
        debug = configFile.debug;
    }

    if (typeof configFile.url !== 'undefined') {
        url = configFile.url;
    }

    if (typeof configFile.m !== 'undefined') {
        m = configFile.m;
    }

    if (typeof configFile.sha1 !== 'undefined') {
        sha1 = configFile.sha1;
    }
}

var io = require('socket.io')(process.env.PORT || 8080);

var chordServer = require('./src/chordServer.js');

chordServer.start(io, {debug: debug, url: url, m: m, sha1: sha1});