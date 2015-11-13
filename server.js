
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