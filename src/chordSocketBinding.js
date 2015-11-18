/*
    Copyright 2015 Bruno Faria, Instituto de Telecomunicações, Wavecom

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

var FingerTable = require("./fingerTable.js");
var SignallingChannel = require("./signalling.js");
var MyPeerConnection = require("./myPeerConnection.js");
var CryptoJS = require("crypto-js");
var io = require('socket.io-client');

function Chord(config) {

	'use strict';

	var sessionStorage = config.storage;
	if (typeof config.storage === 'undefined') {
		function MySessionStorage() {

		    var storage = {};

		    this.setItem = function(hash, data) {
		        storage[hash] = data;
		    };

		    this.getItem = function(hash) {
		        return storage[hash];
		    };
		}

		//Simulate client sessionStorage
		sessionStorage = new MySessionStorage();
	}

	var connectionsCB = {};
	var customCBs = {};

	var debug = false;
	if (config && config.debug === true) {

		debug = {
			overall: false,
			find_value: false,
			find_value_ack: false,
			store_value: true,
			broadcast: false,
			broadcast_event: false,
			getValue: false,
			storeValue: true,
			stabilize: true,
			leave: false,
			connectTo: false,
			join: false,
			join_ack: false,
			may_disconnect: false,
			deleteUnnecessaryNode: false,
			setSuccessor: false,
			find_successor: false,
			find_successor_ack: false,
			find_predecessor: false,
			find_predecessor_ack: false,
			heartbeat: false,
			con_signaling: false,
			initiatePc: true
		};

		//debug = config.debug;
	}

	var mayDisconnectArray = {};

	var configuration = {
		"iceServers": [{
			"urls": ["stun:numb.viagenie.ca"]
		}]
	};

	this.getWebrtcConfigurations = function() {
		return configuration;
	}
	
	this.setWebrtcConfigurations = function(_configuration) {
		configuration = _configuration;
	}

	var options = {
		optional: [{
			DtlsSrtpKeyAgreement: true
		}]
	};

	var registeringNodeGlobal;
	var registeringNodeGlobalUrl = 'http://localhost:8080';

	if (config && config.url) {
		registeringNodeGlobalUrl = config.url;
	}

	this.getRegisteringNodeGlobalUrl = function() {
		return registeringNodeGlobalUrl;
	};

	var broadcasts = {};
	var connections = {};
	var signalling = {};

	var signallingTimeout = 60000;

	var findValueObject = {};

	var fingerTable = new FingerTable(debug.overall);

	var myId;
	if (config) {
		myId = config.id;
	}

	//var userpasshash;

	var that = this;

	//var joinOnSuccess = null;
	//var joinOnError = null;

	//Object with all protocol events
	var eventHandler = {};

	var pingTable = {};
	var pingTimeout = 1000;

	this.getId = function() {
		return myId;
	};

	this.getConnections = function() {
		return connections;
	};

	this.getSignalling = function() {
		return signalling;
	};

	this.getFingerTable = function() {
		return fingerTable;
	};

	this.setRegisteringNode = function(node) {
		registeringNodeGlobal = node;
	};

	function printSuccessors() {
		console.log(fingerTable.getPredecessor());
		for (var i = 0; i < fingerTable.getM(); i++) {
			console.log(fingerTable.successorsGlobal[i]);
		}
	}

	var find_value = function(hash, fromId, hopNodes) {
		if (debug.find_value == true) {
			console.log("find_value - " + hash);
		}

		if (typeof hopNodes === 'undefined' || hopNodes.length === 0) {
			//Something went wrong
			if (debug.find_value == true) {
				console.log("find_value - Something went wrong");
			}
		}

		var value = 0;

		for (var i = hash.toString().length - 1; i >= 0; i--) {
			try {
				console.log(eval(hash.toString()[i]));
				value = eval(hash.toString()[i]) % Math.pow(2, 3);
				break;
			} catch (e) {
				//console.log(e);
			}
		}

		if (value == myId) {
			//It's me
			try {
				var data = sessionStorage.getItem(hash);
				connections[hopNodes.pop()].emit('find_value_ack', fromId, data, hopNodes);
			} catch (e) {
				console.log(e);
			}
		} else {
			var nextNode = fingerTable.findSuccessor(value);
			if (nextNode == myId) {

				//maybe I'm the closest, but first verify my predecessor
				var normalizedPredecessor = fingerTable.normalize(fingerTable.getPredecessor(), value);
				var normalizedNextNode = fingerTable.normalize(nextNode, value);
				if (debug.find_value == true) {
					console.log("Testing find_value: %s < %s", normalizedPredecessor, normalizedNextNode);
				}
				if (normalizedPredecessor < normalizedNextNode) {
					if (debug.find_value == true) {
						console.log("###find_value - Sending find_value to predecessor### %s->%s", myId, fingerTable.getPredecessor());
					}
					hopNodes.push(myId);
					connections[fingerTable.getPredecessor()].emit('find_value', hash, fromId, hopNodes);
				} else {

					if (debug.find_value == true) {
						console.log("find_value - it's for me either way - returning data");
					}
					try {
						var data = sessionStorage.getItem(hash);
						connections[hopNodes.pop()].emit('find_value_ack', fromId, data, hopNodes);
					} catch (e) {
						console.log(e);
					}

				}
			} else {
				if (debug.find_value == true) {
					console.log("find_value - not for me - routing to " + nextNode);
				}
				hopNodes.push(myId);
				connections[nextNode].emit('find_value', hash, fromId, hopNodes);
			}
		}
	};

	var find_value_ack = function(toId, data, hopNodes) {
		if (debug.find_value_ack == true) {
			console.log("find_value_ack - " + toId);
		}

		if (toId == myId) {
			//Call callback to return the retrieved data
			try {

				if (debug.find_value_ack == true) {
					console.log(findValueObject);
				}
				var hash = CryptoJS.SHA1(data);
				findValueObject[hash](data);
				delete findValueObject[hash];
			} catch (e) {
				console.log(e);
			}
		} else {
			if (typeof hopNodes === 'undefined' || hopNodes.length === 0) {
				//Something went wrong
				if (debug.find_value_ack == true) {
					console.log("find_value_ack - Something went wrong");
				}
			} else {
				connections[hopNodes.pop()].emit('find_value_ack', toId, data, hopNodes);
			}
		}
	};

	var store_value = function(to, hash, data) {

		if (debug.store_value == true) {
			console.log("store_value - " + to);
		}

		if (to == myId) {
			if (debug.store_value == true) {
				console.log("store_value - it's for me - storing data");
			}
			sessionStorage.setItem(hash, data);
		} else if (connections[to]) {
			connections[to].emit('store_value', to, hash, data);
		} else {
			var nextNode = fingerTable.findSuccessor(to);

			if (nextNode == myId) {

				//maybe I'm the closest, but first verify my predecessor
				var normalizedPredecessor = fingerTable.normalize(fingerTable.getPredecessor(), to);
				var normalizedNextNode = fingerTable.normalize(nextNode, to);
				console.log("Testing store_value: %s < %s", normalizedPredecessor, normalizedNextNode);
				if (normalizedPredecessor < normalizedNextNode) {
					if (debug.store_value == true) {
						console.log("###store_value - Sending store_value to predecessor### %s->%s", myId, fingerTable.getPredecessor());
					}
					connections[fingerTable.getPredecessor()].emit('store_value', to, hash, data);
				} else {
					if (debug.store_value == true) {
						console.log("store_value - it's for me either way - storing data");
					}
					sessionStorage.setItem(hash, data);
				}
			} else if (connections[nextNode]) {
				if (debug.store_value == true) {
					console.log("store_value - not for me - routing to " + nextNode);
				}
				connections[nextNode].emit('store_value', to, hash, data);
			} else {
				if (debug.store_value == true) {
					console.log("store_value - This should not happen");
				}
			}
		}
	};

	this.broadcast = function(data) {
		var timestamp = new Date().getTime();

		broadcasts[timestamp] = true;

		for (var key in connections) {
			if (debug.broadcast == true) {
				console.log("Sending broadcast to " + key);
			}
			connections[key].emit('broadcast_event', data, myId, timestamp);
		}
	};

	var broadcastCB = null;

	var broadcast_event = function(data, from, timestamp) {

		if (broadcasts[timestamp] != true) {
			broadcasts[timestamp] = true;

			for (var key in connections) {
				if (debug.broadcast_event == true) {
					console.log("Relaying broadcast to " + key);
				}
				connections[key].emit('broadcast_event', data, from, timestamp);
			}

			//console.log("NEW BROADCAST");
			//console.log(data);

			if (data == 'heartbeat') {
				heartbeat();
			} else {

				try {
					broadcastCB(data);
				} catch (e) {
					if (broadcastCB !== null) {
						console.log(e);
					}
				}

			}
		}
	};

	this.getValue = function(hash, cb) {

		var value = 0;

		for (var i = hash.toString().length - 1; i >= 0; i--) {
			try {
				if (debug.getValue == true) {
					console.log(eval(hash.toString()[i]));
				}
				value = eval(hash.toString()[i]) % Math.pow(2, 3);
				break;
			} catch (e) {
				//console.log(e);
			}
		}

		if (value == myId) {
			//It's me
			try {
				cb(sessionStorage.getItem(hash));
			} catch (e) {
				console.log(e);
			}
		} else {
			var successor = fingerTable.findSuccessor(value);

			if (successor == myId) {

				//maybe I'm the closest, but first verify my predecessor
				var normalizedPredecessor = fingerTable.normalize(fingerTable.getPredecessor(), value);
				var normalizedNextNode = fingerTable.normalize(successor, value);
				if (debug.getValue == true) {
					console.log("Testing find_value: %s < %s", normalizedPredecessor, normalizedNextNode);
				}
				if (normalizedPredecessor < normalizedNextNode) {
					if (debug.getValue == true) {
						console.log("###store_value - Sending store_value to predecessor### %s->%s", myId, fingerTable.getPredecessor());
					}
					findValueObject[hash] = cb;
					connections[fingerTable.getPredecessor()].emit('find_value', hash, myId, [myId]);
				} else {
					//It's me either way
					cb(sessionStorage.getItem(hash));
				}

			} else if (connections[successor]) {
				if (debug.getValue == true) {
					console.log("Sending find value to " + successor);
				}
				findValueObject[hash] = cb;
				connections[successor].emit('find_value', hash.toString(), myId, [myId]);
			} else {
				if (debug.getValue == true) {
					console.log("No one to send the value");
				}
			}
		}
	};

	this.storeValue = function(data) {

		var hash = CryptoJS.SHA1(data);

		if (debug.storeValue == true) {
			console.log(hash.toString());
		}

		var value = 0;

		for (var i = hash.toString().length - 1; i >= 0; i--) {
			try {
				if (debug.storeValue == true) {
					console.log(eval(hash.toString()[i]));
				}
				value = eval(hash.toString()[i]) % Math.pow(2, 3);
				break;
			} catch (e) {
				//console.log(e);
			}
		}

		if (debug.storeValue == true) {
			console.log(value);
		}

		store_value(value, hash.toString(), data);

		//var successor = fingerTable.findSuccessor(value);
		//if (debug == true) {
		//	console.log(successor);
		//}
		//if (successor == myId) {
		//} else if (connections[successor]) {
		//	connections[successor].emit('store_value', value, hash.toString(), data);
		//} else {
		//	if (debug == true) {
		//		console.log("No one to send the value");
		//	}
		//}
		//console.log(hash % Math.pow(2, 3));
	};

	//To inform the server, since the server may no be connected directly with the peer
	function informServer(index) {
		if (typeof connections[registeringNodeGlobal] !== 'undefined') {
			connections[registeringNodeGlobal].emit('peerForcedDisconnect', index);
		} else {
			var tmpCB = function(socket) {
				socket.emit('peerForcedDisconnect', index);
			};

			reconnectToServer({
				onConnectCB: tmpCB
			});
		}
	}

	/*
	 * url - websocket/socket.io url
	 * onErrorCB - error callback
	 */
	function reconnectToServer(options) {

		var onConnectCB = function(socket) {
			connections[registeringNodeGlobal] = socket;
			reconnect(connections[registeringNodeGlobal]);

			fingerTable.setSuccessor(registeringNodeGlobal, deleteUnnecessaryNode);
			that.registerSocketCallbacks(connections[registeringNodeGlobal]);
		}

		var url = registeringNodeGlobalUrl;
		if (typeof options !== 'undefined' && typeof options.url !== 'undefined') {
			url = options.url;
		}

		if (typeof options !== 'undefined' && typeof options.onConnectCB !== 'undefined') {
			onConnectCB = options.onConnectCB;
		}

		//to prevent trying to connect to myself
		if (registeringNodeGlobal === myId) {
			return;
		}

		var socket = io.connect(url, {
			'force new connection': true,
			'reconnection': false
		});

		socket.on('connect', function() {
			try {
				onConnectCB(socket);
			} catch (e) {
				console.log(e);
			}
		});

		socket.on('disconnect', function() {
			var startIds = fingerTable.removeSuccessor(registeringNodeGlobal);

			if (typeof connections[registeringNodeGlobal] !== 'undefined') {
				connections[registeringNodeGlobal].disconnect();
				delete connections[registeringNodeGlobal];
			}
			var startIds = fingerTable.removeSuccessor(registeringNodeGlobal);
		});

		socket.on('connect_error', function(e) {
			if (typeof connections[registeringNodeGlobal] !== 'undefined') {
				connections[registeringNodeGlobal].disconnect();
			}

			try {
				options.onErrorCB();
			} catch (e) {
				if (typeof options !== 'undefined' && typeof options.onErrorCB !== 'undefined') {
					console.log(e);
				}
			}
		});
	}

	this.stabilize = function() {
		if (debug.stabilize == true) {
			console.log("stabilize");
		}

		var url;

		if (myId === registeringNodeGlobal) {
			url = registeringNodeGlobalUrl;
		}

		var now = new Date().getTime();
		//Verify if there are no signalling connections pending
		for (var key in signalling) {
			//Remove if hanging for too long
			if (now - signalling[key].timestamp > signallingTimeout) {
				if (debug.stabilize == true) {
					console.log("Removing signalling object for " + key);
				}
				try {
					signalling[key].rtcPeerConnection.close();
				} catch (e) {
					console.log(e);
				}
				delete signalling[key];
			}
		}

		//If for some reason it's the only one in the network and it's not the registering node
		if (Object.keys(connections).length === 0 && myId !== registeringNodeGlobal) {
			if (debug.stabilize == true) {
				console.log("Try to connect to registering node");
			}

			reconnectToServer();
		}

		//To prevent the server from becaming connectionless after a restart if no peer as it as successor
		if (fingerTable.getPredecessor() === myId || (myId !== registeringNodeGlobal && fingerTable.compare(myId, fingerTable.getPredecessor()) == -1)) {

			reconnectToServer();
		}

		var tmpNode;
		for (var i = 0; i < fingerTable.getM(); i++) {
			if (!connections[fingerTable.successorsGlobal[i].start]) {
				if (debug.stabilize == true) {
					console.log("#Stabilize - Find successor: " + fingerTable.successorsGlobal[i].start);
				}
				if (fingerTable.successorsGlobal[i].start == registeringNodeGlobal) {
					//The server node is the successor
					try {

						(function(i) {
							var tmpCB = function() {
								if (debug.stabilize == true) {
									console.log("#Stabilize - Find successor connect_error: " + fingerTable.successorsGlobal[i].start);
								}
								var tmpNode = fingerTable.closestPrecedingFinger(fingerTable.successorsGlobal[i].start);
								if (debug.stabilize == true) {
									console.log(tmpNode);
								}
								if (tmpNode != myId) {
									connections[tmpNode].emit('find_successor', null, myId, fingerTable.successorsGlobal[i].start, [myId], url);
								} else if (fingerTable.getPredecessor() != myId) {
									connections[fingerTable.getPredecessor()].emit('find_successor', null, myId, fingerTable.successorsGlobal[i].start, [myId], url);
								}
							};

							reconnectToServer({
								onErrorCB: tmpCB
							});
						})(i);

					} catch (e) {
						console.log(e);
					}
				} else {

					tmpNode = fingerTable.closestPrecedingFinger(fingerTable.successorsGlobal[i].start);
					if (debug.stabilize == true) {
						console.log(tmpNode);
						console.log("#Stabilize - find_successor - send to predecessor - " + fingerTable.getPredecessor());
					}
					if (tmpNode !== myId && connections[tmpNode]) {
						connections[tmpNode].emit('find_successor', null, myId, fingerTable.successorsGlobal[i].start, [myId], url);
					} else if (fingerTable.getPredecessor() != myId 
						&& typeof connections[fingerTable.getPredecessor()] !== 'undefined') {
						if (debug.stabilize == true) {
							console.log("#Stabilize - find_successor - send to predecessor - " + fingerTable.getPredecessor());
						}
						connections[fingerTable.getPredecessor()].emit('find_successor', null, myId, fingerTable.successorsGlobal[i].start, [myId], url);
					}

				}
			}
		}
	};

	this.leave = function() {
		if (debug.leave == true) {
			console.log("#leave");
		}
		for (var key in connections) {
			if (typeof connections[key].close !== 'undefined') {
				connections[key].close();
			} else if (typeof connections[key].socket.disconnect !== 'undefined') {
				connections[key].emit('disconnect', undefined);
			}

			delete connections[key];
		}

	};

	/*
	 * Try to create a dataChannel between me and the other peer
	 */
	this.connectTo = function(id, cb) {
		if (debug.connectTo == true) {
			console.log("connectTo " + id);
		}

		if (id == myId) {
			//do nothing, it's me
			try {
				cb('yourself');
			} catch (e) {
				console.log(e);
			}
		} else if (connections[id]) { //Verify if I am already connected
			//Already connected
			if (debug.connectTo == true) {
				console.log("Already connected");
			}
			try {
				cb('connected', connections[id]);
			} catch (e) {
				console.log(e);
			}
		} else if (fingerTable.isSuccessor(id) == true) {
			//Node is probably offline or not yet connected to
			if (debug.connectTo == true) {
				console.log("Not connected as I'm a direct predecessor");
			}
			try {
				cb('not_connected');
			} catch (e) {
				console.log(e);
			}
		} else {
			var tmpNode = fingerTable.closestPrecedingFinger(id);
			if (debug.connectTo == true) {
				console.log(tmpNode);
			}

			var requestId = new Date().getTime() + "" + myId;
			connectionsCB[requestId] = {};
			connectionsCB[requestId][0] = function(fromId) {
				if (fromId == id) {
					return true;
				} else {
					return false;
				}
			}

			connectionsCB[requestId][1] = function(fromId, socket) {
				if (fromId != id) {
					try {
						cb('not_connected');
					} catch (e) {
						console.log(e);
					}
				} else {
					try {
						cb('connected', socket);
					} catch (e) {
						console.log(e);
					}
				}
			}

			if (tmpNode != myId) {
				connections[tmpNode].emit('find_successor', requestId, myId, id, [myId]);
			} else if (fingerTable.getPredecessor() != myId) {
				connections[fingerTable.getPredecessor()].emit('find_successor', requestId, myId, id, [myId]);
			}
		}
	};

	function reconnect(socket) {

		if (callbacks['customReconnect'] != null) {
			try {
				callbacks['customReconnect'](socket);
			} catch (e) {
				console.log(e);
			}
		} else {
			console.log("calling reconnect " + myId);

			var activeConnections = [];
			for (var key in connections) {
				activeConnections.push(key);
			}

			socket.emit('chord_reconnect', myId, activeConnections);
		}
	};

	var callbacks = {};
	this.setCallbacks = function(callbackName, cb) {
		callbacks[callbackName] = cb;
	};

	this.join = function(cbOnSuccess) {

		if (debug.join == true) {
			console.log("#Join");
		}

		var socket;


		socket = io.connect(registeringNodeGlobalUrl, {
			'force new connection': true
		});

		socket.on('connect', function() {
			that.registerSocketCallbacks(socket);

			that.setCallbacks('joinOnSuccess', cbOnSuccess);

			if (callbacks['customJoin'] != null) {
				try {
					callbacks['customJoin'](socket);
				} catch (e) {
					console.log(e);
				}
			} else {
				socket.emit('join');
			}
		});

	};

	eventHandler['join_ack'] = function(socket, id, registeringNode, registeringNodeFingerTable) {

		//To enable authentication scenarios
		if (callbacks['customJoinAck'] != null) {
			try {
				callbacks['customJoinAck'].apply(this || window, prepareArguments(initialization, arguments));
			} catch (e) {
				console.log(e);
			}
		} else {
			try {
				callbacks['joinOnSuccess'](id);
			} catch (e) {
				if (callbacks['joinOnSuccess'] !== null) {
					console.log(e);
				}
			}
			initialization(id, registeringNode, registeringNodeFingerTable);
		}

		function initialization(id, registeringNode, registeringNodeFingerTable) {
			if (debug.join_ack == true) {
				console.log("myId: " + id);
			}

			fingerTable.setId(id);
			myId = fingerTable.getId();

			registeringNodeGlobal = registeringNode;
			fingerTable.setM(registeringNodeFingerTable.m);
			fingerTable.calculate();
			//fingerTable.calculate(registeringNodeFingerTable.getM());

			connections[registeringNode] = socket;
			connections[registeringNode].on('disconnect', function() {
				if (debug.join_ack == true) {
					console.log("Server has closed the connection");
				}
				var startIds = fingerTable.removeSuccessor(registeringNode);

				if (typeof connections[registeringNode] !== 'undefined') {
					connections[registeringNode].disconnect();
					delete connections[registeringNode];
				}
			});

			fingerTable.setSuccessor(registeringNode, deleteUnnecessaryNode);

			//find predecessors
			var predecessors = fingerTable.getPredecessors();
			for (var key in predecessors) {
				if (!connections[predecessors[key]]) {
					if (debug.join_ack == true) {
						console.log("#Find preceding: " + predecessors[key]);
					}
					socket.emit('find_predecessor', myId, predecessors[key], [myId]);
				}
			}

			//find successors
			that.stabilize();
			setInterval(that.stabilize, 10000);
		}

	};

	eventHandler['may_disconnect'] = function(socket, fromId) {
		if (debug.may_disconnect == true) {
			console.log("may_disconnect from: " + fromId + " " + !fingerTable.hasSuccessor(fromId));
		}
		if (connections[fromId] && fingerTable.hasSuccessor(fromId) === false) {
			mayDisconnectArray[fromId] = true;
			if (fromId == registeringNodeGlobal) {
				if (debug.may_disconnect == true) {
					console.log("I'm disconnecting from registeringNode");
				}
				connections[fromId].socket.disconnect();
				delete connections[fromId];
			} else if (myId == registeringNodeGlobal) {
				if (debug.may_disconnect == true) {
					console.log("I'm disconnecting");
				}
				connections[fromId].disconnect();
				delete connections[fromId];
			} else {
				//console.log(connections[fromId]);
				if (debug.may_disconnect == true) {
					console.log(myId + " == " + registeringNodeGlobal);
					console.log("I'm closing connection");
				}

				connections[fromId].close();
			}
		}
	};

	var deleteUnnecessaryNode = function(nodesNoLongerNeeded) {
		if (debug.deleteUnnecessaryNode == true) {
			console.log("Nodes to delete");
			console.log(nodesNoLongerNeeded);
		}

		if (Object.keys(signalling).length !== 0) {
			for (var key in nodesNoLongerNeeded) {
				//console.log("Nodes to delete - " + connections[nodesNoLongerNeeded[key]].getPredecessor());
				if (connections[nodesNoLongerNeeded[key]]) {
					connections[nodesNoLongerNeeded[key]].emit('may_disconnect', myId);
				}
			}
		}
	};

	this.setSuccessor = function(id) {
		fingerTable.setSuccessor(id, deleteUnnecessaryNode);
	};

	eventHandler['find_successor'] = function(socket, requestId, fromId, successorId, hopNodes, url) {
		if (debug.find_successor == true) {
			console.log("###find_successor### %s -> %s", fromId, successorId);
		}

		//This should not be needed
		if (typeof hopNodes === 'undefined') {
			if (debug.find_successor == true) {
				console.log("ERROR: hopNodes is undefined");
			}
			hopNodes = [];
		}
		hopNodes.push(myId);

		if (url && successorId == myId) {
			//A direct socket connection is possible

			reconnectToServer({
				url: url
			});

		} else if (fromId == myId) {
			//From me to me - discard
			if (debug.find_successor == true) {
				console.log("###find_predecessor - from me to me### (DO NOTHING)");
			}
		} else if (fromId == successorId) {
			//From a peer to the same peer - discard
			if (debug.find_successor == true) {
				console.log("It's from %s to %s... weird....", fromId, successorId);
			}

		} else if (successorId == myId) {
			// I'm the the successor
			if (debug.find_successor == true) {
				console.log("###find_successor - It's me### %s -> %s", fromId, successorId);
			}

			if (!connections[fromId] && !signalling[fromId]) {
				if (debug.find_successor == true) {
					console.log("###find_successor - its me - send ack### (%s, %s)", fromId, successorId);
				}
				//Already has a connection, do nothing
				var hopNodes1 = [];
				hopNodes1.push(hopNodes.pop());
				socket.emit('find_successor_ack', requestId, myId, fromId, hopNodes, hopNodes1);
			} else {
				//fingerTable.setSuccessor(fromId, deleteUnnecessaryNode);
			}


		} else if (connections[successorId]) {
			if (debug.find_successor == true) {
				console.log("###find_successor - connected directly### %s -> %s", fromId, successorId);
			}
			connections[successorId].emit('find_successor', requestId, fromId, successorId, hopNodes);
		} else {
			var closestId = fingerTable.findSuccessor(successorId);

			if (closestId == myId) {
				if (debug.find_successor == true) {
					console.log("###find_successor - closest is my id### %s -> %s", fromId, successorId);
				}

				//maybe I'm the closest, but first verify my predecessor
				var normalizedPredecessor = fingerTable.normalize(fingerTable.getPredecessor(), myId);
				var normalizedSuccessorId = fingerTable.normalize(successorId, myId);
				if (normalizedPredecessor >= normalizedSuccessorId) {
					if (debug.find_successor == true) {
						console.log("###find_successor - Sending find_successor to predecessor### %s->%s", myId, fingerTable.getPredecessor());
					}
					connections[fingerTable.getPredecessor()].emit('find_successor', requestId, fromId, successorId, hopNodes);
				} else if (url && url != registeringNodeGlobalUrl) {
					if (debug.find_successor == true) {
						console.log("###find_successor - has URL### %s -> %s", fromId, successorId);
					}

					var onConnectCB = function(socket) {
						connections[fromId] = socket;
						reconnect(connections[fromId]);

						fingerTable.setSuccessor(fromId, deleteUnnecessaryNode);
						that.registerSocketCallbacks(connections[fromId]);
					}

					reconnectToServer({
						url: url,
						onConnectCB: onConnectCB
					});

				} else if (connections[fromId]) {
					//Send directly to original requester
					connections[fromId].emit('find_successor_ack', requestId, myId, fromId, [fromId], [myId]);
				} else if (!signalling[fromId]) {
					if (debug.find_successor == true) {
						console.log("###find_successor - its me either way - send ack### (%s, %s)", fromId, successorId);
					}

					//Already has a connection, do nothing
					var hopNodes1 = [];
					hopNodes1.push(hopNodes.pop());
					socket.emit('find_successor_ack', requestId, myId, fromId, hopNodes, hopNodes1);
				} else {

				}
			} else if (connections[closestId]) {
				if (debug.find_successor == true) {
					console.log("###find_successor - Sending find_successor### %s->%s", myId, closestId);
				}
				connections[closestId].emit('find_successor', requestId, fromId, successorId, hopNodes);
			} else {
				if (debug.find_successor == true) {
					console.log("find_successor, no one to return or relay");
				}
			}

		}
	};

	eventHandler['find_successor_ack'] = function(socket, requestId, fromId, predecessorId, hopNodes, hopNodes1) {
		if (debug.find_successor_ack == true) {
			console.log("find_successor_ack, %s->%s", predecessorId, fromId);
		}
		hopNodes1.push(hopNodes.pop());

		if (predecessorId == myId) {
			if (debug.find_successor_ack == true) {
				console.log("&&find_successor_ack it's me %s->%s", predecessorId, fromId);
				console.log(hopNodes1);
			}

			if (myId === registeringNodeGlobal) {
				//This should not happen

			} else if (!connections[fromId] && !signalling[fromId]) {
				if (debug.find_successor_ack == true) {
					console.log("find_successor_ack Initiating PC");
				}

				//It only happens on connectTo
				if (connectionsCB[requestId]) {
					if (connectionsCB[requestId][0](fromId)) {
						initiatePc(socket, connectionsCB[requestId][1], myId, fromId, true, hopNodes1, []);
					} else {
						connectionsCB[requestId][1](fromId);
					}
				} else {
					initiatePc(socket, null, myId, fromId, true, hopNodes1, []);
				}

			} else {
				fingerTable.setSuccessor(fromId, deleteUnnecessaryNode);
			}

		} else if (hopNodes && typeof connections[hopNodes[hopNodes.length - 1]] !== 'undefined') {
			if (debug.find_successor_ack == true) {
				console.log("#find_successor_ack - relaying to %s - %s->%s", hopNodes[hopNodes.length - 1], predecessorId, fromId);
			}

			connections[hopNodes[hopNodes.length - 1]].emit('find_successor_ack', requestId, fromId, predecessorId, hopNodes, hopNodes1);
		} else {
			if (debug.find_successor_ack == true) {
				console.log("Aw, snap.. This should not happen (find_successor_ack)");
			}
		}
	};

	eventHandler['find_predecessor'] = function(socket, successorId, possibleClosestId, hopNodes, url) {

		if (debug.find_predecessor == true) {
			console.log("find_predecessor, %s <- %s", successorId, possibleClosestId);
		}

		//This should not be needed
		if (typeof hopNodes === 'undefined') {
			console.log("ERROR: hopNodes is undefined");
			hopNodes = [];
		}
		try {
			hopNodes.push(myId);
		} catch (e) {
			console.error(e);
		}
		if (debug.find_predecessor == true) {
			console.log("###find_predecessor### (%s, %s)", successorId, possibleClosestId);
		}
		if (successorId == myId) {
			if (debug.find_predecessor == true) {
				console.log("###find_predecessor - from me to me### (DO NOTHING)");
			}
		} else if (successorId == possibleClosestId) {
			if (debug.find_predecessor == true) {
				console.log("It's from %s to %s... weird....", successorId, possibleClosestId);
			}

		} else if (url && possibleClosestId == myId) {

			var onConnectCB = function(socket) {
				connections[successorId] = socket;
				that.registerSocketCallbacks(connections[successorId]);
			}

			reconnectToServer({
				url: url,
				onConnectCB: onConnectCB
			});

		} else if (possibleClosestId == myId) {
			// I'm the predecessor
			if (debug.find_predecessor == true) {
				console.log("###find_predecessor - its me### (%s, %s)", successorId, possibleClosestId);
			}

			if (connections[successorId]) {
				if (debug.find_predecessor == true) {
					console.log("###find_predecessor - its me - send ack### (%s, %s)", successorId, possibleClosestId);
				}

				connections[successorId].emit("find_predecessor_ack", successorId, possibleClosestId, myId);
			} else if (!signalling[successorId]) {
				if (debug.find_predecessor == true) {
					console.log("###find_predecessor - its me - initiatePc### (%s, %s)", successorId, possibleClosestId);
					console.log(hopNodes);
				}
				initiatePc(socket, null, myId, successorId, true, hopNodes, []);
			}

		} else if (connections[possibleClosestId]) {

			if (debug.find_predecessor == true) {
				console.log("###find_predecessor - connected directly### (%s, %s)", successorId, possibleClosestId);
			}
			connections[possibleClosestId].emit('find_predecessor', successorId, possibleClosestId, hopNodes);
		} else {
			var closestId = fingerTable.closestPrecedingFinger(possibleClosestId);
			if (debug.find_predecessor == true) {
				console.log("Closest preceding finger: " + closestId);
			}

			if (closestId == myId) {
				if (debug.find_predecessor == true) {
					console.log("###find_predecessor - its me either way### (%s, %s)", successorId, closestId);
				}
				//No registered nodes between the two
				if (!connections[successorId] && !signalling[successorId]) {
					initiatePc(socket, null, myId, successorId, true, hopNodes, []);
				} else if (connections[successorId]) {
					if (debug.find_predecessor == true) {
						console.log("Send a find_predecessor_ack informing that for this node I'm one predecessor " + !connections[successorId] + " " + !signalling[successorId]);
					}
					connections[successorId].emit("find_predecessor_ack", successorId, possibleClosestId, myId);
				}

			} else {

				//Relay message to closest
				if (connections[closestId]) {
					if (debug.find_predecessor == true) {
						console.log("###find_predecessor - relaying to closest known predecessor (" + successorId + " -> " + closestId + ")(" + possibleClosestId + ")###");
					}

					connections[closestId].emit('find_predecessor', successorId, possibleClosestId, hopNodes);

				} else {
					if (debug.find_predecessor == true) {
						console.log("###find_predecessor - this should not happen");
					}

				}
			}
		}
	};

	//This was called directly from the predecessor node, no routing was performed
	eventHandler['find_predecessor_ack'] = function(socket, successorId, possibleClosestId, confirmedClosestId) {
		if (debug.find_predecessor_ack == true) {
			console.log("find_predecessor_ack (%s<-%s)", possibleClosestId, confirmedClosestId);
		}
		if (successorId === myId) {

			fingerTable.setSuccessor(confirmedClosestId, deleteUnnecessaryNode);

		} else {
			if (debug.find_predecessor_ack == true) {
				console.log("ERROR: find_predecessor_ack");
			}
		}
	};

	function heartbeat() {
		if (debug.heartbeat == true) {
			console.log("HEARTBEAT");
		}
		if (connections[registeringNodeGlobal]) {
			connections[registeringNodeGlobal].emit('alive', myId);
		} else {
			try {
				if (debug.heartbeat == true) {
					console.log("CONNECTING FOR heartbeat " + registeringNodeGlobalUrl);
				}

				var onConnectCB = function(socket) {
					connections[registeringNodeGlobal] = socket;
					reconnect(connections[registeringNodeGlobal]);

					fingerTable.setSuccessor(registeringNodeGlobal, deleteUnnecessaryNode);
					that.registerSocketCallbacks(connections[registeringNodeGlobal]);

					socket.emit('alive', myId);
				}

				//It will disconnect in the next stabilize if it is not necessary
				reconnectToServer({
					onConnectCB: onConnectCB
				});

			} catch (e) {
				console.log(e);
			}
		}
	}

	eventHandler['con_signaling'] = function(socket, fromId, toId, data, hopNodes, hopNodes1) {
		if (debug.con_signaling == true) {
			console.log("con_signaling fromId: %s, toId: %s", fromId, toId);
		}
		hopNodes1.push(hopNodes.pop());

		if (toId != myId) {
			//Is not for me

			if (hopNodes && hopNodes.length > 0) {
				try {
					connections[hopNodes[hopNodes.length - 1]].emit('con_signaling', fromId, toId, data, hopNodes, hopNodes1);
				} catch (e) {
					console.log(e);
				}

			}

		} else if (!connections[fromId]) {
			//It's for me
			if (debug.con_signaling == true) {
				console.log("[%s]con_signaling It's for me", fromId);
			}

			if (!signalling[fromId] && myId !== registeringNodeGlobal) {
				//delete connections[fromId];
				if (debug.con_signaling == true) {
					console.log("Initiating slave peer connection");
				}
				initiatePc(socket, null, myId, fromId, false, hopNodes1, [], data.sdp);
			}

			if (typeof signalling[fromId] !== 'undefined') {
				if (data.sdp && typeof signalling[fromId].setRemoteDescription !== 'undefined') {
					if (debug.con_signaling == true) {
						console.log("Adding sdp from " + fromId);
					}
					signalling[fromId].setRemoteDescription(data.sdp)
				}

				if (data.ice && typeof signalling[fromId].addIceCandidate !== 'undefined') {
					if (debug.con_signaling == true) {
						console.log("Adding ice from " + fromId);
					}
					signalling[fromId].addIceCandidate(data.ice);
				}

			}
		}
	};


	function initiatePc(socket, onClompleteCB, fromId, toId, master, hopNodes, hopNodes1, remoteSDP) {

		signalling[toId] = {};
		signalling[toId] = new MyPeerConnection(master, configuration, options);
		signalling[toId].rtcPeerConnection.sc = new SignallingChannel(signalling[toId].rtcPeerConnection, toId, master);
		signalling[toId].timestamp = new Date().getTime();

		signalling[toId].start(false, true, false, remoteSDP);

		signalling[toId].onIceCandidate(function(ice) {
			if (debug.initiatePc == true) {
				console.log("initiatePc onIceCandidate (%s)", toId);
			}
			var tmpHopNodes = hopNodes.slice();
			var tmpHopNodes1 = hopNodes1.slice();
			tmpHopNodes1.push(tmpHopNodes.pop());
			if (ice) {
				socket.emit('con_signaling', fromId, toId, {
					"timestamp": new Date().getTime(),
					"ice": ice
				}, tmpHopNodes, tmpHopNodes1)
			}
		});
		signalling[toId].onSdpInfo(function(sdp) {
			if (debug.initiatePc == true) {
				console.log("initiatePc onSdpInfo (%s)", toId);
			}
			var tmpHopNodes = hopNodes.slice();
			var tmpHopNodes1 = hopNodes1.slice();
			tmpHopNodes1.push(tmpHopNodes.pop());
			socket.emit('con_signaling', fromId, toId, {
				"timestamp": new Date().getTime(),
				"sdp": sdp
			}, tmpHopNodes, tmpHopNodes1);
		});

		signalling[toId].userOnDataChannel = function(evt) {
			if (debug.initiatePc == true) {
				console.log("userOnDataChannel");
			}
			signalling[toId].rtcPeerConnection.sc.addDataChannel(evt);
		};

		function removeConnection(index) {
			var startIds = fingerTable.removeSuccessor(index);

			delete connections[index];
			delete signalling[index];

			if (mayDisconnectArray[index] !== true) {
				delete mayDisconnectArray[index];

				//To inform the server, since the server may no be connected directly with the peer
				informServer(index);
			}

			//Callback for remove connection
			if (typeof callbacks['onClose'] !== 'undefined') {
				try {
					callbacks['onClose'](index);
				} catch(e) {
					console.error(e);
				}
			}
		}

		signalling[toId].onClosed(function(evt) {
			if (debug.initiatePc == true) {
				console.log("PC Closed");
			}

			//if the connection hasn't been removed, test it
			if (typeof connections[toId] !== 'undefined') {
				connections[toId].emit('chord_ping', myId);

				setTimeout(function() {
					if (typeof pingTable[toId] !== 'undefined' 
						&& new Date().getTime() - pingTable[toId] <= pingTimeout) {

						//It is still connected
						delete pingTable[toId];
					} else {
						//It is a dead connection
						removeConnection(toId);
					}
				}, pingTimeout);
			} else {
				removeConnection(toId);
			}
		});


		signalling[toId].rtcPeerConnection.sc.onClose(function(index) {
			if (debug.initiatePc == true) {
				console.log("PC Closed");
			}
			
			removeConnection(toId);

		});

		signalling[toId].rtcPeerConnection.sc.onOpen(function(index) {
			if (debug.initiatePc == true) {
				console.log("Socket opened");
			}

			connections[index] = signalling[toId].rtcPeerConnection.sc;

			that.registerSocketCallbacks(connections[index]);

			if (master) {
				//It's the predecessor who starts the connection

				if (debug.initiatePc == true) {
					console.log(myId + " Master connecting to " + index);
				}
				//console.log("###" + fingerTable.closestPrecedingFinger(index) + "###");
				if (fingerTable.closestPrecedingFinger(index) === myId) {
					if (debug.initiatePc == true) {
						console.log("Sending finger table (%s->%s)", myId, toId);
					}
				}

			}

			fingerTable.setSuccessor(index, deleteUnnecessaryNode);

			delete signalling[toId];

			if (onClompleteCB) {
				onClompleteCB(index, connections[index]);
			}

		});

	}

	eventHandler['chord_ping'] = function(socket, toId) {
		socket.emit('chord_pong', myId);
	}

	eventHandler['chord_pong'] = function(socket, fromId) {
		pingTable[fromId] = new Date().getTime();
	}



	this.emit = function(event, id, data) {

		try {
			connections[id].emit("user_" + event, data);
		} catch (e) {
			console.log(e);
		}
	};

	this.on = function(event, cb) {
		switch (event) {
			case "broadcast":
				broadcastCB = cb;
				break;
			default:
				//It's a user custom callback
				customCBs["user_" + event] = cb;
				for (var key in connections) {
					try {
						connections[key].on("user_" + event, cb);
					} catch (e) {
						console.log(e);
					}
				}
				break;
		}
	};


	function prepareArguments(socket, argsObject) {
		//Copy arguments and socket
		var args = [];
		args.push(socket);
		for (var i = 0; i < argsObject.length; i++) {
			args.push(argsObject[i]);
		}

		return args;
	}

	this.registerSocketCallbacks = function(socket) {

		for (var key in eventHandler) {

			(function(key) {
				socket.on(key, function() {
					try {
						//console.log(this);
						eventHandler[key].apply(this || window, prepareArguments(socket, arguments));
					} catch (e) {
						console.log("In event: " + key);
						console.log(e);
					}
				});
			})(key);
		}

		socket.on('store_value', function(to, hash, data) {
			try {
				store_value(to, hash, data);
			} catch (e) {
				console.log(e);
			}
		});

		socket.on('broadcast_event', function(data, from, timestamp) {
			try {
				broadcast_event(data, from, timestamp);
			} catch (e) {
				console.log(e);
			}
		});

		socket.on('find_value', function(hash, fromId, hopNodes) {
			try {
				find_value(hash, fromId, hopNodes);
			} catch (e) {
				console.log(e);
			}
		});

		socket.on('find_value_ack', function(toId, data, hopNodes) {
			try {
				find_value_ack(toId, data, hopNodes);
			} catch (e) {
				console.log(e);
			}
		});

		for (var key in customCBs) {
			try {
				if (debug.overall === true) {
					console.log("Setting user call backs");
				}

				socket.on(key, customCBs[key]);
			} catch (e) {
				console.log(e);
			}
		}

	};

}

module.exports = Chord;