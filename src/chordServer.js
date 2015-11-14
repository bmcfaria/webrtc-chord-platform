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

var fs = require('fs');

var SHA1 = require("crypto-js/sha1");
var bigInt = require("big-integer");

var Chord = require("./chordSocketBinding.js");

var eventHandler = {};
var numbers = [];
var connections = {};
var heartbeatTable = {};
var myId = {};
var fingerTable = {};
var chord = {};

var on = function(event, cb) {
    eventHandler[event] = cb;
}

var start = function(io, config) {

    var debug = true;
    var myUrl = 'http://localhost:8080';
    var m = 128;
    var sha1Flag = true;

    if (config) {
        if (typeof config.debug === 'boolean') {
            debug = config.debug;
            //console.log("debug: ", config.debug);
        }

        if (typeof config.url === 'string') {
            myUrl = config.url;
            //console.log("url: ", config.url);
        }

        if (typeof config.m === 'number') {
            m = config.m;
            //console.log("m: ", config.m);
        }

        if (typeof config.sha1 === 'boolean') {
            sha1Flag = config.sha1;
            //console.log("sha1: ", config.sha1);
        }
    }

    //returns a SHA1 hash truncated to m bits
    function getBigIntHash(value, m) {
        if (sha1Flag) {
            var hash = SHA1(value + "").toString();
            var returnValue = bigInt(hash, 16).and(bigInt(2).pow(m).minus(1));
            return returnValue;
        } else {
            //May loose precision for bigger n
            var returnValue = bigInt(eval(value)).and(bigInt(2).pow(m).minus(1));
            return returnValue;
        }
    }

    myId = getBigIntHash(0, m);
    numbers.push(myId.toString(16));

    chord = new Chord({
        //debug: debug,
        debug: debug,
        id: myId.toString(16),
        url: myUrl
    });
    connections = chord.getConnections();

    var signalling = chord.getSignalling();

    fingerTable = chord.getFingerTable();
    fingerTable.setId(myId);
    fingerTable.setM(m);
    fingerTable.calculate();

    function getBaseLog(x, y) {
        return Math.log(y) / Math.log(x);
    }

    var count = bigInt(1);

    chord.setRegisteringNode(myId.toString(16));

    if (typeof eventHandler['chord_reconnect'] === 'undefined') {
        eventHandler['chord_reconnect'] = function(socket, id, listOfActivePeers) {
            if (debug === true) {
                console.log("RECONNECT " + id);
            }
            if (typeof id === 'undefined') {
                console.error("On reconnect, id is undefined");
            } else {

                var tmpIndex = numbers.indexOf(id);
                if (tmpIndex !== -1) {
                    //It means someone else is using this id or someone already informed the server about this id being active
                } else {
                    numbers.push(id);
                }
                heartbeatTable[id] = new Date().getTime();
                connections[id] = socket;
                chord.setSuccessor(id);

                //To inform about it's active peer connections
                if (typeof listOfActivePeers !== 'undefined') {
                    for (var key in listOfActivePeers) {
                        if (numbers.indexOf(key) === -1) {
                            numbers.push(key);
                            heartbeatTable[id] = new Date().getTime();
                        }
                    }
                }

            }
        };
    }

    if (typeof eventHandler['join'] === 'undefined') {
        eventHandler['join'] = function(socket) {

            if (bigInt(numbers.length).lesser(bigInt(2).pow(m))) {

                var newNodeNumber = getBigIntHash(numbers.length, m).toString(16);

                if (numbers.indexOf(newNodeNumber) !== -1) {
                    //It means someone else has this id

                    console.log("Number already registered");

                    for (var i = bigInt(1); i.lesser(bigInt(2).pow(m)); i = i.plus(1)) {
                        newNodeNumber = i.toString(16);
                        if (numbers.indexOf(newNodeNumber) === -1) {

                            break;
                        }
                    }
                }

                //Send to numbers array
                numbers.push(newNodeNumber);

                if (count.greater(bigInt(2).pow(m))) {
                    count = count.mod(bigInt(2).pow(m));
                }
                console.log(newNodeNumber);

                if (debug === true) {
                    console.log("On join from new node: " + newNodeNumber);
                }

                connections[newNodeNumber] = socket;

                heartbeatTable[newNodeNumber] = new Date().getTime();

                var nodeBigInt = bigInt(newNodeNumber, 16);

                var fingerTableObject = fingerTable.getObject(nodeBigInt);

                socket.emit('join_ack', newNodeNumber, myId.toString(16), fingerTableObject);

                chord.setSuccessor(newNodeNumber);

                if (debug === true) {
                    console.log(fingerTableObject);
                }
            } else {
                console.log("SIZE of numbers");
                console.log(numbers.length);
                console.log(numbers);
                socket.disconnect();
            }

        };
    }

    if (typeof eventHandler['disconnect'] === 'undefined') {
        eventHandler['disconnect'] = function(socket, evt) {
            if (debug === true) {
                console.log("on disconnect");
                console.log(evt);
            }
            for (var key in connections) {
                if (connections[key] == socket) {
                    if (debug === true) {
                        console.log("REMOVING NODE " + key);
                    }
                    fingerTable.removeSuccessor(key);
                    delete connections[key];

                    if ((typeof evt === 'undefined' || evt === 'transport close') && numbers.indexOf(key) != -1) {
                        numbers.splice(numbers.indexOf(key), 1);
                        delete heartbeatTable[key];
                    }

                    break;
                }
            }
        };
    }

    if (typeof eventHandler['alive'] === 'undefined') {
        eventHandler['alive'] = function(socket, id) {
            if (debug === true) {
                console.log("Node %s is alive", id);
            }

            if (typeof id !== 'undefined') {
                heartbeatTable[id] = new Date().getTime();
            } else {
                console.error("On reconnect, id is undefined");
            }
        };
    }

    if (typeof eventHandler['peerForcedDisconnect'] === 'undefined') {
        eventHandler['peerForcedDisconnect'] = function(socket, id) {
            if (debug === true) {
                console.log("Node %s was peerForcedDisconnect", id);
            }

            if (typeof id !== 'undefined' && typeof connections[id] === 'undefined') {
                fingerTable.removeSuccessor(id);
                delete connections[id];

                if (numbers.indexOf(id) != -1) {
                    numbers.splice(numbers.indexOf(id), 1);
                }
                delete heartbeatTable[id];
            } else {
                console.error("On peerForcedDisconnect, id is undefined");
            }
        };
    }

    function prepareArguments(socket, argsObject) {
        //Copy arguments and socket
        var args = [];
        args.push(socket);
        for (var i = 0; i < argsObject.length; i++) {
            args.push(argsObject[i]);
        }

        return args;
    }

    io.sockets.on('connection', function(socket) {

        for (var key in eventHandler) {

            (function(key) {
                socket.on(key, function() {
                    try {
                        eventHandler[key].apply(this || window, prepareArguments(socket, arguments));
                    } catch (e) {
                        console.log(e);
                    }
                });
            })(key);
        }

        chord.registerSocketCallbacks(socket);

    });



    chord.stabilize();
    setInterval(chord.stabilize, 10000);

    var verifyRegisteredNodes = function() {
        if (debug === true) {
            console.log("CLEAN UP");
            console.log(heartbeatTable);
            console.log(numbers);
        }

        try {
            if (Object.keys(heartbeatTable).length !== Object.keys(numbers).length - 1) {
                for (var key in numbers) {
                    if (key !== myId.toString(16) && !heartbeatTable.hasOwnProperty(key)) {
                        heartbeatTable[key] = new Date().getTime() - 120000 / 2;
                    }
                }
            }
        } catch (e) {
            console.log("Error normalizing heartbeatTable with numbers Object");
            console.log(e);
        }

        var now = new Date().getTime();
        for (var key in heartbeatTable) {
            if (typeof key !== 'undefined') {
                if (debug === true) {
                    console.log("time from last heartbeat for %s is %s", key, now - heartbeatTable[key]);
                }
                if (now - heartbeatTable[key] > 120000) {
                    if (debug === true) {
                        console.log("Deleting entry for " + key);
                    }
                    fingerTable.removeSuccessor(key);
                    //remove possible connection
                    delete connections[key];
                    if (key in numbers) {
                        numbers.splice(numbers.indexOf(key), 1);
                    }

                    delete heartbeatTable[key];
                }
            }
        }
        //console.log(numbers);
    }

    setInterval(function() {
        chord.broadcast('heartbeat');
    }, 60000);

    setInterval(verifyRegisteredNodes, 20000);

};



module.exports.on = on;
module.exports.getNumbers = function() {
    return numbers
};
module.exports.getConnections = function() {
    return connections
};
module.exports.getHeartbeatTable = function() {
    return heartbeatTable
};
module.exports.getId = function() {
    return myId
};
module.exports.getFingerTable = function() {
    return fingerTable
};
module.exports.getChord = function() {
    return chord
};
module.exports.start = start;