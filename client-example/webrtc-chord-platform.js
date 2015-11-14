/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

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

	window.Chord = __webpack_require__(1);


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

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

	var FingerTable = __webpack_require__(2);
	var SignallingChannel = __webpack_require__(3);
	var MyPeerConnection = __webpack_require__(4);
	var CryptoJS = __webpack_require__(5);
	var io = __webpack_require__(6);

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

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

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

	var bigInt = __webpack_require__(40);

	function FingerTable(debug) {

		//it's a big-integer
		var myId;

		//it's a big-integer
		var predecessor;

		var successors = {};
		var predecessors = {};
		var m;

		var that = this;

		this.successorsGlobal = successors;
		this.getPredecessors = function() {
			return predecessors;
		}

		//Convert to hex
		this.getPredecessor = function() {
			return predecessor.toString(16);
		}

		var updateCb = null;

		this.on = function(event, cb) {
			switch (event) {
				case 'update':
					updateCb = cb;
					break;
			}
		}

		this.setId = function(id) {
			id = convertIfNeeded(id);

			myId = id;
			predecessor = myId;
		}

		//Convert to hex
		this.getId = function() {
			return myId.toString(16);
		}

		this.setM = function(mValue) {
			m = mValue;
		}

		this.getM = function() {
			return m;
		}

		//big-integer ready
		this.calculate = function() {

			var n = myId;
			for (var i = 1; i <= m; i++) {
				//FIXME: Math.pow may have a precision limitation. (ex: 2^(lg 3))
				successors[i - 1] = {};
				//successors[i - 1].start = (n + Math.pow(2, i - 1)) % Math.pow(2, m);
				successors[i - 1].start = (n.plus(bigInt(2).pow(i - 1))).mod(bigInt(2).pow(m)).toString(16);
				successors[i - 1].node = myId;
			}
			for (var i = 1; i <= m; i++) {
				//FIXME: Math.pow may have a precision limitation. (ex: 2^(lg 3))
				predecessors[i - 1] = {};
				//predecessors[i - 1].start = (n - Math.pow(2, i - 1) + Math.pow(2, m)) % Math.pow(2, m);
				predecessors[i - 1] = n.minus(bigInt(2).pow(i - 1)).plus(bigInt(2).pow(m)).mod(bigInt(2).pow(m)).toString(16);
			}
		}

		this.resetSuccessors = function() {
			if (debug == true) {
				console.log("Resetting successors");
			}

			for (var i = 0; i < m; i++) {
				successors[i].node = predecessor;
			}

			//For testing purposes
			if (debug == true) {
				for (var i = 0; i < m; i++) {
					console.log(successors[i]);
				}
			}
		}

		this.getSuccessor = function() {
			if (!successors) {
				return null;
			}

			return successors[0].start;
		}

		//Hash ready
		this.hasSuccessor = function(id) {

			id = convertIfNeeded(id);

			for (var i = 0; i < m; i++) {
				if (successors[i].node == id.toString(16)) {
					return true;
				}
			}

			return false;
		}

		//Hash ready
		this.isSuccessor = function(id) {

			id = convertIfNeeded(id);

			for (var i = 0; i < m; i++) {
				if (successors[i].start == id.toString(16)) {
					return true;
				}
			}

			return false;
		}

		//Hash ready
		this.setSuccessor = function(id, cb) {
			if (debug == true) {
				console.log("setSuccessor (%s)", id);
			}

			id = convertIfNeeded(id);

			//For testing purposes
			//for (var i = 0; i < m; i++) {
			//	console.log(successors[i]);
			//}

			var nodesToDeleteObject = {};
			//var nodesNoLongerNeeded = [];

			//Verify if it's the direct predecessor
			if (predecessor.equals(myId)) {
				predecessor = id;
			} else {
				//var tmpIdNormalized = id > myId ? id - Math.pow(2, m) : id;
				var tmpIdNormalized = that.normalizeInvert(id, myId);
				//var tmpPredecessorNormalized = predecessor > myId ? predecessor - Math.pow(2, m) : predecessor;
				var tmpPredecessorNormalized = that.normalizeInvert(predecessor, myId);
				if (tmpPredecessorNormalized.lesser(tmpIdNormalized) && tmpIdNormalized.lesser(myId)) {
					predecessor = id;
				}
			}

			var successorNode;
			//var idNormalized = id < myId ? id + Math.pow(2, m) : id;
			var idNormalized = that.normalize(id, myId);

			for (var i = 0; i < m; i++) {
				//successorNode = successors[i].node <= myId ? successors[i].node + Math.pow(2, m) : successors[i].node;
				successorNode = that.normalize(successors[i].node, myId, "<=");
				//successorStartNode = successors[i].start <= myId ? successors[i].start + Math.pow(2, m) : successors[i].start;
				successorStartNode = that.normalize(successors[i].start, myId, "<=");
				//Compare normalized values and if it is a valid successor
				//console.log(i + ": " + idNormalized + "(" + id + ")" + " --- " + successorNode + "(" + successorStartNode + ")");
				if ((idNormalized.lesser(successorNode) && idNormalized.greaterOrEquals(successorStartNode)) || (successorStartNode.greater(successorNode) && idNormalized.greaterOrEquals(successorStartNode))) {

					if (successors[i].node.notEquals(myId) && nodesToDeleteObject[successors[i].node.toString(16)] !== false) {
						nodesToDeleteObject[successors[i].node.toString(16)] = true;
					}
					successors[i].node = id;
				} else {
					nodesToDeleteObject[successors[i].node.toString(16)] = false;
				}
			}

			//For testing purposes
			//for (var i = 0; i < m; i++) {
			//	console.log(successors[i]);
			//}

			try {
				var nodesNoLongerNeededReturn = [];
				for (var key in nodesToDeleteObject) {
					if (nodesToDeleteObject[key] === true) {
						nodesNoLongerNeededReturn.push(key);
					}
				}
				cb(nodesNoLongerNeededReturn);
			} catch (e) {
				console.log(e);
			}

			var tmpSuccessors = {};
			for (key in successors) {
				tmpSuccessors[key] = {};
				tmpSuccessors[key].start = successors[key].start;
				tmpSuccessors[key].node = successors[key].node.toString(16);
			}
			try {
				updateCb(predecessor.toString(16), tmpSuccessors);
			} catch (e) {
				if (updateCb != null) {
					console.log(e);
				}
			}
		}

		//Hash ready
		this.removeSuccessor = function(id) {

			id = convertIfNeeded(id);

			var startIds = [];

			for (var i = 0; i < m; i++) {
				if (successors[i].node.equals(id)) {
					//needs to be removed
					successors[i].node = myId;
					startIds.push(successors[i].start);

					if (i + 1 < m && successors[i + 1].node.notEquals(id)) {
						successors[i].node = successors[i + 1].node;
					} else if (predecessor.notEquals(id)) {
						successors[i].node = predecessor;
					}

				}
			}

			if (predecessor.equals(id)) {
				predecessor = successors[m - 1].node;
			}

			var tmpSuccessors = {};
			for (key in successors) {
				tmpSuccessors[key] = {};
				tmpSuccessors[key].start = successors[key].start;
				tmpSuccessors[key].node = successors[key].node.toString(16);
			}
			try {
				updateCb(predecessor.toString(16), tmpSuccessors);
			} catch (e) {
				if (updateCb != null) {
					console.log(e);
				}
			}

			return startIds;
		}

		function convertIfNeeded(id) {
			if (id instanceof bigInt) {
				return id;
			} else {
				switch (typeof id) {
					case "number":
						return bigInt(id);
						break;

					case "string":
						return bigInt(id, 16);
						break;
					default:
						try {
							//Force parse
							return returnValue = bigInt(id);
						} catch (e) {
							console.error("Type is not allowed: " + typeof id);
						}
				}
			}

		}

		//Hash ready
		this.denormalize = function(id) {
			id = convertIfNeeded(id);

			//returnValue >= Math.pow(2, m)
			var tmp = bigInt(2).pow(m);
			if (id.greaterOrEquals(tmp)) {
				return id.minus(tmp);
			} else {
				return id;
			}
		}

		//Hash ready
		//This methos always return bigInt
		this.normalize = function(id, base, operation) {

			id = convertIfNeeded(id);
			base = convertIfNeeded(base);

			if (operation === "<=") {
				if (id.lesserOrEquals(base)) {
					return id.plus(bigInt(2).pow(m));
				} else {
					return bigInt(id);
				}
			} else {

				if (id.lesser(base)) {
					return id.plus(bigInt(2).pow(m));
				} else {
					return bigInt(id);
				}

			}
		}

		//Hash ready
		//This method always return bigInt
		this.normalizeInvert = function(id, base) {

			id = convertIfNeeded(id);
			base = convertIfNeeded(base);

			if (id.greater(base)) {
				return id.minus(bigInt(2).pow(m));
			} else {
				return bigInt(id);
			}
		}

		//Hash ready
		this.findSuccessor = function(id) {

			id = convertIfNeeded(id);

			if (debug == true) {
				console.log("findSuccessor " + id.toString(16));
			}

			if (id == myId) {
				if (debug == true) {
					console.log("WHY AM I ASKING FOR MY OWN findSuccessor");
				}
				return myId;
			}

			//Normalize myId
			var returnValue;
			//var returnValue = id > myId ? myId + Math.pow(2, m) : myId;
			var returnValue = that.normalize(myId, id);

			//var successorStartNormalized;
			var successorNodeNormalized;
			//var idNormalized = id < myId ? id + Math.pow(2, m) : id;
			for (var i = m - 1; i >= 0; i--) {
				//successorNodeNormalized = successors[i].node < id ? successors[i].node + Math.pow(2, m) : successors[i].node;
				successorNodeNormalized = that.normalize(successors[i].node, id);

				if (successorNodeNormalized.greaterOrEquals(id) && successorNodeNormalized.lesser(returnValue)) {
					returnValue = successorNodeNormalized;
				}

			}

			//reverse normalization of myId
			returnValue = that.denormalize(returnValue);
			//if (returnValue >= Math.pow(2, m)) {
			//	returnValue -= Math.pow(2, m);
			//}

			//convert to hex
			return returnValue.toString(16);
		}

	/*
		this.evaluateSuccessorsFromPredecessorFT = function(predecessorFingerTable) {

			if (debug == true) {
				console.log("evaluateSuccessorsFromPredecessorFT");
			}
			//console.log(predecessorFingerTable);

			var tmpSuccessorNodeNormalized;
			var tmpSuccessorStartNormalized;
			var predecessorSuccessorNormalized;
			for (var i = 0; i < m; i++) {
				//test for each successor
				//console.log(successors);
				for (var j = 0; j < m; j++) {

					//tmpSuccessor = that.findSuccessor(predecessorFingerTable.successors[i].node);
					tmpSuccessor = successors[j];
					//console.log("successors: %s", tmpSuccessor);
					//console.log(predecessorFingerTable.successors[i]);

					if (tmpSuccessor.start == predecessorFingerTable.successors[i].node) {
						tmpSuccessor.node = predecessorFingerTable.successors[i].node;
					} else {

						//normalize values
						tmpSuccessorNodeNormalized = tmpSuccessor.node;
						if (tmpSuccessorNodeNormalized <= myId) {
							tmpSuccessorNodeNormalized = tmpSuccessorNodeNormalized + Math.pow(2, m);
						}
						tmpSuccessorStartNormalized = tmpSuccessor.start;
						if (tmpSuccessorStartNormalized <= myId) {
							tmpSuccessorStartNormalized = tmpSuccessorStartNormalized + Math.pow(2, m);
						}
						predecessorSuccessorNormalized = predecessorFingerTable.successors[i].node;
						if (predecessorSuccessorNormalized <= myId) {
							predecessorSuccessorNormalized = predecessorSuccessorNormalized + Math.pow(2, m);
						}
						//console.log(tmpSuccessorNodeNormalized + "(" + tmpSuccessor.node + ")" + ">" + predecessorSuccessorNormalized + "(" + predecessorFingerTable.successors[i].node + ")");
						if (tmpSuccessorNodeNormalized > predecessorSuccessorNormalized && tmpSuccessorStartNormalized <= predecessorSuccessorNormalized) {
							//console.log("Exchanging");
							tmpSuccessor.node = predecessorFingerTable.successors[i].node;
						}

					}
				}
			}

			//For testing purposes
			if (debug == true) {
				for (var i = 0; i < m; i++) {
					console.log(successors[i]);
				}
			}
		}*/

		//Hash ready
		this.closestPrecedingFinger = function(id) {

			id = convertIfNeeded(id);

			if (debug == true) {
				console.log("closestPrecedingFinger to " + id.toString(16));
			}

			if (id == myId) {
				if (debug == true) {
					console.log("WHY AM I ASKING FOR MY OWN closestPrecedingFinger");
				}
			}

			//var outputType = typeof id;
			var returnValue = myId;

			//var successorStartNormalized;
			var successorNodeNormalized;
			//var idNormalized = id < myId ? id + Math.pow(2, m) : id;
			var idNormalized = that.normalize(id, myId);
			for (var i = m - 1; i >= 0; i--) {
				//successorNodeNormalized = successors[i].node < myId ? successors[i].node + Math.pow(2, m) : successors[i].node;
				successorNodeNormalized = that.normalize(successors[i].node, myId);

				if (successorNodeNormalized < idNormalized && successorNodeNormalized > returnValue) {
					returnValue = successorNodeNormalized;
				}

			}

			returnValue = that.denormalize(returnValue);
			//console.log(" is " + returnValue);

			//returns hex
			return returnValue.toString(16);
		}

		this.isInSuccessorsOrPredecessors = function(id) {
			for (var key in successors) {
				if (successors[key].node == id) {
					return true;
				}
			}

			for (var key in predecessor) {
				if (predecessor[key].node == id) {
					return true;
				}
			}

			return false;
		}

		//Hash ready
		this.getObject = function(id) {
			var tmpClosest = that.closestPrecedingFinger(id);
			//if (!tmpClosest) {
			//	tmpClosest = myId;
			//}

			//To prettify the output
			var tmpSuccessors = {};
			for (key in successors) {
				tmpSuccessors[key] = {};
				tmpSuccessors[key].start = successors[key].start;
				tmpSuccessors[key].node = successors[key].node.toString(16);
			}

			return {
				id: myId.toString(16),
				m: m,
				predecessor: predecessor.toString(16),
				closestPrecedingYou: tmpClosest,
				successors: tmpSuccessors
			};
		}

		//Global helper function
		this.compare = function(value1, value2) {
			var tmpValue1 = convertIfNeeded(value1);
			var tmpValue2 = convertIfNeeded(value2);
			return tmpValue1.compare(tmpValue2);
		}

	}

	module.exports = FingerTable;

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

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

	// a prefix we add to normal text messages (not part of signalling but using the same channel)
	var TXT_MSG_PREFIX = "[TextMessage]";

	// chrome allows around 1150 chars to be sent at a time via rtcdatachannels
	//var MAX_CHUNK_SIZE   = 1100;
	var MAX_CHUNK_SIZE = 16000;

	/*
	 * This object creates and provides an RTCPeerConnection which is used for both:
	 *   - a signalling channel
	 *   - a chat channel (why not?)
	 */
	function SignallingChannel(pc, otherID, master) {
		this.remote = otherID;
		var datachn = null;

		var debug = false;

		var that = this;

		this.queues = {};

		var messages = {};

		this.oncall = false;

		this.debugdc = datachn;

		this.dc = function() {
			return datachn
		};

		// user-defined callbacks
		this.onReadyUserCb = null;
		this.onOpenUserCb = null;
		this.onCloseUserCb = null;
		this.onMessageUserCb = null;
		this.onSignallingUserCb = null;
		this.onMessageTooBigUserCb = null;
		this.onSdpUserCb = null;
		this.onIceUserCb = null;
		this.relayUserCb = null;

		var pseudo_id = new Date().getMilliseconds();
		this.id = pseudo_id;

		function createMasterDataChannel() {
			if (!datachn) {
				datachn = pc.createDataChannel("datachannel" + that.id, {});
				registerCallbacks();
			}
		}

		function registerCallbacks() {
			datachn.onopen = function() {
				try {
					that.onOpenUserCb(otherID);
				} catch (e) {
					console.log("Datachannel on signalling peerconnection opened");
				}
			};

			datachn.onerror = function(evt) {
				console.log("Datachannel ON ERROR");
				console.log(evt);
			};

			datachn.onclose = function(x) {
				try {
					if (debug === true) {
						console.log("signalling.js: onclose event");
					}

					that.onCloseUserCb(otherID);
				} catch (e) {
					console.log(x);
					console.log("Datachannel on signalling peerconnection closed");
				}
			};

			datachn.onmessage = function(event) {
				var msg = event.data;

				/*When receiving a text message there's no check for chunks:
				  if it was too big it wasn't sent in the first place*/
				if (msg.indexOf(TXT_MSG_PREFIX) == 0) {
					var txtmsg = msg.replace(TXT_MSG_PREFIX, "");
					try {
						that.onMessageUserCb(txtmsg);
					} catch (e) {
						console.log(TXT_MSG_PREFIX + " " + txtmsg);
					}
				} else {
					incomingSignallingMessage(msg.timestamp, msg);
				}
			};
		}

		function incomingSignallingMessage(timestamp, msg) {
			//check for chunks
			var re = /<chunk from=.+ index=\d+>/;
			var chunk_info = msg.match(re);
			var full_message = null;
			var data = null;

			if (!messages[timestamp])
				messages[timestamp] = [];

			if (chunk_info) {
				console.log("Chunk info OK");
				var chunk_from = chunk_info.input.match(/from=[a-zA-Z0-9]+/)[0].replace("from=", "");
				var chunk_nr = parseInt(chunk_info.input.match(/index=[0-9]+/)[0].replace("index=", ""));

				messages[timestamp][chunk_nr] = msg.replace(re, "");

				full_message = messages[timestamp].join();
			} else {
				full_message = msg;
			}

			try {
				data = JSON.parse(full_message);
				messages[timestamp] = null;
			} catch (e) {
				//				console.log(e);
			}

			if (data) {

				if (debug === true) {
					console.log("Receiving data in datachannel");
				}
				//For behaviour like socket.io
				if (data.queue) {
					try {
						//to pass array as arguments
						that.queues[data.queue].apply(this || window, data.data);
					} catch (e) {
						if (typeof that.queues[data.queue] === 'undefined') {
							console.log("ERR: queue not defined");
						} else {
							console.log("ERR: running queue cb (%s)", data.queue);
							console.log(e);
						}
					}
				};
			}
		}

		this.close = function() {
			try {
				datachn.close();
			} catch (e) {
				console.log(e);
			}
		}

		this.getMessages = function() {
			console.log(messages);
		}

		this.sendMessage = function(msg) {
			if (msg.length < MAX_CHUNK_SIZE) {
				try {
					datachn.send(msg);
				} catch (e) {
					console.log(e);
				}
			} else {
				// break the message into smaller chunks, so it can be sent on the datachannel
				for (var i = 0, chunk_nr = 0; i < msg.length; i += MAX_CHUNK_SIZE, chunk_nr++) {
					var j = i + MAX_CHUNK_SIZE;
					var chunk = msg.substr(i, MAX_CHUNK_SIZE);
					datachn.send("<chunk from=" + this.id + " index=" + chunk_nr + ">" + chunk);
				}
			}
		}

		this.createSlaveDataChannel = function(channel) {
			if (!datachn) {
				datachn = channel;
				registerCallbacks();
			}
		}

		if (master === true)
			createMasterDataChannel();
	}

	SignallingChannel.prototype.addDataChannel = function(evt) {
		this.createSlaveDataChannel(evt.channel);
	}

	SignallingChannel.prototype.sendTextMessage = function(msg) {
		if (msg.length <= MAX_CHUNK_SIZE) {
			this.sendMessage(TXT_MSG_PREFIX + msg);
		} else {
			try {
				this.onMessageTooBigUserCb();
			} catch (e) {
				console.log("Message is too big");
			}
		}
	}

	SignallingChannel.prototype.onReady = function(cb) {
		this.onReadyUserCb = cb;
	};
	SignallingChannel.prototype.onOpen = function(cb) {
		this.onOpenUserCb = cb;
	};
	SignallingChannel.prototype.onClose = function(cb) {
		this.onCloseUserCb = cb;
	};
	SignallingChannel.prototype.onTextMessage = function(cb) {
		this.onMessageUserCb = cb;
	};

	SignallingChannel.prototype.onCallReceived = function(cb) {
		this.onCallReceivedUserCb = cb;
	};

	SignallingChannel.prototype.onSignalling = function(cb) {
		this.onSignallingUserCb = cb;
	};

	SignallingChannel.prototype.onMessageTooBig = function(cb) {
		this.onMessageTooBigUserCb = cb;
	};

	//Interfaces like socket.io
	SignallingChannel.prototype.on = function(queue, cb) {
		this.queues[queue] = cb;
	};
	SignallingChannel.prototype.emit = function(queue, data) {
		var args = Array.prototype.slice.call(arguments);
		//remove queue name
		args.splice(0, 1);

		var message = JSON.stringify({
			"queue": queue,
			"data": args
		});

		this.sendMessage(message);
	};

	SignallingChannel.prototype.relay = function(cb) {
		this.relayUserCb = cb;
	};

	module.exports = SignallingChannel;

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

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

	function MyPeerConnection(isMaster, configuration, options) {
	    "use strict";

	    var PeerConnection = window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
	    var IceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;
	    var SessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;

	    var that = this,
	        pc = new PeerConnection(configuration, options);

	    this.isMaster = isMaster;

	    this.rtcPeerConnection = pc;

	    this.onlocaltreamUserCb = null;
	    this.onremotestreamUserCb = null;
	    this.onicecandidateUserCb = null;
	    this.onsdpinfoUserCb = null;
	    this.onclosedUserCb = null;
	    this.userOICSCC = null;
	    this.userOnDataChannel = null;

	    var remoteSDP = false;

	    function log(text) {
	        //console.log(new Date().getTime() + ": " + text);
	    }

	    this.addIceCandidate = function(ice) {
	        log("Adding remote ice");
	        pc.addIceCandidate(new IceCandidate(ice), function() {}, function() {});
	    };

	    this.setRemoteDescription = function(sdp) {
	        log("Adding remote sdp");
	        if (remoteSDP == false) {
	            pc.setRemoteDescription(new SessionDescription(sdp), function() {}, function() {});
	        }

	    };

	    pc.onicecandidate = function(evt) {
	        log("onicecandidate ");

	        try {
	            that.onicecandidateUserCb(evt.candidate);
	        } catch (e) {
	            console.log(e);
	        }
	    };

	    // once remote stream arrives, show it in the remote video element
	    pc.onaddstream = function(evt) {
	        log("onaddstream");

	        try {
	            that.onremotestreamUserCb(evt.stream);
	        } catch (e) {
	            console.log(e);
	        }
	    };


	    pc.ondatachannel = function(evt) {
	        log("ondatachannel");
	        try {
	            that.userOnDataChannel(evt);
	        } catch (e) {
	            console.log(e);
	        }
	    };

	    pc.oniceconnectionstatechange = function(evt) {
	        log("oniceconnectionstatechange");
	        //console.log(evt);
	        if (pc.iceConnectionState === "connected") {
	            try {
	                that.userOICSCC();
	            } catch (e) {
	                if (typeof that.userOICSCC !== 'undefined' && that.userOICSCC !== null) {
	                    console.log(e);
	                }
	            }

	        } else if (pc.iceConnectionState === "disconnected"
	            || pc.iceConnectionState === "failed"
	            || pc.iceConnectionState === "closed") {

	            try {
	                that.onclosedUserCb(evt);
	            } catch (e) {
	                if (that.onclosedUserCb == null) {
	                    //Is not defined
	                } else {
	                    console.log(e);
	                }
	            }
	        }
	    };

	    pc.onnegotiationneeded = function(evt) {
	        log("onnegotiationneeded");
	    };

	    pc.onsignalingstatechange = function(evt) {
	        log("onsignalingstatechange");

	        if (pc.signalingState === "closed") {
	            // Not sure why this does not always get called
	            console.log("signalingState === closed");
	            try {
	                that.onclosedUserCb(evt);
	            } catch (e) {
	                if (that.onclosedUserCb != null) {
	                    console.log(e)
	                } else {
	                    console.log(e);
	                    console.log(that.onclosedUserCb)
	                }
	            }
	        }
	    };

	    this.start = function(audio, video, call, sdp) {

	        // get the local stream, show it in the local video element and send it
	        // navigator.webkitGetUserMedia({ "audio": audio, "video": video }, function (stream) {
	        function gotDescription(desc) {
	            log("gotDescription");
	            pc.setLocalDescription(desc, function() {}, function() {});

	            try {
	                that.onsdpinfoUserCb(desc);
	            } catch (e) {
	                console.log(e);
	            }

	        }

	        function failedDescription(msg) {
	            log("Failed to get description " + msg);
	        }

	        try {
	            if (that.onlocaltreamUserCb) {
	                that.onlocaltreamUserCb(stream);
	            } else {
	                log("onlocaltreamUserCb not defined");
	            }

	        } catch (e) {
	            console.log("ERROR: onlocaltreamUserCb");
	            console.log(e);
	        }

	        if (call) {
	            pc.addStream(stream);
	        }

	        if (that.isMaster) {
	            log("Creating Offer");
	            pc.createOffer(gotDescription, failedDescription);
	        } else {
	            if (sdp) {
	                pc.setRemoteDescription(new SessionDescription(sdp), function() {}, function() {});
	            }
	            pc.createAnswer(gotDescription, failedDescription);
	        }

	    };

	}

	MyPeerConnection.prototype.onIceCandidate = function(cb) {
	    "use strict";
	    this.onicecandidateUserCb = cb;
	};
	MyPeerConnection.prototype.onSdpInfo = function(cb) {
	    "use strict";
	    this.onsdpinfoUserCb = cb;
	};

	MyPeerConnection.prototype.onRemoteStream = function(cb) {
	    "use strict";
	    this.onremotestreamUserCb = cb;
	};
	MyPeerConnection.prototype.onLocalStream = function(cb) {
	    "use strict";
	    this.onlocaltreamUserCb = cb;
	};

	MyPeerConnection.prototype.onClosed = function(cb) {
	    "use strict";
	    this.onclosedUserCb = cb;
	};

	MyPeerConnection.prototype.addICE = function(ice) {
	    "use strict";
	    this.addIceCandidate(ice);
	};

	MyPeerConnection.prototype.addSDP = function(sdp) {
	    "use strict";
	    this.setRemoteDescription(sdp);
	};

	module.exports = MyPeerConnection;

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(8), __webpack_require__(9), __webpack_require__(10), __webpack_require__(11), __webpack_require__(12), __webpack_require__(13), __webpack_require__(14), __webpack_require__(15), __webpack_require__(16), __webpack_require__(17), __webpack_require__(18), __webpack_require__(19), __webpack_require__(20), __webpack_require__(21), __webpack_require__(22), __webpack_require__(23), __webpack_require__(24), __webpack_require__(25), __webpack_require__(26), __webpack_require__(27), __webpack_require__(28), __webpack_require__(29), __webpack_require__(30), __webpack_require__(31), __webpack_require__(32), __webpack_require__(33), __webpack_require__(34), __webpack_require__(35), __webpack_require__(36), __webpack_require__(37), __webpack_require__(38), __webpack_require__(39));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./x64-core", "./lib-typedarrays", "./enc-utf16", "./enc-base64", "./md5", "./sha1", "./sha256", "./sha224", "./sha512", "./sha384", "./sha3", "./ripemd160", "./hmac", "./pbkdf2", "./evpkdf", "./cipher-core", "./mode-cfb", "./mode-ctr", "./mode-ctr-gladman", "./mode-ofb", "./mode-ecb", "./pad-ansix923", "./pad-iso10126", "./pad-iso97971", "./pad-zeropadding", "./pad-nopadding", "./format-hex", "./aes", "./tripledes", "./rc4", "./rabbit", "./rabbit-legacy"], factory);
		}
		else {
			// Global (browser)
			root.CryptoJS = factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		return CryptoJS;

	}));

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	
	module.exports = __webpack_require__(41);


/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory) {
		if (true) {
			// CommonJS
			module.exports = exports = factory();
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define([], factory);
		}
		else {
			// Global (browser)
			root.CryptoJS = factory();
		}
	}(this, function () {

		/**
		 * CryptoJS core components.
		 */
		var CryptoJS = CryptoJS || (function (Math, undefined) {
		    /**
		     * CryptoJS namespace.
		     */
		    var C = {};

		    /**
		     * Library namespace.
		     */
		    var C_lib = C.lib = {};

		    /**
		     * Base object for prototypal inheritance.
		     */
		    var Base = C_lib.Base = (function () {
		        function F() {}

		        return {
		            /**
		             * Creates a new object that inherits from this object.
		             *
		             * @param {Object} overrides Properties to copy into the new object.
		             *
		             * @return {Object} The new object.
		             *
		             * @static
		             *
		             * @example
		             *
		             *     var MyType = CryptoJS.lib.Base.extend({
		             *         field: 'value',
		             *
		             *         method: function () {
		             *         }
		             *     });
		             */
		            extend: function (overrides) {
		                // Spawn
		                F.prototype = this;
		                var subtype = new F();

		                // Augment
		                if (overrides) {
		                    subtype.mixIn(overrides);
		                }

		                // Create default initializer
		                if (!subtype.hasOwnProperty('init')) {
		                    subtype.init = function () {
		                        subtype.$super.init.apply(this, arguments);
		                    };
		                }

		                // Initializer's prototype is the subtype object
		                subtype.init.prototype = subtype;

		                // Reference supertype
		                subtype.$super = this;

		                return subtype;
		            },

		            /**
		             * Extends this object and runs the init method.
		             * Arguments to create() will be passed to init().
		             *
		             * @return {Object} The new object.
		             *
		             * @static
		             *
		             * @example
		             *
		             *     var instance = MyType.create();
		             */
		            create: function () {
		                var instance = this.extend();
		                instance.init.apply(instance, arguments);

		                return instance;
		            },

		            /**
		             * Initializes a newly created object.
		             * Override this method to add some logic when your objects are created.
		             *
		             * @example
		             *
		             *     var MyType = CryptoJS.lib.Base.extend({
		             *         init: function () {
		             *             // ...
		             *         }
		             *     });
		             */
		            init: function () {
		            },

		            /**
		             * Copies properties into this object.
		             *
		             * @param {Object} properties The properties to mix in.
		             *
		             * @example
		             *
		             *     MyType.mixIn({
		             *         field: 'value'
		             *     });
		             */
		            mixIn: function (properties) {
		                for (var propertyName in properties) {
		                    if (properties.hasOwnProperty(propertyName)) {
		                        this[propertyName] = properties[propertyName];
		                    }
		                }

		                // IE won't copy toString using the loop above
		                if (properties.hasOwnProperty('toString')) {
		                    this.toString = properties.toString;
		                }
		            },

		            /**
		             * Creates a copy of this object.
		             *
		             * @return {Object} The clone.
		             *
		             * @example
		             *
		             *     var clone = instance.clone();
		             */
		            clone: function () {
		                return this.init.prototype.extend(this);
		            }
		        };
		    }());

		    /**
		     * An array of 32-bit words.
		     *
		     * @property {Array} words The array of 32-bit words.
		     * @property {number} sigBytes The number of significant bytes in this word array.
		     */
		    var WordArray = C_lib.WordArray = Base.extend({
		        /**
		         * Initializes a newly created word array.
		         *
		         * @param {Array} words (Optional) An array of 32-bit words.
		         * @param {number} sigBytes (Optional) The number of significant bytes in the words.
		         *
		         * @example
		         *
		         *     var wordArray = CryptoJS.lib.WordArray.create();
		         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
		         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
		         */
		        init: function (words, sigBytes) {
		            words = this.words = words || [];

		            if (sigBytes != undefined) {
		                this.sigBytes = sigBytes;
		            } else {
		                this.sigBytes = words.length * 4;
		            }
		        },

		        /**
		         * Converts this word array to a string.
		         *
		         * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
		         *
		         * @return {string} The stringified word array.
		         *
		         * @example
		         *
		         *     var string = wordArray + '';
		         *     var string = wordArray.toString();
		         *     var string = wordArray.toString(CryptoJS.enc.Utf8);
		         */
		        toString: function (encoder) {
		            return (encoder || Hex).stringify(this);
		        },

		        /**
		         * Concatenates a word array to this word array.
		         *
		         * @param {WordArray} wordArray The word array to append.
		         *
		         * @return {WordArray} This word array.
		         *
		         * @example
		         *
		         *     wordArray1.concat(wordArray2);
		         */
		        concat: function (wordArray) {
		            // Shortcuts
		            var thisWords = this.words;
		            var thatWords = wordArray.words;
		            var thisSigBytes = this.sigBytes;
		            var thatSigBytes = wordArray.sigBytes;

		            // Clamp excess bits
		            this.clamp();

		            // Concat
		            if (thisSigBytes % 4) {
		                // Copy one byte at a time
		                for (var i = 0; i < thatSigBytes; i++) {
		                    var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
		                    thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
		                }
		            } else {
		                // Copy one word at a time
		                for (var i = 0; i < thatSigBytes; i += 4) {
		                    thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
		                }
		            }
		            this.sigBytes += thatSigBytes;

		            // Chainable
		            return this;
		        },

		        /**
		         * Removes insignificant bits.
		         *
		         * @example
		         *
		         *     wordArray.clamp();
		         */
		        clamp: function () {
		            // Shortcuts
		            var words = this.words;
		            var sigBytes = this.sigBytes;

		            // Clamp
		            words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
		            words.length = Math.ceil(sigBytes / 4);
		        },

		        /**
		         * Creates a copy of this word array.
		         *
		         * @return {WordArray} The clone.
		         *
		         * @example
		         *
		         *     var clone = wordArray.clone();
		         */
		        clone: function () {
		            var clone = Base.clone.call(this);
		            clone.words = this.words.slice(0);

		            return clone;
		        },

		        /**
		         * Creates a word array filled with random bytes.
		         *
		         * @param {number} nBytes The number of random bytes to generate.
		         *
		         * @return {WordArray} The random word array.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var wordArray = CryptoJS.lib.WordArray.random(16);
		         */
		        random: function (nBytes) {
		            var words = [];

		            var r = (function (m_w) {
		                var m_w = m_w;
		                var m_z = 0x3ade68b1;
		                var mask = 0xffffffff;

		                return function () {
		                    m_z = (0x9069 * (m_z & 0xFFFF) + (m_z >> 0x10)) & mask;
		                    m_w = (0x4650 * (m_w & 0xFFFF) + (m_w >> 0x10)) & mask;
		                    var result = ((m_z << 0x10) + m_w) & mask;
		                    result /= 0x100000000;
		                    result += 0.5;
		                    return result * (Math.random() > .5 ? 1 : -1);
		                }
		            });

		            for (var i = 0, rcache; i < nBytes; i += 4) {
		                var _r = r((rcache || Math.random()) * 0x100000000);

		                rcache = _r() * 0x3ade67b7;
		                words.push((_r() * 0x100000000) | 0);
		            }

		            return new WordArray.init(words, nBytes);
		        }
		    });

		    /**
		     * Encoder namespace.
		     */
		    var C_enc = C.enc = {};

		    /**
		     * Hex encoding strategy.
		     */
		    var Hex = C_enc.Hex = {
		        /**
		         * Converts a word array to a hex string.
		         *
		         * @param {WordArray} wordArray The word array.
		         *
		         * @return {string} The hex string.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
		         */
		        stringify: function (wordArray) {
		            // Shortcuts
		            var words = wordArray.words;
		            var sigBytes = wordArray.sigBytes;

		            // Convert
		            var hexChars = [];
		            for (var i = 0; i < sigBytes; i++) {
		                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
		                hexChars.push((bite >>> 4).toString(16));
		                hexChars.push((bite & 0x0f).toString(16));
		            }

		            return hexChars.join('');
		        },

		        /**
		         * Converts a hex string to a word array.
		         *
		         * @param {string} hexStr The hex string.
		         *
		         * @return {WordArray} The word array.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
		         */
		        parse: function (hexStr) {
		            // Shortcut
		            var hexStrLength = hexStr.length;

		            // Convert
		            var words = [];
		            for (var i = 0; i < hexStrLength; i += 2) {
		                words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
		            }

		            return new WordArray.init(words, hexStrLength / 2);
		        }
		    };

		    /**
		     * Latin1 encoding strategy.
		     */
		    var Latin1 = C_enc.Latin1 = {
		        /**
		         * Converts a word array to a Latin1 string.
		         *
		         * @param {WordArray} wordArray The word array.
		         *
		         * @return {string} The Latin1 string.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
		         */
		        stringify: function (wordArray) {
		            // Shortcuts
		            var words = wordArray.words;
		            var sigBytes = wordArray.sigBytes;

		            // Convert
		            var latin1Chars = [];
		            for (var i = 0; i < sigBytes; i++) {
		                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
		                latin1Chars.push(String.fromCharCode(bite));
		            }

		            return latin1Chars.join('');
		        },

		        /**
		         * Converts a Latin1 string to a word array.
		         *
		         * @param {string} latin1Str The Latin1 string.
		         *
		         * @return {WordArray} The word array.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
		         */
		        parse: function (latin1Str) {
		            // Shortcut
		            var latin1StrLength = latin1Str.length;

		            // Convert
		            var words = [];
		            for (var i = 0; i < latin1StrLength; i++) {
		                words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
		            }

		            return new WordArray.init(words, latin1StrLength);
		        }
		    };

		    /**
		     * UTF-8 encoding strategy.
		     */
		    var Utf8 = C_enc.Utf8 = {
		        /**
		         * Converts a word array to a UTF-8 string.
		         *
		         * @param {WordArray} wordArray The word array.
		         *
		         * @return {string} The UTF-8 string.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
		         */
		        stringify: function (wordArray) {
		            try {
		                return decodeURIComponent(escape(Latin1.stringify(wordArray)));
		            } catch (e) {
		                throw new Error('Malformed UTF-8 data');
		            }
		        },

		        /**
		         * Converts a UTF-8 string to a word array.
		         *
		         * @param {string} utf8Str The UTF-8 string.
		         *
		         * @return {WordArray} The word array.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
		         */
		        parse: function (utf8Str) {
		            return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
		        }
		    };

		    /**
		     * Abstract buffered block algorithm template.
		     *
		     * The property blockSize must be implemented in a concrete subtype.
		     *
		     * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
		     */
		    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
		        /**
		         * Resets this block algorithm's data buffer to its initial state.
		         *
		         * @example
		         *
		         *     bufferedBlockAlgorithm.reset();
		         */
		        reset: function () {
		            // Initial values
		            this._data = new WordArray.init();
		            this._nDataBytes = 0;
		        },

		        /**
		         * Adds new data to this block algorithm's buffer.
		         *
		         * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
		         *
		         * @example
		         *
		         *     bufferedBlockAlgorithm._append('data');
		         *     bufferedBlockAlgorithm._append(wordArray);
		         */
		        _append: function (data) {
		            // Convert string to WordArray, else assume WordArray already
		            if (typeof data == 'string') {
		                data = Utf8.parse(data);
		            }

		            // Append
		            this._data.concat(data);
		            this._nDataBytes += data.sigBytes;
		        },

		        /**
		         * Processes available data blocks.
		         *
		         * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
		         *
		         * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
		         *
		         * @return {WordArray} The processed data.
		         *
		         * @example
		         *
		         *     var processedData = bufferedBlockAlgorithm._process();
		         *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
		         */
		        _process: function (doFlush) {
		            // Shortcuts
		            var data = this._data;
		            var dataWords = data.words;
		            var dataSigBytes = data.sigBytes;
		            var blockSize = this.blockSize;
		            var blockSizeBytes = blockSize * 4;

		            // Count blocks ready
		            var nBlocksReady = dataSigBytes / blockSizeBytes;
		            if (doFlush) {
		                // Round up to include partial blocks
		                nBlocksReady = Math.ceil(nBlocksReady);
		            } else {
		                // Round down to include only full blocks,
		                // less the number of blocks that must remain in the buffer
		                nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
		            }

		            // Count words ready
		            var nWordsReady = nBlocksReady * blockSize;

		            // Count bytes ready
		            var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

		            // Process blocks
		            if (nWordsReady) {
		                for (var offset = 0; offset < nWordsReady; offset += blockSize) {
		                    // Perform concrete-algorithm logic
		                    this._doProcessBlock(dataWords, offset);
		                }

		                // Remove processed words
		                var processedWords = dataWords.splice(0, nWordsReady);
		                data.sigBytes -= nBytesReady;
		            }

		            // Return processed words
		            return new WordArray.init(processedWords, nBytesReady);
		        },

		        /**
		         * Creates a copy of this object.
		         *
		         * @return {Object} The clone.
		         *
		         * @example
		         *
		         *     var clone = bufferedBlockAlgorithm.clone();
		         */
		        clone: function () {
		            var clone = Base.clone.call(this);
		            clone._data = this._data.clone();

		            return clone;
		        },

		        _minBufferSize: 0
		    });

		    /**
		     * Abstract hasher template.
		     *
		     * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
		     */
		    var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
		        /**
		         * Configuration options.
		         */
		        cfg: Base.extend(),

		        /**
		         * Initializes a newly created hasher.
		         *
		         * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
		         *
		         * @example
		         *
		         *     var hasher = CryptoJS.algo.SHA256.create();
		         */
		        init: function (cfg) {
		            // Apply config defaults
		            this.cfg = this.cfg.extend(cfg);

		            // Set initial values
		            this.reset();
		        },

		        /**
		         * Resets this hasher to its initial state.
		         *
		         * @example
		         *
		         *     hasher.reset();
		         */
		        reset: function () {
		            // Reset data buffer
		            BufferedBlockAlgorithm.reset.call(this);

		            // Perform concrete-hasher logic
		            this._doReset();
		        },

		        /**
		         * Updates this hasher with a message.
		         *
		         * @param {WordArray|string} messageUpdate The message to append.
		         *
		         * @return {Hasher} This hasher.
		         *
		         * @example
		         *
		         *     hasher.update('message');
		         *     hasher.update(wordArray);
		         */
		        update: function (messageUpdate) {
		            // Append
		            this._append(messageUpdate);

		            // Update the hash
		            this._process();

		            // Chainable
		            return this;
		        },

		        /**
		         * Finalizes the hash computation.
		         * Note that the finalize operation is effectively a destructive, read-once operation.
		         *
		         * @param {WordArray|string} messageUpdate (Optional) A final message update.
		         *
		         * @return {WordArray} The hash.
		         *
		         * @example
		         *
		         *     var hash = hasher.finalize();
		         *     var hash = hasher.finalize('message');
		         *     var hash = hasher.finalize(wordArray);
		         */
		        finalize: function (messageUpdate) {
		            // Final message update
		            if (messageUpdate) {
		                this._append(messageUpdate);
		            }

		            // Perform concrete-hasher logic
		            var hash = this._doFinalize();

		            return hash;
		        },

		        blockSize: 512/32,

		        /**
		         * Creates a shortcut function to a hasher's object interface.
		         *
		         * @param {Hasher} hasher The hasher to create a helper for.
		         *
		         * @return {Function} The shortcut function.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
		         */
		        _createHelper: function (hasher) {
		            return function (message, cfg) {
		                return new hasher.init(cfg).finalize(message);
		            };
		        },

		        /**
		         * Creates a shortcut function to the HMAC's object interface.
		         *
		         * @param {Hasher} hasher The hasher to use in this HMAC helper.
		         *
		         * @return {Function} The shortcut function.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
		         */
		        _createHmacHelper: function (hasher) {
		            return function (message, key) {
		                return new C_algo.HMAC.init(hasher, key).finalize(message);
		            };
		        }
		    });

		    /**
		     * Algorithm namespace.
		     */
		    var C_algo = C.algo = {};

		    return C;
		}(Math));


		return CryptoJS;

	}));

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function (undefined) {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var Base = C_lib.Base;
		    var X32WordArray = C_lib.WordArray;

		    /**
		     * x64 namespace.
		     */
		    var C_x64 = C.x64 = {};

		    /**
		     * A 64-bit word.
		     */
		    var X64Word = C_x64.Word = Base.extend({
		        /**
		         * Initializes a newly created 64-bit word.
		         *
		         * @param {number} high The high 32 bits.
		         * @param {number} low The low 32 bits.
		         *
		         * @example
		         *
		         *     var x64Word = CryptoJS.x64.Word.create(0x00010203, 0x04050607);
		         */
		        init: function (high, low) {
		            this.high = high;
		            this.low = low;
		        }

		        /**
		         * Bitwise NOTs this word.
		         *
		         * @return {X64Word} A new x64-Word object after negating.
		         *
		         * @example
		         *
		         *     var negated = x64Word.not();
		         */
		        // not: function () {
		            // var high = ~this.high;
		            // var low = ~this.low;

		            // return X64Word.create(high, low);
		        // },

		        /**
		         * Bitwise ANDs this word with the passed word.
		         *
		         * @param {X64Word} word The x64-Word to AND with this word.
		         *
		         * @return {X64Word} A new x64-Word object after ANDing.
		         *
		         * @example
		         *
		         *     var anded = x64Word.and(anotherX64Word);
		         */
		        // and: function (word) {
		            // var high = this.high & word.high;
		            // var low = this.low & word.low;

		            // return X64Word.create(high, low);
		        // },

		        /**
		         * Bitwise ORs this word with the passed word.
		         *
		         * @param {X64Word} word The x64-Word to OR with this word.
		         *
		         * @return {X64Word} A new x64-Word object after ORing.
		         *
		         * @example
		         *
		         *     var ored = x64Word.or(anotherX64Word);
		         */
		        // or: function (word) {
		            // var high = this.high | word.high;
		            // var low = this.low | word.low;

		            // return X64Word.create(high, low);
		        // },

		        /**
		         * Bitwise XORs this word with the passed word.
		         *
		         * @param {X64Word} word The x64-Word to XOR with this word.
		         *
		         * @return {X64Word} A new x64-Word object after XORing.
		         *
		         * @example
		         *
		         *     var xored = x64Word.xor(anotherX64Word);
		         */
		        // xor: function (word) {
		            // var high = this.high ^ word.high;
		            // var low = this.low ^ word.low;

		            // return X64Word.create(high, low);
		        // },

		        /**
		         * Shifts this word n bits to the left.
		         *
		         * @param {number} n The number of bits to shift.
		         *
		         * @return {X64Word} A new x64-Word object after shifting.
		         *
		         * @example
		         *
		         *     var shifted = x64Word.shiftL(25);
		         */
		        // shiftL: function (n) {
		            // if (n < 32) {
		                // var high = (this.high << n) | (this.low >>> (32 - n));
		                // var low = this.low << n;
		            // } else {
		                // var high = this.low << (n - 32);
		                // var low = 0;
		            // }

		            // return X64Word.create(high, low);
		        // },

		        /**
		         * Shifts this word n bits to the right.
		         *
		         * @param {number} n The number of bits to shift.
		         *
		         * @return {X64Word} A new x64-Word object after shifting.
		         *
		         * @example
		         *
		         *     var shifted = x64Word.shiftR(7);
		         */
		        // shiftR: function (n) {
		            // if (n < 32) {
		                // var low = (this.low >>> n) | (this.high << (32 - n));
		                // var high = this.high >>> n;
		            // } else {
		                // var low = this.high >>> (n - 32);
		                // var high = 0;
		            // }

		            // return X64Word.create(high, low);
		        // },

		        /**
		         * Rotates this word n bits to the left.
		         *
		         * @param {number} n The number of bits to rotate.
		         *
		         * @return {X64Word} A new x64-Word object after rotating.
		         *
		         * @example
		         *
		         *     var rotated = x64Word.rotL(25);
		         */
		        // rotL: function (n) {
		            // return this.shiftL(n).or(this.shiftR(64 - n));
		        // },

		        /**
		         * Rotates this word n bits to the right.
		         *
		         * @param {number} n The number of bits to rotate.
		         *
		         * @return {X64Word} A new x64-Word object after rotating.
		         *
		         * @example
		         *
		         *     var rotated = x64Word.rotR(7);
		         */
		        // rotR: function (n) {
		            // return this.shiftR(n).or(this.shiftL(64 - n));
		        // },

		        /**
		         * Adds this word with the passed word.
		         *
		         * @param {X64Word} word The x64-Word to add with this word.
		         *
		         * @return {X64Word} A new x64-Word object after adding.
		         *
		         * @example
		         *
		         *     var added = x64Word.add(anotherX64Word);
		         */
		        // add: function (word) {
		            // var low = (this.low + word.low) | 0;
		            // var carry = (low >>> 0) < (this.low >>> 0) ? 1 : 0;
		            // var high = (this.high + word.high + carry) | 0;

		            // return X64Word.create(high, low);
		        // }
		    });

		    /**
		     * An array of 64-bit words.
		     *
		     * @property {Array} words The array of CryptoJS.x64.Word objects.
		     * @property {number} sigBytes The number of significant bytes in this word array.
		     */
		    var X64WordArray = C_x64.WordArray = Base.extend({
		        /**
		         * Initializes a newly created word array.
		         *
		         * @param {Array} words (Optional) An array of CryptoJS.x64.Word objects.
		         * @param {number} sigBytes (Optional) The number of significant bytes in the words.
		         *
		         * @example
		         *
		         *     var wordArray = CryptoJS.x64.WordArray.create();
		         *
		         *     var wordArray = CryptoJS.x64.WordArray.create([
		         *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
		         *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
		         *     ]);
		         *
		         *     var wordArray = CryptoJS.x64.WordArray.create([
		         *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
		         *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
		         *     ], 10);
		         */
		        init: function (words, sigBytes) {
		            words = this.words = words || [];

		            if (sigBytes != undefined) {
		                this.sigBytes = sigBytes;
		            } else {
		                this.sigBytes = words.length * 8;
		            }
		        },

		        /**
		         * Converts this 64-bit word array to a 32-bit word array.
		         *
		         * @return {CryptoJS.lib.WordArray} This word array's data as a 32-bit word array.
		         *
		         * @example
		         *
		         *     var x32WordArray = x64WordArray.toX32();
		         */
		        toX32: function () {
		            // Shortcuts
		            var x64Words = this.words;
		            var x64WordsLength = x64Words.length;

		            // Convert
		            var x32Words = [];
		            for (var i = 0; i < x64WordsLength; i++) {
		                var x64Word = x64Words[i];
		                x32Words.push(x64Word.high);
		                x32Words.push(x64Word.low);
		            }

		            return X32WordArray.create(x32Words, this.sigBytes);
		        },

		        /**
		         * Creates a copy of this word array.
		         *
		         * @return {X64WordArray} The clone.
		         *
		         * @example
		         *
		         *     var clone = x64WordArray.clone();
		         */
		        clone: function () {
		            var clone = Base.clone.call(this);

		            // Clone "words" array
		            var words = clone.words = this.words.slice(0);

		            // Clone each X64Word object
		            var wordsLength = words.length;
		            for (var i = 0; i < wordsLength; i++) {
		                words[i] = words[i].clone();
		            }

		            return clone;
		        }
		    });
		}());


		return CryptoJS;

	}));

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Check if typed arrays are supported
		    if (typeof ArrayBuffer != 'function') {
		        return;
		    }

		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var WordArray = C_lib.WordArray;

		    // Reference original init
		    var superInit = WordArray.init;

		    // Augment WordArray.init to handle typed arrays
		    var subInit = WordArray.init = function (typedArray) {
		        // Convert buffers to uint8
		        if (typedArray instanceof ArrayBuffer) {
		            typedArray = new Uint8Array(typedArray);
		        }

		        // Convert other array views to uint8
		        if (
		            typedArray instanceof Int8Array ||
		            (typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray) ||
		            typedArray instanceof Int16Array ||
		            typedArray instanceof Uint16Array ||
		            typedArray instanceof Int32Array ||
		            typedArray instanceof Uint32Array ||
		            typedArray instanceof Float32Array ||
		            typedArray instanceof Float64Array
		        ) {
		            typedArray = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
		        }

		        // Handle Uint8Array
		        if (typedArray instanceof Uint8Array) {
		            // Shortcut
		            var typedArrayByteLength = typedArray.byteLength;

		            // Extract bytes
		            var words = [];
		            for (var i = 0; i < typedArrayByteLength; i++) {
		                words[i >>> 2] |= typedArray[i] << (24 - (i % 4) * 8);
		            }

		            // Initialize this word array
		            superInit.call(this, words, typedArrayByteLength);
		        } else {
		            // Else call normal init
		            superInit.apply(this, arguments);
		        }
		    };

		    subInit.prototype = WordArray;
		}());


		return CryptoJS.lib.WordArray;

	}));

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var WordArray = C_lib.WordArray;
		    var C_enc = C.enc;

		    /**
		     * UTF-16 BE encoding strategy.
		     */
		    var Utf16BE = C_enc.Utf16 = C_enc.Utf16BE = {
		        /**
		         * Converts a word array to a UTF-16 BE string.
		         *
		         * @param {WordArray} wordArray The word array.
		         *
		         * @return {string} The UTF-16 BE string.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var utf16String = CryptoJS.enc.Utf16.stringify(wordArray);
		         */
		        stringify: function (wordArray) {
		            // Shortcuts
		            var words = wordArray.words;
		            var sigBytes = wordArray.sigBytes;

		            // Convert
		            var utf16Chars = [];
		            for (var i = 0; i < sigBytes; i += 2) {
		                var codePoint = (words[i >>> 2] >>> (16 - (i % 4) * 8)) & 0xffff;
		                utf16Chars.push(String.fromCharCode(codePoint));
		            }

		            return utf16Chars.join('');
		        },

		        /**
		         * Converts a UTF-16 BE string to a word array.
		         *
		         * @param {string} utf16Str The UTF-16 BE string.
		         *
		         * @return {WordArray} The word array.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var wordArray = CryptoJS.enc.Utf16.parse(utf16String);
		         */
		        parse: function (utf16Str) {
		            // Shortcut
		            var utf16StrLength = utf16Str.length;

		            // Convert
		            var words = [];
		            for (var i = 0; i < utf16StrLength; i++) {
		                words[i >>> 1] |= utf16Str.charCodeAt(i) << (16 - (i % 2) * 16);
		            }

		            return WordArray.create(words, utf16StrLength * 2);
		        }
		    };

		    /**
		     * UTF-16 LE encoding strategy.
		     */
		    C_enc.Utf16LE = {
		        /**
		         * Converts a word array to a UTF-16 LE string.
		         *
		         * @param {WordArray} wordArray The word array.
		         *
		         * @return {string} The UTF-16 LE string.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var utf16Str = CryptoJS.enc.Utf16LE.stringify(wordArray);
		         */
		        stringify: function (wordArray) {
		            // Shortcuts
		            var words = wordArray.words;
		            var sigBytes = wordArray.sigBytes;

		            // Convert
		            var utf16Chars = [];
		            for (var i = 0; i < sigBytes; i += 2) {
		                var codePoint = swapEndian((words[i >>> 2] >>> (16 - (i % 4) * 8)) & 0xffff);
		                utf16Chars.push(String.fromCharCode(codePoint));
		            }

		            return utf16Chars.join('');
		        },

		        /**
		         * Converts a UTF-16 LE string to a word array.
		         *
		         * @param {string} utf16Str The UTF-16 LE string.
		         *
		         * @return {WordArray} The word array.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var wordArray = CryptoJS.enc.Utf16LE.parse(utf16Str);
		         */
		        parse: function (utf16Str) {
		            // Shortcut
		            var utf16StrLength = utf16Str.length;

		            // Convert
		            var words = [];
		            for (var i = 0; i < utf16StrLength; i++) {
		                words[i >>> 1] |= swapEndian(utf16Str.charCodeAt(i) << (16 - (i % 2) * 16));
		            }

		            return WordArray.create(words, utf16StrLength * 2);
		        }
		    };

		    function swapEndian(word) {
		        return ((word << 8) & 0xff00ff00) | ((word >>> 8) & 0x00ff00ff);
		    }
		}());


		return CryptoJS.enc.Utf16;

	}));

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var WordArray = C_lib.WordArray;
		    var C_enc = C.enc;

		    /**
		     * Base64 encoding strategy.
		     */
		    var Base64 = C_enc.Base64 = {
		        /**
		         * Converts a word array to a Base64 string.
		         *
		         * @param {WordArray} wordArray The word array.
		         *
		         * @return {string} The Base64 string.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
		         */
		        stringify: function (wordArray) {
		            // Shortcuts
		            var words = wordArray.words;
		            var sigBytes = wordArray.sigBytes;
		            var map = this._map;

		            // Clamp excess bits
		            wordArray.clamp();

		            // Convert
		            var base64Chars = [];
		            for (var i = 0; i < sigBytes; i += 3) {
		                var byte1 = (words[i >>> 2]       >>> (24 - (i % 4) * 8))       & 0xff;
		                var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
		                var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

		                var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

		                for (var j = 0; (j < 4) && (i + j * 0.75 < sigBytes); j++) {
		                    base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
		                }
		            }

		            // Add padding
		            var paddingChar = map.charAt(64);
		            if (paddingChar) {
		                while (base64Chars.length % 4) {
		                    base64Chars.push(paddingChar);
		                }
		            }

		            return base64Chars.join('');
		        },

		        /**
		         * Converts a Base64 string to a word array.
		         *
		         * @param {string} base64Str The Base64 string.
		         *
		         * @return {WordArray} The word array.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
		         */
		        parse: function (base64Str) {
		            // Shortcuts
		            var base64StrLength = base64Str.length;
		            var map = this._map;

		            // Ignore padding
		            var paddingChar = map.charAt(64);
		            if (paddingChar) {
		                var paddingIndex = base64Str.indexOf(paddingChar);
		                if (paddingIndex != -1) {
		                    base64StrLength = paddingIndex;
		                }
		            }

		            // Convert
		            var words = [];
		            var nBytes = 0;
		            for (var i = 0; i < base64StrLength; i++) {
		                if (i % 4) {
		                    var bits1 = map.indexOf(base64Str.charAt(i - 1)) << ((i % 4) * 2);
		                    var bits2 = map.indexOf(base64Str.charAt(i)) >>> (6 - (i % 4) * 2);
		                    words[nBytes >>> 2] |= (bits1 | bits2) << (24 - (nBytes % 4) * 8);
		                    nBytes++;
		                }
		            }

		            return WordArray.create(words, nBytes);
		        },

		        _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
		    };
		}());


		return CryptoJS.enc.Base64;

	}));

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function (Math) {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var WordArray = C_lib.WordArray;
		    var Hasher = C_lib.Hasher;
		    var C_algo = C.algo;

		    // Constants table
		    var T = [];

		    // Compute constants
		    (function () {
		        for (var i = 0; i < 64; i++) {
		            T[i] = (Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
		        }
		    }());

		    /**
		     * MD5 hash algorithm.
		     */
		    var MD5 = C_algo.MD5 = Hasher.extend({
		        _doReset: function () {
		            this._hash = new WordArray.init([
		                0x67452301, 0xefcdab89,
		                0x98badcfe, 0x10325476
		            ]);
		        },

		        _doProcessBlock: function (M, offset) {
		            // Swap endian
		            for (var i = 0; i < 16; i++) {
		                // Shortcuts
		                var offset_i = offset + i;
		                var M_offset_i = M[offset_i];

		                M[offset_i] = (
		                    (((M_offset_i << 8)  | (M_offset_i >>> 24)) & 0x00ff00ff) |
		                    (((M_offset_i << 24) | (M_offset_i >>> 8))  & 0xff00ff00)
		                );
		            }

		            // Shortcuts
		            var H = this._hash.words;

		            var M_offset_0  = M[offset + 0];
		            var M_offset_1  = M[offset + 1];
		            var M_offset_2  = M[offset + 2];
		            var M_offset_3  = M[offset + 3];
		            var M_offset_4  = M[offset + 4];
		            var M_offset_5  = M[offset + 5];
		            var M_offset_6  = M[offset + 6];
		            var M_offset_7  = M[offset + 7];
		            var M_offset_8  = M[offset + 8];
		            var M_offset_9  = M[offset + 9];
		            var M_offset_10 = M[offset + 10];
		            var M_offset_11 = M[offset + 11];
		            var M_offset_12 = M[offset + 12];
		            var M_offset_13 = M[offset + 13];
		            var M_offset_14 = M[offset + 14];
		            var M_offset_15 = M[offset + 15];

		            // Working varialbes
		            var a = H[0];
		            var b = H[1];
		            var c = H[2];
		            var d = H[3];

		            // Computation
		            a = FF(a, b, c, d, M_offset_0,  7,  T[0]);
		            d = FF(d, a, b, c, M_offset_1,  12, T[1]);
		            c = FF(c, d, a, b, M_offset_2,  17, T[2]);
		            b = FF(b, c, d, a, M_offset_3,  22, T[3]);
		            a = FF(a, b, c, d, M_offset_4,  7,  T[4]);
		            d = FF(d, a, b, c, M_offset_5,  12, T[5]);
		            c = FF(c, d, a, b, M_offset_6,  17, T[6]);
		            b = FF(b, c, d, a, M_offset_7,  22, T[7]);
		            a = FF(a, b, c, d, M_offset_8,  7,  T[8]);
		            d = FF(d, a, b, c, M_offset_9,  12, T[9]);
		            c = FF(c, d, a, b, M_offset_10, 17, T[10]);
		            b = FF(b, c, d, a, M_offset_11, 22, T[11]);
		            a = FF(a, b, c, d, M_offset_12, 7,  T[12]);
		            d = FF(d, a, b, c, M_offset_13, 12, T[13]);
		            c = FF(c, d, a, b, M_offset_14, 17, T[14]);
		            b = FF(b, c, d, a, M_offset_15, 22, T[15]);

		            a = GG(a, b, c, d, M_offset_1,  5,  T[16]);
		            d = GG(d, a, b, c, M_offset_6,  9,  T[17]);
		            c = GG(c, d, a, b, M_offset_11, 14, T[18]);
		            b = GG(b, c, d, a, M_offset_0,  20, T[19]);
		            a = GG(a, b, c, d, M_offset_5,  5,  T[20]);
		            d = GG(d, a, b, c, M_offset_10, 9,  T[21]);
		            c = GG(c, d, a, b, M_offset_15, 14, T[22]);
		            b = GG(b, c, d, a, M_offset_4,  20, T[23]);
		            a = GG(a, b, c, d, M_offset_9,  5,  T[24]);
		            d = GG(d, a, b, c, M_offset_14, 9,  T[25]);
		            c = GG(c, d, a, b, M_offset_3,  14, T[26]);
		            b = GG(b, c, d, a, M_offset_8,  20, T[27]);
		            a = GG(a, b, c, d, M_offset_13, 5,  T[28]);
		            d = GG(d, a, b, c, M_offset_2,  9,  T[29]);
		            c = GG(c, d, a, b, M_offset_7,  14, T[30]);
		            b = GG(b, c, d, a, M_offset_12, 20, T[31]);

		            a = HH(a, b, c, d, M_offset_5,  4,  T[32]);
		            d = HH(d, a, b, c, M_offset_8,  11, T[33]);
		            c = HH(c, d, a, b, M_offset_11, 16, T[34]);
		            b = HH(b, c, d, a, M_offset_14, 23, T[35]);
		            a = HH(a, b, c, d, M_offset_1,  4,  T[36]);
		            d = HH(d, a, b, c, M_offset_4,  11, T[37]);
		            c = HH(c, d, a, b, M_offset_7,  16, T[38]);
		            b = HH(b, c, d, a, M_offset_10, 23, T[39]);
		            a = HH(a, b, c, d, M_offset_13, 4,  T[40]);
		            d = HH(d, a, b, c, M_offset_0,  11, T[41]);
		            c = HH(c, d, a, b, M_offset_3,  16, T[42]);
		            b = HH(b, c, d, a, M_offset_6,  23, T[43]);
		            a = HH(a, b, c, d, M_offset_9,  4,  T[44]);
		            d = HH(d, a, b, c, M_offset_12, 11, T[45]);
		            c = HH(c, d, a, b, M_offset_15, 16, T[46]);
		            b = HH(b, c, d, a, M_offset_2,  23, T[47]);

		            a = II(a, b, c, d, M_offset_0,  6,  T[48]);
		            d = II(d, a, b, c, M_offset_7,  10, T[49]);
		            c = II(c, d, a, b, M_offset_14, 15, T[50]);
		            b = II(b, c, d, a, M_offset_5,  21, T[51]);
		            a = II(a, b, c, d, M_offset_12, 6,  T[52]);
		            d = II(d, a, b, c, M_offset_3,  10, T[53]);
		            c = II(c, d, a, b, M_offset_10, 15, T[54]);
		            b = II(b, c, d, a, M_offset_1,  21, T[55]);
		            a = II(a, b, c, d, M_offset_8,  6,  T[56]);
		            d = II(d, a, b, c, M_offset_15, 10, T[57]);
		            c = II(c, d, a, b, M_offset_6,  15, T[58]);
		            b = II(b, c, d, a, M_offset_13, 21, T[59]);
		            a = II(a, b, c, d, M_offset_4,  6,  T[60]);
		            d = II(d, a, b, c, M_offset_11, 10, T[61]);
		            c = II(c, d, a, b, M_offset_2,  15, T[62]);
		            b = II(b, c, d, a, M_offset_9,  21, T[63]);

		            // Intermediate hash value
		            H[0] = (H[0] + a) | 0;
		            H[1] = (H[1] + b) | 0;
		            H[2] = (H[2] + c) | 0;
		            H[3] = (H[3] + d) | 0;
		        },

		        _doFinalize: function () {
		            // Shortcuts
		            var data = this._data;
		            var dataWords = data.words;

		            var nBitsTotal = this._nDataBytes * 8;
		            var nBitsLeft = data.sigBytes * 8;

		            // Add padding
		            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);

		            var nBitsTotalH = Math.floor(nBitsTotal / 0x100000000);
		            var nBitsTotalL = nBitsTotal;
		            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = (
		                (((nBitsTotalH << 8)  | (nBitsTotalH >>> 24)) & 0x00ff00ff) |
		                (((nBitsTotalH << 24) | (nBitsTotalH >>> 8))  & 0xff00ff00)
		            );
		            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = (
		                (((nBitsTotalL << 8)  | (nBitsTotalL >>> 24)) & 0x00ff00ff) |
		                (((nBitsTotalL << 24) | (nBitsTotalL >>> 8))  & 0xff00ff00)
		            );

		            data.sigBytes = (dataWords.length + 1) * 4;

		            // Hash final blocks
		            this._process();

		            // Shortcuts
		            var hash = this._hash;
		            var H = hash.words;

		            // Swap endian
		            for (var i = 0; i < 4; i++) {
		                // Shortcut
		                var H_i = H[i];

		                H[i] = (((H_i << 8)  | (H_i >>> 24)) & 0x00ff00ff) |
		                       (((H_i << 24) | (H_i >>> 8))  & 0xff00ff00);
		            }

		            // Return final computed hash
		            return hash;
		        },

		        clone: function () {
		            var clone = Hasher.clone.call(this);
		            clone._hash = this._hash.clone();

		            return clone;
		        }
		    });

		    function FF(a, b, c, d, x, s, t) {
		        var n = a + ((b & c) | (~b & d)) + x + t;
		        return ((n << s) | (n >>> (32 - s))) + b;
		    }

		    function GG(a, b, c, d, x, s, t) {
		        var n = a + ((b & d) | (c & ~d)) + x + t;
		        return ((n << s) | (n >>> (32 - s))) + b;
		    }

		    function HH(a, b, c, d, x, s, t) {
		        var n = a + (b ^ c ^ d) + x + t;
		        return ((n << s) | (n >>> (32 - s))) + b;
		    }

		    function II(a, b, c, d, x, s, t) {
		        var n = a + (c ^ (b | ~d)) + x + t;
		        return ((n << s) | (n >>> (32 - s))) + b;
		    }

		    /**
		     * Shortcut function to the hasher's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     *
		     * @return {WordArray} The hash.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hash = CryptoJS.MD5('message');
		     *     var hash = CryptoJS.MD5(wordArray);
		     */
		    C.MD5 = Hasher._createHelper(MD5);

		    /**
		     * Shortcut function to the HMAC's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     * @param {WordArray|string} key The secret key.
		     *
		     * @return {WordArray} The HMAC.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hmac = CryptoJS.HmacMD5(message, key);
		     */
		    C.HmacMD5 = Hasher._createHmacHelper(MD5);
		}(Math));


		return CryptoJS.MD5;

	}));

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var WordArray = C_lib.WordArray;
		    var Hasher = C_lib.Hasher;
		    var C_algo = C.algo;

		    // Reusable object
		    var W = [];

		    /**
		     * SHA-1 hash algorithm.
		     */
		    var SHA1 = C_algo.SHA1 = Hasher.extend({
		        _doReset: function () {
		            this._hash = new WordArray.init([
		                0x67452301, 0xefcdab89,
		                0x98badcfe, 0x10325476,
		                0xc3d2e1f0
		            ]);
		        },

		        _doProcessBlock: function (M, offset) {
		            // Shortcut
		            var H = this._hash.words;

		            // Working variables
		            var a = H[0];
		            var b = H[1];
		            var c = H[2];
		            var d = H[3];
		            var e = H[4];

		            // Computation
		            for (var i = 0; i < 80; i++) {
		                if (i < 16) {
		                    W[i] = M[offset + i] | 0;
		                } else {
		                    var n = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
		                    W[i] = (n << 1) | (n >>> 31);
		                }

		                var t = ((a << 5) | (a >>> 27)) + e + W[i];
		                if (i < 20) {
		                    t += ((b & c) | (~b & d)) + 0x5a827999;
		                } else if (i < 40) {
		                    t += (b ^ c ^ d) + 0x6ed9eba1;
		                } else if (i < 60) {
		                    t += ((b & c) | (b & d) | (c & d)) - 0x70e44324;
		                } else /* if (i < 80) */ {
		                    t += (b ^ c ^ d) - 0x359d3e2a;
		                }

		                e = d;
		                d = c;
		                c = (b << 30) | (b >>> 2);
		                b = a;
		                a = t;
		            }

		            // Intermediate hash value
		            H[0] = (H[0] + a) | 0;
		            H[1] = (H[1] + b) | 0;
		            H[2] = (H[2] + c) | 0;
		            H[3] = (H[3] + d) | 0;
		            H[4] = (H[4] + e) | 0;
		        },

		        _doFinalize: function () {
		            // Shortcuts
		            var data = this._data;
		            var dataWords = data.words;

		            var nBitsTotal = this._nDataBytes * 8;
		            var nBitsLeft = data.sigBytes * 8;

		            // Add padding
		            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
		            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
		            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
		            data.sigBytes = dataWords.length * 4;

		            // Hash final blocks
		            this._process();

		            // Return final computed hash
		            return this._hash;
		        },

		        clone: function () {
		            var clone = Hasher.clone.call(this);
		            clone._hash = this._hash.clone();

		            return clone;
		        }
		    });

		    /**
		     * Shortcut function to the hasher's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     *
		     * @return {WordArray} The hash.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hash = CryptoJS.SHA1('message');
		     *     var hash = CryptoJS.SHA1(wordArray);
		     */
		    C.SHA1 = Hasher._createHelper(SHA1);

		    /**
		     * Shortcut function to the HMAC's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     * @param {WordArray|string} key The secret key.
		     *
		     * @return {WordArray} The HMAC.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hmac = CryptoJS.HmacSHA1(message, key);
		     */
		    C.HmacSHA1 = Hasher._createHmacHelper(SHA1);
		}());


		return CryptoJS.SHA1;

	}));

/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function (Math) {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var WordArray = C_lib.WordArray;
		    var Hasher = C_lib.Hasher;
		    var C_algo = C.algo;

		    // Initialization and round constants tables
		    var H = [];
		    var K = [];

		    // Compute constants
		    (function () {
		        function isPrime(n) {
		            var sqrtN = Math.sqrt(n);
		            for (var factor = 2; factor <= sqrtN; factor++) {
		                if (!(n % factor)) {
		                    return false;
		                }
		            }

		            return true;
		        }

		        function getFractionalBits(n) {
		            return ((n - (n | 0)) * 0x100000000) | 0;
		        }

		        var n = 2;
		        var nPrime = 0;
		        while (nPrime < 64) {
		            if (isPrime(n)) {
		                if (nPrime < 8) {
		                    H[nPrime] = getFractionalBits(Math.pow(n, 1 / 2));
		                }
		                K[nPrime] = getFractionalBits(Math.pow(n, 1 / 3));

		                nPrime++;
		            }

		            n++;
		        }
		    }());

		    // Reusable object
		    var W = [];

		    /**
		     * SHA-256 hash algorithm.
		     */
		    var SHA256 = C_algo.SHA256 = Hasher.extend({
		        _doReset: function () {
		            this._hash = new WordArray.init(H.slice(0));
		        },

		        _doProcessBlock: function (M, offset) {
		            // Shortcut
		            var H = this._hash.words;

		            // Working variables
		            var a = H[0];
		            var b = H[1];
		            var c = H[2];
		            var d = H[3];
		            var e = H[4];
		            var f = H[5];
		            var g = H[6];
		            var h = H[7];

		            // Computation
		            for (var i = 0; i < 64; i++) {
		                if (i < 16) {
		                    W[i] = M[offset + i] | 0;
		                } else {
		                    var gamma0x = W[i - 15];
		                    var gamma0  = ((gamma0x << 25) | (gamma0x >>> 7))  ^
		                                  ((gamma0x << 14) | (gamma0x >>> 18)) ^
		                                   (gamma0x >>> 3);

		                    var gamma1x = W[i - 2];
		                    var gamma1  = ((gamma1x << 15) | (gamma1x >>> 17)) ^
		                                  ((gamma1x << 13) | (gamma1x >>> 19)) ^
		                                   (gamma1x >>> 10);

		                    W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16];
		                }

		                var ch  = (e & f) ^ (~e & g);
		                var maj = (a & b) ^ (a & c) ^ (b & c);

		                var sigma0 = ((a << 30) | (a >>> 2)) ^ ((a << 19) | (a >>> 13)) ^ ((a << 10) | (a >>> 22));
		                var sigma1 = ((e << 26) | (e >>> 6)) ^ ((e << 21) | (e >>> 11)) ^ ((e << 7)  | (e >>> 25));

		                var t1 = h + sigma1 + ch + K[i] + W[i];
		                var t2 = sigma0 + maj;

		                h = g;
		                g = f;
		                f = e;
		                e = (d + t1) | 0;
		                d = c;
		                c = b;
		                b = a;
		                a = (t1 + t2) | 0;
		            }

		            // Intermediate hash value
		            H[0] = (H[0] + a) | 0;
		            H[1] = (H[1] + b) | 0;
		            H[2] = (H[2] + c) | 0;
		            H[3] = (H[3] + d) | 0;
		            H[4] = (H[4] + e) | 0;
		            H[5] = (H[5] + f) | 0;
		            H[6] = (H[6] + g) | 0;
		            H[7] = (H[7] + h) | 0;
		        },

		        _doFinalize: function () {
		            // Shortcuts
		            var data = this._data;
		            var dataWords = data.words;

		            var nBitsTotal = this._nDataBytes * 8;
		            var nBitsLeft = data.sigBytes * 8;

		            // Add padding
		            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
		            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
		            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
		            data.sigBytes = dataWords.length * 4;

		            // Hash final blocks
		            this._process();

		            // Return final computed hash
		            return this._hash;
		        },

		        clone: function () {
		            var clone = Hasher.clone.call(this);
		            clone._hash = this._hash.clone();

		            return clone;
		        }
		    });

		    /**
		     * Shortcut function to the hasher's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     *
		     * @return {WordArray} The hash.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hash = CryptoJS.SHA256('message');
		     *     var hash = CryptoJS.SHA256(wordArray);
		     */
		    C.SHA256 = Hasher._createHelper(SHA256);

		    /**
		     * Shortcut function to the HMAC's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     * @param {WordArray|string} key The secret key.
		     *
		     * @return {WordArray} The HMAC.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hmac = CryptoJS.HmacSHA256(message, key);
		     */
		    C.HmacSHA256 = Hasher._createHmacHelper(SHA256);
		}(Math));


		return CryptoJS.SHA256;

	}));

/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(14));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./sha256"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var WordArray = C_lib.WordArray;
		    var C_algo = C.algo;
		    var SHA256 = C_algo.SHA256;

		    /**
		     * SHA-224 hash algorithm.
		     */
		    var SHA224 = C_algo.SHA224 = SHA256.extend({
		        _doReset: function () {
		            this._hash = new WordArray.init([
		                0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
		                0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4
		            ]);
		        },

		        _doFinalize: function () {
		            var hash = SHA256._doFinalize.call(this);

		            hash.sigBytes -= 4;

		            return hash;
		        }
		    });

		    /**
		     * Shortcut function to the hasher's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     *
		     * @return {WordArray} The hash.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hash = CryptoJS.SHA224('message');
		     *     var hash = CryptoJS.SHA224(wordArray);
		     */
		    C.SHA224 = SHA256._createHelper(SHA224);

		    /**
		     * Shortcut function to the HMAC's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     * @param {WordArray|string} key The secret key.
		     *
		     * @return {WordArray} The HMAC.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hmac = CryptoJS.HmacSHA224(message, key);
		     */
		    C.HmacSHA224 = SHA256._createHmacHelper(SHA224);
		}());


		return CryptoJS.SHA224;

	}));

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(8));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./x64-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var Hasher = C_lib.Hasher;
		    var C_x64 = C.x64;
		    var X64Word = C_x64.Word;
		    var X64WordArray = C_x64.WordArray;
		    var C_algo = C.algo;

		    function X64Word_create() {
		        return X64Word.create.apply(X64Word, arguments);
		    }

		    // Constants
		    var K = [
		        X64Word_create(0x428a2f98, 0xd728ae22), X64Word_create(0x71374491, 0x23ef65cd),
		        X64Word_create(0xb5c0fbcf, 0xec4d3b2f), X64Word_create(0xe9b5dba5, 0x8189dbbc),
		        X64Word_create(0x3956c25b, 0xf348b538), X64Word_create(0x59f111f1, 0xb605d019),
		        X64Word_create(0x923f82a4, 0xaf194f9b), X64Word_create(0xab1c5ed5, 0xda6d8118),
		        X64Word_create(0xd807aa98, 0xa3030242), X64Word_create(0x12835b01, 0x45706fbe),
		        X64Word_create(0x243185be, 0x4ee4b28c), X64Word_create(0x550c7dc3, 0xd5ffb4e2),
		        X64Word_create(0x72be5d74, 0xf27b896f), X64Word_create(0x80deb1fe, 0x3b1696b1),
		        X64Word_create(0x9bdc06a7, 0x25c71235), X64Word_create(0xc19bf174, 0xcf692694),
		        X64Word_create(0xe49b69c1, 0x9ef14ad2), X64Word_create(0xefbe4786, 0x384f25e3),
		        X64Word_create(0x0fc19dc6, 0x8b8cd5b5), X64Word_create(0x240ca1cc, 0x77ac9c65),
		        X64Word_create(0x2de92c6f, 0x592b0275), X64Word_create(0x4a7484aa, 0x6ea6e483),
		        X64Word_create(0x5cb0a9dc, 0xbd41fbd4), X64Word_create(0x76f988da, 0x831153b5),
		        X64Word_create(0x983e5152, 0xee66dfab), X64Word_create(0xa831c66d, 0x2db43210),
		        X64Word_create(0xb00327c8, 0x98fb213f), X64Word_create(0xbf597fc7, 0xbeef0ee4),
		        X64Word_create(0xc6e00bf3, 0x3da88fc2), X64Word_create(0xd5a79147, 0x930aa725),
		        X64Word_create(0x06ca6351, 0xe003826f), X64Word_create(0x14292967, 0x0a0e6e70),
		        X64Word_create(0x27b70a85, 0x46d22ffc), X64Word_create(0x2e1b2138, 0x5c26c926),
		        X64Word_create(0x4d2c6dfc, 0x5ac42aed), X64Word_create(0x53380d13, 0x9d95b3df),
		        X64Word_create(0x650a7354, 0x8baf63de), X64Word_create(0x766a0abb, 0x3c77b2a8),
		        X64Word_create(0x81c2c92e, 0x47edaee6), X64Word_create(0x92722c85, 0x1482353b),
		        X64Word_create(0xa2bfe8a1, 0x4cf10364), X64Word_create(0xa81a664b, 0xbc423001),
		        X64Word_create(0xc24b8b70, 0xd0f89791), X64Word_create(0xc76c51a3, 0x0654be30),
		        X64Word_create(0xd192e819, 0xd6ef5218), X64Word_create(0xd6990624, 0x5565a910),
		        X64Word_create(0xf40e3585, 0x5771202a), X64Word_create(0x106aa070, 0x32bbd1b8),
		        X64Word_create(0x19a4c116, 0xb8d2d0c8), X64Word_create(0x1e376c08, 0x5141ab53),
		        X64Word_create(0x2748774c, 0xdf8eeb99), X64Word_create(0x34b0bcb5, 0xe19b48a8),
		        X64Word_create(0x391c0cb3, 0xc5c95a63), X64Word_create(0x4ed8aa4a, 0xe3418acb),
		        X64Word_create(0x5b9cca4f, 0x7763e373), X64Word_create(0x682e6ff3, 0xd6b2b8a3),
		        X64Word_create(0x748f82ee, 0x5defb2fc), X64Word_create(0x78a5636f, 0x43172f60),
		        X64Word_create(0x84c87814, 0xa1f0ab72), X64Word_create(0x8cc70208, 0x1a6439ec),
		        X64Word_create(0x90befffa, 0x23631e28), X64Word_create(0xa4506ceb, 0xde82bde9),
		        X64Word_create(0xbef9a3f7, 0xb2c67915), X64Word_create(0xc67178f2, 0xe372532b),
		        X64Word_create(0xca273ece, 0xea26619c), X64Word_create(0xd186b8c7, 0x21c0c207),
		        X64Word_create(0xeada7dd6, 0xcde0eb1e), X64Word_create(0xf57d4f7f, 0xee6ed178),
		        X64Word_create(0x06f067aa, 0x72176fba), X64Word_create(0x0a637dc5, 0xa2c898a6),
		        X64Word_create(0x113f9804, 0xbef90dae), X64Word_create(0x1b710b35, 0x131c471b),
		        X64Word_create(0x28db77f5, 0x23047d84), X64Word_create(0x32caab7b, 0x40c72493),
		        X64Word_create(0x3c9ebe0a, 0x15c9bebc), X64Word_create(0x431d67c4, 0x9c100d4c),
		        X64Word_create(0x4cc5d4be, 0xcb3e42b6), X64Word_create(0x597f299c, 0xfc657e2a),
		        X64Word_create(0x5fcb6fab, 0x3ad6faec), X64Word_create(0x6c44198c, 0x4a475817)
		    ];

		    // Reusable objects
		    var W = [];
		    (function () {
		        for (var i = 0; i < 80; i++) {
		            W[i] = X64Word_create();
		        }
		    }());

		    /**
		     * SHA-512 hash algorithm.
		     */
		    var SHA512 = C_algo.SHA512 = Hasher.extend({
		        _doReset: function () {
		            this._hash = new X64WordArray.init([
		                new X64Word.init(0x6a09e667, 0xf3bcc908), new X64Word.init(0xbb67ae85, 0x84caa73b),
		                new X64Word.init(0x3c6ef372, 0xfe94f82b), new X64Word.init(0xa54ff53a, 0x5f1d36f1),
		                new X64Word.init(0x510e527f, 0xade682d1), new X64Word.init(0x9b05688c, 0x2b3e6c1f),
		                new X64Word.init(0x1f83d9ab, 0xfb41bd6b), new X64Word.init(0x5be0cd19, 0x137e2179)
		            ]);
		        },

		        _doProcessBlock: function (M, offset) {
		            // Shortcuts
		            var H = this._hash.words;

		            var H0 = H[0];
		            var H1 = H[1];
		            var H2 = H[2];
		            var H3 = H[3];
		            var H4 = H[4];
		            var H5 = H[5];
		            var H6 = H[6];
		            var H7 = H[7];

		            var H0h = H0.high;
		            var H0l = H0.low;
		            var H1h = H1.high;
		            var H1l = H1.low;
		            var H2h = H2.high;
		            var H2l = H2.low;
		            var H3h = H3.high;
		            var H3l = H3.low;
		            var H4h = H4.high;
		            var H4l = H4.low;
		            var H5h = H5.high;
		            var H5l = H5.low;
		            var H6h = H6.high;
		            var H6l = H6.low;
		            var H7h = H7.high;
		            var H7l = H7.low;

		            // Working variables
		            var ah = H0h;
		            var al = H0l;
		            var bh = H1h;
		            var bl = H1l;
		            var ch = H2h;
		            var cl = H2l;
		            var dh = H3h;
		            var dl = H3l;
		            var eh = H4h;
		            var el = H4l;
		            var fh = H5h;
		            var fl = H5l;
		            var gh = H6h;
		            var gl = H6l;
		            var hh = H7h;
		            var hl = H7l;

		            // Rounds
		            for (var i = 0; i < 80; i++) {
		                // Shortcut
		                var Wi = W[i];

		                // Extend message
		                if (i < 16) {
		                    var Wih = Wi.high = M[offset + i * 2]     | 0;
		                    var Wil = Wi.low  = M[offset + i * 2 + 1] | 0;
		                } else {
		                    // Gamma0
		                    var gamma0x  = W[i - 15];
		                    var gamma0xh = gamma0x.high;
		                    var gamma0xl = gamma0x.low;
		                    var gamma0h  = ((gamma0xh >>> 1) | (gamma0xl << 31)) ^ ((gamma0xh >>> 8) | (gamma0xl << 24)) ^ (gamma0xh >>> 7);
		                    var gamma0l  = ((gamma0xl >>> 1) | (gamma0xh << 31)) ^ ((gamma0xl >>> 8) | (gamma0xh << 24)) ^ ((gamma0xl >>> 7) | (gamma0xh << 25));

		                    // Gamma1
		                    var gamma1x  = W[i - 2];
		                    var gamma1xh = gamma1x.high;
		                    var gamma1xl = gamma1x.low;
		                    var gamma1h  = ((gamma1xh >>> 19) | (gamma1xl << 13)) ^ ((gamma1xh << 3) | (gamma1xl >>> 29)) ^ (gamma1xh >>> 6);
		                    var gamma1l  = ((gamma1xl >>> 19) | (gamma1xh << 13)) ^ ((gamma1xl << 3) | (gamma1xh >>> 29)) ^ ((gamma1xl >>> 6) | (gamma1xh << 26));

		                    // W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16]
		                    var Wi7  = W[i - 7];
		                    var Wi7h = Wi7.high;
		                    var Wi7l = Wi7.low;

		                    var Wi16  = W[i - 16];
		                    var Wi16h = Wi16.high;
		                    var Wi16l = Wi16.low;

		                    var Wil = gamma0l + Wi7l;
		                    var Wih = gamma0h + Wi7h + ((Wil >>> 0) < (gamma0l >>> 0) ? 1 : 0);
		                    var Wil = Wil + gamma1l;
		                    var Wih = Wih + gamma1h + ((Wil >>> 0) < (gamma1l >>> 0) ? 1 : 0);
		                    var Wil = Wil + Wi16l;
		                    var Wih = Wih + Wi16h + ((Wil >>> 0) < (Wi16l >>> 0) ? 1 : 0);

		                    Wi.high = Wih;
		                    Wi.low  = Wil;
		                }

		                var chh  = (eh & fh) ^ (~eh & gh);
		                var chl  = (el & fl) ^ (~el & gl);
		                var majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
		                var majl = (al & bl) ^ (al & cl) ^ (bl & cl);

		                var sigma0h = ((ah >>> 28) | (al << 4))  ^ ((ah << 30)  | (al >>> 2)) ^ ((ah << 25) | (al >>> 7));
		                var sigma0l = ((al >>> 28) | (ah << 4))  ^ ((al << 30)  | (ah >>> 2)) ^ ((al << 25) | (ah >>> 7));
		                var sigma1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((eh << 23) | (el >>> 9));
		                var sigma1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((el << 23) | (eh >>> 9));

		                // t1 = h + sigma1 + ch + K[i] + W[i]
		                var Ki  = K[i];
		                var Kih = Ki.high;
		                var Kil = Ki.low;

		                var t1l = hl + sigma1l;
		                var t1h = hh + sigma1h + ((t1l >>> 0) < (hl >>> 0) ? 1 : 0);
		                var t1l = t1l + chl;
		                var t1h = t1h + chh + ((t1l >>> 0) < (chl >>> 0) ? 1 : 0);
		                var t1l = t1l + Kil;
		                var t1h = t1h + Kih + ((t1l >>> 0) < (Kil >>> 0) ? 1 : 0);
		                var t1l = t1l + Wil;
		                var t1h = t1h + Wih + ((t1l >>> 0) < (Wil >>> 0) ? 1 : 0);

		                // t2 = sigma0 + maj
		                var t2l = sigma0l + majl;
		                var t2h = sigma0h + majh + ((t2l >>> 0) < (sigma0l >>> 0) ? 1 : 0);

		                // Update working variables
		                hh = gh;
		                hl = gl;
		                gh = fh;
		                gl = fl;
		                fh = eh;
		                fl = el;
		                el = (dl + t1l) | 0;
		                eh = (dh + t1h + ((el >>> 0) < (dl >>> 0) ? 1 : 0)) | 0;
		                dh = ch;
		                dl = cl;
		                ch = bh;
		                cl = bl;
		                bh = ah;
		                bl = al;
		                al = (t1l + t2l) | 0;
		                ah = (t1h + t2h + ((al >>> 0) < (t1l >>> 0) ? 1 : 0)) | 0;
		            }

		            // Intermediate hash value
		            H0l = H0.low  = (H0l + al);
		            H0.high = (H0h + ah + ((H0l >>> 0) < (al >>> 0) ? 1 : 0));
		            H1l = H1.low  = (H1l + bl);
		            H1.high = (H1h + bh + ((H1l >>> 0) < (bl >>> 0) ? 1 : 0));
		            H2l = H2.low  = (H2l + cl);
		            H2.high = (H2h + ch + ((H2l >>> 0) < (cl >>> 0) ? 1 : 0));
		            H3l = H3.low  = (H3l + dl);
		            H3.high = (H3h + dh + ((H3l >>> 0) < (dl >>> 0) ? 1 : 0));
		            H4l = H4.low  = (H4l + el);
		            H4.high = (H4h + eh + ((H4l >>> 0) < (el >>> 0) ? 1 : 0));
		            H5l = H5.low  = (H5l + fl);
		            H5.high = (H5h + fh + ((H5l >>> 0) < (fl >>> 0) ? 1 : 0));
		            H6l = H6.low  = (H6l + gl);
		            H6.high = (H6h + gh + ((H6l >>> 0) < (gl >>> 0) ? 1 : 0));
		            H7l = H7.low  = (H7l + hl);
		            H7.high = (H7h + hh + ((H7l >>> 0) < (hl >>> 0) ? 1 : 0));
		        },

		        _doFinalize: function () {
		            // Shortcuts
		            var data = this._data;
		            var dataWords = data.words;

		            var nBitsTotal = this._nDataBytes * 8;
		            var nBitsLeft = data.sigBytes * 8;

		            // Add padding
		            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
		            dataWords[(((nBitsLeft + 128) >>> 10) << 5) + 30] = Math.floor(nBitsTotal / 0x100000000);
		            dataWords[(((nBitsLeft + 128) >>> 10) << 5) + 31] = nBitsTotal;
		            data.sigBytes = dataWords.length * 4;

		            // Hash final blocks
		            this._process();

		            // Convert hash to 32-bit word array before returning
		            var hash = this._hash.toX32();

		            // Return final computed hash
		            return hash;
		        },

		        clone: function () {
		            var clone = Hasher.clone.call(this);
		            clone._hash = this._hash.clone();

		            return clone;
		        },

		        blockSize: 1024/32
		    });

		    /**
		     * Shortcut function to the hasher's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     *
		     * @return {WordArray} The hash.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hash = CryptoJS.SHA512('message');
		     *     var hash = CryptoJS.SHA512(wordArray);
		     */
		    C.SHA512 = Hasher._createHelper(SHA512);

		    /**
		     * Shortcut function to the HMAC's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     * @param {WordArray|string} key The secret key.
		     *
		     * @return {WordArray} The HMAC.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hmac = CryptoJS.HmacSHA512(message, key);
		     */
		    C.HmacSHA512 = Hasher._createHmacHelper(SHA512);
		}());


		return CryptoJS.SHA512;

	}));

/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(8), __webpack_require__(16));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./x64-core", "./sha512"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_x64 = C.x64;
		    var X64Word = C_x64.Word;
		    var X64WordArray = C_x64.WordArray;
		    var C_algo = C.algo;
		    var SHA512 = C_algo.SHA512;

		    /**
		     * SHA-384 hash algorithm.
		     */
		    var SHA384 = C_algo.SHA384 = SHA512.extend({
		        _doReset: function () {
		            this._hash = new X64WordArray.init([
		                new X64Word.init(0xcbbb9d5d, 0xc1059ed8), new X64Word.init(0x629a292a, 0x367cd507),
		                new X64Word.init(0x9159015a, 0x3070dd17), new X64Word.init(0x152fecd8, 0xf70e5939),
		                new X64Word.init(0x67332667, 0xffc00b31), new X64Word.init(0x8eb44a87, 0x68581511),
		                new X64Word.init(0xdb0c2e0d, 0x64f98fa7), new X64Word.init(0x47b5481d, 0xbefa4fa4)
		            ]);
		        },

		        _doFinalize: function () {
		            var hash = SHA512._doFinalize.call(this);

		            hash.sigBytes -= 16;

		            return hash;
		        }
		    });

		    /**
		     * Shortcut function to the hasher's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     *
		     * @return {WordArray} The hash.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hash = CryptoJS.SHA384('message');
		     *     var hash = CryptoJS.SHA384(wordArray);
		     */
		    C.SHA384 = SHA512._createHelper(SHA384);

		    /**
		     * Shortcut function to the HMAC's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     * @param {WordArray|string} key The secret key.
		     *
		     * @return {WordArray} The HMAC.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hmac = CryptoJS.HmacSHA384(message, key);
		     */
		    C.HmacSHA384 = SHA512._createHmacHelper(SHA384);
		}());


		return CryptoJS.SHA384;

	}));

/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(8));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./x64-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function (Math) {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var WordArray = C_lib.WordArray;
		    var Hasher = C_lib.Hasher;
		    var C_x64 = C.x64;
		    var X64Word = C_x64.Word;
		    var C_algo = C.algo;

		    // Constants tables
		    var RHO_OFFSETS = [];
		    var PI_INDEXES  = [];
		    var ROUND_CONSTANTS = [];

		    // Compute Constants
		    (function () {
		        // Compute rho offset constants
		        var x = 1, y = 0;
		        for (var t = 0; t < 24; t++) {
		            RHO_OFFSETS[x + 5 * y] = ((t + 1) * (t + 2) / 2) % 64;

		            var newX = y % 5;
		            var newY = (2 * x + 3 * y) % 5;
		            x = newX;
		            y = newY;
		        }

		        // Compute pi index constants
		        for (var x = 0; x < 5; x++) {
		            for (var y = 0; y < 5; y++) {
		                PI_INDEXES[x + 5 * y] = y + ((2 * x + 3 * y) % 5) * 5;
		            }
		        }

		        // Compute round constants
		        var LFSR = 0x01;
		        for (var i = 0; i < 24; i++) {
		            var roundConstantMsw = 0;
		            var roundConstantLsw = 0;

		            for (var j = 0; j < 7; j++) {
		                if (LFSR & 0x01) {
		                    var bitPosition = (1 << j) - 1;
		                    if (bitPosition < 32) {
		                        roundConstantLsw ^= 1 << bitPosition;
		                    } else /* if (bitPosition >= 32) */ {
		                        roundConstantMsw ^= 1 << (bitPosition - 32);
		                    }
		                }

		                // Compute next LFSR
		                if (LFSR & 0x80) {
		                    // Primitive polynomial over GF(2): x^8 + x^6 + x^5 + x^4 + 1
		                    LFSR = (LFSR << 1) ^ 0x71;
		                } else {
		                    LFSR <<= 1;
		                }
		            }

		            ROUND_CONSTANTS[i] = X64Word.create(roundConstantMsw, roundConstantLsw);
		        }
		    }());

		    // Reusable objects for temporary values
		    var T = [];
		    (function () {
		        for (var i = 0; i < 25; i++) {
		            T[i] = X64Word.create();
		        }
		    }());

		    /**
		     * SHA-3 hash algorithm.
		     */
		    var SHA3 = C_algo.SHA3 = Hasher.extend({
		        /**
		         * Configuration options.
		         *
		         * @property {number} outputLength
		         *   The desired number of bits in the output hash.
		         *   Only values permitted are: 224, 256, 384, 512.
		         *   Default: 512
		         */
		        cfg: Hasher.cfg.extend({
		            outputLength: 512
		        }),

		        _doReset: function () {
		            var state = this._state = []
		            for (var i = 0; i < 25; i++) {
		                state[i] = new X64Word.init();
		            }

		            this.blockSize = (1600 - 2 * this.cfg.outputLength) / 32;
		        },

		        _doProcessBlock: function (M, offset) {
		            // Shortcuts
		            var state = this._state;
		            var nBlockSizeLanes = this.blockSize / 2;

		            // Absorb
		            for (var i = 0; i < nBlockSizeLanes; i++) {
		                // Shortcuts
		                var M2i  = M[offset + 2 * i];
		                var M2i1 = M[offset + 2 * i + 1];

		                // Swap endian
		                M2i = (
		                    (((M2i << 8)  | (M2i >>> 24)) & 0x00ff00ff) |
		                    (((M2i << 24) | (M2i >>> 8))  & 0xff00ff00)
		                );
		                M2i1 = (
		                    (((M2i1 << 8)  | (M2i1 >>> 24)) & 0x00ff00ff) |
		                    (((M2i1 << 24) | (M2i1 >>> 8))  & 0xff00ff00)
		                );

		                // Absorb message into state
		                var lane = state[i];
		                lane.high ^= M2i1;
		                lane.low  ^= M2i;
		            }

		            // Rounds
		            for (var round = 0; round < 24; round++) {
		                // Theta
		                for (var x = 0; x < 5; x++) {
		                    // Mix column lanes
		                    var tMsw = 0, tLsw = 0;
		                    for (var y = 0; y < 5; y++) {
		                        var lane = state[x + 5 * y];
		                        tMsw ^= lane.high;
		                        tLsw ^= lane.low;
		                    }

		                    // Temporary values
		                    var Tx = T[x];
		                    Tx.high = tMsw;
		                    Tx.low  = tLsw;
		                }
		                for (var x = 0; x < 5; x++) {
		                    // Shortcuts
		                    var Tx4 = T[(x + 4) % 5];
		                    var Tx1 = T[(x + 1) % 5];
		                    var Tx1Msw = Tx1.high;
		                    var Tx1Lsw = Tx1.low;

		                    // Mix surrounding columns
		                    var tMsw = Tx4.high ^ ((Tx1Msw << 1) | (Tx1Lsw >>> 31));
		                    var tLsw = Tx4.low  ^ ((Tx1Lsw << 1) | (Tx1Msw >>> 31));
		                    for (var y = 0; y < 5; y++) {
		                        var lane = state[x + 5 * y];
		                        lane.high ^= tMsw;
		                        lane.low  ^= tLsw;
		                    }
		                }

		                // Rho Pi
		                for (var laneIndex = 1; laneIndex < 25; laneIndex++) {
		                    // Shortcuts
		                    var lane = state[laneIndex];
		                    var laneMsw = lane.high;
		                    var laneLsw = lane.low;
		                    var rhoOffset = RHO_OFFSETS[laneIndex];

		                    // Rotate lanes
		                    if (rhoOffset < 32) {
		                        var tMsw = (laneMsw << rhoOffset) | (laneLsw >>> (32 - rhoOffset));
		                        var tLsw = (laneLsw << rhoOffset) | (laneMsw >>> (32 - rhoOffset));
		                    } else /* if (rhoOffset >= 32) */ {
		                        var tMsw = (laneLsw << (rhoOffset - 32)) | (laneMsw >>> (64 - rhoOffset));
		                        var tLsw = (laneMsw << (rhoOffset - 32)) | (laneLsw >>> (64 - rhoOffset));
		                    }

		                    // Transpose lanes
		                    var TPiLane = T[PI_INDEXES[laneIndex]];
		                    TPiLane.high = tMsw;
		                    TPiLane.low  = tLsw;
		                }

		                // Rho pi at x = y = 0
		                var T0 = T[0];
		                var state0 = state[0];
		                T0.high = state0.high;
		                T0.low  = state0.low;

		                // Chi
		                for (var x = 0; x < 5; x++) {
		                    for (var y = 0; y < 5; y++) {
		                        // Shortcuts
		                        var laneIndex = x + 5 * y;
		                        var lane = state[laneIndex];
		                        var TLane = T[laneIndex];
		                        var Tx1Lane = T[((x + 1) % 5) + 5 * y];
		                        var Tx2Lane = T[((x + 2) % 5) + 5 * y];

		                        // Mix rows
		                        lane.high = TLane.high ^ (~Tx1Lane.high & Tx2Lane.high);
		                        lane.low  = TLane.low  ^ (~Tx1Lane.low  & Tx2Lane.low);
		                    }
		                }

		                // Iota
		                var lane = state[0];
		                var roundConstant = ROUND_CONSTANTS[round];
		                lane.high ^= roundConstant.high;
		                lane.low  ^= roundConstant.low;;
		            }
		        },

		        _doFinalize: function () {
		            // Shortcuts
		            var data = this._data;
		            var dataWords = data.words;
		            var nBitsTotal = this._nDataBytes * 8;
		            var nBitsLeft = data.sigBytes * 8;
		            var blockSizeBits = this.blockSize * 32;

		            // Add padding
		            dataWords[nBitsLeft >>> 5] |= 0x1 << (24 - nBitsLeft % 32);
		            dataWords[((Math.ceil((nBitsLeft + 1) / blockSizeBits) * blockSizeBits) >>> 5) - 1] |= 0x80;
		            data.sigBytes = dataWords.length * 4;

		            // Hash final blocks
		            this._process();

		            // Shortcuts
		            var state = this._state;
		            var outputLengthBytes = this.cfg.outputLength / 8;
		            var outputLengthLanes = outputLengthBytes / 8;

		            // Squeeze
		            var hashWords = [];
		            for (var i = 0; i < outputLengthLanes; i++) {
		                // Shortcuts
		                var lane = state[i];
		                var laneMsw = lane.high;
		                var laneLsw = lane.low;

		                // Swap endian
		                laneMsw = (
		                    (((laneMsw << 8)  | (laneMsw >>> 24)) & 0x00ff00ff) |
		                    (((laneMsw << 24) | (laneMsw >>> 8))  & 0xff00ff00)
		                );
		                laneLsw = (
		                    (((laneLsw << 8)  | (laneLsw >>> 24)) & 0x00ff00ff) |
		                    (((laneLsw << 24) | (laneLsw >>> 8))  & 0xff00ff00)
		                );

		                // Squeeze state to retrieve hash
		                hashWords.push(laneLsw);
		                hashWords.push(laneMsw);
		            }

		            // Return final computed hash
		            return new WordArray.init(hashWords, outputLengthBytes);
		        },

		        clone: function () {
		            var clone = Hasher.clone.call(this);

		            var state = clone._state = this._state.slice(0);
		            for (var i = 0; i < 25; i++) {
		                state[i] = state[i].clone();
		            }

		            return clone;
		        }
		    });

		    /**
		     * Shortcut function to the hasher's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     *
		     * @return {WordArray} The hash.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hash = CryptoJS.SHA3('message');
		     *     var hash = CryptoJS.SHA3(wordArray);
		     */
		    C.SHA3 = Hasher._createHelper(SHA3);

		    /**
		     * Shortcut function to the HMAC's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     * @param {WordArray|string} key The secret key.
		     *
		     * @return {WordArray} The HMAC.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hmac = CryptoJS.HmacSHA3(message, key);
		     */
		    C.HmacSHA3 = Hasher._createHmacHelper(SHA3);
		}(Math));


		return CryptoJS.SHA3;

	}));

/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/** @preserve
		(c) 2012 by Cédric Mesnil. All rights reserved.

		Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

		    - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
		    - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

		THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
		*/

		(function (Math) {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var WordArray = C_lib.WordArray;
		    var Hasher = C_lib.Hasher;
		    var C_algo = C.algo;

		    // Constants table
		    var _zl = WordArray.create([
		        0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,
		        7,  4, 13,  1, 10,  6, 15,  3, 12,  0,  9,  5,  2, 14, 11,  8,
		        3, 10, 14,  4,  9, 15,  8,  1,  2,  7,  0,  6, 13, 11,  5, 12,
		        1,  9, 11, 10,  0,  8, 12,  4, 13,  3,  7, 15, 14,  5,  6,  2,
		        4,  0,  5,  9,  7, 12,  2, 10, 14,  1,  3,  8, 11,  6, 15, 13]);
		    var _zr = WordArray.create([
		        5, 14,  7,  0,  9,  2, 11,  4, 13,  6, 15,  8,  1, 10,  3, 12,
		        6, 11,  3,  7,  0, 13,  5, 10, 14, 15,  8, 12,  4,  9,  1,  2,
		        15,  5,  1,  3,  7, 14,  6,  9, 11,  8, 12,  2, 10,  0,  4, 13,
		        8,  6,  4,  1,  3, 11, 15,  0,  5, 12,  2, 13,  9,  7, 10, 14,
		        12, 15, 10,  4,  1,  5,  8,  7,  6,  2, 13, 14,  0,  3,  9, 11]);
		    var _sl = WordArray.create([
		         11, 14, 15, 12,  5,  8,  7,  9, 11, 13, 14, 15,  6,  7,  9,  8,
		        7, 6,   8, 13, 11,  9,  7, 15,  7, 12, 15,  9, 11,  7, 13, 12,
		        11, 13,  6,  7, 14,  9, 13, 15, 14,  8, 13,  6,  5, 12,  7,  5,
		          11, 12, 14, 15, 14, 15,  9,  8,  9, 14,  5,  6,  8,  6,  5, 12,
		        9, 15,  5, 11,  6,  8, 13, 12,  5, 12, 13, 14, 11,  8,  5,  6 ]);
		    var _sr = WordArray.create([
		        8,  9,  9, 11, 13, 15, 15,  5,  7,  7,  8, 11, 14, 14, 12,  6,
		        9, 13, 15,  7, 12,  8,  9, 11,  7,  7, 12,  7,  6, 15, 13, 11,
		        9,  7, 15, 11,  8,  6,  6, 14, 12, 13,  5, 14, 13, 13,  7,  5,
		        15,  5,  8, 11, 14, 14,  6, 14,  6,  9, 12,  9, 12,  5, 15,  8,
		        8,  5, 12,  9, 12,  5, 14,  6,  8, 13,  6,  5, 15, 13, 11, 11 ]);

		    var _hl =  WordArray.create([ 0x00000000, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E]);
		    var _hr =  WordArray.create([ 0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0x00000000]);

		    /**
		     * RIPEMD160 hash algorithm.
		     */
		    var RIPEMD160 = C_algo.RIPEMD160 = Hasher.extend({
		        _doReset: function () {
		            this._hash  = WordArray.create([0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0]);
		        },

		        _doProcessBlock: function (M, offset) {

		            // Swap endian
		            for (var i = 0; i < 16; i++) {
		                // Shortcuts
		                var offset_i = offset + i;
		                var M_offset_i = M[offset_i];

		                // Swap
		                M[offset_i] = (
		                    (((M_offset_i << 8)  | (M_offset_i >>> 24)) & 0x00ff00ff) |
		                    (((M_offset_i << 24) | (M_offset_i >>> 8))  & 0xff00ff00)
		                );
		            }
		            // Shortcut
		            var H  = this._hash.words;
		            var hl = _hl.words;
		            var hr = _hr.words;
		            var zl = _zl.words;
		            var zr = _zr.words;
		            var sl = _sl.words;
		            var sr = _sr.words;

		            // Working variables
		            var al, bl, cl, dl, el;
		            var ar, br, cr, dr, er;

		            ar = al = H[0];
		            br = bl = H[1];
		            cr = cl = H[2];
		            dr = dl = H[3];
		            er = el = H[4];
		            // Computation
		            var t;
		            for (var i = 0; i < 80; i += 1) {
		                t = (al +  M[offset+zl[i]])|0;
		                if (i<16){
			            t +=  f1(bl,cl,dl) + hl[0];
		                } else if (i<32) {
			            t +=  f2(bl,cl,dl) + hl[1];
		                } else if (i<48) {
			            t +=  f3(bl,cl,dl) + hl[2];
		                } else if (i<64) {
			            t +=  f4(bl,cl,dl) + hl[3];
		                } else {// if (i<80) {
			            t +=  f5(bl,cl,dl) + hl[4];
		                }
		                t = t|0;
		                t =  rotl(t,sl[i]);
		                t = (t+el)|0;
		                al = el;
		                el = dl;
		                dl = rotl(cl, 10);
		                cl = bl;
		                bl = t;

		                t = (ar + M[offset+zr[i]])|0;
		                if (i<16){
			            t +=  f5(br,cr,dr) + hr[0];
		                } else if (i<32) {
			            t +=  f4(br,cr,dr) + hr[1];
		                } else if (i<48) {
			            t +=  f3(br,cr,dr) + hr[2];
		                } else if (i<64) {
			            t +=  f2(br,cr,dr) + hr[3];
		                } else {// if (i<80) {
			            t +=  f1(br,cr,dr) + hr[4];
		                }
		                t = t|0;
		                t =  rotl(t,sr[i]) ;
		                t = (t+er)|0;
		                ar = er;
		                er = dr;
		                dr = rotl(cr, 10);
		                cr = br;
		                br = t;
		            }
		            // Intermediate hash value
		            t    = (H[1] + cl + dr)|0;
		            H[1] = (H[2] + dl + er)|0;
		            H[2] = (H[3] + el + ar)|0;
		            H[3] = (H[4] + al + br)|0;
		            H[4] = (H[0] + bl + cr)|0;
		            H[0] =  t;
		        },

		        _doFinalize: function () {
		            // Shortcuts
		            var data = this._data;
		            var dataWords = data.words;

		            var nBitsTotal = this._nDataBytes * 8;
		            var nBitsLeft = data.sigBytes * 8;

		            // Add padding
		            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
		            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = (
		                (((nBitsTotal << 8)  | (nBitsTotal >>> 24)) & 0x00ff00ff) |
		                (((nBitsTotal << 24) | (nBitsTotal >>> 8))  & 0xff00ff00)
		            );
		            data.sigBytes = (dataWords.length + 1) * 4;

		            // Hash final blocks
		            this._process();

		            // Shortcuts
		            var hash = this._hash;
		            var H = hash.words;

		            // Swap endian
		            for (var i = 0; i < 5; i++) {
		                // Shortcut
		                var H_i = H[i];

		                // Swap
		                H[i] = (((H_i << 8)  | (H_i >>> 24)) & 0x00ff00ff) |
		                       (((H_i << 24) | (H_i >>> 8))  & 0xff00ff00);
		            }

		            // Return final computed hash
		            return hash;
		        },

		        clone: function () {
		            var clone = Hasher.clone.call(this);
		            clone._hash = this._hash.clone();

		            return clone;
		        }
		    });


		    function f1(x, y, z) {
		        return ((x) ^ (y) ^ (z));

		    }

		    function f2(x, y, z) {
		        return (((x)&(y)) | ((~x)&(z)));
		    }

		    function f3(x, y, z) {
		        return (((x) | (~(y))) ^ (z));
		    }

		    function f4(x, y, z) {
		        return (((x) & (z)) | ((y)&(~(z))));
		    }

		    function f5(x, y, z) {
		        return ((x) ^ ((y) |(~(z))));

		    }

		    function rotl(x,n) {
		        return (x<<n) | (x>>>(32-n));
		    }


		    /**
		     * Shortcut function to the hasher's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     *
		     * @return {WordArray} The hash.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hash = CryptoJS.RIPEMD160('message');
		     *     var hash = CryptoJS.RIPEMD160(wordArray);
		     */
		    C.RIPEMD160 = Hasher._createHelper(RIPEMD160);

		    /**
		     * Shortcut function to the HMAC's object interface.
		     *
		     * @param {WordArray|string} message The message to hash.
		     * @param {WordArray|string} key The secret key.
		     *
		     * @return {WordArray} The HMAC.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var hmac = CryptoJS.HmacRIPEMD160(message, key);
		     */
		    C.HmacRIPEMD160 = Hasher._createHmacHelper(RIPEMD160);
		}(Math));


		return CryptoJS.RIPEMD160;

	}));

/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var Base = C_lib.Base;
		    var C_enc = C.enc;
		    var Utf8 = C_enc.Utf8;
		    var C_algo = C.algo;

		    /**
		     * HMAC algorithm.
		     */
		    var HMAC = C_algo.HMAC = Base.extend({
		        /**
		         * Initializes a newly created HMAC.
		         *
		         * @param {Hasher} hasher The hash algorithm to use.
		         * @param {WordArray|string} key The secret key.
		         *
		         * @example
		         *
		         *     var hmacHasher = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key);
		         */
		        init: function (hasher, key) {
		            // Init hasher
		            hasher = this._hasher = new hasher.init();

		            // Convert string to WordArray, else assume WordArray already
		            if (typeof key == 'string') {
		                key = Utf8.parse(key);
		            }

		            // Shortcuts
		            var hasherBlockSize = hasher.blockSize;
		            var hasherBlockSizeBytes = hasherBlockSize * 4;

		            // Allow arbitrary length keys
		            if (key.sigBytes > hasherBlockSizeBytes) {
		                key = hasher.finalize(key);
		            }

		            // Clamp excess bits
		            key.clamp();

		            // Clone key for inner and outer pads
		            var oKey = this._oKey = key.clone();
		            var iKey = this._iKey = key.clone();

		            // Shortcuts
		            var oKeyWords = oKey.words;
		            var iKeyWords = iKey.words;

		            // XOR keys with pad constants
		            for (var i = 0; i < hasherBlockSize; i++) {
		                oKeyWords[i] ^= 0x5c5c5c5c;
		                iKeyWords[i] ^= 0x36363636;
		            }
		            oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;

		            // Set initial values
		            this.reset();
		        },

		        /**
		         * Resets this HMAC to its initial state.
		         *
		         * @example
		         *
		         *     hmacHasher.reset();
		         */
		        reset: function () {
		            // Shortcut
		            var hasher = this._hasher;

		            // Reset
		            hasher.reset();
		            hasher.update(this._iKey);
		        },

		        /**
		         * Updates this HMAC with a message.
		         *
		         * @param {WordArray|string} messageUpdate The message to append.
		         *
		         * @return {HMAC} This HMAC instance.
		         *
		         * @example
		         *
		         *     hmacHasher.update('message');
		         *     hmacHasher.update(wordArray);
		         */
		        update: function (messageUpdate) {
		            this._hasher.update(messageUpdate);

		            // Chainable
		            return this;
		        },

		        /**
		         * Finalizes the HMAC computation.
		         * Note that the finalize operation is effectively a destructive, read-once operation.
		         *
		         * @param {WordArray|string} messageUpdate (Optional) A final message update.
		         *
		         * @return {WordArray} The HMAC.
		         *
		         * @example
		         *
		         *     var hmac = hmacHasher.finalize();
		         *     var hmac = hmacHasher.finalize('message');
		         *     var hmac = hmacHasher.finalize(wordArray);
		         */
		        finalize: function (messageUpdate) {
		            // Shortcut
		            var hasher = this._hasher;

		            // Compute HMAC
		            var innerHash = hasher.finalize(messageUpdate);
		            hasher.reset();
		            var hmac = hasher.finalize(this._oKey.clone().concat(innerHash));

		            return hmac;
		        }
		    });
		}());


	}));

/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(13), __webpack_require__(20));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./sha1", "./hmac"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var Base = C_lib.Base;
		    var WordArray = C_lib.WordArray;
		    var C_algo = C.algo;
		    var SHA1 = C_algo.SHA1;
		    var HMAC = C_algo.HMAC;

		    /**
		     * Password-Based Key Derivation Function 2 algorithm.
		     */
		    var PBKDF2 = C_algo.PBKDF2 = Base.extend({
		        /**
		         * Configuration options.
		         *
		         * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
		         * @property {Hasher} hasher The hasher to use. Default: SHA1
		         * @property {number} iterations The number of iterations to perform. Default: 1
		         */
		        cfg: Base.extend({
		            keySize: 128/32,
		            hasher: SHA1,
		            iterations: 1
		        }),

		        /**
		         * Initializes a newly created key derivation function.
		         *
		         * @param {Object} cfg (Optional) The configuration options to use for the derivation.
		         *
		         * @example
		         *
		         *     var kdf = CryptoJS.algo.PBKDF2.create();
		         *     var kdf = CryptoJS.algo.PBKDF2.create({ keySize: 8 });
		         *     var kdf = CryptoJS.algo.PBKDF2.create({ keySize: 8, iterations: 1000 });
		         */
		        init: function (cfg) {
		            this.cfg = this.cfg.extend(cfg);
		        },

		        /**
		         * Computes the Password-Based Key Derivation Function 2.
		         *
		         * @param {WordArray|string} password The password.
		         * @param {WordArray|string} salt A salt.
		         *
		         * @return {WordArray} The derived key.
		         *
		         * @example
		         *
		         *     var key = kdf.compute(password, salt);
		         */
		        compute: function (password, salt) {
		            // Shortcut
		            var cfg = this.cfg;

		            // Init HMAC
		            var hmac = HMAC.create(cfg.hasher, password);

		            // Initial values
		            var derivedKey = WordArray.create();
		            var blockIndex = WordArray.create([0x00000001]);

		            // Shortcuts
		            var derivedKeyWords = derivedKey.words;
		            var blockIndexWords = blockIndex.words;
		            var keySize = cfg.keySize;
		            var iterations = cfg.iterations;

		            // Generate key
		            while (derivedKeyWords.length < keySize) {
		                var block = hmac.update(salt).finalize(blockIndex);
		                hmac.reset();

		                // Shortcuts
		                var blockWords = block.words;
		                var blockWordsLength = blockWords.length;

		                // Iterations
		                var intermediate = block;
		                for (var i = 1; i < iterations; i++) {
		                    intermediate = hmac.finalize(intermediate);
		                    hmac.reset();

		                    // Shortcut
		                    var intermediateWords = intermediate.words;

		                    // XOR intermediate with block
		                    for (var j = 0; j < blockWordsLength; j++) {
		                        blockWords[j] ^= intermediateWords[j];
		                    }
		                }

		                derivedKey.concat(block);
		                blockIndexWords[0]++;
		            }
		            derivedKey.sigBytes = keySize * 4;

		            return derivedKey;
		        }
		    });

		    /**
		     * Computes the Password-Based Key Derivation Function 2.
		     *
		     * @param {WordArray|string} password The password.
		     * @param {WordArray|string} salt A salt.
		     * @param {Object} cfg (Optional) The configuration options to use for this computation.
		     *
		     * @return {WordArray} The derived key.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var key = CryptoJS.PBKDF2(password, salt);
		     *     var key = CryptoJS.PBKDF2(password, salt, { keySize: 8 });
		     *     var key = CryptoJS.PBKDF2(password, salt, { keySize: 8, iterations: 1000 });
		     */
		    C.PBKDF2 = function (password, salt, cfg) {
		        return PBKDF2.create(cfg).compute(password, salt);
		    };
		}());


		return CryptoJS.PBKDF2;

	}));

/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(13), __webpack_require__(20));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./sha1", "./hmac"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var Base = C_lib.Base;
		    var WordArray = C_lib.WordArray;
		    var C_algo = C.algo;
		    var MD5 = C_algo.MD5;

		    /**
		     * This key derivation function is meant to conform with EVP_BytesToKey.
		     * www.openssl.org/docs/crypto/EVP_BytesToKey.html
		     */
		    var EvpKDF = C_algo.EvpKDF = Base.extend({
		        /**
		         * Configuration options.
		         *
		         * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
		         * @property {Hasher} hasher The hash algorithm to use. Default: MD5
		         * @property {number} iterations The number of iterations to perform. Default: 1
		         */
		        cfg: Base.extend({
		            keySize: 128/32,
		            hasher: MD5,
		            iterations: 1
		        }),

		        /**
		         * Initializes a newly created key derivation function.
		         *
		         * @param {Object} cfg (Optional) The configuration options to use for the derivation.
		         *
		         * @example
		         *
		         *     var kdf = CryptoJS.algo.EvpKDF.create();
		         *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8 });
		         *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8, iterations: 1000 });
		         */
		        init: function (cfg) {
		            this.cfg = this.cfg.extend(cfg);
		        },

		        /**
		         * Derives a key from a password.
		         *
		         * @param {WordArray|string} password The password.
		         * @param {WordArray|string} salt A salt.
		         *
		         * @return {WordArray} The derived key.
		         *
		         * @example
		         *
		         *     var key = kdf.compute(password, salt);
		         */
		        compute: function (password, salt) {
		            // Shortcut
		            var cfg = this.cfg;

		            // Init hasher
		            var hasher = cfg.hasher.create();

		            // Initial values
		            var derivedKey = WordArray.create();

		            // Shortcuts
		            var derivedKeyWords = derivedKey.words;
		            var keySize = cfg.keySize;
		            var iterations = cfg.iterations;

		            // Generate key
		            while (derivedKeyWords.length < keySize) {
		                if (block) {
		                    hasher.update(block);
		                }
		                var block = hasher.update(password).finalize(salt);
		                hasher.reset();

		                // Iterations
		                for (var i = 1; i < iterations; i++) {
		                    block = hasher.finalize(block);
		                    hasher.reset();
		                }

		                derivedKey.concat(block);
		            }
		            derivedKey.sigBytes = keySize * 4;

		            return derivedKey;
		        }
		    });

		    /**
		     * Derives a key from a password.
		     *
		     * @param {WordArray|string} password The password.
		     * @param {WordArray|string} salt A salt.
		     * @param {Object} cfg (Optional) The configuration options to use for this computation.
		     *
		     * @return {WordArray} The derived key.
		     *
		     * @static
		     *
		     * @example
		     *
		     *     var key = CryptoJS.EvpKDF(password, salt);
		     *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8 });
		     *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8, iterations: 1000 });
		     */
		    C.EvpKDF = function (password, salt, cfg) {
		        return EvpKDF.create(cfg).compute(password, salt);
		    };
		}());


		return CryptoJS.EvpKDF;

	}));

/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/**
		 * Cipher core components.
		 */
		CryptoJS.lib.Cipher || (function (undefined) {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var Base = C_lib.Base;
		    var WordArray = C_lib.WordArray;
		    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm;
		    var C_enc = C.enc;
		    var Utf8 = C_enc.Utf8;
		    var Base64 = C_enc.Base64;
		    var C_algo = C.algo;
		    var EvpKDF = C_algo.EvpKDF;

		    /**
		     * Abstract base cipher template.
		     *
		     * @property {number} keySize This cipher's key size. Default: 4 (128 bits)
		     * @property {number} ivSize This cipher's IV size. Default: 4 (128 bits)
		     * @property {number} _ENC_XFORM_MODE A constant representing encryption mode.
		     * @property {number} _DEC_XFORM_MODE A constant representing decryption mode.
		     */
		    var Cipher = C_lib.Cipher = BufferedBlockAlgorithm.extend({
		        /**
		         * Configuration options.
		         *
		         * @property {WordArray} iv The IV to use for this operation.
		         */
		        cfg: Base.extend(),

		        /**
		         * Creates this cipher in encryption mode.
		         *
		         * @param {WordArray} key The key.
		         * @param {Object} cfg (Optional) The configuration options to use for this operation.
		         *
		         * @return {Cipher} A cipher instance.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var cipher = CryptoJS.algo.AES.createEncryptor(keyWordArray, { iv: ivWordArray });
		         */
		        createEncryptor: function (key, cfg) {
		            return this.create(this._ENC_XFORM_MODE, key, cfg);
		        },

		        /**
		         * Creates this cipher in decryption mode.
		         *
		         * @param {WordArray} key The key.
		         * @param {Object} cfg (Optional) The configuration options to use for this operation.
		         *
		         * @return {Cipher} A cipher instance.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var cipher = CryptoJS.algo.AES.createDecryptor(keyWordArray, { iv: ivWordArray });
		         */
		        createDecryptor: function (key, cfg) {
		            return this.create(this._DEC_XFORM_MODE, key, cfg);
		        },

		        /**
		         * Initializes a newly created cipher.
		         *
		         * @param {number} xformMode Either the encryption or decryption transormation mode constant.
		         * @param {WordArray} key The key.
		         * @param {Object} cfg (Optional) The configuration options to use for this operation.
		         *
		         * @example
		         *
		         *     var cipher = CryptoJS.algo.AES.create(CryptoJS.algo.AES._ENC_XFORM_MODE, keyWordArray, { iv: ivWordArray });
		         */
		        init: function (xformMode, key, cfg) {
		            // Apply config defaults
		            this.cfg = this.cfg.extend(cfg);

		            // Store transform mode and key
		            this._xformMode = xformMode;
		            this._key = key;

		            // Set initial values
		            this.reset();
		        },

		        /**
		         * Resets this cipher to its initial state.
		         *
		         * @example
		         *
		         *     cipher.reset();
		         */
		        reset: function () {
		            // Reset data buffer
		            BufferedBlockAlgorithm.reset.call(this);

		            // Perform concrete-cipher logic
		            this._doReset();
		        },

		        /**
		         * Adds data to be encrypted or decrypted.
		         *
		         * @param {WordArray|string} dataUpdate The data to encrypt or decrypt.
		         *
		         * @return {WordArray} The data after processing.
		         *
		         * @example
		         *
		         *     var encrypted = cipher.process('data');
		         *     var encrypted = cipher.process(wordArray);
		         */
		        process: function (dataUpdate) {
		            // Append
		            this._append(dataUpdate);

		            // Process available blocks
		            return this._process();
		        },

		        /**
		         * Finalizes the encryption or decryption process.
		         * Note that the finalize operation is effectively a destructive, read-once operation.
		         *
		         * @param {WordArray|string} dataUpdate The final data to encrypt or decrypt.
		         *
		         * @return {WordArray} The data after final processing.
		         *
		         * @example
		         *
		         *     var encrypted = cipher.finalize();
		         *     var encrypted = cipher.finalize('data');
		         *     var encrypted = cipher.finalize(wordArray);
		         */
		        finalize: function (dataUpdate) {
		            // Final data update
		            if (dataUpdate) {
		                this._append(dataUpdate);
		            }

		            // Perform concrete-cipher logic
		            var finalProcessedData = this._doFinalize();

		            return finalProcessedData;
		        },

		        keySize: 128/32,

		        ivSize: 128/32,

		        _ENC_XFORM_MODE: 1,

		        _DEC_XFORM_MODE: 2,

		        /**
		         * Creates shortcut functions to a cipher's object interface.
		         *
		         * @param {Cipher} cipher The cipher to create a helper for.
		         *
		         * @return {Object} An object with encrypt and decrypt shortcut functions.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var AES = CryptoJS.lib.Cipher._createHelper(CryptoJS.algo.AES);
		         */
		        _createHelper: (function () {
		            function selectCipherStrategy(key) {
		                if (typeof key == 'string') {
		                    return PasswordBasedCipher;
		                } else {
		                    return SerializableCipher;
		                }
		            }

		            return function (cipher) {
		                return {
		                    encrypt: function (message, key, cfg) {
		                        return selectCipherStrategy(key).encrypt(cipher, message, key, cfg);
		                    },

		                    decrypt: function (ciphertext, key, cfg) {
		                        return selectCipherStrategy(key).decrypt(cipher, ciphertext, key, cfg);
		                    }
		                };
		            };
		        }())
		    });

		    /**
		     * Abstract base stream cipher template.
		     *
		     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 1 (32 bits)
		     */
		    var StreamCipher = C_lib.StreamCipher = Cipher.extend({
		        _doFinalize: function () {
		            // Process partial blocks
		            var finalProcessedBlocks = this._process(!!'flush');

		            return finalProcessedBlocks;
		        },

		        blockSize: 1
		    });

		    /**
		     * Mode namespace.
		     */
		    var C_mode = C.mode = {};

		    /**
		     * Abstract base block cipher mode template.
		     */
		    var BlockCipherMode = C_lib.BlockCipherMode = Base.extend({
		        /**
		         * Creates this mode for encryption.
		         *
		         * @param {Cipher} cipher A block cipher instance.
		         * @param {Array} iv The IV words.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var mode = CryptoJS.mode.CBC.createEncryptor(cipher, iv.words);
		         */
		        createEncryptor: function (cipher, iv) {
		            return this.Encryptor.create(cipher, iv);
		        },

		        /**
		         * Creates this mode for decryption.
		         *
		         * @param {Cipher} cipher A block cipher instance.
		         * @param {Array} iv The IV words.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var mode = CryptoJS.mode.CBC.createDecryptor(cipher, iv.words);
		         */
		        createDecryptor: function (cipher, iv) {
		            return this.Decryptor.create(cipher, iv);
		        },

		        /**
		         * Initializes a newly created mode.
		         *
		         * @param {Cipher} cipher A block cipher instance.
		         * @param {Array} iv The IV words.
		         *
		         * @example
		         *
		         *     var mode = CryptoJS.mode.CBC.Encryptor.create(cipher, iv.words);
		         */
		        init: function (cipher, iv) {
		            this._cipher = cipher;
		            this._iv = iv;
		        }
		    });

		    /**
		     * Cipher Block Chaining mode.
		     */
		    var CBC = C_mode.CBC = (function () {
		        /**
		         * Abstract base CBC mode.
		         */
		        var CBC = BlockCipherMode.extend();

		        /**
		         * CBC encryptor.
		         */
		        CBC.Encryptor = CBC.extend({
		            /**
		             * Processes the data block at offset.
		             *
		             * @param {Array} words The data words to operate on.
		             * @param {number} offset The offset where the block starts.
		             *
		             * @example
		             *
		             *     mode.processBlock(data.words, offset);
		             */
		            processBlock: function (words, offset) {
		                // Shortcuts
		                var cipher = this._cipher;
		                var blockSize = cipher.blockSize;

		                // XOR and encrypt
		                xorBlock.call(this, words, offset, blockSize);
		                cipher.encryptBlock(words, offset);

		                // Remember this block to use with next block
		                this._prevBlock = words.slice(offset, offset + blockSize);
		            }
		        });

		        /**
		         * CBC decryptor.
		         */
		        CBC.Decryptor = CBC.extend({
		            /**
		             * Processes the data block at offset.
		             *
		             * @param {Array} words The data words to operate on.
		             * @param {number} offset The offset where the block starts.
		             *
		             * @example
		             *
		             *     mode.processBlock(data.words, offset);
		             */
		            processBlock: function (words, offset) {
		                // Shortcuts
		                var cipher = this._cipher;
		                var blockSize = cipher.blockSize;

		                // Remember this block to use with next block
		                var thisBlock = words.slice(offset, offset + blockSize);

		                // Decrypt and XOR
		                cipher.decryptBlock(words, offset);
		                xorBlock.call(this, words, offset, blockSize);

		                // This block becomes the previous block
		                this._prevBlock = thisBlock;
		            }
		        });

		        function xorBlock(words, offset, blockSize) {
		            // Shortcut
		            var iv = this._iv;

		            // Choose mixing block
		            if (iv) {
		                var block = iv;

		                // Remove IV for subsequent blocks
		                this._iv = undefined;
		            } else {
		                var block = this._prevBlock;
		            }

		            // XOR blocks
		            for (var i = 0; i < blockSize; i++) {
		                words[offset + i] ^= block[i];
		            }
		        }

		        return CBC;
		    }());

		    /**
		     * Padding namespace.
		     */
		    var C_pad = C.pad = {};

		    /**
		     * PKCS #5/7 padding strategy.
		     */
		    var Pkcs7 = C_pad.Pkcs7 = {
		        /**
		         * Pads data using the algorithm defined in PKCS #5/7.
		         *
		         * @param {WordArray} data The data to pad.
		         * @param {number} blockSize The multiple that the data should be padded to.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     CryptoJS.pad.Pkcs7.pad(wordArray, 4);
		         */
		        pad: function (data, blockSize) {
		            // Shortcut
		            var blockSizeBytes = blockSize * 4;

		            // Count padding bytes
		            var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;

		            // Create padding word
		            var paddingWord = (nPaddingBytes << 24) | (nPaddingBytes << 16) | (nPaddingBytes << 8) | nPaddingBytes;

		            // Create padding
		            var paddingWords = [];
		            for (var i = 0; i < nPaddingBytes; i += 4) {
		                paddingWords.push(paddingWord);
		            }
		            var padding = WordArray.create(paddingWords, nPaddingBytes);

		            // Add padding
		            data.concat(padding);
		        },

		        /**
		         * Unpads data that had been padded using the algorithm defined in PKCS #5/7.
		         *
		         * @param {WordArray} data The data to unpad.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     CryptoJS.pad.Pkcs7.unpad(wordArray);
		         */
		        unpad: function (data) {
		            // Get number of padding bytes from last byte
		            var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

		            // Remove padding
		            data.sigBytes -= nPaddingBytes;
		        }
		    };

		    /**
		     * Abstract base block cipher template.
		     *
		     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 4 (128 bits)
		     */
		    var BlockCipher = C_lib.BlockCipher = Cipher.extend({
		        /**
		         * Configuration options.
		         *
		         * @property {Mode} mode The block mode to use. Default: CBC
		         * @property {Padding} padding The padding strategy to use. Default: Pkcs7
		         */
		        cfg: Cipher.cfg.extend({
		            mode: CBC,
		            padding: Pkcs7
		        }),

		        reset: function () {
		            // Reset cipher
		            Cipher.reset.call(this);

		            // Shortcuts
		            var cfg = this.cfg;
		            var iv = cfg.iv;
		            var mode = cfg.mode;

		            // Reset block mode
		            if (this._xformMode == this._ENC_XFORM_MODE) {
		                var modeCreator = mode.createEncryptor;
		            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
		                var modeCreator = mode.createDecryptor;

		                // Keep at least one block in the buffer for unpadding
		                this._minBufferSize = 1;
		            }
		            this._mode = modeCreator.call(mode, this, iv && iv.words);
		        },

		        _doProcessBlock: function (words, offset) {
		            this._mode.processBlock(words, offset);
		        },

		        _doFinalize: function () {
		            // Shortcut
		            var padding = this.cfg.padding;

		            // Finalize
		            if (this._xformMode == this._ENC_XFORM_MODE) {
		                // Pad data
		                padding.pad(this._data, this.blockSize);

		                // Process final blocks
		                var finalProcessedBlocks = this._process(!!'flush');
		            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
		                // Process final blocks
		                var finalProcessedBlocks = this._process(!!'flush');

		                // Unpad data
		                padding.unpad(finalProcessedBlocks);
		            }

		            return finalProcessedBlocks;
		        },

		        blockSize: 128/32
		    });

		    /**
		     * A collection of cipher parameters.
		     *
		     * @property {WordArray} ciphertext The raw ciphertext.
		     * @property {WordArray} key The key to this ciphertext.
		     * @property {WordArray} iv The IV used in the ciphering operation.
		     * @property {WordArray} salt The salt used with a key derivation function.
		     * @property {Cipher} algorithm The cipher algorithm.
		     * @property {Mode} mode The block mode used in the ciphering operation.
		     * @property {Padding} padding The padding scheme used in the ciphering operation.
		     * @property {number} blockSize The block size of the cipher.
		     * @property {Format} formatter The default formatting strategy to convert this cipher params object to a string.
		     */
		    var CipherParams = C_lib.CipherParams = Base.extend({
		        /**
		         * Initializes a newly created cipher params object.
		         *
		         * @param {Object} cipherParams An object with any of the possible cipher parameters.
		         *
		         * @example
		         *
		         *     var cipherParams = CryptoJS.lib.CipherParams.create({
		         *         ciphertext: ciphertextWordArray,
		         *         key: keyWordArray,
		         *         iv: ivWordArray,
		         *         salt: saltWordArray,
		         *         algorithm: CryptoJS.algo.AES,
		         *         mode: CryptoJS.mode.CBC,
		         *         padding: CryptoJS.pad.PKCS7,
		         *         blockSize: 4,
		         *         formatter: CryptoJS.format.OpenSSL
		         *     });
		         */
		        init: function (cipherParams) {
		            this.mixIn(cipherParams);
		        },

		        /**
		         * Converts this cipher params object to a string.
		         *
		         * @param {Format} formatter (Optional) The formatting strategy to use.
		         *
		         * @return {string} The stringified cipher params.
		         *
		         * @throws Error If neither the formatter nor the default formatter is set.
		         *
		         * @example
		         *
		         *     var string = cipherParams + '';
		         *     var string = cipherParams.toString();
		         *     var string = cipherParams.toString(CryptoJS.format.OpenSSL);
		         */
		        toString: function (formatter) {
		            return (formatter || this.formatter).stringify(this);
		        }
		    });

		    /**
		     * Format namespace.
		     */
		    var C_format = C.format = {};

		    /**
		     * OpenSSL formatting strategy.
		     */
		    var OpenSSLFormatter = C_format.OpenSSL = {
		        /**
		         * Converts a cipher params object to an OpenSSL-compatible string.
		         *
		         * @param {CipherParams} cipherParams The cipher params object.
		         *
		         * @return {string} The OpenSSL-compatible string.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var openSSLString = CryptoJS.format.OpenSSL.stringify(cipherParams);
		         */
		        stringify: function (cipherParams) {
		            // Shortcuts
		            var ciphertext = cipherParams.ciphertext;
		            var salt = cipherParams.salt;

		            // Format
		            if (salt) {
		                var wordArray = WordArray.create([0x53616c74, 0x65645f5f]).concat(salt).concat(ciphertext);
		            } else {
		                var wordArray = ciphertext;
		            }

		            return wordArray.toString(Base64);
		        },

		        /**
		         * Converts an OpenSSL-compatible string to a cipher params object.
		         *
		         * @param {string} openSSLStr The OpenSSL-compatible string.
		         *
		         * @return {CipherParams} The cipher params object.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var cipherParams = CryptoJS.format.OpenSSL.parse(openSSLString);
		         */
		        parse: function (openSSLStr) {
		            // Parse base64
		            var ciphertext = Base64.parse(openSSLStr);

		            // Shortcut
		            var ciphertextWords = ciphertext.words;

		            // Test for salt
		            if (ciphertextWords[0] == 0x53616c74 && ciphertextWords[1] == 0x65645f5f) {
		                // Extract salt
		                var salt = WordArray.create(ciphertextWords.slice(2, 4));

		                // Remove salt from ciphertext
		                ciphertextWords.splice(0, 4);
		                ciphertext.sigBytes -= 16;
		            }

		            return CipherParams.create({ ciphertext: ciphertext, salt: salt });
		        }
		    };

		    /**
		     * A cipher wrapper that returns ciphertext as a serializable cipher params object.
		     */
		    var SerializableCipher = C_lib.SerializableCipher = Base.extend({
		        /**
		         * Configuration options.
		         *
		         * @property {Formatter} format The formatting strategy to convert cipher param objects to and from a string. Default: OpenSSL
		         */
		        cfg: Base.extend({
		            format: OpenSSLFormatter
		        }),

		        /**
		         * Encrypts a message.
		         *
		         * @param {Cipher} cipher The cipher algorithm to use.
		         * @param {WordArray|string} message The message to encrypt.
		         * @param {WordArray} key The key.
		         * @param {Object} cfg (Optional) The configuration options to use for this operation.
		         *
		         * @return {CipherParams} A cipher params object.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key);
		         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv });
		         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv, format: CryptoJS.format.OpenSSL });
		         */
		        encrypt: function (cipher, message, key, cfg) {
		            // Apply config defaults
		            cfg = this.cfg.extend(cfg);

		            // Encrypt
		            var encryptor = cipher.createEncryptor(key, cfg);
		            var ciphertext = encryptor.finalize(message);

		            // Shortcut
		            var cipherCfg = encryptor.cfg;

		            // Create and return serializable cipher params
		            return CipherParams.create({
		                ciphertext: ciphertext,
		                key: key,
		                iv: cipherCfg.iv,
		                algorithm: cipher,
		                mode: cipherCfg.mode,
		                padding: cipherCfg.padding,
		                blockSize: cipher.blockSize,
		                formatter: cfg.format
		            });
		        },

		        /**
		         * Decrypts serialized ciphertext.
		         *
		         * @param {Cipher} cipher The cipher algorithm to use.
		         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
		         * @param {WordArray} key The key.
		         * @param {Object} cfg (Optional) The configuration options to use for this operation.
		         *
		         * @return {WordArray} The plaintext.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, key, { iv: iv, format: CryptoJS.format.OpenSSL });
		         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, key, { iv: iv, format: CryptoJS.format.OpenSSL });
		         */
		        decrypt: function (cipher, ciphertext, key, cfg) {
		            // Apply config defaults
		            cfg = this.cfg.extend(cfg);

		            // Convert string to CipherParams
		            ciphertext = this._parse(ciphertext, cfg.format);

		            // Decrypt
		            var plaintext = cipher.createDecryptor(key, cfg).finalize(ciphertext.ciphertext);

		            return plaintext;
		        },

		        /**
		         * Converts serialized ciphertext to CipherParams,
		         * else assumed CipherParams already and returns ciphertext unchanged.
		         *
		         * @param {CipherParams|string} ciphertext The ciphertext.
		         * @param {Formatter} format The formatting strategy to use to parse serialized ciphertext.
		         *
		         * @return {CipherParams} The unserialized ciphertext.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var ciphertextParams = CryptoJS.lib.SerializableCipher._parse(ciphertextStringOrParams, format);
		         */
		        _parse: function (ciphertext, format) {
		            if (typeof ciphertext == 'string') {
		                return format.parse(ciphertext, this);
		            } else {
		                return ciphertext;
		            }
		        }
		    });

		    /**
		     * Key derivation function namespace.
		     */
		    var C_kdf = C.kdf = {};

		    /**
		     * OpenSSL key derivation function.
		     */
		    var OpenSSLKdf = C_kdf.OpenSSL = {
		        /**
		         * Derives a key and IV from a password.
		         *
		         * @param {string} password The password to derive from.
		         * @param {number} keySize The size in words of the key to generate.
		         * @param {number} ivSize The size in words of the IV to generate.
		         * @param {WordArray|string} salt (Optional) A 64-bit salt to use. If omitted, a salt will be generated randomly.
		         *
		         * @return {CipherParams} A cipher params object with the key, IV, and salt.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32);
		         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32, 'saltsalt');
		         */
		        execute: function (password, keySize, ivSize, salt) {
		            // Generate random salt
		            if (!salt) {
		                salt = WordArray.random(64/8);
		            }

		            // Derive key and IV
		            var key = EvpKDF.create({ keySize: keySize + ivSize }).compute(password, salt);

		            // Separate key and IV
		            var iv = WordArray.create(key.words.slice(keySize), ivSize * 4);
		            key.sigBytes = keySize * 4;

		            // Return params
		            return CipherParams.create({ key: key, iv: iv, salt: salt });
		        }
		    };

		    /**
		     * A serializable cipher wrapper that derives the key from a password,
		     * and returns ciphertext as a serializable cipher params object.
		     */
		    var PasswordBasedCipher = C_lib.PasswordBasedCipher = SerializableCipher.extend({
		        /**
		         * Configuration options.
		         *
		         * @property {KDF} kdf The key derivation function to use to generate a key and IV from a password. Default: OpenSSL
		         */
		        cfg: SerializableCipher.cfg.extend({
		            kdf: OpenSSLKdf
		        }),

		        /**
		         * Encrypts a message using a password.
		         *
		         * @param {Cipher} cipher The cipher algorithm to use.
		         * @param {WordArray|string} message The message to encrypt.
		         * @param {string} password The password.
		         * @param {Object} cfg (Optional) The configuration options to use for this operation.
		         *
		         * @return {CipherParams} A cipher params object.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password');
		         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password', { format: CryptoJS.format.OpenSSL });
		         */
		        encrypt: function (cipher, message, password, cfg) {
		            // Apply config defaults
		            cfg = this.cfg.extend(cfg);

		            // Derive key and other params
		            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize);

		            // Add IV to config
		            cfg.iv = derivedParams.iv;

		            // Encrypt
		            var ciphertext = SerializableCipher.encrypt.call(this, cipher, message, derivedParams.key, cfg);

		            // Mix in derived params
		            ciphertext.mixIn(derivedParams);

		            return ciphertext;
		        },

		        /**
		         * Decrypts serialized ciphertext using a password.
		         *
		         * @param {Cipher} cipher The cipher algorithm to use.
		         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
		         * @param {string} password The password.
		         * @param {Object} cfg (Optional) The configuration options to use for this operation.
		         *
		         * @return {WordArray} The plaintext.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, 'password', { format: CryptoJS.format.OpenSSL });
		         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, 'password', { format: CryptoJS.format.OpenSSL });
		         */
		        decrypt: function (cipher, ciphertext, password, cfg) {
		            // Apply config defaults
		            cfg = this.cfg.extend(cfg);

		            // Convert string to CipherParams
		            ciphertext = this._parse(ciphertext, cfg.format);

		            // Derive key and other params
		            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize, ciphertext.salt);

		            // Add IV to config
		            cfg.iv = derivedParams.iv;

		            // Decrypt
		            var plaintext = SerializableCipher.decrypt.call(this, cipher, ciphertext, derivedParams.key, cfg);

		            return plaintext;
		        }
		    });
		}());


	}));

/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/**
		 * Cipher Feedback block mode.
		 */
		CryptoJS.mode.CFB = (function () {
		    var CFB = CryptoJS.lib.BlockCipherMode.extend();

		    CFB.Encryptor = CFB.extend({
		        processBlock: function (words, offset) {
		            // Shortcuts
		            var cipher = this._cipher;
		            var blockSize = cipher.blockSize;

		            generateKeystreamAndEncrypt.call(this, words, offset, blockSize, cipher);

		            // Remember this block to use with next block
		            this._prevBlock = words.slice(offset, offset + blockSize);
		        }
		    });

		    CFB.Decryptor = CFB.extend({
		        processBlock: function (words, offset) {
		            // Shortcuts
		            var cipher = this._cipher;
		            var blockSize = cipher.blockSize;

		            // Remember this block to use with next block
		            var thisBlock = words.slice(offset, offset + blockSize);

		            generateKeystreamAndEncrypt.call(this, words, offset, blockSize, cipher);

		            // This block becomes the previous block
		            this._prevBlock = thisBlock;
		        }
		    });

		    function generateKeystreamAndEncrypt(words, offset, blockSize, cipher) {
		        // Shortcut
		        var iv = this._iv;

		        // Generate keystream
		        if (iv) {
		            var keystream = iv.slice(0);

		            // Remove IV for subsequent blocks
		            this._iv = undefined;
		        } else {
		            var keystream = this._prevBlock;
		        }
		        cipher.encryptBlock(keystream, 0);

		        // Encrypt
		        for (var i = 0; i < blockSize; i++) {
		            words[offset + i] ^= keystream[i];
		        }
		    }

		    return CFB;
		}());


		return CryptoJS.mode.CFB;

	}));

/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/**
		 * Counter block mode.
		 */
		CryptoJS.mode.CTR = (function () {
		    var CTR = CryptoJS.lib.BlockCipherMode.extend();

		    var Encryptor = CTR.Encryptor = CTR.extend({
		        processBlock: function (words, offset) {
		            // Shortcuts
		            var cipher = this._cipher
		            var blockSize = cipher.blockSize;
		            var iv = this._iv;
		            var counter = this._counter;

		            // Generate keystream
		            if (iv) {
		                counter = this._counter = iv.slice(0);

		                // Remove IV for subsequent blocks
		                this._iv = undefined;
		            }
		            var keystream = counter.slice(0);
		            cipher.encryptBlock(keystream, 0);

		            // Increment counter
		            counter[blockSize - 1] = (counter[blockSize - 1] + 1) | 0

		            // Encrypt
		            for (var i = 0; i < blockSize; i++) {
		                words[offset + i] ^= keystream[i];
		            }
		        }
		    });

		    CTR.Decryptor = Encryptor;

		    return CTR;
		}());


		return CryptoJS.mode.CTR;

	}));

/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/** @preserve
		 * Counter block mode compatible with  Dr Brian Gladman fileenc.c
		 * derived from CryptoJS.mode.CTR
		 * Jan Hruby jhruby.web@gmail.com
		 */
		CryptoJS.mode.CTRGladman = (function () {
		    var CTRGladman = CryptoJS.lib.BlockCipherMode.extend();

			function incWord(word)
			{
				if (((word >> 24) & 0xff) === 0xff) { //overflow
				var b1 = (word >> 16)&0xff;
				var b2 = (word >> 8)&0xff;
				var b3 = word & 0xff;

				if (b1 === 0xff) // overflow b1
				{
				b1 = 0;
				if (b2 === 0xff)
				{
					b2 = 0;
					if (b3 === 0xff)
					{
						b3 = 0;
					}
					else
					{
						++b3;
					}
				}
				else
				{
					++b2;
				}
				}
				else
				{
				++b1;
				}

				word = 0;
				word += (b1 << 16);
				word += (b2 << 8);
				word += b3;
				}
				else
				{
				word += (0x01 << 24);
				}
				return word;
			}

			function incCounter(counter)
			{
				if ((counter[0] = incWord(counter[0])) === 0)
				{
					// encr_data in fileenc.c from  Dr Brian Gladman's counts only with DWORD j < 8
					counter[1] = incWord(counter[1]);
				}
				return counter;
			}

		    var Encryptor = CTRGladman.Encryptor = CTRGladman.extend({
		        processBlock: function (words, offset) {
		            // Shortcuts
		            var cipher = this._cipher
		            var blockSize = cipher.blockSize;
		            var iv = this._iv;
		            var counter = this._counter;

		            // Generate keystream
		            if (iv) {
		                counter = this._counter = iv.slice(0);

		                // Remove IV for subsequent blocks
		                this._iv = undefined;
		            }

					incCounter(counter);

					var keystream = counter.slice(0);
		            cipher.encryptBlock(keystream, 0);

		            // Encrypt
		            for (var i = 0; i < blockSize; i++) {
		                words[offset + i] ^= keystream[i];
		            }
		        }
		    });

		    CTRGladman.Decryptor = Encryptor;

		    return CTRGladman;
		}());




		return CryptoJS.mode.CTRGladman;

	}));

/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/**
		 * Output Feedback block mode.
		 */
		CryptoJS.mode.OFB = (function () {
		    var OFB = CryptoJS.lib.BlockCipherMode.extend();

		    var Encryptor = OFB.Encryptor = OFB.extend({
		        processBlock: function (words, offset) {
		            // Shortcuts
		            var cipher = this._cipher
		            var blockSize = cipher.blockSize;
		            var iv = this._iv;
		            var keystream = this._keystream;

		            // Generate keystream
		            if (iv) {
		                keystream = this._keystream = iv.slice(0);

		                // Remove IV for subsequent blocks
		                this._iv = undefined;
		            }
		            cipher.encryptBlock(keystream, 0);

		            // Encrypt
		            for (var i = 0; i < blockSize; i++) {
		                words[offset + i] ^= keystream[i];
		            }
		        }
		    });

		    OFB.Decryptor = Encryptor;

		    return OFB;
		}());


		return CryptoJS.mode.OFB;

	}));

/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/**
		 * Electronic Codebook block mode.
		 */
		CryptoJS.mode.ECB = (function () {
		    var ECB = CryptoJS.lib.BlockCipherMode.extend();

		    ECB.Encryptor = ECB.extend({
		        processBlock: function (words, offset) {
		            this._cipher.encryptBlock(words, offset);
		        }
		    });

		    ECB.Decryptor = ECB.extend({
		        processBlock: function (words, offset) {
		            this._cipher.decryptBlock(words, offset);
		        }
		    });

		    return ECB;
		}());


		return CryptoJS.mode.ECB;

	}));

/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/**
		 * ANSI X.923 padding strategy.
		 */
		CryptoJS.pad.AnsiX923 = {
		    pad: function (data, blockSize) {
		        // Shortcuts
		        var dataSigBytes = data.sigBytes;
		        var blockSizeBytes = blockSize * 4;

		        // Count padding bytes
		        var nPaddingBytes = blockSizeBytes - dataSigBytes % blockSizeBytes;

		        // Compute last byte position
		        var lastBytePos = dataSigBytes + nPaddingBytes - 1;

		        // Pad
		        data.clamp();
		        data.words[lastBytePos >>> 2] |= nPaddingBytes << (24 - (lastBytePos % 4) * 8);
		        data.sigBytes += nPaddingBytes;
		    },

		    unpad: function (data) {
		        // Get number of padding bytes from last byte
		        var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

		        // Remove padding
		        data.sigBytes -= nPaddingBytes;
		    }
		};


		return CryptoJS.pad.Ansix923;

	}));

/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/**
		 * ISO 10126 padding strategy.
		 */
		CryptoJS.pad.Iso10126 = {
		    pad: function (data, blockSize) {
		        // Shortcut
		        var blockSizeBytes = blockSize * 4;

		        // Count padding bytes
		        var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;

		        // Pad
		        data.concat(CryptoJS.lib.WordArray.random(nPaddingBytes - 1)).
		             concat(CryptoJS.lib.WordArray.create([nPaddingBytes << 24], 1));
		    },

		    unpad: function (data) {
		        // Get number of padding bytes from last byte
		        var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

		        // Remove padding
		        data.sigBytes -= nPaddingBytes;
		    }
		};


		return CryptoJS.pad.Iso10126;

	}));

/***/ },
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/**
		 * ISO/IEC 9797-1 Padding Method 2.
		 */
		CryptoJS.pad.Iso97971 = {
		    pad: function (data, blockSize) {
		        // Add 0x80 byte
		        data.concat(CryptoJS.lib.WordArray.create([0x80000000], 1));

		        // Zero pad the rest
		        CryptoJS.pad.ZeroPadding.pad(data, blockSize);
		    },

		    unpad: function (data) {
		        // Remove zero padding
		        CryptoJS.pad.ZeroPadding.unpad(data);

		        // Remove one more byte -- the 0x80 byte
		        data.sigBytes--;
		    }
		};


		return CryptoJS.pad.Iso97971;

	}));

/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/**
		 * Zero padding strategy.
		 */
		CryptoJS.pad.ZeroPadding = {
		    pad: function (data, blockSize) {
		        // Shortcut
		        var blockSizeBytes = blockSize * 4;

		        // Pad
		        data.clamp();
		        data.sigBytes += blockSizeBytes - ((data.sigBytes % blockSizeBytes) || blockSizeBytes);
		    },

		    unpad: function (data) {
		        // Shortcut
		        var dataWords = data.words;

		        // Unpad
		        var i = data.sigBytes - 1;
		        while (!((dataWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff)) {
		            i--;
		        }
		        data.sigBytes = i + 1;
		    }
		};


		return CryptoJS.pad.ZeroPadding;

	}));

/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		/**
		 * A noop padding strategy.
		 */
		CryptoJS.pad.NoPadding = {
		    pad: function () {
		    },

		    unpad: function () {
		    }
		};


		return CryptoJS.pad.NoPadding;

	}));

/***/ },
/* 34 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function (undefined) {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var CipherParams = C_lib.CipherParams;
		    var C_enc = C.enc;
		    var Hex = C_enc.Hex;
		    var C_format = C.format;

		    var HexFormatter = C_format.Hex = {
		        /**
		         * Converts the ciphertext of a cipher params object to a hexadecimally encoded string.
		         *
		         * @param {CipherParams} cipherParams The cipher params object.
		         *
		         * @return {string} The hexadecimally encoded string.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var hexString = CryptoJS.format.Hex.stringify(cipherParams);
		         */
		        stringify: function (cipherParams) {
		            return cipherParams.ciphertext.toString(Hex);
		        },

		        /**
		         * Converts a hexadecimally encoded ciphertext string to a cipher params object.
		         *
		         * @param {string} input The hexadecimally encoded string.
		         *
		         * @return {CipherParams} The cipher params object.
		         *
		         * @static
		         *
		         * @example
		         *
		         *     var cipherParams = CryptoJS.format.Hex.parse(hexString);
		         */
		        parse: function (input) {
		            var ciphertext = Hex.parse(input);
		            return CipherParams.create({ ciphertext: ciphertext });
		        }
		    };
		}());


		return CryptoJS.format.Hex;

	}));

/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(11), __webpack_require__(12), __webpack_require__(22), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var BlockCipher = C_lib.BlockCipher;
		    var C_algo = C.algo;

		    // Lookup tables
		    var SBOX = [];
		    var INV_SBOX = [];
		    var SUB_MIX_0 = [];
		    var SUB_MIX_1 = [];
		    var SUB_MIX_2 = [];
		    var SUB_MIX_3 = [];
		    var INV_SUB_MIX_0 = [];
		    var INV_SUB_MIX_1 = [];
		    var INV_SUB_MIX_2 = [];
		    var INV_SUB_MIX_3 = [];

		    // Compute lookup tables
		    (function () {
		        // Compute double table
		        var d = [];
		        for (var i = 0; i < 256; i++) {
		            if (i < 128) {
		                d[i] = i << 1;
		            } else {
		                d[i] = (i << 1) ^ 0x11b;
		            }
		        }

		        // Walk GF(2^8)
		        var x = 0;
		        var xi = 0;
		        for (var i = 0; i < 256; i++) {
		            // Compute sbox
		            var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
		            sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
		            SBOX[x] = sx;
		            INV_SBOX[sx] = x;

		            // Compute multiplication
		            var x2 = d[x];
		            var x4 = d[x2];
		            var x8 = d[x4];

		            // Compute sub bytes, mix columns tables
		            var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
		            SUB_MIX_0[x] = (t << 24) | (t >>> 8);
		            SUB_MIX_1[x] = (t << 16) | (t >>> 16);
		            SUB_MIX_2[x] = (t << 8)  | (t >>> 24);
		            SUB_MIX_3[x] = t;

		            // Compute inv sub bytes, inv mix columns tables
		            var t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
		            INV_SUB_MIX_0[sx] = (t << 24) | (t >>> 8);
		            INV_SUB_MIX_1[sx] = (t << 16) | (t >>> 16);
		            INV_SUB_MIX_2[sx] = (t << 8)  | (t >>> 24);
		            INV_SUB_MIX_3[sx] = t;

		            // Compute next counter
		            if (!x) {
		                x = xi = 1;
		            } else {
		                x = x2 ^ d[d[d[x8 ^ x2]]];
		                xi ^= d[d[xi]];
		            }
		        }
		    }());

		    // Precomputed Rcon lookup
		    var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

		    /**
		     * AES block cipher algorithm.
		     */
		    var AES = C_algo.AES = BlockCipher.extend({
		        _doReset: function () {
		            // Shortcuts
		            var key = this._key;
		            var keyWords = key.words;
		            var keySize = key.sigBytes / 4;

		            // Compute number of rounds
		            var nRounds = this._nRounds = keySize + 6

		            // Compute number of key schedule rows
		            var ksRows = (nRounds + 1) * 4;

		            // Compute key schedule
		            var keySchedule = this._keySchedule = [];
		            for (var ksRow = 0; ksRow < ksRows; ksRow++) {
		                if (ksRow < keySize) {
		                    keySchedule[ksRow] = keyWords[ksRow];
		                } else {
		                    var t = keySchedule[ksRow - 1];

		                    if (!(ksRow % keySize)) {
		                        // Rot word
		                        t = (t << 8) | (t >>> 24);

		                        // Sub word
		                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];

		                        // Mix Rcon
		                        t ^= RCON[(ksRow / keySize) | 0] << 24;
		                    } else if (keySize > 6 && ksRow % keySize == 4) {
		                        // Sub word
		                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];
		                    }

		                    keySchedule[ksRow] = keySchedule[ksRow - keySize] ^ t;
		                }
		            }

		            // Compute inv key schedule
		            var invKeySchedule = this._invKeySchedule = [];
		            for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
		                var ksRow = ksRows - invKsRow;

		                if (invKsRow % 4) {
		                    var t = keySchedule[ksRow];
		                } else {
		                    var t = keySchedule[ksRow - 4];
		                }

		                if (invKsRow < 4 || ksRow <= 4) {
		                    invKeySchedule[invKsRow] = t;
		                } else {
		                    invKeySchedule[invKsRow] = INV_SUB_MIX_0[SBOX[t >>> 24]] ^ INV_SUB_MIX_1[SBOX[(t >>> 16) & 0xff]] ^
		                                               INV_SUB_MIX_2[SBOX[(t >>> 8) & 0xff]] ^ INV_SUB_MIX_3[SBOX[t & 0xff]];
		                }
		            }
		        },

		        encryptBlock: function (M, offset) {
		            this._doCryptBlock(M, offset, this._keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX);
		        },

		        decryptBlock: function (M, offset) {
		            // Swap 2nd and 4th rows
		            var t = M[offset + 1];
		            M[offset + 1] = M[offset + 3];
		            M[offset + 3] = t;

		            this._doCryptBlock(M, offset, this._invKeySchedule, INV_SUB_MIX_0, INV_SUB_MIX_1, INV_SUB_MIX_2, INV_SUB_MIX_3, INV_SBOX);

		            // Inv swap 2nd and 4th rows
		            var t = M[offset + 1];
		            M[offset + 1] = M[offset + 3];
		            M[offset + 3] = t;
		        },

		        _doCryptBlock: function (M, offset, keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX) {
		            // Shortcut
		            var nRounds = this._nRounds;

		            // Get input, add round key
		            var s0 = M[offset]     ^ keySchedule[0];
		            var s1 = M[offset + 1] ^ keySchedule[1];
		            var s2 = M[offset + 2] ^ keySchedule[2];
		            var s3 = M[offset + 3] ^ keySchedule[3];

		            // Key schedule row counter
		            var ksRow = 4;

		            // Rounds
		            for (var round = 1; round < nRounds; round++) {
		                // Shift rows, sub bytes, mix columns, add round key
		                var t0 = SUB_MIX_0[s0 >>> 24] ^ SUB_MIX_1[(s1 >>> 16) & 0xff] ^ SUB_MIX_2[(s2 >>> 8) & 0xff] ^ SUB_MIX_3[s3 & 0xff] ^ keySchedule[ksRow++];
		                var t1 = SUB_MIX_0[s1 >>> 24] ^ SUB_MIX_1[(s2 >>> 16) & 0xff] ^ SUB_MIX_2[(s3 >>> 8) & 0xff] ^ SUB_MIX_3[s0 & 0xff] ^ keySchedule[ksRow++];
		                var t2 = SUB_MIX_0[s2 >>> 24] ^ SUB_MIX_1[(s3 >>> 16) & 0xff] ^ SUB_MIX_2[(s0 >>> 8) & 0xff] ^ SUB_MIX_3[s1 & 0xff] ^ keySchedule[ksRow++];
		                var t3 = SUB_MIX_0[s3 >>> 24] ^ SUB_MIX_1[(s0 >>> 16) & 0xff] ^ SUB_MIX_2[(s1 >>> 8) & 0xff] ^ SUB_MIX_3[s2 & 0xff] ^ keySchedule[ksRow++];

		                // Update state
		                s0 = t0;
		                s1 = t1;
		                s2 = t2;
		                s3 = t3;
		            }

		            // Shift rows, sub bytes, add round key
		            var t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
		            var t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
		            var t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
		            var t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];

		            // Set output
		            M[offset]     = t0;
		            M[offset + 1] = t1;
		            M[offset + 2] = t2;
		            M[offset + 3] = t3;
		        },

		        keySize: 256/32
		    });

		    /**
		     * Shortcut functions to the cipher's object interface.
		     *
		     * @example
		     *
		     *     var ciphertext = CryptoJS.AES.encrypt(message, key, cfg);
		     *     var plaintext  = CryptoJS.AES.decrypt(ciphertext, key, cfg);
		     */
		    C.AES = BlockCipher._createHelper(AES);
		}());


		return CryptoJS.AES;

	}));

/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(11), __webpack_require__(12), __webpack_require__(22), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var WordArray = C_lib.WordArray;
		    var BlockCipher = C_lib.BlockCipher;
		    var C_algo = C.algo;

		    // Permuted Choice 1 constants
		    var PC1 = [
		        57, 49, 41, 33, 25, 17, 9,  1,
		        58, 50, 42, 34, 26, 18, 10, 2,
		        59, 51, 43, 35, 27, 19, 11, 3,
		        60, 52, 44, 36, 63, 55, 47, 39,
		        31, 23, 15, 7,  62, 54, 46, 38,
		        30, 22, 14, 6,  61, 53, 45, 37,
		        29, 21, 13, 5,  28, 20, 12, 4
		    ];

		    // Permuted Choice 2 constants
		    var PC2 = [
		        14, 17, 11, 24, 1,  5,
		        3,  28, 15, 6,  21, 10,
		        23, 19, 12, 4,  26, 8,
		        16, 7,  27, 20, 13, 2,
		        41, 52, 31, 37, 47, 55,
		        30, 40, 51, 45, 33, 48,
		        44, 49, 39, 56, 34, 53,
		        46, 42, 50, 36, 29, 32
		    ];

		    // Cumulative bit shift constants
		    var BIT_SHIFTS = [1,  2,  4,  6,  8,  10, 12, 14, 15, 17, 19, 21, 23, 25, 27, 28];

		    // SBOXes and round permutation constants
		    var SBOX_P = [
		        {
		            0x0: 0x808200,
		            0x10000000: 0x8000,
		            0x20000000: 0x808002,
		            0x30000000: 0x2,
		            0x40000000: 0x200,
		            0x50000000: 0x808202,
		            0x60000000: 0x800202,
		            0x70000000: 0x800000,
		            0x80000000: 0x202,
		            0x90000000: 0x800200,
		            0xa0000000: 0x8200,
		            0xb0000000: 0x808000,
		            0xc0000000: 0x8002,
		            0xd0000000: 0x800002,
		            0xe0000000: 0x0,
		            0xf0000000: 0x8202,
		            0x8000000: 0x0,
		            0x18000000: 0x808202,
		            0x28000000: 0x8202,
		            0x38000000: 0x8000,
		            0x48000000: 0x808200,
		            0x58000000: 0x200,
		            0x68000000: 0x808002,
		            0x78000000: 0x2,
		            0x88000000: 0x800200,
		            0x98000000: 0x8200,
		            0xa8000000: 0x808000,
		            0xb8000000: 0x800202,
		            0xc8000000: 0x800002,
		            0xd8000000: 0x8002,
		            0xe8000000: 0x202,
		            0xf8000000: 0x800000,
		            0x1: 0x8000,
		            0x10000001: 0x2,
		            0x20000001: 0x808200,
		            0x30000001: 0x800000,
		            0x40000001: 0x808002,
		            0x50000001: 0x8200,
		            0x60000001: 0x200,
		            0x70000001: 0x800202,
		            0x80000001: 0x808202,
		            0x90000001: 0x808000,
		            0xa0000001: 0x800002,
		            0xb0000001: 0x8202,
		            0xc0000001: 0x202,
		            0xd0000001: 0x800200,
		            0xe0000001: 0x8002,
		            0xf0000001: 0x0,
		            0x8000001: 0x808202,
		            0x18000001: 0x808000,
		            0x28000001: 0x800000,
		            0x38000001: 0x200,
		            0x48000001: 0x8000,
		            0x58000001: 0x800002,
		            0x68000001: 0x2,
		            0x78000001: 0x8202,
		            0x88000001: 0x8002,
		            0x98000001: 0x800202,
		            0xa8000001: 0x202,
		            0xb8000001: 0x808200,
		            0xc8000001: 0x800200,
		            0xd8000001: 0x0,
		            0xe8000001: 0x8200,
		            0xf8000001: 0x808002
		        },
		        {
		            0x0: 0x40084010,
		            0x1000000: 0x4000,
		            0x2000000: 0x80000,
		            0x3000000: 0x40080010,
		            0x4000000: 0x40000010,
		            0x5000000: 0x40084000,
		            0x6000000: 0x40004000,
		            0x7000000: 0x10,
		            0x8000000: 0x84000,
		            0x9000000: 0x40004010,
		            0xa000000: 0x40000000,
		            0xb000000: 0x84010,
		            0xc000000: 0x80010,
		            0xd000000: 0x0,
		            0xe000000: 0x4010,
		            0xf000000: 0x40080000,
		            0x800000: 0x40004000,
		            0x1800000: 0x84010,
		            0x2800000: 0x10,
		            0x3800000: 0x40004010,
		            0x4800000: 0x40084010,
		            0x5800000: 0x40000000,
		            0x6800000: 0x80000,
		            0x7800000: 0x40080010,
		            0x8800000: 0x80010,
		            0x9800000: 0x0,
		            0xa800000: 0x4000,
		            0xb800000: 0x40080000,
		            0xc800000: 0x40000010,
		            0xd800000: 0x84000,
		            0xe800000: 0x40084000,
		            0xf800000: 0x4010,
		            0x10000000: 0x0,
		            0x11000000: 0x40080010,
		            0x12000000: 0x40004010,
		            0x13000000: 0x40084000,
		            0x14000000: 0x40080000,
		            0x15000000: 0x10,
		            0x16000000: 0x84010,
		            0x17000000: 0x4000,
		            0x18000000: 0x4010,
		            0x19000000: 0x80000,
		            0x1a000000: 0x80010,
		            0x1b000000: 0x40000010,
		            0x1c000000: 0x84000,
		            0x1d000000: 0x40004000,
		            0x1e000000: 0x40000000,
		            0x1f000000: 0x40084010,
		            0x10800000: 0x84010,
		            0x11800000: 0x80000,
		            0x12800000: 0x40080000,
		            0x13800000: 0x4000,
		            0x14800000: 0x40004000,
		            0x15800000: 0x40084010,
		            0x16800000: 0x10,
		            0x17800000: 0x40000000,
		            0x18800000: 0x40084000,
		            0x19800000: 0x40000010,
		            0x1a800000: 0x40004010,
		            0x1b800000: 0x80010,
		            0x1c800000: 0x0,
		            0x1d800000: 0x4010,
		            0x1e800000: 0x40080010,
		            0x1f800000: 0x84000
		        },
		        {
		            0x0: 0x104,
		            0x100000: 0x0,
		            0x200000: 0x4000100,
		            0x300000: 0x10104,
		            0x400000: 0x10004,
		            0x500000: 0x4000004,
		            0x600000: 0x4010104,
		            0x700000: 0x4010000,
		            0x800000: 0x4000000,
		            0x900000: 0x4010100,
		            0xa00000: 0x10100,
		            0xb00000: 0x4010004,
		            0xc00000: 0x4000104,
		            0xd00000: 0x10000,
		            0xe00000: 0x4,
		            0xf00000: 0x100,
		            0x80000: 0x4010100,
		            0x180000: 0x4010004,
		            0x280000: 0x0,
		            0x380000: 0x4000100,
		            0x480000: 0x4000004,
		            0x580000: 0x10000,
		            0x680000: 0x10004,
		            0x780000: 0x104,
		            0x880000: 0x4,
		            0x980000: 0x100,
		            0xa80000: 0x4010000,
		            0xb80000: 0x10104,
		            0xc80000: 0x10100,
		            0xd80000: 0x4000104,
		            0xe80000: 0x4010104,
		            0xf80000: 0x4000000,
		            0x1000000: 0x4010100,
		            0x1100000: 0x10004,
		            0x1200000: 0x10000,
		            0x1300000: 0x4000100,
		            0x1400000: 0x100,
		            0x1500000: 0x4010104,
		            0x1600000: 0x4000004,
		            0x1700000: 0x0,
		            0x1800000: 0x4000104,
		            0x1900000: 0x4000000,
		            0x1a00000: 0x4,
		            0x1b00000: 0x10100,
		            0x1c00000: 0x4010000,
		            0x1d00000: 0x104,
		            0x1e00000: 0x10104,
		            0x1f00000: 0x4010004,
		            0x1080000: 0x4000000,
		            0x1180000: 0x104,
		            0x1280000: 0x4010100,
		            0x1380000: 0x0,
		            0x1480000: 0x10004,
		            0x1580000: 0x4000100,
		            0x1680000: 0x100,
		            0x1780000: 0x4010004,
		            0x1880000: 0x10000,
		            0x1980000: 0x4010104,
		            0x1a80000: 0x10104,
		            0x1b80000: 0x4000004,
		            0x1c80000: 0x4000104,
		            0x1d80000: 0x4010000,
		            0x1e80000: 0x4,
		            0x1f80000: 0x10100
		        },
		        {
		            0x0: 0x80401000,
		            0x10000: 0x80001040,
		            0x20000: 0x401040,
		            0x30000: 0x80400000,
		            0x40000: 0x0,
		            0x50000: 0x401000,
		            0x60000: 0x80000040,
		            0x70000: 0x400040,
		            0x80000: 0x80000000,
		            0x90000: 0x400000,
		            0xa0000: 0x40,
		            0xb0000: 0x80001000,
		            0xc0000: 0x80400040,
		            0xd0000: 0x1040,
		            0xe0000: 0x1000,
		            0xf0000: 0x80401040,
		            0x8000: 0x80001040,
		            0x18000: 0x40,
		            0x28000: 0x80400040,
		            0x38000: 0x80001000,
		            0x48000: 0x401000,
		            0x58000: 0x80401040,
		            0x68000: 0x0,
		            0x78000: 0x80400000,
		            0x88000: 0x1000,
		            0x98000: 0x80401000,
		            0xa8000: 0x400000,
		            0xb8000: 0x1040,
		            0xc8000: 0x80000000,
		            0xd8000: 0x400040,
		            0xe8000: 0x401040,
		            0xf8000: 0x80000040,
		            0x100000: 0x400040,
		            0x110000: 0x401000,
		            0x120000: 0x80000040,
		            0x130000: 0x0,
		            0x140000: 0x1040,
		            0x150000: 0x80400040,
		            0x160000: 0x80401000,
		            0x170000: 0x80001040,
		            0x180000: 0x80401040,
		            0x190000: 0x80000000,
		            0x1a0000: 0x80400000,
		            0x1b0000: 0x401040,
		            0x1c0000: 0x80001000,
		            0x1d0000: 0x400000,
		            0x1e0000: 0x40,
		            0x1f0000: 0x1000,
		            0x108000: 0x80400000,
		            0x118000: 0x80401040,
		            0x128000: 0x0,
		            0x138000: 0x401000,
		            0x148000: 0x400040,
		            0x158000: 0x80000000,
		            0x168000: 0x80001040,
		            0x178000: 0x40,
		            0x188000: 0x80000040,
		            0x198000: 0x1000,
		            0x1a8000: 0x80001000,
		            0x1b8000: 0x80400040,
		            0x1c8000: 0x1040,
		            0x1d8000: 0x80401000,
		            0x1e8000: 0x400000,
		            0x1f8000: 0x401040
		        },
		        {
		            0x0: 0x80,
		            0x1000: 0x1040000,
		            0x2000: 0x40000,
		            0x3000: 0x20000000,
		            0x4000: 0x20040080,
		            0x5000: 0x1000080,
		            0x6000: 0x21000080,
		            0x7000: 0x40080,
		            0x8000: 0x1000000,
		            0x9000: 0x20040000,
		            0xa000: 0x20000080,
		            0xb000: 0x21040080,
		            0xc000: 0x21040000,
		            0xd000: 0x0,
		            0xe000: 0x1040080,
		            0xf000: 0x21000000,
		            0x800: 0x1040080,
		            0x1800: 0x21000080,
		            0x2800: 0x80,
		            0x3800: 0x1040000,
		            0x4800: 0x40000,
		            0x5800: 0x20040080,
		            0x6800: 0x21040000,
		            0x7800: 0x20000000,
		            0x8800: 0x20040000,
		            0x9800: 0x0,
		            0xa800: 0x21040080,
		            0xb800: 0x1000080,
		            0xc800: 0x20000080,
		            0xd800: 0x21000000,
		            0xe800: 0x1000000,
		            0xf800: 0x40080,
		            0x10000: 0x40000,
		            0x11000: 0x80,
		            0x12000: 0x20000000,
		            0x13000: 0x21000080,
		            0x14000: 0x1000080,
		            0x15000: 0x21040000,
		            0x16000: 0x20040080,
		            0x17000: 0x1000000,
		            0x18000: 0x21040080,
		            0x19000: 0x21000000,
		            0x1a000: 0x1040000,
		            0x1b000: 0x20040000,
		            0x1c000: 0x40080,
		            0x1d000: 0x20000080,
		            0x1e000: 0x0,
		            0x1f000: 0x1040080,
		            0x10800: 0x21000080,
		            0x11800: 0x1000000,
		            0x12800: 0x1040000,
		            0x13800: 0x20040080,
		            0x14800: 0x20000000,
		            0x15800: 0x1040080,
		            0x16800: 0x80,
		            0x17800: 0x21040000,
		            0x18800: 0x40080,
		            0x19800: 0x21040080,
		            0x1a800: 0x0,
		            0x1b800: 0x21000000,
		            0x1c800: 0x1000080,
		            0x1d800: 0x40000,
		            0x1e800: 0x20040000,
		            0x1f800: 0x20000080
		        },
		        {
		            0x0: 0x10000008,
		            0x100: 0x2000,
		            0x200: 0x10200000,
		            0x300: 0x10202008,
		            0x400: 0x10002000,
		            0x500: 0x200000,
		            0x600: 0x200008,
		            0x700: 0x10000000,
		            0x800: 0x0,
		            0x900: 0x10002008,
		            0xa00: 0x202000,
		            0xb00: 0x8,
		            0xc00: 0x10200008,
		            0xd00: 0x202008,
		            0xe00: 0x2008,
		            0xf00: 0x10202000,
		            0x80: 0x10200000,
		            0x180: 0x10202008,
		            0x280: 0x8,
		            0x380: 0x200000,
		            0x480: 0x202008,
		            0x580: 0x10000008,
		            0x680: 0x10002000,
		            0x780: 0x2008,
		            0x880: 0x200008,
		            0x980: 0x2000,
		            0xa80: 0x10002008,
		            0xb80: 0x10200008,
		            0xc80: 0x0,
		            0xd80: 0x10202000,
		            0xe80: 0x202000,
		            0xf80: 0x10000000,
		            0x1000: 0x10002000,
		            0x1100: 0x10200008,
		            0x1200: 0x10202008,
		            0x1300: 0x2008,
		            0x1400: 0x200000,
		            0x1500: 0x10000000,
		            0x1600: 0x10000008,
		            0x1700: 0x202000,
		            0x1800: 0x202008,
		            0x1900: 0x0,
		            0x1a00: 0x8,
		            0x1b00: 0x10200000,
		            0x1c00: 0x2000,
		            0x1d00: 0x10002008,
		            0x1e00: 0x10202000,
		            0x1f00: 0x200008,
		            0x1080: 0x8,
		            0x1180: 0x202000,
		            0x1280: 0x200000,
		            0x1380: 0x10000008,
		            0x1480: 0x10002000,
		            0x1580: 0x2008,
		            0x1680: 0x10202008,
		            0x1780: 0x10200000,
		            0x1880: 0x10202000,
		            0x1980: 0x10200008,
		            0x1a80: 0x2000,
		            0x1b80: 0x202008,
		            0x1c80: 0x200008,
		            0x1d80: 0x0,
		            0x1e80: 0x10000000,
		            0x1f80: 0x10002008
		        },
		        {
		            0x0: 0x100000,
		            0x10: 0x2000401,
		            0x20: 0x400,
		            0x30: 0x100401,
		            0x40: 0x2100401,
		            0x50: 0x0,
		            0x60: 0x1,
		            0x70: 0x2100001,
		            0x80: 0x2000400,
		            0x90: 0x100001,
		            0xa0: 0x2000001,
		            0xb0: 0x2100400,
		            0xc0: 0x2100000,
		            0xd0: 0x401,
		            0xe0: 0x100400,
		            0xf0: 0x2000000,
		            0x8: 0x2100001,
		            0x18: 0x0,
		            0x28: 0x2000401,
		            0x38: 0x2100400,
		            0x48: 0x100000,
		            0x58: 0x2000001,
		            0x68: 0x2000000,
		            0x78: 0x401,
		            0x88: 0x100401,
		            0x98: 0x2000400,
		            0xa8: 0x2100000,
		            0xb8: 0x100001,
		            0xc8: 0x400,
		            0xd8: 0x2100401,
		            0xe8: 0x1,
		            0xf8: 0x100400,
		            0x100: 0x2000000,
		            0x110: 0x100000,
		            0x120: 0x2000401,
		            0x130: 0x2100001,
		            0x140: 0x100001,
		            0x150: 0x2000400,
		            0x160: 0x2100400,
		            0x170: 0x100401,
		            0x180: 0x401,
		            0x190: 0x2100401,
		            0x1a0: 0x100400,
		            0x1b0: 0x1,
		            0x1c0: 0x0,
		            0x1d0: 0x2100000,
		            0x1e0: 0x2000001,
		            0x1f0: 0x400,
		            0x108: 0x100400,
		            0x118: 0x2000401,
		            0x128: 0x2100001,
		            0x138: 0x1,
		            0x148: 0x2000000,
		            0x158: 0x100000,
		            0x168: 0x401,
		            0x178: 0x2100400,
		            0x188: 0x2000001,
		            0x198: 0x2100000,
		            0x1a8: 0x0,
		            0x1b8: 0x2100401,
		            0x1c8: 0x100401,
		            0x1d8: 0x400,
		            0x1e8: 0x2000400,
		            0x1f8: 0x100001
		        },
		        {
		            0x0: 0x8000820,
		            0x1: 0x20000,
		            0x2: 0x8000000,
		            0x3: 0x20,
		            0x4: 0x20020,
		            0x5: 0x8020820,
		            0x6: 0x8020800,
		            0x7: 0x800,
		            0x8: 0x8020000,
		            0x9: 0x8000800,
		            0xa: 0x20800,
		            0xb: 0x8020020,
		            0xc: 0x820,
		            0xd: 0x0,
		            0xe: 0x8000020,
		            0xf: 0x20820,
		            0x80000000: 0x800,
		            0x80000001: 0x8020820,
		            0x80000002: 0x8000820,
		            0x80000003: 0x8000000,
		            0x80000004: 0x8020000,
		            0x80000005: 0x20800,
		            0x80000006: 0x20820,
		            0x80000007: 0x20,
		            0x80000008: 0x8000020,
		            0x80000009: 0x820,
		            0x8000000a: 0x20020,
		            0x8000000b: 0x8020800,
		            0x8000000c: 0x0,
		            0x8000000d: 0x8020020,
		            0x8000000e: 0x8000800,
		            0x8000000f: 0x20000,
		            0x10: 0x20820,
		            0x11: 0x8020800,
		            0x12: 0x20,
		            0x13: 0x800,
		            0x14: 0x8000800,
		            0x15: 0x8000020,
		            0x16: 0x8020020,
		            0x17: 0x20000,
		            0x18: 0x0,
		            0x19: 0x20020,
		            0x1a: 0x8020000,
		            0x1b: 0x8000820,
		            0x1c: 0x8020820,
		            0x1d: 0x20800,
		            0x1e: 0x820,
		            0x1f: 0x8000000,
		            0x80000010: 0x20000,
		            0x80000011: 0x800,
		            0x80000012: 0x8020020,
		            0x80000013: 0x20820,
		            0x80000014: 0x20,
		            0x80000015: 0x8020000,
		            0x80000016: 0x8000000,
		            0x80000017: 0x8000820,
		            0x80000018: 0x8020820,
		            0x80000019: 0x8000020,
		            0x8000001a: 0x8000800,
		            0x8000001b: 0x0,
		            0x8000001c: 0x20800,
		            0x8000001d: 0x820,
		            0x8000001e: 0x20020,
		            0x8000001f: 0x8020800
		        }
		    ];

		    // Masks that select the SBOX input
		    var SBOX_MASK = [
		        0xf8000001, 0x1f800000, 0x01f80000, 0x001f8000,
		        0x0001f800, 0x00001f80, 0x000001f8, 0x8000001f
		    ];

		    /**
		     * DES block cipher algorithm.
		     */
		    var DES = C_algo.DES = BlockCipher.extend({
		        _doReset: function () {
		            // Shortcuts
		            var key = this._key;
		            var keyWords = key.words;

		            // Select 56 bits according to PC1
		            var keyBits = [];
		            for (var i = 0; i < 56; i++) {
		                var keyBitPos = PC1[i] - 1;
		                keyBits[i] = (keyWords[keyBitPos >>> 5] >>> (31 - keyBitPos % 32)) & 1;
		            }

		            // Assemble 16 subkeys
		            var subKeys = this._subKeys = [];
		            for (var nSubKey = 0; nSubKey < 16; nSubKey++) {
		                // Create subkey
		                var subKey = subKeys[nSubKey] = [];

		                // Shortcut
		                var bitShift = BIT_SHIFTS[nSubKey];

		                // Select 48 bits according to PC2
		                for (var i = 0; i < 24; i++) {
		                    // Select from the left 28 key bits
		                    subKey[(i / 6) | 0] |= keyBits[((PC2[i] - 1) + bitShift) % 28] << (31 - i % 6);

		                    // Select from the right 28 key bits
		                    subKey[4 + ((i / 6) | 0)] |= keyBits[28 + (((PC2[i + 24] - 1) + bitShift) % 28)] << (31 - i % 6);
		                }

		                // Since each subkey is applied to an expanded 32-bit input,
		                // the subkey can be broken into 8 values scaled to 32-bits,
		                // which allows the key to be used without expansion
		                subKey[0] = (subKey[0] << 1) | (subKey[0] >>> 31);
		                for (var i = 1; i < 7; i++) {
		                    subKey[i] = subKey[i] >>> ((i - 1) * 4 + 3);
		                }
		                subKey[7] = (subKey[7] << 5) | (subKey[7] >>> 27);
		            }

		            // Compute inverse subkeys
		            var invSubKeys = this._invSubKeys = [];
		            for (var i = 0; i < 16; i++) {
		                invSubKeys[i] = subKeys[15 - i];
		            }
		        },

		        encryptBlock: function (M, offset) {
		            this._doCryptBlock(M, offset, this._subKeys);
		        },

		        decryptBlock: function (M, offset) {
		            this._doCryptBlock(M, offset, this._invSubKeys);
		        },

		        _doCryptBlock: function (M, offset, subKeys) {
		            // Get input
		            this._lBlock = M[offset];
		            this._rBlock = M[offset + 1];

		            // Initial permutation
		            exchangeLR.call(this, 4,  0x0f0f0f0f);
		            exchangeLR.call(this, 16, 0x0000ffff);
		            exchangeRL.call(this, 2,  0x33333333);
		            exchangeRL.call(this, 8,  0x00ff00ff);
		            exchangeLR.call(this, 1,  0x55555555);

		            // Rounds
		            for (var round = 0; round < 16; round++) {
		                // Shortcuts
		                var subKey = subKeys[round];
		                var lBlock = this._lBlock;
		                var rBlock = this._rBlock;

		                // Feistel function
		                var f = 0;
		                for (var i = 0; i < 8; i++) {
		                    f |= SBOX_P[i][((rBlock ^ subKey[i]) & SBOX_MASK[i]) >>> 0];
		                }
		                this._lBlock = rBlock;
		                this._rBlock = lBlock ^ f;
		            }

		            // Undo swap from last round
		            var t = this._lBlock;
		            this._lBlock = this._rBlock;
		            this._rBlock = t;

		            // Final permutation
		            exchangeLR.call(this, 1,  0x55555555);
		            exchangeRL.call(this, 8,  0x00ff00ff);
		            exchangeRL.call(this, 2,  0x33333333);
		            exchangeLR.call(this, 16, 0x0000ffff);
		            exchangeLR.call(this, 4,  0x0f0f0f0f);

		            // Set output
		            M[offset] = this._lBlock;
		            M[offset + 1] = this._rBlock;
		        },

		        keySize: 64/32,

		        ivSize: 64/32,

		        blockSize: 64/32
		    });

		    // Swap bits across the left and right words
		    function exchangeLR(offset, mask) {
		        var t = ((this._lBlock >>> offset) ^ this._rBlock) & mask;
		        this._rBlock ^= t;
		        this._lBlock ^= t << offset;
		    }

		    function exchangeRL(offset, mask) {
		        var t = ((this._rBlock >>> offset) ^ this._lBlock) & mask;
		        this._lBlock ^= t;
		        this._rBlock ^= t << offset;
		    }

		    /**
		     * Shortcut functions to the cipher's object interface.
		     *
		     * @example
		     *
		     *     var ciphertext = CryptoJS.DES.encrypt(message, key, cfg);
		     *     var plaintext  = CryptoJS.DES.decrypt(ciphertext, key, cfg);
		     */
		    C.DES = BlockCipher._createHelper(DES);

		    /**
		     * Triple-DES block cipher algorithm.
		     */
		    var TripleDES = C_algo.TripleDES = BlockCipher.extend({
		        _doReset: function () {
		            // Shortcuts
		            var key = this._key;
		            var keyWords = key.words;

		            // Create DES instances
		            this._des1 = DES.createEncryptor(WordArray.create(keyWords.slice(0, 2)));
		            this._des2 = DES.createEncryptor(WordArray.create(keyWords.slice(2, 4)));
		            this._des3 = DES.createEncryptor(WordArray.create(keyWords.slice(4, 6)));
		        },

		        encryptBlock: function (M, offset) {
		            this._des1.encryptBlock(M, offset);
		            this._des2.decryptBlock(M, offset);
		            this._des3.encryptBlock(M, offset);
		        },

		        decryptBlock: function (M, offset) {
		            this._des3.decryptBlock(M, offset);
		            this._des2.encryptBlock(M, offset);
		            this._des1.decryptBlock(M, offset);
		        },

		        keySize: 192/32,

		        ivSize: 64/32,

		        blockSize: 64/32
		    });

		    /**
		     * Shortcut functions to the cipher's object interface.
		     *
		     * @example
		     *
		     *     var ciphertext = CryptoJS.TripleDES.encrypt(message, key, cfg);
		     *     var plaintext  = CryptoJS.TripleDES.decrypt(ciphertext, key, cfg);
		     */
		    C.TripleDES = BlockCipher._createHelper(TripleDES);
		}());


		return CryptoJS.TripleDES;

	}));

/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(11), __webpack_require__(12), __webpack_require__(22), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var StreamCipher = C_lib.StreamCipher;
		    var C_algo = C.algo;

		    /**
		     * RC4 stream cipher algorithm.
		     */
		    var RC4 = C_algo.RC4 = StreamCipher.extend({
		        _doReset: function () {
		            // Shortcuts
		            var key = this._key;
		            var keyWords = key.words;
		            var keySigBytes = key.sigBytes;

		            // Init sbox
		            var S = this._S = [];
		            for (var i = 0; i < 256; i++) {
		                S[i] = i;
		            }

		            // Key setup
		            for (var i = 0, j = 0; i < 256; i++) {
		                var keyByteIndex = i % keySigBytes;
		                var keyByte = (keyWords[keyByteIndex >>> 2] >>> (24 - (keyByteIndex % 4) * 8)) & 0xff;

		                j = (j + S[i] + keyByte) % 256;

		                // Swap
		                var t = S[i];
		                S[i] = S[j];
		                S[j] = t;
		            }

		            // Counters
		            this._i = this._j = 0;
		        },

		        _doProcessBlock: function (M, offset) {
		            M[offset] ^= generateKeystreamWord.call(this);
		        },

		        keySize: 256/32,

		        ivSize: 0
		    });

		    function generateKeystreamWord() {
		        // Shortcuts
		        var S = this._S;
		        var i = this._i;
		        var j = this._j;

		        // Generate keystream word
		        var keystreamWord = 0;
		        for (var n = 0; n < 4; n++) {
		            i = (i + 1) % 256;
		            j = (j + S[i]) % 256;

		            // Swap
		            var t = S[i];
		            S[i] = S[j];
		            S[j] = t;

		            keystreamWord |= S[(S[i] + S[j]) % 256] << (24 - n * 8);
		        }

		        // Update counters
		        this._i = i;
		        this._j = j;

		        return keystreamWord;
		    }

		    /**
		     * Shortcut functions to the cipher's object interface.
		     *
		     * @example
		     *
		     *     var ciphertext = CryptoJS.RC4.encrypt(message, key, cfg);
		     *     var plaintext  = CryptoJS.RC4.decrypt(ciphertext, key, cfg);
		     */
		    C.RC4 = StreamCipher._createHelper(RC4);

		    /**
		     * Modified RC4 stream cipher algorithm.
		     */
		    var RC4Drop = C_algo.RC4Drop = RC4.extend({
		        /**
		         * Configuration options.
		         *
		         * @property {number} drop The number of keystream words to drop. Default 192
		         */
		        cfg: RC4.cfg.extend({
		            drop: 192
		        }),

		        _doReset: function () {
		            RC4._doReset.call(this);

		            // Drop
		            for (var i = this.cfg.drop; i > 0; i--) {
		                generateKeystreamWord.call(this);
		            }
		        }
		    });

		    /**
		     * Shortcut functions to the cipher's object interface.
		     *
		     * @example
		     *
		     *     var ciphertext = CryptoJS.RC4Drop.encrypt(message, key, cfg);
		     *     var plaintext  = CryptoJS.RC4Drop.decrypt(ciphertext, key, cfg);
		     */
		    C.RC4Drop = StreamCipher._createHelper(RC4Drop);
		}());


		return CryptoJS.RC4;

	}));

/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(11), __webpack_require__(12), __webpack_require__(22), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var StreamCipher = C_lib.StreamCipher;
		    var C_algo = C.algo;

		    // Reusable objects
		    var S  = [];
		    var C_ = [];
		    var G  = [];

		    /**
		     * Rabbit stream cipher algorithm
		     */
		    var Rabbit = C_algo.Rabbit = StreamCipher.extend({
		        _doReset: function () {
		            // Shortcuts
		            var K = this._key.words;
		            var iv = this.cfg.iv;

		            // Swap endian
		            for (var i = 0; i < 4; i++) {
		                K[i] = (((K[i] << 8)  | (K[i] >>> 24)) & 0x00ff00ff) |
		                       (((K[i] << 24) | (K[i] >>> 8))  & 0xff00ff00);
		            }

		            // Generate initial state values
		            var X = this._X = [
		                K[0], (K[3] << 16) | (K[2] >>> 16),
		                K[1], (K[0] << 16) | (K[3] >>> 16),
		                K[2], (K[1] << 16) | (K[0] >>> 16),
		                K[3], (K[2] << 16) | (K[1] >>> 16)
		            ];

		            // Generate initial counter values
		            var C = this._C = [
		                (K[2] << 16) | (K[2] >>> 16), (K[0] & 0xffff0000) | (K[1] & 0x0000ffff),
		                (K[3] << 16) | (K[3] >>> 16), (K[1] & 0xffff0000) | (K[2] & 0x0000ffff),
		                (K[0] << 16) | (K[0] >>> 16), (K[2] & 0xffff0000) | (K[3] & 0x0000ffff),
		                (K[1] << 16) | (K[1] >>> 16), (K[3] & 0xffff0000) | (K[0] & 0x0000ffff)
		            ];

		            // Carry bit
		            this._b = 0;

		            // Iterate the system four times
		            for (var i = 0; i < 4; i++) {
		                nextState.call(this);
		            }

		            // Modify the counters
		            for (var i = 0; i < 8; i++) {
		                C[i] ^= X[(i + 4) & 7];
		            }

		            // IV setup
		            if (iv) {
		                // Shortcuts
		                var IV = iv.words;
		                var IV_0 = IV[0];
		                var IV_1 = IV[1];

		                // Generate four subvectors
		                var i0 = (((IV_0 << 8) | (IV_0 >>> 24)) & 0x00ff00ff) | (((IV_0 << 24) | (IV_0 >>> 8)) & 0xff00ff00);
		                var i2 = (((IV_1 << 8) | (IV_1 >>> 24)) & 0x00ff00ff) | (((IV_1 << 24) | (IV_1 >>> 8)) & 0xff00ff00);
		                var i1 = (i0 >>> 16) | (i2 & 0xffff0000);
		                var i3 = (i2 << 16)  | (i0 & 0x0000ffff);

		                // Modify counter values
		                C[0] ^= i0;
		                C[1] ^= i1;
		                C[2] ^= i2;
		                C[3] ^= i3;
		                C[4] ^= i0;
		                C[5] ^= i1;
		                C[6] ^= i2;
		                C[7] ^= i3;

		                // Iterate the system four times
		                for (var i = 0; i < 4; i++) {
		                    nextState.call(this);
		                }
		            }
		        },

		        _doProcessBlock: function (M, offset) {
		            // Shortcut
		            var X = this._X;

		            // Iterate the system
		            nextState.call(this);

		            // Generate four keystream words
		            S[0] = X[0] ^ (X[5] >>> 16) ^ (X[3] << 16);
		            S[1] = X[2] ^ (X[7] >>> 16) ^ (X[5] << 16);
		            S[2] = X[4] ^ (X[1] >>> 16) ^ (X[7] << 16);
		            S[3] = X[6] ^ (X[3] >>> 16) ^ (X[1] << 16);

		            for (var i = 0; i < 4; i++) {
		                // Swap endian
		                S[i] = (((S[i] << 8)  | (S[i] >>> 24)) & 0x00ff00ff) |
		                       (((S[i] << 24) | (S[i] >>> 8))  & 0xff00ff00);

		                // Encrypt
		                M[offset + i] ^= S[i];
		            }
		        },

		        blockSize: 128/32,

		        ivSize: 64/32
		    });

		    function nextState() {
		        // Shortcuts
		        var X = this._X;
		        var C = this._C;

		        // Save old counter values
		        for (var i = 0; i < 8; i++) {
		            C_[i] = C[i];
		        }

		        // Calculate new counter values
		        C[0] = (C[0] + 0x4d34d34d + this._b) | 0;
		        C[1] = (C[1] + 0xd34d34d3 + ((C[0] >>> 0) < (C_[0] >>> 0) ? 1 : 0)) | 0;
		        C[2] = (C[2] + 0x34d34d34 + ((C[1] >>> 0) < (C_[1] >>> 0) ? 1 : 0)) | 0;
		        C[3] = (C[3] + 0x4d34d34d + ((C[2] >>> 0) < (C_[2] >>> 0) ? 1 : 0)) | 0;
		        C[4] = (C[4] + 0xd34d34d3 + ((C[3] >>> 0) < (C_[3] >>> 0) ? 1 : 0)) | 0;
		        C[5] = (C[5] + 0x34d34d34 + ((C[4] >>> 0) < (C_[4] >>> 0) ? 1 : 0)) | 0;
		        C[6] = (C[6] + 0x4d34d34d + ((C[5] >>> 0) < (C_[5] >>> 0) ? 1 : 0)) | 0;
		        C[7] = (C[7] + 0xd34d34d3 + ((C[6] >>> 0) < (C_[6] >>> 0) ? 1 : 0)) | 0;
		        this._b = (C[7] >>> 0) < (C_[7] >>> 0) ? 1 : 0;

		        // Calculate the g-values
		        for (var i = 0; i < 8; i++) {
		            var gx = X[i] + C[i];

		            // Construct high and low argument for squaring
		            var ga = gx & 0xffff;
		            var gb = gx >>> 16;

		            // Calculate high and low result of squaring
		            var gh = ((((ga * ga) >>> 17) + ga * gb) >>> 15) + gb * gb;
		            var gl = (((gx & 0xffff0000) * gx) | 0) + (((gx & 0x0000ffff) * gx) | 0);

		            // High XOR low
		            G[i] = gh ^ gl;
		        }

		        // Calculate new state values
		        X[0] = (G[0] + ((G[7] << 16) | (G[7] >>> 16)) + ((G[6] << 16) | (G[6] >>> 16))) | 0;
		        X[1] = (G[1] + ((G[0] << 8)  | (G[0] >>> 24)) + G[7]) | 0;
		        X[2] = (G[2] + ((G[1] << 16) | (G[1] >>> 16)) + ((G[0] << 16) | (G[0] >>> 16))) | 0;
		        X[3] = (G[3] + ((G[2] << 8)  | (G[2] >>> 24)) + G[1]) | 0;
		        X[4] = (G[4] + ((G[3] << 16) | (G[3] >>> 16)) + ((G[2] << 16) | (G[2] >>> 16))) | 0;
		        X[5] = (G[5] + ((G[4] << 8)  | (G[4] >>> 24)) + G[3]) | 0;
		        X[6] = (G[6] + ((G[5] << 16) | (G[5] >>> 16)) + ((G[4] << 16) | (G[4] >>> 16))) | 0;
		        X[7] = (G[7] + ((G[6] << 8)  | (G[6] >>> 24)) + G[5]) | 0;
		    }

		    /**
		     * Shortcut functions to the cipher's object interface.
		     *
		     * @example
		     *
		     *     var ciphertext = CryptoJS.Rabbit.encrypt(message, key, cfg);
		     *     var plaintext  = CryptoJS.Rabbit.decrypt(ciphertext, key, cfg);
		     */
		    C.Rabbit = StreamCipher._createHelper(Rabbit);
		}());


		return CryptoJS.Rabbit;

	}));

/***/ },
/* 39 */
/***/ function(module, exports, __webpack_require__) {

	;(function (root, factory, undef) {
		if (true) {
			// CommonJS
			module.exports = exports = factory(__webpack_require__(7), __webpack_require__(11), __webpack_require__(12), __webpack_require__(22), __webpack_require__(23));
		}
		else if (typeof define === "function" && define.amd) {
			// AMD
			define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
		}
		else {
			// Global (browser)
			factory(root.CryptoJS);
		}
	}(this, function (CryptoJS) {

		(function () {
		    // Shortcuts
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var StreamCipher = C_lib.StreamCipher;
		    var C_algo = C.algo;

		    // Reusable objects
		    var S  = [];
		    var C_ = [];
		    var G  = [];

		    /**
		     * Rabbit stream cipher algorithm.
		     *
		     * This is a legacy version that neglected to convert the key to little-endian.
		     * This error doesn't affect the cipher's security,
		     * but it does affect its compatibility with other implementations.
		     */
		    var RabbitLegacy = C_algo.RabbitLegacy = StreamCipher.extend({
		        _doReset: function () {
		            // Shortcuts
		            var K = this._key.words;
		            var iv = this.cfg.iv;

		            // Generate initial state values
		            var X = this._X = [
		                K[0], (K[3] << 16) | (K[2] >>> 16),
		                K[1], (K[0] << 16) | (K[3] >>> 16),
		                K[2], (K[1] << 16) | (K[0] >>> 16),
		                K[3], (K[2] << 16) | (K[1] >>> 16)
		            ];

		            // Generate initial counter values
		            var C = this._C = [
		                (K[2] << 16) | (K[2] >>> 16), (K[0] & 0xffff0000) | (K[1] & 0x0000ffff),
		                (K[3] << 16) | (K[3] >>> 16), (K[1] & 0xffff0000) | (K[2] & 0x0000ffff),
		                (K[0] << 16) | (K[0] >>> 16), (K[2] & 0xffff0000) | (K[3] & 0x0000ffff),
		                (K[1] << 16) | (K[1] >>> 16), (K[3] & 0xffff0000) | (K[0] & 0x0000ffff)
		            ];

		            // Carry bit
		            this._b = 0;

		            // Iterate the system four times
		            for (var i = 0; i < 4; i++) {
		                nextState.call(this);
		            }

		            // Modify the counters
		            for (var i = 0; i < 8; i++) {
		                C[i] ^= X[(i + 4) & 7];
		            }

		            // IV setup
		            if (iv) {
		                // Shortcuts
		                var IV = iv.words;
		                var IV_0 = IV[0];
		                var IV_1 = IV[1];

		                // Generate four subvectors
		                var i0 = (((IV_0 << 8) | (IV_0 >>> 24)) & 0x00ff00ff) | (((IV_0 << 24) | (IV_0 >>> 8)) & 0xff00ff00);
		                var i2 = (((IV_1 << 8) | (IV_1 >>> 24)) & 0x00ff00ff) | (((IV_1 << 24) | (IV_1 >>> 8)) & 0xff00ff00);
		                var i1 = (i0 >>> 16) | (i2 & 0xffff0000);
		                var i3 = (i2 << 16)  | (i0 & 0x0000ffff);

		                // Modify counter values
		                C[0] ^= i0;
		                C[1] ^= i1;
		                C[2] ^= i2;
		                C[3] ^= i3;
		                C[4] ^= i0;
		                C[5] ^= i1;
		                C[6] ^= i2;
		                C[7] ^= i3;

		                // Iterate the system four times
		                for (var i = 0; i < 4; i++) {
		                    nextState.call(this);
		                }
		            }
		        },

		        _doProcessBlock: function (M, offset) {
		            // Shortcut
		            var X = this._X;

		            // Iterate the system
		            nextState.call(this);

		            // Generate four keystream words
		            S[0] = X[0] ^ (X[5] >>> 16) ^ (X[3] << 16);
		            S[1] = X[2] ^ (X[7] >>> 16) ^ (X[5] << 16);
		            S[2] = X[4] ^ (X[1] >>> 16) ^ (X[7] << 16);
		            S[3] = X[6] ^ (X[3] >>> 16) ^ (X[1] << 16);

		            for (var i = 0; i < 4; i++) {
		                // Swap endian
		                S[i] = (((S[i] << 8)  | (S[i] >>> 24)) & 0x00ff00ff) |
		                       (((S[i] << 24) | (S[i] >>> 8))  & 0xff00ff00);

		                // Encrypt
		                M[offset + i] ^= S[i];
		            }
		        },

		        blockSize: 128/32,

		        ivSize: 64/32
		    });

		    function nextState() {
		        // Shortcuts
		        var X = this._X;
		        var C = this._C;

		        // Save old counter values
		        for (var i = 0; i < 8; i++) {
		            C_[i] = C[i];
		        }

		        // Calculate new counter values
		        C[0] = (C[0] + 0x4d34d34d + this._b) | 0;
		        C[1] = (C[1] + 0xd34d34d3 + ((C[0] >>> 0) < (C_[0] >>> 0) ? 1 : 0)) | 0;
		        C[2] = (C[2] + 0x34d34d34 + ((C[1] >>> 0) < (C_[1] >>> 0) ? 1 : 0)) | 0;
		        C[3] = (C[3] + 0x4d34d34d + ((C[2] >>> 0) < (C_[2] >>> 0) ? 1 : 0)) | 0;
		        C[4] = (C[4] + 0xd34d34d3 + ((C[3] >>> 0) < (C_[3] >>> 0) ? 1 : 0)) | 0;
		        C[5] = (C[5] + 0x34d34d34 + ((C[4] >>> 0) < (C_[4] >>> 0) ? 1 : 0)) | 0;
		        C[6] = (C[6] + 0x4d34d34d + ((C[5] >>> 0) < (C_[5] >>> 0) ? 1 : 0)) | 0;
		        C[7] = (C[7] + 0xd34d34d3 + ((C[6] >>> 0) < (C_[6] >>> 0) ? 1 : 0)) | 0;
		        this._b = (C[7] >>> 0) < (C_[7] >>> 0) ? 1 : 0;

		        // Calculate the g-values
		        for (var i = 0; i < 8; i++) {
		            var gx = X[i] + C[i];

		            // Construct high and low argument for squaring
		            var ga = gx & 0xffff;
		            var gb = gx >>> 16;

		            // Calculate high and low result of squaring
		            var gh = ((((ga * ga) >>> 17) + ga * gb) >>> 15) + gb * gb;
		            var gl = (((gx & 0xffff0000) * gx) | 0) + (((gx & 0x0000ffff) * gx) | 0);

		            // High XOR low
		            G[i] = gh ^ gl;
		        }

		        // Calculate new state values
		        X[0] = (G[0] + ((G[7] << 16) | (G[7] >>> 16)) + ((G[6] << 16) | (G[6] >>> 16))) | 0;
		        X[1] = (G[1] + ((G[0] << 8)  | (G[0] >>> 24)) + G[7]) | 0;
		        X[2] = (G[2] + ((G[1] << 16) | (G[1] >>> 16)) + ((G[0] << 16) | (G[0] >>> 16))) | 0;
		        X[3] = (G[3] + ((G[2] << 8)  | (G[2] >>> 24)) + G[1]) | 0;
		        X[4] = (G[4] + ((G[3] << 16) | (G[3] >>> 16)) + ((G[2] << 16) | (G[2] >>> 16))) | 0;
		        X[5] = (G[5] + ((G[4] << 8)  | (G[4] >>> 24)) + G[3]) | 0;
		        X[6] = (G[6] + ((G[5] << 16) | (G[5] >>> 16)) + ((G[4] << 16) | (G[4] >>> 16))) | 0;
		        X[7] = (G[7] + ((G[6] << 8)  | (G[6] >>> 24)) + G[5]) | 0;
		    }

		    /**
		     * Shortcut functions to the cipher's object interface.
		     *
		     * @example
		     *
		     *     var ciphertext = CryptoJS.RabbitLegacy.encrypt(message, key, cfg);
		     *     var plaintext  = CryptoJS.RabbitLegacy.decrypt(ciphertext, key, cfg);
		     */
		    C.RabbitLegacy = StreamCipher._createHelper(RabbitLegacy);
		}());


		return CryptoJS.RabbitLegacy;

	}));

/***/ },
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var bigInt = (function () {
	    var base = 10000000, logBase = 7, zeros = "0000000";
	    var sign = {
	        positive: false,
	        negative: true
	    };

	    function BigInteger(value, sign) {
	        this.value = value;
	        this.sign = sign;
	    }

	    function trim(value) {
	        while (value[value.length - 1] === 0 && value.length > 1) value.pop();
	        return value;
	    }

	    function fastAdd(a, b) {
	        var sign = b < 0;
	        if (a.sign !== sign) {
	            if(sign) return fastSubtract(a.abs(), -b);
	            return fastSubtract(a.abs(), b).negate();
	        }
	        if (sign) b = -b;
	        var value = a.value,
	            result = [],
	            carry = 0;
	        for (var i = 0; i < value.length || carry > 0; i++) {
	            var sum = (value[i] || 0) + (i > 0 ? 0 : b) + carry;
	            carry = sum >= base ? 1 : 0;
	            result.push(sum % base);
	        }
	        return new BigInteger(trim(result), a.sign);
	    }

	    function fastSubtract(a, b) {
	        var value = a.value;
	        if (value.length === 1) {
	            value = value[0];
	            if (a.sign) value = -value;
	            return new BigInteger([Math.abs(value - b)], (value - b) < 0);
	        }
	        if (a.sign !== (b < 0)) return fastAdd(a, -b);
	        var sign = false;
	        if (a.sign) sign = true;
	        if (value.length === 1 && value[0] < b) return new BigInteger([b - value[0]], !sign);
	        if (sign) b = -b;
	        var result = [],
	            borrow = 0;
	        for (var i = 0; i < value.length; i++) {
	            var tmp = value[i] - borrow - (i > 0 ? 0 : b);
	            borrow = tmp < 0 ? 1 : 0;
	            result.push((borrow * base) + tmp);
	        }

	        return new BigInteger(trim(result), sign);
	    }

	    function fastMultiplyInternal(value, lambda) {
	        var result = [];
	        var carry = 0;
	        for (var i = 0; i < value.length; i++) {
	            carry += lambda * value[i];
	            var q = Math.floor(carry / base);
	            result[i] = (carry - q * base) | 0;
	            carry = q;
	        }
	        result[value.length] = carry | 0;
	        return result;
	    }

	    function fastMultiply(a, b) {
	        var result = fastMultiplyInternal(a.value, b < 0 ? -b : b);
	        return new BigInteger(trim(result), b < 0 ? !a.sign : a.sign);
	    }

	    function fastDivModInternal(value, lambda) {
	        var quotient = [];
	        for (var i = 0; i < value.length; i++) {
	            quotient[i] = 0;
	        }
	        var remainder = 0;
	        for (var i = value.length - 1; i >= 0; i--) {
	            var divisor = remainder * base + value[i];
	            var q = Math.floor(divisor / lambda);
	            remainder = divisor - q * lambda;
	            quotient[i] = q | 0;
	        }
	        return {
	          quotient: quotient,
	          remainder: remainder | 0
	        };
	    }

	    function fastDivMod(a, b) {
	        if (b === 0) throw new Error("Cannot divide by zero.");
	        var result = fastDivModInternal(a.value, b < 0 ? -b : b);
	        return {
	            quotient: new BigInteger(trim(result.quotient), b < 0 ? !a.sign : a.sign),
	            remainder: new BigInteger([result.remainder], a.sign)
	        };
	    }

	    function isSmall(n) {
	        return ((typeof n === "number" || typeof n === "string") && +Math.abs(n) <= base) ||
	            (n instanceof BigInteger && n.value.length <= 1);
	    }

	    BigInteger.prototype.negate = function () {
	        return new BigInteger(this.value, !this.sign);
	    };
	    BigInteger.prototype.abs = function () {
	        return new BigInteger(this.value, sign.positive);
	    };
	    BigInteger.prototype.add = function (n) {
	        if(isSmall(n)) return fastAdd(this, +n);
	        n = parseInput(n);
	        if (this.sign !== n.sign) {
	            if (this.sign === sign.positive) return this.abs().subtract(n.abs());
	            return n.abs().subtract(this.abs());
	        }
	        var a = this.value, b = n.value;
	        var result = [],
	            carry = 0,
	            length = Math.max(a.length, b.length);
	        for (var i = 0; i < length || carry > 0; i++) {
	            var sum = (a[i] || 0) + (b[i] || 0) + carry;
	            carry = sum >= base ? 1 : 0;
	            result.push(sum % base);
	        }
	        return new BigInteger(trim(result), this.sign);
	    };
	    BigInteger.prototype.plus = BigInteger.prototype.add;

	    BigInteger.prototype.subtract = function (n) {
	        if (isSmall(n)) return fastSubtract(this, +n);
	        n = parseInput(n);
	        if (this.sign !== n.sign) return this.add(n.negate());
	        if (this.sign === sign.negative) return n.negate().subtract(this.negate());
	        if (this.compare(n) < 0) return n.subtract(this).negate();
	        var a = this.value, b = n.value;
	        var result = [],
	            borrow = 0,
	            length = Math.max(a.length, b.length);
	        for (var i = 0; i < length; i++) {
	            var ai = a[i] || 0, bi = b[i] || 0;
	            var tmp = ai - borrow;
	            borrow = tmp < bi ? 1 : 0;
	            result.push((borrow * base) + tmp - bi);
	        }
	        return new BigInteger(trim(result), sign.positive);
	    };
	    BigInteger.prototype.minus = BigInteger.prototype.subtract;

	    BigInteger.prototype.multiply = function (n) {
	        if (isSmall(n)) return fastMultiply(this, +n);
	        n = parseInput(n);
	        var sign = this.sign !== n.sign;

	        var a = this.value, b = n.value;
	        var result = [];
	        for (var i = a.length + b.length; i > 0; i--) {
	            result.push(0);
	        }
	        for (var i = 0; i < a.length; i++) {
	            var x = a[i];
	            for (var j = 0; j < b.length; j++) {
	                var y = b[j];
	                var product = x * y + result[i+j];
	                var q = Math.floor(product / base);
	                result[i+j] = product - q * base;
	                result[i+j+1] += q;
	            }
	        }
	        return new BigInteger(trim(result), sign);
	    };
	    BigInteger.prototype.times = BigInteger.prototype.multiply;

	    BigInteger.prototype.divmod = function (n) {
	        if (isSmall(n)) return fastDivMod(this, +n);
	        n = parseInput(n);
	        var quotientSign = this.sign !== n.sign;
	        if (n.equals(ZERO)) throw new Error("Cannot divide by zero");
	        if (this.equals(ZERO)) return {
	            quotient: new BigInteger([0], sign.positive),
	            remainder: new BigInteger([0], sign.positive)
	        };
	        var a = this.value, b = n.value;
	        var result = [0];
	        for (var i = 0; i < b.length; i++) {
	            result[i] = 0;
	        }
	        var divisorMostSignificantDigit = b[b.length - 1];
	        // normalization
	        var lambda = Math.ceil(base / 2 / divisorMostSignificantDigit);
	        var remainder = fastMultiplyInternal(a, lambda);
	        var divisor = fastMultiplyInternal(b, lambda);
	        divisorMostSignificantDigit = divisor[b.length - 1];
	        for (var shift = a.length - b.length; shift >= 0; shift--) {
	            var quotientDigit = base - 1;
	            if (remainder[shift + b.length] !== divisorMostSignificantDigit) {
	                quotientDigit = Math.floor((remainder[shift + b.length] * base + remainder[shift + b.length - 1]) / divisorMostSignificantDigit);
	            }
	            // remainder -= quotientDigit * divisor
	            var carry = 0;
	            var borrow = 0;
	            for (var i = 0; i < divisor.length; i++) {
	                carry += quotientDigit * divisor[i];
	                var q = Math.floor(carry / base);
	                borrow += remainder[shift + i] - (carry - q * base);
	                carry = q;
	                if (borrow < 0) {
	                    remainder[shift + i] = (borrow + base) | 0;
	                    borrow = -1;
	                } else {
	                    remainder[shift + i] = borrow | 0;
	                    borrow = 0;
	                }
	            }
	            while (borrow !== 0) {
	                quotientDigit -= 1;
	                var carry = 0;
	                for (var i = 0; i < divisor.length; i++) {
	                    carry += remainder[shift + i] - base + divisor[i];
	                    if (carry < 0) {
	                        remainder[shift + i] = (carry + base) | 0;
	                        carry = 0;
	                    } else {
	                        remainder[shift + i] = carry | 0;
	                        carry = +1;
	                    }
	                }
	                borrow += carry;
	            }
	            result[shift] = quotientDigit | 0;
	        }
	        // denormalization
	        remainder = fastDivModInternal(remainder, lambda).quotient;
	        return {
	            quotient: new BigInteger(trim(result), quotientSign),
	            remainder: new BigInteger(trim(remainder), this.sign)
	        };
	    };
	    BigInteger.prototype.divide = function (n) {
	        return this.divmod(n).quotient;
	    };
	    BigInteger.prototype.over = BigInteger.prototype.divide;

	    BigInteger.prototype.mod = function (n) {
	        return this.divmod(n).remainder;
	    };
	    BigInteger.prototype.remainder = BigInteger.prototype.mod;

	    BigInteger.prototype.pow = function (n) {
	        n = parseInput(n);
	        var a = this, b = n, r = ONE;
	        if (b.equals(ZERO)) return r;
	        if (a.equals(ZERO) || b.lesser(ZERO)) return ZERO;
	        while (true) {
	            if (b.isOdd()) {
	                r = r.times(a);
	            }
	            b = b.divide(2);
	            if (b.equals(ZERO)) break;
	            a = a.times(a);
	        }
	        return r;
	    };
	    BigInteger.prototype.modPow = function (exp, mod) {
	        exp = parseInput(exp);
	        mod = parseInput(mod);
	        if (mod.equals(ZERO)) throw new Error("Cannot take modPow with modulus 0");
	        var r = ONE,
	            base = this.mod(mod);
	        if (base.equals(ZERO)) return ZERO;
	        while (exp.greater(0)) {
	            if (exp.isOdd()) r = r.multiply(base).mod(mod);
	            exp = exp.divide(2);
	            base = base.square().mod(mod);
	        }
	        return r;
	    };
	    BigInteger.prototype.square = function () {
	        return this.multiply(this);
	    };
	    function gcd(a, b) {
	        a = parseInput(a).abs();
	        b = parseInput(b).abs();
	        if (a.equals(b)) return a;
	        if (a.equals(ZERO)) return b;
	        if (b.equals(ZERO)) return a;
	        if (a.isEven()) {
	            if (b.isOdd()) {
	                return gcd(a.divide(2), b);
	            }
	            return gcd(a.divide(2), b.divide(2)).multiply(2);
	        }
	        if (b.isEven()) {
	            return gcd(a, b.divide(2));
	        }
	        if (a.greater(b)) {
	            return gcd(a.subtract(b).divide(2), b);
	        }
	        return gcd(b.subtract(a).divide(2), a);
	    }
	    function lcm(a, b) {
	        a = parseInput(a).abs();
	        b = parseInput(b).abs();
	        return a.multiply(b).divide(gcd(a, b));
	    }
	    BigInteger.prototype.next = function () {
	        return fastAdd(this, 1);
	    };
	    BigInteger.prototype.prev = function () {
	        return fastSubtract(this, 1);
	    };
	    BigInteger.prototype.compare = function (n) {
	        var first = this, second = parseInput(n);
	        if (first.value.length === 1 && second.value.length === 1 && first.value[0] === 0 && second.value[0] === 0) return 0;
	        if (second.sign !== first.sign) return first.sign === sign.positive ? 1 : -1;
	        var multiplier = first.sign === sign.positive ? 1 : -1;
	        var a = first.value, b = second.value,
	            length = Math.max(a.length, b.length) - 1;
	        for (var i = length; i >= 0; i--) {
	            var ai = (a[i] || 0), bi = (b[i] || 0);
	            if (ai > bi) return 1 * multiplier;
	            if (bi > ai) return -1 * multiplier;
	        }
	        return 0;
	    };

	    BigInteger.prototype.compareAbs = function (n) {
	        return this.abs().compare(n.abs());
	    };
	    BigInteger.prototype.equals = function (n) {
	        return this.compare(n) === 0;
	    };
	    BigInteger.prototype.notEquals = function (n) {
	        return !this.equals(n);
	    };
	    BigInteger.prototype.lesser = function (n) {
	        return this.compare(n) < 0;
	    };
	    BigInteger.prototype.greater = function (n) {
	        return this.compare(n) > 0;
	    };
	    BigInteger.prototype.greaterOrEquals = function (n) {
	        return this.compare(n) >= 0;
	    };
	    BigInteger.prototype.lesserOrEquals = function (n) {
	        return this.compare(n) <= 0;
	    };

	    BigInteger.prototype.compareTo = BigInteger.prototype.compare;
	    BigInteger.prototype.lt = BigInteger.prototype.lesser;
	    BigInteger.prototype.leq = BigInteger.prototype.lesserOrEquals;
	    BigInteger.prototype.gt = BigInteger.prototype.greater;
	    BigInteger.prototype.geq = BigInteger.prototype.greaterOrEquals;
	    BigInteger.prototype.eq = BigInteger.prototype.equals;
	    BigInteger.prototype.neq = BigInteger.prototype.notEquals;

	    function max (a, b) {
	        a = parseInput(a);
	        b = parseInput(b);
	        return a.greater(b) ? a : b;
	    }
	    function min (a, b) {
	        a = parseInput(a);
	        b = parseInput(b);
	        return a.lesser(b) ? a : b;
	    }
	    BigInteger.prototype.isPositive = function () {
	        if (this.value.length === 1 && this.value[0] === 0) return false;
	        return this.sign === sign.positive;
	    };
	    BigInteger.prototype.isNegative = function () {
	        if (this.value.length === 1 && this.value[0] === 0) return false;
	        return this.sign === sign.negative;
	    };
	    BigInteger.prototype.isEven = function () {
	        return this.value[0] % 2 === 0;
	    };
	    BigInteger.prototype.isOdd = function () {
	        return this.value[0] % 2 === 1;
	    };
	    BigInteger.prototype.isUnit = function () {
	        return this.value.length === 1 && this.value[0] === 1;
	    };
	    BigInteger.prototype.isZero = function () {
	        return this.value.length === 1 && this.value[0] === 0;
	    };
	    BigInteger.prototype.isDivisibleBy = function (n) {
	        n = parseInput(n);
	        if (n.isZero()) return false;
	        return this.mod(n).equals(ZERO);
	    };
	    BigInteger.prototype.isPrime = function () {
	        var n = this.abs(),
	            nPrev = n.prev();
	        if (n.isUnit()) return false;
	        if (n.equals(2) || n.equals(3) || n.equals(5)) return true;
	        if (n.isEven() || n.isDivisibleBy(3) || n.isDivisibleBy(5)) return false;
	        if (n.lesser(25)) return true;
	        var a = [2, 3, 5, 7, 11, 13, 17, 19],
	            b = nPrev,
	            d, t, i, x;
	        while (b.isEven()) b = b.divide(2);
	        for (i = 0; i < a.length; i++) {
	            x = bigInt(a[i]).modPow(b, n);
	            if (x.equals(ONE) || x.equals(nPrev)) continue;
	            for (t = true, d = b; t && d.lesser(nPrev); d = d.multiply(2)) {
	                x = x.square().mod(n);
	                if (x.equals(nPrev)) t = false;
	            }
	            if (t) return false;
	        }
	        return true;
	    };
	    function randBetween (a, b) {
	        a = parseInput(a);
	        b = parseInput(b);
	        var low = min(a, b), high = max(a, b);
	        var range = high.subtract(low);
	        var length = range.value.length - 1;
	        var result = [], restricted = true;
	        for (var i = length; i >= 0; i--) {
	            var top = restricted ? range.value[i] : base;
	            var digit = Math.floor(Math.random() * top);
	            result.unshift(digit);
	            if (digit < top) restricted = false;
	        }
	        return low.add(new BigInteger(result, false));
	    }

	    var powersOfTwo = [1];
	    while (powersOfTwo[powersOfTwo.length - 1] <= base) powersOfTwo.push(2 * powersOfTwo[powersOfTwo.length - 1]);
	    var powers2Length = powersOfTwo.length, highestPower2 = powersOfTwo[powers2Length - 1];

	    BigInteger.prototype.shiftLeft = function (n) {
	        if (!isSmall(n)) {
	            if (n.isNegative()) return this.shiftRight(n.abs());
	            return this.times(bigInt(2).pow(n));
	        }
	        n = +n;
	        if (n < 0) return this.shiftRight(-n);
	        var result = this;
	        while (n >= powers2Length) {
	            result = fastMultiply(result, highestPower2);
	            n -= powers2Length - 1;
	        }
	        return fastMultiply(result, powersOfTwo[n]);
	    };

	    BigInteger.prototype.shiftRight = function (n) {
	        var remQuo = undefined;
	        if (!isSmall(n)) {
	            if (n.isNegative()) return this.shiftLeft(n.abs());
	            remQuo = this.divmod(bigInt(2).pow(n));
	            return remQuo.remainder.compareTo(ZERO) < 0 ? remQuo.quotient.subtract(ONE) : remQuo.quotient;
	        }
	        n = +n;
	        if (n < 0) return this.shiftLeft(-n);
	        var result = this;
	        while (n >= powers2Length) {
	            if (result.equals(ZERO)) return result;
	            remQuo = fastDivMod(result, highestPower2);
	            result = remQuo.remainder.compareTo(ZERO) < 0 ? remQuo.quotient.subtract(ONE) : remQuo.quotient;
	            n -= powers2Length - 1;
	        }
	        remQuo = fastDivMod(result, powersOfTwo[n]);
	        return remQuo.remainder.compareTo(ZERO) < 0 ? remQuo.quotient.subtract(ONE) : remQuo.quotient;
	    };

	    function bitwise(x, y, fn) {
	        y = parseInput(y);
	        var xSign = x.isNegative(), ySign = y.isNegative();
	        var xRem = xSign ? x.not() : x,
	            yRem = ySign ? y.not() : y;
	        var xBits = [], yBits = [];
	        var xStop = false, yStop = false;
	        while (!xStop || !yStop) {
	            if (xRem.isZero()) { // virtual sign extension for simulating two's complement
	                xStop = true;
	                xBits.push(xSign ? 1 : 0);
	            }
	            else if (xSign) xBits.push(xRem.isEven() ? 1 : 0); // two's complement for negative numbers
	            else xBits.push(xRem.isEven() ? 0 : 1);

	            if (yRem.isZero()) {
	                yStop = true;
	                yBits.push(ySign ? 1 : 0);
	            }
	            else if (ySign) yBits.push(yRem.isEven() ? 1 : 0);
	            else yBits.push(yRem.isEven() ? 0 : 1);

	            xRem = xRem.over(2);
	            yRem = yRem.over(2);
	        }
	        var result = [];
	        for (var i = 0; i < xBits.length; i++) result.push(fn(xBits[i], yBits[i]));
	        var sum = bigInt(result.pop()).negate().times(bigInt(2).pow(result.length));
	        while (result.length) {
	            sum = sum.add(bigInt(result.pop()).times(bigInt(2).pow(result.length)));
	        }
	        return sum;
	    }

	    BigInteger.prototype.not = function () {
	        return this.negate().minus(1);
	    };

	    BigInteger.prototype.and = function (n) {
	        return bitwise(this, n, function (a, b) { return a & b });
	    };

	    BigInteger.prototype.or = function (n) {
	        return bitwise(this, n, function (a, b) { return a | b; });
	    };

	    BigInteger.prototype.xor = function (n) {
	        return bitwise(this, n, function (a, b) { return a ^ b });
	    };

	    BigInteger.prototype.toString = function (radix) {
	        if (radix === undefined) {
	            radix = 10;
	        }
	        if (radix !== 10) return toBase(this, radix);
	        var first = this;
	        var str = "", len = first.value.length;
	        if (len === 0 || (len === 1 && first.value[0] === 0)) {
	            return "0";
	        }
	        len -= 1;
	        str = first.value[len].toString();
	        while (--len >= 0) {
	            var digit = first.value[len].toString();
	            str += zeros.slice(digit.length) + digit;
	        }
	        var s = first.sign === sign.positive ? "" : "-";
	        return s + str;
	    };
	    BigInteger.prototype.toJSNumber = function () {
	        return this.valueOf();
	    };
	    BigInteger.prototype.valueOf = function () {
	        if (this.value.length === 1) return this.sign ? -this.value[0] : this.value[0];
	        return +this.toString();
	    };

	    var ZERO = new BigInteger([0], sign.positive);
	    var ONE = new BigInteger([1], sign.positive);
	    var MINUS_ONE = new BigInteger([1], sign.negative);


	    function parseInput(text) {
	        if (text instanceof BigInteger) return text;
	        if (Math.abs(+text) < base && +text === (+text | 0)) {
	            var value = +text;
	            return new BigInteger([Math.abs(value)], (value < 0 || (1 / value) === -Infinity));
	        }
	        text += "";
	        var s = sign.positive, value = [];
	        if (text[0] === "-") {
	            s = sign.negative;
	            text = text.slice(1);
	        }
	        var text = text.split(/e/i);
	        if (text.length > 2) throw new Error("Invalid integer: " + text.join("e"));
	        if (text[1]) {
	            var exp = text[1];
	            if (exp[0] === "+") exp = exp.slice(1);
	            exp = parseInput(exp);
	            var decimalPlace = text[0].indexOf(".");
	            if (decimalPlace >= 0) {
	                exp = exp.minus(text[0].length - decimalPlace);
	                text[0] = text[0].slice(0, decimalPlace) + text[0].slice(decimalPlace + 1);
	            }
	            if (exp.lesser(0)) throw new Error("Cannot include negative exponent part for integers");
	            while (exp.notEquals(0)) {
	                text[0] += "0";
	                exp = exp.prev();
	            }
	        }
	        text = text[0];
	        if (text === "-0") text = "0";
	        var isValid = /^([0-9][0-9]*)$/.test(text);
	        if (!isValid) throw new Error("Invalid integer: " + text);
	        while (text.length) {
	            var divider = text.length > logBase ? text.length - logBase : 0;
	            value.push(+text.slice(divider));
	            text = text.slice(0, divider);
	        }
	        return new BigInteger(trim(value), s);
	    }

	    var parseBase = function (text, base) {
	        base = parseInput(base);
	        var val = ZERO;
	        var digits = [];
	        var i;
	        var isNegative = false;
	        function parseToken(text) {
	            var c = text[i].toLowerCase();
	            if (i === 0 && text[i] === "-") {
	                isNegative = true;
	                return;
	            }
	            if (/[0-9]/.test(c)) digits.push(parseInput(c));
	            else if (/[a-z]/.test(c)) digits.push(parseInput(c.charCodeAt(0) - 87));
	            else if (c === "<") {
	                var start = i;
	                do { i++; } while (text[i] !== ">");
	                digits.push(parseInput(text.slice(start + 1, i)));
	            }
	            else throw new Error(c + " is not a valid character");
	        }
	        for (i = 0; i < text.length; i++) {
	            parseToken(text);
	        }
	        digits.reverse();
	        for (i = 0; i < digits.length; i++) {
	            val = val.add(digits[i].times(base.pow(i)));
	        }
	        return isNegative ? val.negate() : val;
	    };

	    function stringify(digit) {
	        var v = digit.value;
	        if (v.length === 1 && v[0] <= 36) {
	            return "0123456789abcdefghijklmnopqrstuvwxyz".charAt(v[0]);
	        }
	        return "<" + v + ">";
	    }

	    function toBase(n, base) {
	        base = bigInt(base);
	        if (base.equals(0)) {
	            if (n.equals(0)) return "0";
	            throw new Error("Cannot convert nonzero numbers to base 0.");
	        }
	        if (base.equals(-1)) {
	            if (n.equals(0)) return "0";
	            if (n.lesser(0)) return Array(1 - n).join("10");
	            return "1" + Array(+n).join("01");
	        }
	        var minusSign = "";
	        if (n.isNegative() && base.isPositive()) {
	            minusSign = "-";
	            n = n.abs();
	        }
	        if (base.equals(1)) {
	            if (n.equals(0)) return "0";
	            return minusSign + Array(+n + 1).join(1);
	        }
	        var out = [];
	        var left = n, divmod;
	        while (left.lesser(0) || left.compareAbs(base) >= 0) {
	            divmod = left.divmod(base);
	            left = divmod.quotient;
	            var digit = divmod.remainder;
	            if (digit.lesser(0)) {
	                digit = base.minus(digit).abs();
	                left = left.next();
	            }
	            out.push(stringify(digit));
	        }
	        out.push(stringify(left));
	        return minusSign + out.reverse().join("");
	    }

	    var fnReturn = function (a, b) {
	        if (typeof a === "undefined") return ZERO;
	        if (typeof b !== "undefined") return parseBase(a, b);
	        return parseInput(a);
	    };
	    fnReturn.zero = ZERO;
	    fnReturn.one = ONE;
	    fnReturn.minusOne = MINUS_ONE;
	    fnReturn.randBetween = randBetween;
	    fnReturn.isInstance = function (x) { return x instanceof BigInteger; };
	    fnReturn.min = min;
	    fnReturn.max = max;
	    fnReturn.gcd = gcd;
	    fnReturn.lcm = lcm;
	    return fnReturn;
	})();

	if (true) {
	    module.exports = bigInt;
	}


/***/ },
/* 41 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Module dependencies.
	 */

	var url = __webpack_require__(42);
	var parser = __webpack_require__(45);
	var Manager = __webpack_require__(43);
	var debug = __webpack_require__(46)('socket.io-client');

	/**
	 * Module exports.
	 */

	module.exports = exports = lookup;

	/**
	 * Managers cache.
	 */

	var cache = exports.managers = {};

	/**
	 * Looks up an existing `Manager` for multiplexing.
	 * If the user summons:
	 *
	 *   `io('http://localhost/a');`
	 *   `io('http://localhost/b');`
	 *
	 * We reuse the existing instance based on same scheme/port/host,
	 * and we initialize sockets for each namespace.
	 *
	 * @api public
	 */

	function lookup(uri, opts) {
	  if (typeof uri == 'object') {
	    opts = uri;
	    uri = undefined;
	  }

	  opts = opts || {};

	  var parsed = url(uri);
	  var source = parsed.source;
	  var id = parsed.id;
	  var io;

	  if (opts.forceNew || opts['force new connection'] || false === opts.multiplex) {
	    debug('ignoring socket cache for %s', source);
	    io = Manager(source, opts);
	  } else {
	    if (!cache[id]) {
	      debug('new io instance for %s', source);
	      cache[id] = Manager(source, opts);
	    }
	    io = cache[id];
	  }

	  return io.socket(parsed.path);
	}

	/**
	 * Protocol version.
	 *
	 * @api public
	 */

	exports.protocol = parser.protocol;

	/**
	 * `connect`.
	 *
	 * @param {String} uri
	 * @api public
	 */

	exports.connect = lookup;

	/**
	 * Expose constructors for standalone build.
	 *
	 * @api public
	 */

	exports.Manager = __webpack_require__(43);
	exports.Socket = __webpack_require__(44);


/***/ },
/* 42 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {
	/**
	 * Module dependencies.
	 */

	var parseuri = __webpack_require__(48);
	var debug = __webpack_require__(46)('socket.io-client:url');

	/**
	 * Module exports.
	 */

	module.exports = url;

	/**
	 * URL parser.
	 *
	 * @param {String} url
	 * @param {Object} An object meant to mimic window.location.
	 *                 Defaults to window.location.
	 * @api public
	 */

	function url(uri, loc){
	  var obj = uri;

	  // default to window.location
	  var loc = loc || global.location;
	  if (null == uri) uri = loc.protocol + '//' + loc.host;

	  // relative path support
	  if ('string' == typeof uri) {
	    if ('/' == uri.charAt(0)) {
	      if ('/' == uri.charAt(1)) {
	        uri = loc.protocol + uri;
	      } else {
	        uri = loc.hostname + uri;
	      }
	    }

	    if (!/^(https?|wss?):\/\//.test(uri)) {
	      debug('protocol-less url %s', uri);
	      if ('undefined' != typeof loc) {
	        uri = loc.protocol + '//' + uri;
	      } else {
	        uri = 'https://' + uri;
	      }
	    }

	    // parse
	    debug('parse %s', uri);
	    obj = parseuri(uri);
	  }

	  // make sure we treat `localhost:80` and `localhost` equally
	  if (!obj.port) {
	    if (/^(http|ws)$/.test(obj.protocol)) {
	      obj.port = '80';
	    }
	    else if (/^(http|ws)s$/.test(obj.protocol)) {
	      obj.port = '443';
	    }
	  }

	  obj.path = obj.path || '/';

	  // define unique id
	  obj.id = obj.protocol + '://' + obj.host + ':' + obj.port;
	  // define href
	  obj.href = obj.protocol + '://' + obj.host + (loc && loc.port == obj.port ? '' : (':' + obj.port));

	  return obj;
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 43 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Module dependencies.
	 */

	var url = __webpack_require__(42);
	var eio = __webpack_require__(49);
	var Socket = __webpack_require__(44);
	var Emitter = __webpack_require__(52);
	var parser = __webpack_require__(45);
	var on = __webpack_require__(47);
	var bind = __webpack_require__(53);
	var object = __webpack_require__(54);
	var debug = __webpack_require__(46)('socket.io-client:manager');
	var indexOf = __webpack_require__(56);
	var Backoff = __webpack_require__(55);

	/**
	 * Module exports
	 */

	module.exports = Manager;

	/**
	 * `Manager` constructor.
	 *
	 * @param {String} engine instance or engine uri/opts
	 * @param {Object} options
	 * @api public
	 */

	function Manager(uri, opts){
	  if (!(this instanceof Manager)) return new Manager(uri, opts);
	  if (uri && ('object' == typeof uri)) {
	    opts = uri;
	    uri = undefined;
	  }
	  opts = opts || {};

	  opts.path = opts.path || '/socket.io';
	  this.nsps = {};
	  this.subs = [];
	  this.opts = opts;
	  this.reconnection(opts.reconnection !== false);
	  this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
	  this.reconnectionDelay(opts.reconnectionDelay || 1000);
	  this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
	  this.randomizationFactor(opts.randomizationFactor || 0.5);
	  this.backoff = new Backoff({
	    min: this.reconnectionDelay(),
	    max: this.reconnectionDelayMax(),
	    jitter: this.randomizationFactor()
	  });
	  this.timeout(null == opts.timeout ? 20000 : opts.timeout);
	  this.readyState = 'closed';
	  this.uri = uri;
	  this.connected = [];
	  this.encoding = false;
	  this.packetBuffer = [];
	  this.encoder = new parser.Encoder();
	  this.decoder = new parser.Decoder();
	  this.autoConnect = opts.autoConnect !== false;
	  if (this.autoConnect) this.open();
	}

	/**
	 * Propagate given event to sockets and emit on `this`
	 *
	 * @api private
	 */

	Manager.prototype.emitAll = function() {
	  this.emit.apply(this, arguments);
	  for (var nsp in this.nsps) {
	    this.nsps[nsp].emit.apply(this.nsps[nsp], arguments);
	  }
	};

	/**
	 * Update `socket.id` of all sockets
	 *
	 * @api private
	 */

	Manager.prototype.updateSocketIds = function(){
	  for (var nsp in this.nsps) {
	    this.nsps[nsp].id = this.engine.id;
	  }
	};

	/**
	 * Mix in `Emitter`.
	 */

	Emitter(Manager.prototype);

	/**
	 * Sets the `reconnection` config.
	 *
	 * @param {Boolean} true/false if it should automatically reconnect
	 * @return {Manager} self or value
	 * @api public
	 */

	Manager.prototype.reconnection = function(v){
	  if (!arguments.length) return this._reconnection;
	  this._reconnection = !!v;
	  return this;
	};

	/**
	 * Sets the reconnection attempts config.
	 *
	 * @param {Number} max reconnection attempts before giving up
	 * @return {Manager} self or value
	 * @api public
	 */

	Manager.prototype.reconnectionAttempts = function(v){
	  if (!arguments.length) return this._reconnectionAttempts;
	  this._reconnectionAttempts = v;
	  return this;
	};

	/**
	 * Sets the delay between reconnections.
	 *
	 * @param {Number} delay
	 * @return {Manager} self or value
	 * @api public
	 */

	Manager.prototype.reconnectionDelay = function(v){
	  if (!arguments.length) return this._reconnectionDelay;
	  this._reconnectionDelay = v;
	  this.backoff && this.backoff.setMin(v);
	  return this;
	};

	Manager.prototype.randomizationFactor = function(v){
	  if (!arguments.length) return this._randomizationFactor;
	  this._randomizationFactor = v;
	  this.backoff && this.backoff.setJitter(v);
	  return this;
	};

	/**
	 * Sets the maximum delay between reconnections.
	 *
	 * @param {Number} delay
	 * @return {Manager} self or value
	 * @api public
	 */

	Manager.prototype.reconnectionDelayMax = function(v){
	  if (!arguments.length) return this._reconnectionDelayMax;
	  this._reconnectionDelayMax = v;
	  this.backoff && this.backoff.setMax(v);
	  return this;
	};

	/**
	 * Sets the connection timeout. `false` to disable
	 *
	 * @return {Manager} self or value
	 * @api public
	 */

	Manager.prototype.timeout = function(v){
	  if (!arguments.length) return this._timeout;
	  this._timeout = v;
	  return this;
	};

	/**
	 * Starts trying to reconnect if reconnection is enabled and we have not
	 * started reconnecting yet
	 *
	 * @api private
	 */

	Manager.prototype.maybeReconnectOnOpen = function() {
	  // Only try to reconnect if it's the first time we're connecting
	  if (!this.reconnecting && this._reconnection && this.backoff.attempts === 0) {
	    // keeps reconnection from firing twice for the same reconnection loop
	    this.reconnect();
	  }
	};


	/**
	 * Sets the current transport `socket`.
	 *
	 * @param {Function} optional, callback
	 * @return {Manager} self
	 * @api public
	 */

	Manager.prototype.open =
	Manager.prototype.connect = function(fn){
	  debug('readyState %s', this.readyState);
	  if (~this.readyState.indexOf('open')) return this;

	  debug('opening %s', this.uri);
	  this.engine = eio(this.uri, this.opts);
	  var socket = this.engine;
	  var self = this;
	  this.readyState = 'opening';
	  this.skipReconnect = false;

	  // emit `open`
	  var openSub = on(socket, 'open', function() {
	    self.onopen();
	    fn && fn();
	  });

	  // emit `connect_error`
	  var errorSub = on(socket, 'error', function(data){
	    debug('connect_error');
	    self.cleanup();
	    self.readyState = 'closed';
	    self.emitAll('connect_error', data);
	    if (fn) {
	      var err = new Error('Connection error');
	      err.data = data;
	      fn(err);
	    } else {
	      // Only do this if there is no fn to handle the error
	      self.maybeReconnectOnOpen();
	    }
	  });

	  // emit `connect_timeout`
	  if (false !== this._timeout) {
	    var timeout = this._timeout;
	    debug('connect attempt will timeout after %d', timeout);

	    // set timer
	    var timer = setTimeout(function(){
	      debug('connect attempt timed out after %d', timeout);
	      openSub.destroy();
	      socket.close();
	      socket.emit('error', 'timeout');
	      self.emitAll('connect_timeout', timeout);
	    }, timeout);

	    this.subs.push({
	      destroy: function(){
	        clearTimeout(timer);
	      }
	    });
	  }

	  this.subs.push(openSub);
	  this.subs.push(errorSub);

	  return this;
	};

	/**
	 * Called upon transport open.
	 *
	 * @api private
	 */

	Manager.prototype.onopen = function(){
	  debug('open');

	  // clear old subs
	  this.cleanup();

	  // mark as open
	  this.readyState = 'open';
	  this.emit('open');

	  // add new subs
	  var socket = this.engine;
	  this.subs.push(on(socket, 'data', bind(this, 'ondata')));
	  this.subs.push(on(this.decoder, 'decoded', bind(this, 'ondecoded')));
	  this.subs.push(on(socket, 'error', bind(this, 'onerror')));
	  this.subs.push(on(socket, 'close', bind(this, 'onclose')));
	};

	/**
	 * Called with data.
	 *
	 * @api private
	 */

	Manager.prototype.ondata = function(data){
	  this.decoder.add(data);
	};

	/**
	 * Called when parser fully decodes a packet.
	 *
	 * @api private
	 */

	Manager.prototype.ondecoded = function(packet) {
	  this.emit('packet', packet);
	};

	/**
	 * Called upon socket error.
	 *
	 * @api private
	 */

	Manager.prototype.onerror = function(err){
	  debug('error', err);
	  this.emitAll('error', err);
	};

	/**
	 * Creates a new socket for the given `nsp`.
	 *
	 * @return {Socket}
	 * @api public
	 */

	Manager.prototype.socket = function(nsp){
	  var socket = this.nsps[nsp];
	  if (!socket) {
	    socket = new Socket(this, nsp);
	    this.nsps[nsp] = socket;
	    var self = this;
	    socket.on('connect', function(){
	      socket.id = self.engine.id;
	      if (!~indexOf(self.connected, socket)) {
	        self.connected.push(socket);
	      }
	    });
	  }
	  return socket;
	};

	/**
	 * Called upon a socket close.
	 *
	 * @param {Socket} socket
	 */

	Manager.prototype.destroy = function(socket){
	  var index = indexOf(this.connected, socket);
	  if (~index) this.connected.splice(index, 1);
	  if (this.connected.length) return;

	  this.close();
	};

	/**
	 * Writes a packet.
	 *
	 * @param {Object} packet
	 * @api private
	 */

	Manager.prototype.packet = function(packet){
	  debug('writing packet %j', packet);
	  var self = this;

	  if (!self.encoding) {
	    // encode, then write to engine with result
	    self.encoding = true;
	    this.encoder.encode(packet, function(encodedPackets) {
	      for (var i = 0; i < encodedPackets.length; i++) {
	        self.engine.write(encodedPackets[i]);
	      }
	      self.encoding = false;
	      self.processPacketQueue();
	    });
	  } else { // add packet to the queue
	    self.packetBuffer.push(packet);
	  }
	};

	/**
	 * If packet buffer is non-empty, begins encoding the
	 * next packet in line.
	 *
	 * @api private
	 */

	Manager.prototype.processPacketQueue = function() {
	  if (this.packetBuffer.length > 0 && !this.encoding) {
	    var pack = this.packetBuffer.shift();
	    this.packet(pack);
	  }
	};

	/**
	 * Clean up transport subscriptions and packet buffer.
	 *
	 * @api private
	 */

	Manager.prototype.cleanup = function(){
	  var sub;
	  while (sub = this.subs.shift()) sub.destroy();

	  this.packetBuffer = [];
	  this.encoding = false;

	  this.decoder.destroy();
	};

	/**
	 * Close the current socket.
	 *
	 * @api private
	 */

	Manager.prototype.close =
	Manager.prototype.disconnect = function(){
	  this.skipReconnect = true;
	  this.backoff.reset();
	  this.readyState = 'closed';
	  this.engine && this.engine.close();
	};

	/**
	 * Called upon engine close.
	 *
	 * @api private
	 */

	Manager.prototype.onclose = function(reason){
	  debug('close');
	  this.cleanup();
	  this.backoff.reset();
	  this.readyState = 'closed';
	  this.emit('close', reason);
	  if (this._reconnection && !this.skipReconnect) {
	    this.reconnect();
	  }
	};

	/**
	 * Attempt a reconnection.
	 *
	 * @api private
	 */

	Manager.prototype.reconnect = function(){
	  if (this.reconnecting || this.skipReconnect) return this;

	  var self = this;

	  if (this.backoff.attempts >= this._reconnectionAttempts) {
	    debug('reconnect failed');
	    this.backoff.reset();
	    this.emitAll('reconnect_failed');
	    this.reconnecting = false;
	  } else {
	    var delay = this.backoff.duration();
	    debug('will wait %dms before reconnect attempt', delay);

	    this.reconnecting = true;
	    var timer = setTimeout(function(){
	      if (self.skipReconnect) return;

	      debug('attempting reconnect');
	      self.emitAll('reconnect_attempt', self.backoff.attempts);
	      self.emitAll('reconnecting', self.backoff.attempts);

	      // check again for the case socket closed in above events
	      if (self.skipReconnect) return;

	      self.open(function(err){
	        if (err) {
	          debug('reconnect attempt error');
	          self.reconnecting = false;
	          self.reconnect();
	          self.emitAll('reconnect_error', err.data);
	        } else {
	          debug('reconnect success');
	          self.onreconnect();
	        }
	      });
	    }, delay);

	    this.subs.push({
	      destroy: function(){
	        clearTimeout(timer);
	      }
	    });
	  }
	};

	/**
	 * Called upon successful reconnect.
	 *
	 * @api private
	 */

	Manager.prototype.onreconnect = function(){
	  var attempt = this.backoff.attempts;
	  this.reconnecting = false;
	  this.backoff.reset();
	  this.updateSocketIds();
	  this.emitAll('reconnect', attempt);
	};


/***/ },
/* 44 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Module dependencies.
	 */

	var parser = __webpack_require__(45);
	var Emitter = __webpack_require__(52);
	var toArray = __webpack_require__(57);
	var on = __webpack_require__(47);
	var bind = __webpack_require__(53);
	var debug = __webpack_require__(46)('socket.io-client:socket');
	var hasBin = __webpack_require__(58);

	/**
	 * Module exports.
	 */

	module.exports = exports = Socket;

	/**
	 * Internal events (blacklisted).
	 * These events can't be emitted by the user.
	 *
	 * @api private
	 */

	var events = {
	  connect: 1,
	  connect_error: 1,
	  connect_timeout: 1,
	  disconnect: 1,
	  error: 1,
	  reconnect: 1,
	  reconnect_attempt: 1,
	  reconnect_failed: 1,
	  reconnect_error: 1,
	  reconnecting: 1
	};

	/**
	 * Shortcut to `Emitter#emit`.
	 */

	var emit = Emitter.prototype.emit;

	/**
	 * `Socket` constructor.
	 *
	 * @api public
	 */

	function Socket(io, nsp){
	  this.io = io;
	  this.nsp = nsp;
	  this.json = this; // compat
	  this.ids = 0;
	  this.acks = {};
	  if (this.io.autoConnect) this.open();
	  this.receiveBuffer = [];
	  this.sendBuffer = [];
	  this.connected = false;
	  this.disconnected = true;
	}

	/**
	 * Mix in `Emitter`.
	 */

	Emitter(Socket.prototype);

	/**
	 * Subscribe to open, close and packet events
	 *
	 * @api private
	 */

	Socket.prototype.subEvents = function() {
	  if (this.subs) return;

	  var io = this.io;
	  this.subs = [
	    on(io, 'open', bind(this, 'onopen')),
	    on(io, 'packet', bind(this, 'onpacket')),
	    on(io, 'close', bind(this, 'onclose'))
	  ];
	};

	/**
	 * "Opens" the socket.
	 *
	 * @api public
	 */

	Socket.prototype.open =
	Socket.prototype.connect = function(){
	  if (this.connected) return this;

	  this.subEvents();
	  this.io.open(); // ensure open
	  if ('open' == this.io.readyState) this.onopen();
	  return this;
	};

	/**
	 * Sends a `message` event.
	 *
	 * @return {Socket} self
	 * @api public
	 */

	Socket.prototype.send = function(){
	  var args = toArray(arguments);
	  args.unshift('message');
	  this.emit.apply(this, args);
	  return this;
	};

	/**
	 * Override `emit`.
	 * If the event is in `events`, it's emitted normally.
	 *
	 * @param {String} event name
	 * @return {Socket} self
	 * @api public
	 */

	Socket.prototype.emit = function(ev){
	  if (events.hasOwnProperty(ev)) {
	    emit.apply(this, arguments);
	    return this;
	  }

	  var args = toArray(arguments);
	  var parserType = parser.EVENT; // default
	  if (hasBin(args)) { parserType = parser.BINARY_EVENT; } // binary
	  var packet = { type: parserType, data: args };

	  // event ack callback
	  if ('function' == typeof args[args.length - 1]) {
	    debug('emitting packet with ack id %d', this.ids);
	    this.acks[this.ids] = args.pop();
	    packet.id = this.ids++;
	  }

	  if (this.connected) {
	    this.packet(packet);
	  } else {
	    this.sendBuffer.push(packet);
	  }

	  return this;
	};

	/**
	 * Sends a packet.
	 *
	 * @param {Object} packet
	 * @api private
	 */

	Socket.prototype.packet = function(packet){
	  packet.nsp = this.nsp;
	  this.io.packet(packet);
	};

	/**
	 * Called upon engine `open`.
	 *
	 * @api private
	 */

	Socket.prototype.onopen = function(){
	  debug('transport is open - connecting');

	  // write connect packet if necessary
	  if ('/' != this.nsp) {
	    this.packet({ type: parser.CONNECT });
	  }
	};

	/**
	 * Called upon engine `close`.
	 *
	 * @param {String} reason
	 * @api private
	 */

	Socket.prototype.onclose = function(reason){
	  debug('close (%s)', reason);
	  this.connected = false;
	  this.disconnected = true;
	  delete this.id;
	  this.emit('disconnect', reason);
	};

	/**
	 * Called with socket packet.
	 *
	 * @param {Object} packet
	 * @api private
	 */

	Socket.prototype.onpacket = function(packet){
	  if (packet.nsp != this.nsp) return;

	  switch (packet.type) {
	    case parser.CONNECT:
	      this.onconnect();
	      break;

	    case parser.EVENT:
	      this.onevent(packet);
	      break;

	    case parser.BINARY_EVENT:
	      this.onevent(packet);
	      break;

	    case parser.ACK:
	      this.onack(packet);
	      break;

	    case parser.BINARY_ACK:
	      this.onack(packet);
	      break;

	    case parser.DISCONNECT:
	      this.ondisconnect();
	      break;

	    case parser.ERROR:
	      this.emit('error', packet.data);
	      break;
	  }
	};

	/**
	 * Called upon a server event.
	 *
	 * @param {Object} packet
	 * @api private
	 */

	Socket.prototype.onevent = function(packet){
	  var args = packet.data || [];
	  debug('emitting event %j', args);

	  if (null != packet.id) {
	    debug('attaching ack callback to event');
	    args.push(this.ack(packet.id));
	  }

	  if (this.connected) {
	    emit.apply(this, args);
	  } else {
	    this.receiveBuffer.push(args);
	  }
	};

	/**
	 * Produces an ack callback to emit with an event.
	 *
	 * @api private
	 */

	Socket.prototype.ack = function(id){
	  var self = this;
	  var sent = false;
	  return function(){
	    // prevent double callbacks
	    if (sent) return;
	    sent = true;
	    var args = toArray(arguments);
	    debug('sending ack %j', args);

	    var type = hasBin(args) ? parser.BINARY_ACK : parser.ACK;
	    self.packet({
	      type: type,
	      id: id,
	      data: args
	    });
	  };
	};

	/**
	 * Called upon a server acknowlegement.
	 *
	 * @param {Object} packet
	 * @api private
	 */

	Socket.prototype.onack = function(packet){
	  debug('calling ack %s with %j', packet.id, packet.data);
	  var fn = this.acks[packet.id];
	  fn.apply(this, packet.data);
	  delete this.acks[packet.id];
	};

	/**
	 * Called upon server connect.
	 *
	 * @api private
	 */

	Socket.prototype.onconnect = function(){
	  this.connected = true;
	  this.disconnected = false;
	  this.emit('connect');
	  this.emitBuffered();
	};

	/**
	 * Emit buffered events (received and emitted).
	 *
	 * @api private
	 */

	Socket.prototype.emitBuffered = function(){
	  var i;
	  for (i = 0; i < this.receiveBuffer.length; i++) {
	    emit.apply(this, this.receiveBuffer[i]);
	  }
	  this.receiveBuffer = [];

	  for (i = 0; i < this.sendBuffer.length; i++) {
	    this.packet(this.sendBuffer[i]);
	  }
	  this.sendBuffer = [];
	};

	/**
	 * Called upon server disconnect.
	 *
	 * @api private
	 */

	Socket.prototype.ondisconnect = function(){
	  debug('server disconnect (%s)', this.nsp);
	  this.destroy();
	  this.onclose('io server disconnect');
	};

	/**
	 * Called upon forced client/server side disconnections,
	 * this method ensures the manager stops tracking us and
	 * that reconnections don't get triggered for this.
	 *
	 * @api private.
	 */

	Socket.prototype.destroy = function(){
	  if (this.subs) {
	    // clean subscriptions to avoid reconnections
	    for (var i = 0; i < this.subs.length; i++) {
	      this.subs[i].destroy();
	    }
	    this.subs = null;
	  }

	  this.io.destroy(this);
	};

	/**
	 * Disconnects the socket manually.
	 *
	 * @return {Socket} self
	 * @api public
	 */

	Socket.prototype.close =
	Socket.prototype.disconnect = function(){
	  if (this.connected) {
	    debug('performing disconnect (%s)', this.nsp);
	    this.packet({ type: parser.DISCONNECT });
	  }

	  // remove socket from pool
	  this.destroy();

	  if (this.connected) {
	    // fire events
	    this.onclose('io client disconnect');
	  }
	  return this;
	};


/***/ },
/* 45 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Module dependencies.
	 */

	var debug = __webpack_require__(61)('socket.io-parser');
	var json = __webpack_require__(60);
	var isArray = __webpack_require__(59);
	var Emitter = __webpack_require__(52);
	var binary = __webpack_require__(50);
	var isBuf = __webpack_require__(51);

	/**
	 * Protocol version.
	 *
	 * @api public
	 */

	exports.protocol = 4;

	/**
	 * Packet types.
	 *
	 * @api public
	 */

	exports.types = [
	  'CONNECT',
	  'DISCONNECT',
	  'EVENT',
	  'BINARY_EVENT',
	  'ACK',
	  'BINARY_ACK',
	  'ERROR'
	];

	/**
	 * Packet type `connect`.
	 *
	 * @api public
	 */

	exports.CONNECT = 0;

	/**
	 * Packet type `disconnect`.
	 *
	 * @api public
	 */

	exports.DISCONNECT = 1;

	/**
	 * Packet type `event`.
	 *
	 * @api public
	 */

	exports.EVENT = 2;

	/**
	 * Packet type `ack`.
	 *
	 * @api public
	 */

	exports.ACK = 3;

	/**
	 * Packet type `error`.
	 *
	 * @api public
	 */

	exports.ERROR = 4;

	/**
	 * Packet type 'binary event'
	 *
	 * @api public
	 */

	exports.BINARY_EVENT = 5;

	/**
	 * Packet type `binary ack`. For acks with binary arguments.
	 *
	 * @api public
	 */

	exports.BINARY_ACK = 6;

	/**
	 * Encoder constructor.
	 *
	 * @api public
	 */

	exports.Encoder = Encoder;

	/**
	 * Decoder constructor.
	 *
	 * @api public
	 */

	exports.Decoder = Decoder;

	/**
	 * A socket.io Encoder instance
	 *
	 * @api public
	 */

	function Encoder() {}

	/**
	 * Encode a packet as a single string if non-binary, or as a
	 * buffer sequence, depending on packet type.
	 *
	 * @param {Object} obj - packet object
	 * @param {Function} callback - function to handle encodings (likely engine.write)
	 * @return Calls callback with Array of encodings
	 * @api public
	 */

	Encoder.prototype.encode = function(obj, callback){
	  debug('encoding packet %j', obj);

	  if (exports.BINARY_EVENT == obj.type || exports.BINARY_ACK == obj.type) {
	    encodeAsBinary(obj, callback);
	  }
	  else {
	    var encoding = encodeAsString(obj);
	    callback([encoding]);
	  }
	};

	/**
	 * Encode packet as string.
	 *
	 * @param {Object} packet
	 * @return {String} encoded
	 * @api private
	 */

	function encodeAsString(obj) {
	  var str = '';
	  var nsp = false;

	  // first is type
	  str += obj.type;

	  // attachments if we have them
	  if (exports.BINARY_EVENT == obj.type || exports.BINARY_ACK == obj.type) {
	    str += obj.attachments;
	    str += '-';
	  }

	  // if we have a namespace other than `/`
	  // we append it followed by a comma `,`
	  if (obj.nsp && '/' != obj.nsp) {
	    nsp = true;
	    str += obj.nsp;
	  }

	  // immediately followed by the id
	  if (null != obj.id) {
	    if (nsp) {
	      str += ',';
	      nsp = false;
	    }
	    str += obj.id;
	  }

	  // json data
	  if (null != obj.data) {
	    if (nsp) str += ',';
	    str += json.stringify(obj.data);
	  }

	  debug('encoded %j as %s', obj, str);
	  return str;
	}

	/**
	 * Encode packet as 'buffer sequence' by removing blobs, and
	 * deconstructing packet into object with placeholders and
	 * a list of buffers.
	 *
	 * @param {Object} packet
	 * @return {Buffer} encoded
	 * @api private
	 */

	function encodeAsBinary(obj, callback) {

	  function writeEncoding(bloblessData) {
	    var deconstruction = binary.deconstructPacket(bloblessData);
	    var pack = encodeAsString(deconstruction.packet);
	    var buffers = deconstruction.buffers;

	    buffers.unshift(pack); // add packet info to beginning of data list
	    callback(buffers); // write all the buffers
	  }

	  binary.removeBlobs(obj, writeEncoding);
	}

	/**
	 * A socket.io Decoder instance
	 *
	 * @return {Object} decoder
	 * @api public
	 */

	function Decoder() {
	  this.reconstructor = null;
	}

	/**
	 * Mix in `Emitter` with Decoder.
	 */

	Emitter(Decoder.prototype);

	/**
	 * Decodes an ecoded packet string into packet JSON.
	 *
	 * @param {String} obj - encoded packet
	 * @return {Object} packet
	 * @api public
	 */

	Decoder.prototype.add = function(obj) {
	  var packet;
	  if ('string' == typeof obj) {
	    packet = decodeString(obj);
	    if (exports.BINARY_EVENT == packet.type || exports.BINARY_ACK == packet.type) { // binary packet's json
	      this.reconstructor = new BinaryReconstructor(packet);

	      // no attachments, labeled binary but no binary data to follow
	      if (this.reconstructor.reconPack.attachments === 0) {
	        this.emit('decoded', packet);
	      }
	    } else { // non-binary full packet
	      this.emit('decoded', packet);
	    }
	  }
	  else if (isBuf(obj) || obj.base64) { // raw binary data
	    if (!this.reconstructor) {
	      throw new Error('got binary data when not reconstructing a packet');
	    } else {
	      packet = this.reconstructor.takeBinaryData(obj);
	      if (packet) { // received final buffer
	        this.reconstructor = null;
	        this.emit('decoded', packet);
	      }
	    }
	  }
	  else {
	    throw new Error('Unknown type: ' + obj);
	  }
	};

	/**
	 * Decode a packet String (JSON data)
	 *
	 * @param {String} str
	 * @return {Object} packet
	 * @api private
	 */

	function decodeString(str) {
	  var p = {};
	  var i = 0;

	  // look up type
	  p.type = Number(str.charAt(0));
	  if (null == exports.types[p.type]) return error();

	  // look up attachments if type binary
	  if (exports.BINARY_EVENT == p.type || exports.BINARY_ACK == p.type) {
	    var buf = '';
	    while (str.charAt(++i) != '-') {
	      buf += str.charAt(i);
	      if (i == str.length) break;
	    }
	    if (buf != Number(buf) || str.charAt(i) != '-') {
	      throw new Error('Illegal attachments');
	    }
	    p.attachments = Number(buf);
	  }

	  // look up namespace (if any)
	  if ('/' == str.charAt(i + 1)) {
	    p.nsp = '';
	    while (++i) {
	      var c = str.charAt(i);
	      if (',' == c) break;
	      p.nsp += c;
	      if (i == str.length) break;
	    }
	  } else {
	    p.nsp = '/';
	  }

	  // look up id
	  var next = str.charAt(i + 1);
	  if ('' !== next && Number(next) == next) {
	    p.id = '';
	    while (++i) {
	      var c = str.charAt(i);
	      if (null == c || Number(c) != c) {
	        --i;
	        break;
	      }
	      p.id += str.charAt(i);
	      if (i == str.length) break;
	    }
	    p.id = Number(p.id);
	  }

	  // look up json data
	  if (str.charAt(++i)) {
	    try {
	      p.data = json.parse(str.substr(i));
	    } catch(e){
	      return error();
	    }
	  }

	  debug('decoded %s as %j', str, p);
	  return p;
	}

	/**
	 * Deallocates a parser's resources
	 *
	 * @api public
	 */

	Decoder.prototype.destroy = function() {
	  if (this.reconstructor) {
	    this.reconstructor.finishedReconstruction();
	  }
	};

	/**
	 * A manager of a binary event's 'buffer sequence'. Should
	 * be constructed whenever a packet of type BINARY_EVENT is
	 * decoded.
	 *
	 * @param {Object} packet
	 * @return {BinaryReconstructor} initialized reconstructor
	 * @api private
	 */

	function BinaryReconstructor(packet) {
	  this.reconPack = packet;
	  this.buffers = [];
	}

	/**
	 * Method to be called when binary data received from connection
	 * after a BINARY_EVENT packet.
	 *
	 * @param {Buffer | ArrayBuffer} binData - the raw binary data received
	 * @return {null | Object} returns null if more binary data is expected or
	 *   a reconstructed packet object if all buffers have been received.
	 * @api private
	 */

	BinaryReconstructor.prototype.takeBinaryData = function(binData) {
	  this.buffers.push(binData);
	  if (this.buffers.length == this.reconPack.attachments) { // done with buffer list
	    var packet = binary.reconstructPacket(this.reconPack, this.buffers);
	    this.finishedReconstruction();
	    return packet;
	  }
	  return null;
	};

	/**
	 * Cleans up binary packet reconstruction variables.
	 *
	 * @api private
	 */

	BinaryReconstructor.prototype.finishedReconstruction = function() {
	  this.reconPack = null;
	  this.buffers = [];
	};

	function error(data){
	  return {
	    type: exports.ERROR,
	    data: 'parser error'
	  };
	}


/***/ },
/* 46 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Expose `debug()` as the module.
	 */

	module.exports = debug;

	/**
	 * Create a debugger with the given `name`.
	 *
	 * @param {String} name
	 * @return {Type}
	 * @api public
	 */

	function debug(name) {
	  if (!debug.enabled(name)) return function(){};

	  return function(fmt){
	    fmt = coerce(fmt);

	    var curr = new Date;
	    var ms = curr - (debug[name] || curr);
	    debug[name] = curr;

	    fmt = name
	      + ' '
	      + fmt
	      + ' +' + debug.humanize(ms);

	    // This hackery is required for IE8
	    // where `console.log` doesn't have 'apply'
	    window.console
	      && console.log
	      && Function.prototype.apply.call(console.log, console, arguments);
	  }
	}

	/**
	 * The currently active debug mode names.
	 */

	debug.names = [];
	debug.skips = [];

	/**
	 * Enables a debug mode by name. This can include modes
	 * separated by a colon and wildcards.
	 *
	 * @param {String} name
	 * @api public
	 */

	debug.enable = function(name) {
	  try {
	    localStorage.debug = name;
	  } catch(e){}

	  var split = (name || '').split(/[\s,]+/)
	    , len = split.length;

	  for (var i = 0; i < len; i++) {
	    name = split[i].replace('*', '.*?');
	    if (name[0] === '-') {
	      debug.skips.push(new RegExp('^' + name.substr(1) + '$'));
	    }
	    else {
	      debug.names.push(new RegExp('^' + name + '$'));
	    }
	  }
	};

	/**
	 * Disable debug output.
	 *
	 * @api public
	 */

	debug.disable = function(){
	  debug.enable('');
	};

	/**
	 * Humanize the given `ms`.
	 *
	 * @param {Number} m
	 * @return {String}
	 * @api private
	 */

	debug.humanize = function(ms) {
	  var sec = 1000
	    , min = 60 * 1000
	    , hour = 60 * min;

	  if (ms >= hour) return (ms / hour).toFixed(1) + 'h';
	  if (ms >= min) return (ms / min).toFixed(1) + 'm';
	  if (ms >= sec) return (ms / sec | 0) + 's';
	  return ms + 'ms';
	};

	/**
	 * Returns true if the given mode name is enabled, false otherwise.
	 *
	 * @param {String} name
	 * @return {Boolean}
	 * @api public
	 */

	debug.enabled = function(name) {
	  for (var i = 0, len = debug.skips.length; i < len; i++) {
	    if (debug.skips[i].test(name)) {
	      return false;
	    }
	  }
	  for (var i = 0, len = debug.names.length; i < len; i++) {
	    if (debug.names[i].test(name)) {
	      return true;
	    }
	  }
	  return false;
	};

	/**
	 * Coerce `val`.
	 */

	function coerce(val) {
	  if (val instanceof Error) return val.stack || val.message;
	  return val;
	}

	// persist

	try {
	  if (window.localStorage) debug.enable(localStorage.debug);
	} catch(e){}


/***/ },
/* 47 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Module exports.
	 */

	module.exports = on;

	/**
	 * Helper for subscriptions.
	 *
	 * @param {Object|EventEmitter} obj with `Emitter` mixin or `EventEmitter`
	 * @param {String} event name
	 * @param {Function} callback
	 * @api public
	 */

	function on(obj, ev, fn) {
	  obj.on(ev, fn);
	  return {
	    destroy: function(){
	      obj.removeListener(ev, fn);
	    }
	  };
	}


/***/ },
/* 48 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Parses an URI
	 *
	 * @author Steven Levithan <stevenlevithan.com> (MIT license)
	 * @api private
	 */

	var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

	var parts = [
	    'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host'
	  , 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
	];

	module.exports = function parseuri(str) {
	  var m = re.exec(str || '')
	    , uri = {}
	    , i = 14;

	  while (i--) {
	    uri[parts[i]] = m[i] || '';
	  }

	  return uri;
	};


/***/ },
/* 49 */
/***/ function(module, exports, __webpack_require__) {

	
	module.exports =  __webpack_require__(62);


/***/ },
/* 50 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/*global Blob,File*/

	/**
	 * Module requirements
	 */

	var isArray = __webpack_require__(59);
	var isBuf = __webpack_require__(51);

	/**
	 * Replaces every Buffer | ArrayBuffer in packet with a numbered placeholder.
	 * Anything with blobs or files should be fed through removeBlobs before coming
	 * here.
	 *
	 * @param {Object} packet - socket.io event packet
	 * @return {Object} with deconstructed packet and list of buffers
	 * @api public
	 */

	exports.deconstructPacket = function(packet){
	  var buffers = [];
	  var packetData = packet.data;

	  function _deconstructPacket(data) {
	    if (!data) return data;

	    if (isBuf(data)) {
	      var placeholder = { _placeholder: true, num: buffers.length };
	      buffers.push(data);
	      return placeholder;
	    } else if (isArray(data)) {
	      var newData = new Array(data.length);
	      for (var i = 0; i < data.length; i++) {
	        newData[i] = _deconstructPacket(data[i]);
	      }
	      return newData;
	    } else if ('object' == typeof data && !(data instanceof Date)) {
	      var newData = {};
	      for (var key in data) {
	        newData[key] = _deconstructPacket(data[key]);
	      }
	      return newData;
	    }
	    return data;
	  }

	  var pack = packet;
	  pack.data = _deconstructPacket(packetData);
	  pack.attachments = buffers.length; // number of binary 'attachments'
	  return {packet: pack, buffers: buffers};
	};

	/**
	 * Reconstructs a binary packet from its placeholder packet and buffers
	 *
	 * @param {Object} packet - event packet with placeholders
	 * @param {Array} buffers - binary buffers to put in placeholder positions
	 * @return {Object} reconstructed packet
	 * @api public
	 */

	exports.reconstructPacket = function(packet, buffers) {
	  var curPlaceHolder = 0;

	  function _reconstructPacket(data) {
	    if (data && data._placeholder) {
	      var buf = buffers[data.num]; // appropriate buffer (should be natural order anyway)
	      return buf;
	    } else if (isArray(data)) {
	      for (var i = 0; i < data.length; i++) {
	        data[i] = _reconstructPacket(data[i]);
	      }
	      return data;
	    } else if (data && 'object' == typeof data) {
	      for (var key in data) {
	        data[key] = _reconstructPacket(data[key]);
	      }
	      return data;
	    }
	    return data;
	  }

	  packet.data = _reconstructPacket(packet.data);
	  packet.attachments = undefined; // no longer useful
	  return packet;
	};

	/**
	 * Asynchronously removes Blobs or Files from data via
	 * FileReader's readAsArrayBuffer method. Used before encoding
	 * data as msgpack. Calls callback with the blobless data.
	 *
	 * @param {Object} data
	 * @param {Function} callback
	 * @api private
	 */

	exports.removeBlobs = function(data, callback) {
	  function _removeBlobs(obj, curKey, containingObject) {
	    if (!obj) return obj;

	    // convert any blob
	    if ((global.Blob && obj instanceof Blob) ||
	        (global.File && obj instanceof File)) {
	      pendingBlobs++;

	      // async filereader
	      var fileReader = new FileReader();
	      fileReader.onload = function() { // this.result == arraybuffer
	        if (containingObject) {
	          containingObject[curKey] = this.result;
	        }
	        else {
	          bloblessData = this.result;
	        }

	        // if nothing pending its callback time
	        if(! --pendingBlobs) {
	          callback(bloblessData);
	        }
	      };

	      fileReader.readAsArrayBuffer(obj); // blob -> arraybuffer
	    } else if (isArray(obj)) { // handle array
	      for (var i = 0; i < obj.length; i++) {
	        _removeBlobs(obj[i], i, obj);
	      }
	    } else if (obj && 'object' == typeof obj && !isBuf(obj)) { // and object
	      for (var key in obj) {
	        _removeBlobs(obj[key], key, obj);
	      }
	    }
	  }

	  var pendingBlobs = 0;
	  var bloblessData = data;
	  _removeBlobs(bloblessData);
	  if (!pendingBlobs) {
	    callback(bloblessData);
	  }
	};

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 51 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {
	module.exports = isBuf;

	/**
	 * Returns true if obj is a buffer or an arraybuffer.
	 *
	 * @api private
	 */

	function isBuf(obj) {
	  return (global.Buffer && global.Buffer.isBuffer(obj)) ||
	         (global.ArrayBuffer && obj instanceof ArrayBuffer);
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 52 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Expose `Emitter`.
	 */

	module.exports = Emitter;

	/**
	 * Initialize a new `Emitter`.
	 *
	 * @api public
	 */

	function Emitter(obj) {
	  if (obj) return mixin(obj);
	};

	/**
	 * Mixin the emitter properties.
	 *
	 * @param {Object} obj
	 * @return {Object}
	 * @api private
	 */

	function mixin(obj) {
	  for (var key in Emitter.prototype) {
	    obj[key] = Emitter.prototype[key];
	  }
	  return obj;
	}

	/**
	 * Listen on the given `event` with `fn`.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */

	Emitter.prototype.on =
	Emitter.prototype.addEventListener = function(event, fn){
	  this._callbacks = this._callbacks || {};
	  (this._callbacks[event] = this._callbacks[event] || [])
	    .push(fn);
	  return this;
	};

	/**
	 * Adds an `event` listener that will be invoked a single
	 * time then automatically removed.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */

	Emitter.prototype.once = function(event, fn){
	  var self = this;
	  this._callbacks = this._callbacks || {};

	  function on() {
	    self.off(event, on);
	    fn.apply(this, arguments);
	  }

	  on.fn = fn;
	  this.on(event, on);
	  return this;
	};

	/**
	 * Remove the given callback for `event` or all
	 * registered callbacks.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */

	Emitter.prototype.off =
	Emitter.prototype.removeListener =
	Emitter.prototype.removeAllListeners =
	Emitter.prototype.removeEventListener = function(event, fn){
	  this._callbacks = this._callbacks || {};

	  // all
	  if (0 == arguments.length) {
	    this._callbacks = {};
	    return this;
	  }

	  // specific event
	  var callbacks = this._callbacks[event];
	  if (!callbacks) return this;

	  // remove all handlers
	  if (1 == arguments.length) {
	    delete this._callbacks[event];
	    return this;
	  }

	  // remove specific handler
	  var cb;
	  for (var i = 0; i < callbacks.length; i++) {
	    cb = callbacks[i];
	    if (cb === fn || cb.fn === fn) {
	      callbacks.splice(i, 1);
	      break;
	    }
	  }
	  return this;
	};

	/**
	 * Emit `event` with the given args.
	 *
	 * @param {String} event
	 * @param {Mixed} ...
	 * @return {Emitter}
	 */

	Emitter.prototype.emit = function(event){
	  this._callbacks = this._callbacks || {};
	  var args = [].slice.call(arguments, 1)
	    , callbacks = this._callbacks[event];

	  if (callbacks) {
	    callbacks = callbacks.slice(0);
	    for (var i = 0, len = callbacks.length; i < len; ++i) {
	      callbacks[i].apply(this, args);
	    }
	  }

	  return this;
	};

	/**
	 * Return array of callbacks for `event`.
	 *
	 * @param {String} event
	 * @return {Array}
	 * @api public
	 */

	Emitter.prototype.listeners = function(event){
	  this._callbacks = this._callbacks || {};
	  return this._callbacks[event] || [];
	};

	/**
	 * Check if this emitter has `event` handlers.
	 *
	 * @param {String} event
	 * @return {Boolean}
	 * @api public
	 */

	Emitter.prototype.hasListeners = function(event){
	  return !! this.listeners(event).length;
	};


/***/ },
/* 53 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Slice reference.
	 */

	var slice = [].slice;

	/**
	 * Bind `obj` to `fn`.
	 *
	 * @param {Object} obj
	 * @param {Function|String} fn or string
	 * @return {Function}
	 * @api public
	 */

	module.exports = function(obj, fn){
	  if ('string' == typeof fn) fn = obj[fn];
	  if ('function' != typeof fn) throw new Error('bind() requires a function');
	  var args = slice.call(arguments, 2);
	  return function(){
	    return fn.apply(obj, args.concat(slice.call(arguments)));
	  }
	};


/***/ },
/* 54 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * HOP ref.
	 */

	var has = Object.prototype.hasOwnProperty;

	/**
	 * Return own keys in `obj`.
	 *
	 * @param {Object} obj
	 * @return {Array}
	 * @api public
	 */

	exports.keys = Object.keys || function(obj){
	  var keys = [];
	  for (var key in obj) {
	    if (has.call(obj, key)) {
	      keys.push(key);
	    }
	  }
	  return keys;
	};

	/**
	 * Return own values in `obj`.
	 *
	 * @param {Object} obj
	 * @return {Array}
	 * @api public
	 */

	exports.values = function(obj){
	  var vals = [];
	  for (var key in obj) {
	    if (has.call(obj, key)) {
	      vals.push(obj[key]);
	    }
	  }
	  return vals;
	};

	/**
	 * Merge `b` into `a`.
	 *
	 * @param {Object} a
	 * @param {Object} b
	 * @return {Object} a
	 * @api public
	 */

	exports.merge = function(a, b){
	  for (var key in b) {
	    if (has.call(b, key)) {
	      a[key] = b[key];
	    }
	  }
	  return a;
	};

	/**
	 * Return length of `obj`.
	 *
	 * @param {Object} obj
	 * @return {Number}
	 * @api public
	 */

	exports.length = function(obj){
	  return exports.keys(obj).length;
	};

	/**
	 * Check if `obj` is empty.
	 *
	 * @param {Object} obj
	 * @return {Boolean}
	 * @api public
	 */

	exports.isEmpty = function(obj){
	  return 0 == exports.length(obj);
	};

/***/ },
/* 55 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Expose `Backoff`.
	 */

	module.exports = Backoff;

	/**
	 * Initialize backoff timer with `opts`.
	 *
	 * - `min` initial timeout in milliseconds [100]
	 * - `max` max timeout [10000]
	 * - `jitter` [0]
	 * - `factor` [2]
	 *
	 * @param {Object} opts
	 * @api public
	 */

	function Backoff(opts) {
	  opts = opts || {};
	  this.ms = opts.min || 100;
	  this.max = opts.max || 10000;
	  this.factor = opts.factor || 2;
	  this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
	  this.attempts = 0;
	}

	/**
	 * Return the backoff duration.
	 *
	 * @return {Number}
	 * @api public
	 */

	Backoff.prototype.duration = function(){
	  var ms = this.ms * Math.pow(this.factor, this.attempts++);
	  if (this.jitter) {
	    var rand =  Math.random();
	    var deviation = Math.floor(rand * this.jitter * ms);
	    ms = (Math.floor(rand * 10) & 1) == 0  ? ms - deviation : ms + deviation;
	  }
	  return Math.min(ms, this.max) | 0;
	};

	/**
	 * Reset the number of attempts.
	 *
	 * @api public
	 */

	Backoff.prototype.reset = function(){
	  this.attempts = 0;
	};

	/**
	 * Set the minimum duration
	 *
	 * @api public
	 */

	Backoff.prototype.setMin = function(min){
	  this.ms = min;
	};

	/**
	 * Set the maximum duration
	 *
	 * @api public
	 */

	Backoff.prototype.setMax = function(max){
	  this.max = max;
	};

	/**
	 * Set the jitter
	 *
	 * @api public
	 */

	Backoff.prototype.setJitter = function(jitter){
	  this.jitter = jitter;
	};



/***/ },
/* 56 */
/***/ function(module, exports, __webpack_require__) {

	
	var indexOf = [].indexOf;

	module.exports = function(arr, obj){
	  if (indexOf) return arr.indexOf(obj);
	  for (var i = 0; i < arr.length; ++i) {
	    if (arr[i] === obj) return i;
	  }
	  return -1;
	};

/***/ },
/* 57 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = toArray

	function toArray(list, index) {
	    var array = []

	    index = index || 0

	    for (var i = index || 0; i < list.length; i++) {
	        array[i - index] = list[i]
	    }

	    return array
	}


/***/ },
/* 58 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {
	/*
	 * Module requirements.
	 */

	var isArray = __webpack_require__(59);

	/**
	 * Module exports.
	 */

	module.exports = hasBinary;

	/**
	 * Checks for binary data.
	 *
	 * Right now only Buffer and ArrayBuffer are supported..
	 *
	 * @param {Object} anything
	 * @api public
	 */

	function hasBinary(data) {

	  function _hasBinary(obj) {
	    if (!obj) return false;

	    if ( (global.Buffer && global.Buffer.isBuffer(obj)) ||
	         (global.ArrayBuffer && obj instanceof ArrayBuffer) ||
	         (global.Blob && obj instanceof Blob) ||
	         (global.File && obj instanceof File)
	        ) {
	      return true;
	    }

	    if (isArray(obj)) {
	      for (var i = 0; i < obj.length; i++) {
	          if (_hasBinary(obj[i])) {
	              return true;
	          }
	      }
	    } else if (obj && 'object' == typeof obj) {
	      if (obj.toJSON) {
	        obj = obj.toJSON();
	      }

	      for (var key in obj) {
	        if (Object.prototype.hasOwnProperty.call(obj, key) && _hasBinary(obj[key])) {
	          return true;
	        }
	      }
	    }

	    return false;
	  }

	  return _hasBinary(data);
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 59 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = Array.isArray || function (arr) {
	  return Object.prototype.toString.call(arr) == '[object Array]';
	};


/***/ },
/* 60 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;/*! JSON v3.2.6 | http://bestiejs.github.io/json3 | Copyright 2012-2013, Kit Cambridge | http://kit.mit-license.org */
	;(function (window) {
	  // Convenience aliases.
	  var getClass = {}.toString, isProperty, forEach, undef;

	  // Detect the `define` function exposed by asynchronous module loaders. The
	  // strict `define` check is necessary for compatibility with `r.js`.
	  var isLoader = "function" === "function" && __webpack_require__(64);

	  // Detect native implementations.
	  var nativeJSON = typeof JSON == "object" && JSON;

	  // Set up the JSON 3 namespace, preferring the CommonJS `exports` object if
	  // available.
	  var JSON3 = typeof exports == "object" && exports && !exports.nodeType && exports;

	  if (JSON3 && nativeJSON) {
	    // Explicitly delegate to the native `stringify` and `parse`
	    // implementations in CommonJS environments.
	    JSON3.stringify = nativeJSON.stringify;
	    JSON3.parse = nativeJSON.parse;
	  } else {
	    // Export for web browsers, JavaScript engines, and asynchronous module
	    // loaders, using the global `JSON` object if available.
	    JSON3 = window.JSON = nativeJSON || {};
	  }

	  // Test the `Date#getUTC*` methods. Based on work by @Yaffle.
	  var isExtended = new Date(-3509827334573292);
	  try {
	    // The `getUTCFullYear`, `Month`, and `Date` methods return nonsensical
	    // results for certain dates in Opera >= 10.53.
	    isExtended = isExtended.getUTCFullYear() == -109252 && isExtended.getUTCMonth() === 0 && isExtended.getUTCDate() === 1 &&
	      // Safari < 2.0.2 stores the internal millisecond time value correctly,
	      // but clips the values returned by the date methods to the range of
	      // signed 32-bit integers ([-2 ** 31, 2 ** 31 - 1]).
	      isExtended.getUTCHours() == 10 && isExtended.getUTCMinutes() == 37 && isExtended.getUTCSeconds() == 6 && isExtended.getUTCMilliseconds() == 708;
	  } catch (exception) {}

	  // Internal: Determines whether the native `JSON.stringify` and `parse`
	  // implementations are spec-compliant. Based on work by Ken Snyder.
	  function has(name) {
	    if (has[name] !== undef) {
	      // Return cached feature test result.
	      return has[name];
	    }

	    var isSupported;
	    if (name == "bug-string-char-index") {
	      // IE <= 7 doesn't support accessing string characters using square
	      // bracket notation. IE 8 only supports this for primitives.
	      isSupported = "a"[0] != "a";
	    } else if (name == "json") {
	      // Indicates whether both `JSON.stringify` and `JSON.parse` are
	      // supported.
	      isSupported = has("json-stringify") && has("json-parse");
	    } else {
	      var value, serialized = '{"a":[1,true,false,null,"\\u0000\\b\\n\\f\\r\\t"]}';
	      // Test `JSON.stringify`.
	      if (name == "json-stringify") {
	        var stringify = JSON3.stringify, stringifySupported = typeof stringify == "function" && isExtended;
	        if (stringifySupported) {
	          // A test function object with a custom `toJSON` method.
	          (value = function () {
	            return 1;
	          }).toJSON = value;
	          try {
	            stringifySupported =
	              // Firefox 3.1b1 and b2 serialize string, number, and boolean
	              // primitives as object literals.
	              stringify(0) === "0" &&
	              // FF 3.1b1, b2, and JSON 2 serialize wrapped primitives as object
	              // literals.
	              stringify(new Number()) === "0" &&
	              stringify(new String()) == '""' &&
	              // FF 3.1b1, 2 throw an error if the value is `null`, `undefined`, or
	              // does not define a canonical JSON representation (this applies to
	              // objects with `toJSON` properties as well, *unless* they are nested
	              // within an object or array).
	              stringify(getClass) === undef &&
	              // IE 8 serializes `undefined` as `"undefined"`. Safari <= 5.1.7 and
	              // FF 3.1b3 pass this test.
	              stringify(undef) === undef &&
	              // Safari <= 5.1.7 and FF 3.1b3 throw `Error`s and `TypeError`s,
	              // respectively, if the value is omitted entirely.
	              stringify() === undef &&
	              // FF 3.1b1, 2 throw an error if the given value is not a number,
	              // string, array, object, Boolean, or `null` literal. This applies to
	              // objects with custom `toJSON` methods as well, unless they are nested
	              // inside object or array literals. YUI 3.0.0b1 ignores custom `toJSON`
	              // methods entirely.
	              stringify(value) === "1" &&
	              stringify([value]) == "[1]" &&
	              // Prototype <= 1.6.1 serializes `[undefined]` as `"[]"` instead of
	              // `"[null]"`.
	              stringify([undef]) == "[null]" &&
	              // YUI 3.0.0b1 fails to serialize `null` literals.
	              stringify(null) == "null" &&
	              // FF 3.1b1, 2 halts serialization if an array contains a function:
	              // `[1, true, getClass, 1]` serializes as "[1,true,],". FF 3.1b3
	              // elides non-JSON values from objects and arrays, unless they
	              // define custom `toJSON` methods.
	              stringify([undef, getClass, null]) == "[null,null,null]" &&
	              // Simple serialization test. FF 3.1b1 uses Unicode escape sequences
	              // where character escape codes are expected (e.g., `\b` => `\u0008`).
	              stringify({ "a": [value, true, false, null, "\x00\b\n\f\r\t"] }) == serialized &&
	              // FF 3.1b1 and b2 ignore the `filter` and `width` arguments.
	              stringify(null, value) === "1" &&
	              stringify([1, 2], null, 1) == "[\n 1,\n 2\n]" &&
	              // JSON 2, Prototype <= 1.7, and older WebKit builds incorrectly
	              // serialize extended years.
	              stringify(new Date(-8.64e15)) == '"-271821-04-20T00:00:00.000Z"' &&
	              // The milliseconds are optional in ES 5, but required in 5.1.
	              stringify(new Date(8.64e15)) == '"+275760-09-13T00:00:00.000Z"' &&
	              // Firefox <= 11.0 incorrectly serializes years prior to 0 as negative
	              // four-digit years instead of six-digit years. Credits: @Yaffle.
	              stringify(new Date(-621987552e5)) == '"-000001-01-01T00:00:00.000Z"' &&
	              // Safari <= 5.1.5 and Opera >= 10.53 incorrectly serialize millisecond
	              // values less than 1000. Credits: @Yaffle.
	              stringify(new Date(-1)) == '"1969-12-31T23:59:59.999Z"';
	          } catch (exception) {
	            stringifySupported = false;
	          }
	        }
	        isSupported = stringifySupported;
	      }
	      // Test `JSON.parse`.
	      if (name == "json-parse") {
	        var parse = JSON3.parse;
	        if (typeof parse == "function") {
	          try {
	            // FF 3.1b1, b2 will throw an exception if a bare literal is provided.
	            // Conforming implementations should also coerce the initial argument to
	            // a string prior to parsing.
	            if (parse("0") === 0 && !parse(false)) {
	              // Simple parsing test.
	              value = parse(serialized);
	              var parseSupported = value["a"].length == 5 && value["a"][0] === 1;
	              if (parseSupported) {
	                try {
	                  // Safari <= 5.1.2 and FF 3.1b1 allow unescaped tabs in strings.
	                  parseSupported = !parse('"\t"');
	                } catch (exception) {}
	                if (parseSupported) {
	                  try {
	                    // FF 4.0 and 4.0.1 allow leading `+` signs and leading
	                    // decimal points. FF 4.0, 4.0.1, and IE 9-10 also allow
	                    // certain octal literals.
	                    parseSupported = parse("01") !== 1;
	                  } catch (exception) {}
	                }
	                if (parseSupported) {
	                  try {
	                    // FF 4.0, 4.0.1, and Rhino 1.7R3-R4 allow trailing decimal
	                    // points. These environments, along with FF 3.1b1 and 2,
	                    // also allow trailing commas in JSON objects and arrays.
	                    parseSupported = parse("1.") !== 1;
	                  } catch (exception) {}
	                }
	              }
	            }
	          } catch (exception) {
	            parseSupported = false;
	          }
	        }
	        isSupported = parseSupported;
	      }
	    }
	    return has[name] = !!isSupported;
	  }

	  if (!has("json")) {
	    // Common `[[Class]]` name aliases.
	    var functionClass = "[object Function]";
	    var dateClass = "[object Date]";
	    var numberClass = "[object Number]";
	    var stringClass = "[object String]";
	    var arrayClass = "[object Array]";
	    var booleanClass = "[object Boolean]";

	    // Detect incomplete support for accessing string characters by index.
	    var charIndexBuggy = has("bug-string-char-index");

	    // Define additional utility methods if the `Date` methods are buggy.
	    if (!isExtended) {
	      var floor = Math.floor;
	      // A mapping between the months of the year and the number of days between
	      // January 1st and the first of the respective month.
	      var Months = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
	      // Internal: Calculates the number of days between the Unix epoch and the
	      // first day of the given month.
	      var getDay = function (year, month) {
	        return Months[month] + 365 * (year - 1970) + floor((year - 1969 + (month = +(month > 1))) / 4) - floor((year - 1901 + month) / 100) + floor((year - 1601 + month) / 400);
	      };
	    }

	    // Internal: Determines if a property is a direct property of the given
	    // object. Delegates to the native `Object#hasOwnProperty` method.
	    if (!(isProperty = {}.hasOwnProperty)) {
	      isProperty = function (property) {
	        var members = {}, constructor;
	        if ((members.__proto__ = null, members.__proto__ = {
	          // The *proto* property cannot be set multiple times in recent
	          // versions of Firefox and SeaMonkey.
	          "toString": 1
	        }, members).toString != getClass) {
	          // Safari <= 2.0.3 doesn't implement `Object#hasOwnProperty`, but
	          // supports the mutable *proto* property.
	          isProperty = function (property) {
	            // Capture and break the object's prototype chain (see section 8.6.2
	            // of the ES 5.1 spec). The parenthesized expression prevents an
	            // unsafe transformation by the Closure Compiler.
	            var original = this.__proto__, result = property in (this.__proto__ = null, this);
	            // Restore the original prototype chain.
	            this.__proto__ = original;
	            return result;
	          };
	        } else {
	          // Capture a reference to the top-level `Object` constructor.
	          constructor = members.constructor;
	          // Use the `constructor` property to simulate `Object#hasOwnProperty` in
	          // other environments.
	          isProperty = function (property) {
	            var parent = (this.constructor || constructor).prototype;
	            return property in this && !(property in parent && this[property] === parent[property]);
	          };
	        }
	        members = null;
	        return isProperty.call(this, property);
	      };
	    }

	    // Internal: A set of primitive types used by `isHostType`.
	    var PrimitiveTypes = {
	      'boolean': 1,
	      'number': 1,
	      'string': 1,
	      'undefined': 1
	    };

	    // Internal: Determines if the given object `property` value is a
	    // non-primitive.
	    var isHostType = function (object, property) {
	      var type = typeof object[property];
	      return type == 'object' ? !!object[property] : !PrimitiveTypes[type];
	    };

	    // Internal: Normalizes the `for...in` iteration algorithm across
	    // environments. Each enumerated key is yielded to a `callback` function.
	    forEach = function (object, callback) {
	      var size = 0, Properties, members, property;

	      // Tests for bugs in the current environment's `for...in` algorithm. The
	      // `valueOf` property inherits the non-enumerable flag from
	      // `Object.prototype` in older versions of IE, Netscape, and Mozilla.
	      (Properties = function () {
	        this.valueOf = 0;
	      }).prototype.valueOf = 0;

	      // Iterate over a new instance of the `Properties` class.
	      members = new Properties();
	      for (property in members) {
	        // Ignore all properties inherited from `Object.prototype`.
	        if (isProperty.call(members, property)) {
	          size++;
	        }
	      }
	      Properties = members = null;

	      // Normalize the iteration algorithm.
	      if (!size) {
	        // A list of non-enumerable properties inherited from `Object.prototype`.
	        members = ["valueOf", "toString", "toLocaleString", "propertyIsEnumerable", "isPrototypeOf", "hasOwnProperty", "constructor"];
	        // IE <= 8, Mozilla 1.0, and Netscape 6.2 ignore shadowed non-enumerable
	        // properties.
	        forEach = function (object, callback) {
	          var isFunction = getClass.call(object) == functionClass, property, length;
	          var hasProperty = !isFunction && typeof object.constructor != 'function' && isHostType(object, 'hasOwnProperty') ? object.hasOwnProperty : isProperty;
	          for (property in object) {
	            // Gecko <= 1.0 enumerates the `prototype` property of functions under
	            // certain conditions; IE does not.
	            if (!(isFunction && property == "prototype") && hasProperty.call(object, property)) {
	              callback(property);
	            }
	          }
	          // Manually invoke the callback for each non-enumerable property.
	          for (length = members.length; property = members[--length]; hasProperty.call(object, property) && callback(property));
	        };
	      } else if (size == 2) {
	        // Safari <= 2.0.4 enumerates shadowed properties twice.
	        forEach = function (object, callback) {
	          // Create a set of iterated properties.
	          var members = {}, isFunction = getClass.call(object) == functionClass, property;
	          for (property in object) {
	            // Store each property name to prevent double enumeration. The
	            // `prototype` property of functions is not enumerated due to cross-
	            // environment inconsistencies.
	            if (!(isFunction && property == "prototype") && !isProperty.call(members, property) && (members[property] = 1) && isProperty.call(object, property)) {
	              callback(property);
	            }
	          }
	        };
	      } else {
	        // No bugs detected; use the standard `for...in` algorithm.
	        forEach = function (object, callback) {
	          var isFunction = getClass.call(object) == functionClass, property, isConstructor;
	          for (property in object) {
	            if (!(isFunction && property == "prototype") && isProperty.call(object, property) && !(isConstructor = property === "constructor")) {
	              callback(property);
	            }
	          }
	          // Manually invoke the callback for the `constructor` property due to
	          // cross-environment inconsistencies.
	          if (isConstructor || isProperty.call(object, (property = "constructor"))) {
	            callback(property);
	          }
	        };
	      }
	      return forEach(object, callback);
	    };

	    // Public: Serializes a JavaScript `value` as a JSON string. The optional
	    // `filter` argument may specify either a function that alters how object and
	    // array members are serialized, or an array of strings and numbers that
	    // indicates which properties should be serialized. The optional `width`
	    // argument may be either a string or number that specifies the indentation
	    // level of the output.
	    if (!has("json-stringify")) {
	      // Internal: A map of control characters and their escaped equivalents.
	      var Escapes = {
	        92: "\\\\",
	        34: '\\"',
	        8: "\\b",
	        12: "\\f",
	        10: "\\n",
	        13: "\\r",
	        9: "\\t"
	      };

	      // Internal: Converts `value` into a zero-padded string such that its
	      // length is at least equal to `width`. The `width` must be <= 6.
	      var leadingZeroes = "000000";
	      var toPaddedString = function (width, value) {
	        // The `|| 0` expression is necessary to work around a bug in
	        // Opera <= 7.54u2 where `0 == -0`, but `String(-0) !== "0"`.
	        return (leadingZeroes + (value || 0)).slice(-width);
	      };

	      // Internal: Double-quotes a string `value`, replacing all ASCII control
	      // characters (characters with code unit values between 0 and 31) with
	      // their escaped equivalents. This is an implementation of the
	      // `Quote(value)` operation defined in ES 5.1 section 15.12.3.
	      var unicodePrefix = "\\u00";
	      var quote = function (value) {
	        var result = '"', index = 0, length = value.length, isLarge = length > 10 && charIndexBuggy, symbols;
	        if (isLarge) {
	          symbols = value.split("");
	        }
	        for (; index < length; index++) {
	          var charCode = value.charCodeAt(index);
	          // If the character is a control character, append its Unicode or
	          // shorthand escape sequence; otherwise, append the character as-is.
	          switch (charCode) {
	            case 8: case 9: case 10: case 12: case 13: case 34: case 92:
	              result += Escapes[charCode];
	              break;
	            default:
	              if (charCode < 32) {
	                result += unicodePrefix + toPaddedString(2, charCode.toString(16));
	                break;
	              }
	              result += isLarge ? symbols[index] : charIndexBuggy ? value.charAt(index) : value[index];
	          }
	        }
	        return result + '"';
	      };

	      // Internal: Recursively serializes an object. Implements the
	      // `Str(key, holder)`, `JO(value)`, and `JA(value)` operations.
	      var serialize = function (property, object, callback, properties, whitespace, indentation, stack) {
	        var value, className, year, month, date, time, hours, minutes, seconds, milliseconds, results, element, index, length, prefix, result;
	        try {
	          // Necessary for host object support.
	          value = object[property];
	        } catch (exception) {}
	        if (typeof value == "object" && value) {
	          className = getClass.call(value);
	          if (className == dateClass && !isProperty.call(value, "toJSON")) {
	            if (value > -1 / 0 && value < 1 / 0) {
	              // Dates are serialized according to the `Date#toJSON` method
	              // specified in ES 5.1 section 15.9.5.44. See section 15.9.1.15
	              // for the ISO 8601 date time string format.
	              if (getDay) {
	                // Manually compute the year, month, date, hours, minutes,
	                // seconds, and milliseconds if the `getUTC*` methods are
	                // buggy. Adapted from @Yaffle's `date-shim` project.
	                date = floor(value / 864e5);
	                for (year = floor(date / 365.2425) + 1970 - 1; getDay(year + 1, 0) <= date; year++);
	                for (month = floor((date - getDay(year, 0)) / 30.42); getDay(year, month + 1) <= date; month++);
	                date = 1 + date - getDay(year, month);
	                // The `time` value specifies the time within the day (see ES
	                // 5.1 section 15.9.1.2). The formula `(A % B + B) % B` is used
	                // to compute `A modulo B`, as the `%` operator does not
	                // correspond to the `modulo` operation for negative numbers.
	                time = (value % 864e5 + 864e5) % 864e5;
	                // The hours, minutes, seconds, and milliseconds are obtained by
	                // decomposing the time within the day. See section 15.9.1.10.
	                hours = floor(time / 36e5) % 24;
	                minutes = floor(time / 6e4) % 60;
	                seconds = floor(time / 1e3) % 60;
	                milliseconds = time % 1e3;
	              } else {
	                year = value.getUTCFullYear();
	                month = value.getUTCMonth();
	                date = value.getUTCDate();
	                hours = value.getUTCHours();
	                minutes = value.getUTCMinutes();
	                seconds = value.getUTCSeconds();
	                milliseconds = value.getUTCMilliseconds();
	              }
	              // Serialize extended years correctly.
	              value = (year <= 0 || year >= 1e4 ? (year < 0 ? "-" : "+") + toPaddedString(6, year < 0 ? -year : year) : toPaddedString(4, year)) +
	                "-" + toPaddedString(2, month + 1) + "-" + toPaddedString(2, date) +
	                // Months, dates, hours, minutes, and seconds should have two
	                // digits; milliseconds should have three.
	                "T" + toPaddedString(2, hours) + ":" + toPaddedString(2, minutes) + ":" + toPaddedString(2, seconds) +
	                // Milliseconds are optional in ES 5.0, but required in 5.1.
	                "." + toPaddedString(3, milliseconds) + "Z";
	            } else {
	              value = null;
	            }
	          } else if (typeof value.toJSON == "function" && ((className != numberClass && className != stringClass && className != arrayClass) || isProperty.call(value, "toJSON"))) {
	            // Prototype <= 1.6.1 adds non-standard `toJSON` methods to the
	            // `Number`, `String`, `Date`, and `Array` prototypes. JSON 3
	            // ignores all `toJSON` methods on these objects unless they are
	            // defined directly on an instance.
	            value = value.toJSON(property);
	          }
	        }
	        if (callback) {
	          // If a replacement function was provided, call it to obtain the value
	          // for serialization.
	          value = callback.call(object, property, value);
	        }
	        if (value === null) {
	          return "null";
	        }
	        className = getClass.call(value);
	        if (className == booleanClass) {
	          // Booleans are represented literally.
	          return "" + value;
	        } else if (className == numberClass) {
	          // JSON numbers must be finite. `Infinity` and `NaN` are serialized as
	          // `"null"`.
	          return value > -1 / 0 && value < 1 / 0 ? "" + value : "null";
	        } else if (className == stringClass) {
	          // Strings are double-quoted and escaped.
	          return quote("" + value);
	        }
	        // Recursively serialize objects and arrays.
	        if (typeof value == "object") {
	          // Check for cyclic structures. This is a linear search; performance
	          // is inversely proportional to the number of unique nested objects.
	          for (length = stack.length; length--;) {
	            if (stack[length] === value) {
	              // Cyclic structures cannot be serialized by `JSON.stringify`.
	              throw TypeError();
	            }
	          }
	          // Add the object to the stack of traversed objects.
	          stack.push(value);
	          results = [];
	          // Save the current indentation level and indent one additional level.
	          prefix = indentation;
	          indentation += whitespace;
	          if (className == arrayClass) {
	            // Recursively serialize array elements.
	            for (index = 0, length = value.length; index < length; index++) {
	              element = serialize(index, value, callback, properties, whitespace, indentation, stack);
	              results.push(element === undef ? "null" : element);
	            }
	            result = results.length ? (whitespace ? "[\n" + indentation + results.join(",\n" + indentation) + "\n" + prefix + "]" : ("[" + results.join(",") + "]")) : "[]";
	          } else {
	            // Recursively serialize object members. Members are selected from
	            // either a user-specified list of property names, or the object
	            // itself.
	            forEach(properties || value, function (property) {
	              var element = serialize(property, value, callback, properties, whitespace, indentation, stack);
	              if (element !== undef) {
	                // According to ES 5.1 section 15.12.3: "If `gap` {whitespace}
	                // is not the empty string, let `member` {quote(property) + ":"}
	                // be the concatenation of `member` and the `space` character."
	                // The "`space` character" refers to the literal space
	                // character, not the `space` {width} argument provided to
	                // `JSON.stringify`.
	                results.push(quote(property) + ":" + (whitespace ? " " : "") + element);
	              }
	            });
	            result = results.length ? (whitespace ? "{\n" + indentation + results.join(",\n" + indentation) + "\n" + prefix + "}" : ("{" + results.join(",") + "}")) : "{}";
	          }
	          // Remove the object from the traversed object stack.
	          stack.pop();
	          return result;
	        }
	      };

	      // Public: `JSON.stringify`. See ES 5.1 section 15.12.3.
	      JSON3.stringify = function (source, filter, width) {
	        var whitespace, callback, properties, className;
	        if (typeof filter == "function" || typeof filter == "object" && filter) {
	          if ((className = getClass.call(filter)) == functionClass) {
	            callback = filter;
	          } else if (className == arrayClass) {
	            // Convert the property names array into a makeshift set.
	            properties = {};
	            for (var index = 0, length = filter.length, value; index < length; value = filter[index++], ((className = getClass.call(value)), className == stringClass || className == numberClass) && (properties[value] = 1));
	          }
	        }
	        if (width) {
	          if ((className = getClass.call(width)) == numberClass) {
	            // Convert the `width` to an integer and create a string containing
	            // `width` number of space characters.
	            if ((width -= width % 1) > 0) {
	              for (whitespace = "", width > 10 && (width = 10); whitespace.length < width; whitespace += " ");
	            }
	          } else if (className == stringClass) {
	            whitespace = width.length <= 10 ? width : width.slice(0, 10);
	          }
	        }
	        // Opera <= 7.54u2 discards the values associated with empty string keys
	        // (`""`) only if they are used directly within an object member list
	        // (e.g., `!("" in { "": 1})`).
	        return serialize("", (value = {}, value[""] = source, value), callback, properties, whitespace, "", []);
	      };
	    }

	    // Public: Parses a JSON source string.
	    if (!has("json-parse")) {
	      var fromCharCode = String.fromCharCode;

	      // Internal: A map of escaped control characters and their unescaped
	      // equivalents.
	      var Unescapes = {
	        92: "\\",
	        34: '"',
	        47: "/",
	        98: "\b",
	        116: "\t",
	        110: "\n",
	        102: "\f",
	        114: "\r"
	      };

	      // Internal: Stores the parser state.
	      var Index, Source;

	      // Internal: Resets the parser state and throws a `SyntaxError`.
	      var abort = function() {
	        Index = Source = null;
	        throw SyntaxError();
	      };

	      // Internal: Returns the next token, or `"$"` if the parser has reached
	      // the end of the source string. A token may be a string, number, `null`
	      // literal, or Boolean literal.
	      var lex = function () {
	        var source = Source, length = source.length, value, begin, position, isSigned, charCode;
	        while (Index < length) {
	          charCode = source.charCodeAt(Index);
	          switch (charCode) {
	            case 9: case 10: case 13: case 32:
	              // Skip whitespace tokens, including tabs, carriage returns, line
	              // feeds, and space characters.
	              Index++;
	              break;
	            case 123: case 125: case 91: case 93: case 58: case 44:
	              // Parse a punctuator token (`{`, `}`, `[`, `]`, `:`, or `,`) at
	              // the current position.
	              value = charIndexBuggy ? source.charAt(Index) : source[Index];
	              Index++;
	              return value;
	            case 34:
	              // `"` delimits a JSON string; advance to the next character and
	              // begin parsing the string. String tokens are prefixed with the
	              // sentinel `@` character to distinguish them from punctuators and
	              // end-of-string tokens.
	              for (value = "@", Index++; Index < length;) {
	                charCode = source.charCodeAt(Index);
	                if (charCode < 32) {
	                  // Unescaped ASCII control characters (those with a code unit
	                  // less than the space character) are not permitted.
	                  abort();
	                } else if (charCode == 92) {
	                  // A reverse solidus (`\`) marks the beginning of an escaped
	                  // control character (including `"`, `\`, and `/`) or Unicode
	                  // escape sequence.
	                  charCode = source.charCodeAt(++Index);
	                  switch (charCode) {
	                    case 92: case 34: case 47: case 98: case 116: case 110: case 102: case 114:
	                      // Revive escaped control characters.
	                      value += Unescapes[charCode];
	                      Index++;
	                      break;
	                    case 117:
	                      // `\u` marks the beginning of a Unicode escape sequence.
	                      // Advance to the first character and validate the
	                      // four-digit code point.
	                      begin = ++Index;
	                      for (position = Index + 4; Index < position; Index++) {
	                        charCode = source.charCodeAt(Index);
	                        // A valid sequence comprises four hexdigits (case-
	                        // insensitive) that form a single hexadecimal value.
	                        if (!(charCode >= 48 && charCode <= 57 || charCode >= 97 && charCode <= 102 || charCode >= 65 && charCode <= 70)) {
	                          // Invalid Unicode escape sequence.
	                          abort();
	                        }
	                      }
	                      // Revive the escaped character.
	                      value += fromCharCode("0x" + source.slice(begin, Index));
	                      break;
	                    default:
	                      // Invalid escape sequence.
	                      abort();
	                  }
	                } else {
	                  if (charCode == 34) {
	                    // An unescaped double-quote character marks the end of the
	                    // string.
	                    break;
	                  }
	                  charCode = source.charCodeAt(Index);
	                  begin = Index;
	                  // Optimize for the common case where a string is valid.
	                  while (charCode >= 32 && charCode != 92 && charCode != 34) {
	                    charCode = source.charCodeAt(++Index);
	                  }
	                  // Append the string as-is.
	                  value += source.slice(begin, Index);
	                }
	              }
	              if (source.charCodeAt(Index) == 34) {
	                // Advance to the next character and return the revived string.
	                Index++;
	                return value;
	              }
	              // Unterminated string.
	              abort();
	            default:
	              // Parse numbers and literals.
	              begin = Index;
	              // Advance past the negative sign, if one is specified.
	              if (charCode == 45) {
	                isSigned = true;
	                charCode = source.charCodeAt(++Index);
	              }
	              // Parse an integer or floating-point value.
	              if (charCode >= 48 && charCode <= 57) {
	                // Leading zeroes are interpreted as octal literals.
	                if (charCode == 48 && ((charCode = source.charCodeAt(Index + 1)), charCode >= 48 && charCode <= 57)) {
	                  // Illegal octal literal.
	                  abort();
	                }
	                isSigned = false;
	                // Parse the integer component.
	                for (; Index < length && ((charCode = source.charCodeAt(Index)), charCode >= 48 && charCode <= 57); Index++);
	                // Floats cannot contain a leading decimal point; however, this
	                // case is already accounted for by the parser.
	                if (source.charCodeAt(Index) == 46) {
	                  position = ++Index;
	                  // Parse the decimal component.
	                  for (; position < length && ((charCode = source.charCodeAt(position)), charCode >= 48 && charCode <= 57); position++);
	                  if (position == Index) {
	                    // Illegal trailing decimal.
	                    abort();
	                  }
	                  Index = position;
	                }
	                // Parse exponents. The `e` denoting the exponent is
	                // case-insensitive.
	                charCode = source.charCodeAt(Index);
	                if (charCode == 101 || charCode == 69) {
	                  charCode = source.charCodeAt(++Index);
	                  // Skip past the sign following the exponent, if one is
	                  // specified.
	                  if (charCode == 43 || charCode == 45) {
	                    Index++;
	                  }
	                  // Parse the exponential component.
	                  for (position = Index; position < length && ((charCode = source.charCodeAt(position)), charCode >= 48 && charCode <= 57); position++);
	                  if (position == Index) {
	                    // Illegal empty exponent.
	                    abort();
	                  }
	                  Index = position;
	                }
	                // Coerce the parsed value to a JavaScript number.
	                return +source.slice(begin, Index);
	              }
	              // A negative sign may only precede numbers.
	              if (isSigned) {
	                abort();
	              }
	              // `true`, `false`, and `null` literals.
	              if (source.slice(Index, Index + 4) == "true") {
	                Index += 4;
	                return true;
	              } else if (source.slice(Index, Index + 5) == "false") {
	                Index += 5;
	                return false;
	              } else if (source.slice(Index, Index + 4) == "null") {
	                Index += 4;
	                return null;
	              }
	              // Unrecognized token.
	              abort();
	          }
	        }
	        // Return the sentinel `$` character if the parser has reached the end
	        // of the source string.
	        return "$";
	      };

	      // Internal: Parses a JSON `value` token.
	      var get = function (value) {
	        var results, hasMembers;
	        if (value == "$") {
	          // Unexpected end of input.
	          abort();
	        }
	        if (typeof value == "string") {
	          if ((charIndexBuggy ? value.charAt(0) : value[0]) == "@") {
	            // Remove the sentinel `@` character.
	            return value.slice(1);
	          }
	          // Parse object and array literals.
	          if (value == "[") {
	            // Parses a JSON array, returning a new JavaScript array.
	            results = [];
	            for (;; hasMembers || (hasMembers = true)) {
	              value = lex();
	              // A closing square bracket marks the end of the array literal.
	              if (value == "]") {
	                break;
	              }
	              // If the array literal contains elements, the current token
	              // should be a comma separating the previous element from the
	              // next.
	              if (hasMembers) {
	                if (value == ",") {
	                  value = lex();
	                  if (value == "]") {
	                    // Unexpected trailing `,` in array literal.
	                    abort();
	                  }
	                } else {
	                  // A `,` must separate each array element.
	                  abort();
	                }
	              }
	              // Elisions and leading commas are not permitted.
	              if (value == ",") {
	                abort();
	              }
	              results.push(get(value));
	            }
	            return results;
	          } else if (value == "{") {
	            // Parses a JSON object, returning a new JavaScript object.
	            results = {};
	            for (;; hasMembers || (hasMembers = true)) {
	              value = lex();
	              // A closing curly brace marks the end of the object literal.
	              if (value == "}") {
	                break;
	              }
	              // If the object literal contains members, the current token
	              // should be a comma separator.
	              if (hasMembers) {
	                if (value == ",") {
	                  value = lex();
	                  if (value == "}") {
	                    // Unexpected trailing `,` in object literal.
	                    abort();
	                  }
	                } else {
	                  // A `,` must separate each object member.
	                  abort();
	                }
	              }
	              // Leading commas are not permitted, object property names must be
	              // double-quoted strings, and a `:` must separate each property
	              // name and value.
	              if (value == "," || typeof value != "string" || (charIndexBuggy ? value.charAt(0) : value[0]) != "@" || lex() != ":") {
	                abort();
	              }
	              results[value.slice(1)] = get(lex());
	            }
	            return results;
	          }
	          // Unexpected token encountered.
	          abort();
	        }
	        return value;
	      };

	      // Internal: Updates a traversed object member.
	      var update = function(source, property, callback) {
	        var element = walk(source, property, callback);
	        if (element === undef) {
	          delete source[property];
	        } else {
	          source[property] = element;
	        }
	      };

	      // Internal: Recursively traverses a parsed JSON object, invoking the
	      // `callback` function for each value. This is an implementation of the
	      // `Walk(holder, name)` operation defined in ES 5.1 section 15.12.2.
	      var walk = function (source, property, callback) {
	        var value = source[property], length;
	        if (typeof value == "object" && value) {
	          // `forEach` can't be used to traverse an array in Opera <= 8.54
	          // because its `Object#hasOwnProperty` implementation returns `false`
	          // for array indices (e.g., `![1, 2, 3].hasOwnProperty("0")`).
	          if (getClass.call(value) == arrayClass) {
	            for (length = value.length; length--;) {
	              update(value, length, callback);
	            }
	          } else {
	            forEach(value, function (property) {
	              update(value, property, callback);
	            });
	          }
	        }
	        return callback.call(source, property, value);
	      };

	      // Public: `JSON.parse`. See ES 5.1 section 15.12.2.
	      JSON3.parse = function (source, callback) {
	        var result, value;
	        Index = 0;
	        Source = "" + source;
	        result = get(lex());
	        // If a JSON string contains multiple tokens, it is invalid.
	        if (lex() != "$") {
	          abort();
	        }
	        // Reset the parser state.
	        Index = Source = null;
	        return callback && getClass.call(callback) == functionClass ? walk((value = {}, value[""] = result, value), "", callback) : result;
	      };
	    }
	  }

	  // Export for asynchronous module loaders.
	  if (isLoader) {
	    !(__WEBPACK_AMD_DEFINE_RESULT__ = function () {
	      return JSON3;
	    }.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	  }
	}(this));


/***/ },
/* 61 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Expose `debug()` as the module.
	 */

	module.exports = debug;

	/**
	 * Create a debugger with the given `name`.
	 *
	 * @param {String} name
	 * @return {Type}
	 * @api public
	 */

	function debug(name) {
	  if (!debug.enabled(name)) return function(){};

	  return function(fmt){
	    fmt = coerce(fmt);

	    var curr = new Date;
	    var ms = curr - (debug[name] || curr);
	    debug[name] = curr;

	    fmt = name
	      + ' '
	      + fmt
	      + ' +' + debug.humanize(ms);

	    // This hackery is required for IE8
	    // where `console.log` doesn't have 'apply'
	    window.console
	      && console.log
	      && Function.prototype.apply.call(console.log, console, arguments);
	  }
	}

	/**
	 * The currently active debug mode names.
	 */

	debug.names = [];
	debug.skips = [];

	/**
	 * Enables a debug mode by name. This can include modes
	 * separated by a colon and wildcards.
	 *
	 * @param {String} name
	 * @api public
	 */

	debug.enable = function(name) {
	  try {
	    localStorage.debug = name;
	  } catch(e){}

	  var split = (name || '').split(/[\s,]+/)
	    , len = split.length;

	  for (var i = 0; i < len; i++) {
	    name = split[i].replace('*', '.*?');
	    if (name[0] === '-') {
	      debug.skips.push(new RegExp('^' + name.substr(1) + '$'));
	    }
	    else {
	      debug.names.push(new RegExp('^' + name + '$'));
	    }
	  }
	};

	/**
	 * Disable debug output.
	 *
	 * @api public
	 */

	debug.disable = function(){
	  debug.enable('');
	};

	/**
	 * Humanize the given `ms`.
	 *
	 * @param {Number} m
	 * @return {String}
	 * @api private
	 */

	debug.humanize = function(ms) {
	  var sec = 1000
	    , min = 60 * 1000
	    , hour = 60 * min;

	  if (ms >= hour) return (ms / hour).toFixed(1) + 'h';
	  if (ms >= min) return (ms / min).toFixed(1) + 'm';
	  if (ms >= sec) return (ms / sec | 0) + 's';
	  return ms + 'ms';
	};

	/**
	 * Returns true if the given mode name is enabled, false otherwise.
	 *
	 * @param {String} name
	 * @return {Boolean}
	 * @api public
	 */

	debug.enabled = function(name) {
	  for (var i = 0, len = debug.skips.length; i < len; i++) {
	    if (debug.skips[i].test(name)) {
	      return false;
	    }
	  }
	  for (var i = 0, len = debug.names.length; i < len; i++) {
	    if (debug.names[i].test(name)) {
	      return true;
	    }
	  }
	  return false;
	};

	/**
	 * Coerce `val`.
	 */

	function coerce(val) {
	  if (val instanceof Error) return val.stack || val.message;
	  return val;
	}

	// persist

	try {
	  if (window.localStorage) debug.enable(localStorage.debug);
	} catch(e){}


/***/ },
/* 62 */
/***/ function(module, exports, __webpack_require__) {

	
	module.exports = __webpack_require__(63);

	/**
	 * Exports parser
	 *
	 * @api public
	 *
	 */
	module.exports.parser = __webpack_require__(65);


/***/ },
/* 63 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Module dependencies.
	 */

	var transports = __webpack_require__(67);
	var Emitter = __webpack_require__(52);
	var debug = __webpack_require__(73)('engine.io-client:socket');
	var index = __webpack_require__(56);
	var parser = __webpack_require__(65);
	var parseuri = __webpack_require__(68);
	var parsejson = __webpack_require__(69);
	var parseqs = __webpack_require__(70);

	/**
	 * Module exports.
	 */

	module.exports = Socket;

	/**
	 * Noop function.
	 *
	 * @api private
	 */

	function noop(){}

	/**
	 * Socket constructor.
	 *
	 * @param {String|Object} uri or options
	 * @param {Object} options
	 * @api public
	 */

	function Socket(uri, opts){
	  if (!(this instanceof Socket)) return new Socket(uri, opts);

	  opts = opts || {};

	  if (uri && 'object' == typeof uri) {
	    opts = uri;
	    uri = null;
	  }

	  if (uri) {
	    uri = parseuri(uri);
	    opts.host = uri.host;
	    opts.secure = uri.protocol == 'https' || uri.protocol == 'wss';
	    opts.port = uri.port;
	    if (uri.query) opts.query = uri.query;
	  }

	  this.secure = null != opts.secure ? opts.secure :
	    (global.location && 'https:' == location.protocol);

	  if (opts.host) {
	    var pieces = opts.host.split(':');
	    opts.hostname = pieces.shift();
	    if (pieces.length) {
	      opts.port = pieces.pop();
	    } else if (!opts.port) {
	      // if no port is specified manually, use the protocol default
	      opts.port = this.secure ? '443' : '80';
	    }
	  }

	  this.agent = opts.agent || false;
	  this.hostname = opts.hostname ||
	    (global.location ? location.hostname : 'localhost');
	  this.port = opts.port || (global.location && location.port ?
	       location.port :
	       (this.secure ? 443 : 80));
	  this.query = opts.query || {};
	  if ('string' == typeof this.query) this.query = parseqs.decode(this.query);
	  this.upgrade = false !== opts.upgrade;
	  this.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
	  this.forceJSONP = !!opts.forceJSONP;
	  this.jsonp = false !== opts.jsonp;
	  this.forceBase64 = !!opts.forceBase64;
	  this.enablesXDR = !!opts.enablesXDR;
	  this.timestampParam = opts.timestampParam || 't';
	  this.timestampRequests = opts.timestampRequests;
	  this.transports = opts.transports || ['polling', 'websocket'];
	  this.readyState = '';
	  this.writeBuffer = [];
	  this.callbackBuffer = [];
	  this.policyPort = opts.policyPort || 843;
	  this.rememberUpgrade = opts.rememberUpgrade || false;
	  this.binaryType = null;
	  this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;

	  // SSL options for Node.js client
	  this.pfx = opts.pfx || null;
	  this.key = opts.key || null;
	  this.passphrase = opts.passphrase || null;
	  this.cert = opts.cert || null;
	  this.ca = opts.ca || null;
	  this.ciphers = opts.ciphers || null;
	  this.rejectUnauthorized = opts.rejectUnauthorized || null;

	  this.open();
	}

	Socket.priorWebsocketSuccess = false;

	/**
	 * Mix in `Emitter`.
	 */

	Emitter(Socket.prototype);

	/**
	 * Protocol version.
	 *
	 * @api public
	 */

	Socket.protocol = parser.protocol; // this is an int

	/**
	 * Expose deps for legacy compatibility
	 * and standalone browser access.
	 */

	Socket.Socket = Socket;
	Socket.Transport = __webpack_require__(66);
	Socket.transports = __webpack_require__(67);
	Socket.parser = __webpack_require__(65);

	/**
	 * Creates transport of the given type.
	 *
	 * @param {String} transport name
	 * @return {Transport}
	 * @api private
	 */

	Socket.prototype.createTransport = function (name) {
	  debug('creating transport "%s"', name);
	  var query = clone(this.query);

	  // append engine.io protocol identifier
	  query.EIO = parser.protocol;

	  // transport name
	  query.transport = name;

	  // session id if we already have one
	  if (this.id) query.sid = this.id;

	  var transport = new transports[name]({
	    agent: this.agent,
	    hostname: this.hostname,
	    port: this.port,
	    secure: this.secure,
	    path: this.path,
	    query: query,
	    forceJSONP: this.forceJSONP,
	    jsonp: this.jsonp,
	    forceBase64: this.forceBase64,
	    enablesXDR: this.enablesXDR,
	    timestampRequests: this.timestampRequests,
	    timestampParam: this.timestampParam,
	    policyPort: this.policyPort,
	    socket: this,
	    pfx: this.pfx,
	    key: this.key,
	    passphrase: this.passphrase,
	    cert: this.cert,
	    ca: this.ca,
	    ciphers: this.ciphers,
	    rejectUnauthorized: this.rejectUnauthorized
	  });

	  return transport;
	};

	function clone (obj) {
	  var o = {};
	  for (var i in obj) {
	    if (obj.hasOwnProperty(i)) {
	      o[i] = obj[i];
	    }
	  }
	  return o;
	}

	/**
	 * Initializes transport to use and starts probe.
	 *
	 * @api private
	 */
	Socket.prototype.open = function () {
	  var transport;
	  if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf('websocket') != -1) {
	    transport = 'websocket';
	  } else if (0 == this.transports.length) {
	    // Emit error on next tick so it can be listened to
	    var self = this;
	    setTimeout(function() {
	      self.emit('error', 'No transports available');
	    }, 0);
	    return;
	  } else {
	    transport = this.transports[0];
	  }
	  this.readyState = 'opening';

	  // Retry with the next transport if the transport is disabled (jsonp: false)
	  var transport;
	  try {
	    transport = this.createTransport(transport);
	  } catch (e) {
	    this.transports.shift();
	    this.open();
	    return;
	  }

	  transport.open();
	  this.setTransport(transport);
	};

	/**
	 * Sets the current transport. Disables the existing one (if any).
	 *
	 * @api private
	 */

	Socket.prototype.setTransport = function(transport){
	  debug('setting transport %s', transport.name);
	  var self = this;

	  if (this.transport) {
	    debug('clearing existing transport %s', this.transport.name);
	    this.transport.removeAllListeners();
	  }

	  // set up transport
	  this.transport = transport;

	  // set up transport listeners
	  transport
	  .on('drain', function(){
	    self.onDrain();
	  })
	  .on('packet', function(packet){
	    self.onPacket(packet);
	  })
	  .on('error', function(e){
	    self.onError(e);
	  })
	  .on('close', function(){
	    self.onClose('transport close');
	  });
	};

	/**
	 * Probes a transport.
	 *
	 * @param {String} transport name
	 * @api private
	 */

	Socket.prototype.probe = function (name) {
	  debug('probing transport "%s"', name);
	  var transport = this.createTransport(name, { probe: 1 })
	    , failed = false
	    , self = this;

	  Socket.priorWebsocketSuccess = false;

	  function onTransportOpen(){
	    if (self.onlyBinaryUpgrades) {
	      var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
	      failed = failed || upgradeLosesBinary;
	    }
	    if (failed) return;

	    debug('probe transport "%s" opened', name);
	    transport.send([{ type: 'ping', data: 'probe' }]);
	    transport.once('packet', function (msg) {
	      if (failed) return;
	      if ('pong' == msg.type && 'probe' == msg.data) {
	        debug('probe transport "%s" pong', name);
	        self.upgrading = true;
	        self.emit('upgrading', transport);
	        if (!transport) return;
	        Socket.priorWebsocketSuccess = 'websocket' == transport.name;

	        debug('pausing current transport "%s"', self.transport.name);
	        self.transport.pause(function () {
	          if (failed) return;
	          if ('closed' == self.readyState) return;
	          debug('changing transport and sending upgrade packet');

	          cleanup();

	          self.setTransport(transport);
	          transport.send([{ type: 'upgrade' }]);
	          self.emit('upgrade', transport);
	          transport = null;
	          self.upgrading = false;
	          self.flush();
	        });
	      } else {
	        debug('probe transport "%s" failed', name);
	        var err = new Error('probe error');
	        err.transport = transport.name;
	        self.emit('upgradeError', err);
	      }
	    });
	  }

	  function freezeTransport() {
	    if (failed) return;

	    // Any callback called by transport should be ignored since now
	    failed = true;

	    cleanup();

	    transport.close();
	    transport = null;
	  }

	  //Handle any error that happens while probing
	  function onerror(err) {
	    var error = new Error('probe error: ' + err);
	    error.transport = transport.name;

	    freezeTransport();

	    debug('probe transport "%s" failed because of error: %s', name, err);

	    self.emit('upgradeError', error);
	  }

	  function onTransportClose(){
	    onerror("transport closed");
	  }

	  //When the socket is closed while we're probing
	  function onclose(){
	    onerror("socket closed");
	  }

	  //When the socket is upgraded while we're probing
	  function onupgrade(to){
	    if (transport && to.name != transport.name) {
	      debug('"%s" works - aborting "%s"', to.name, transport.name);
	      freezeTransport();
	    }
	  }

	  //Remove all listeners on the transport and on self
	  function cleanup(){
	    transport.removeListener('open', onTransportOpen);
	    transport.removeListener('error', onerror);
	    transport.removeListener('close', onTransportClose);
	    self.removeListener('close', onclose);
	    self.removeListener('upgrading', onupgrade);
	  }

	  transport.once('open', onTransportOpen);
	  transport.once('error', onerror);
	  transport.once('close', onTransportClose);

	  this.once('close', onclose);
	  this.once('upgrading', onupgrade);

	  transport.open();

	};

	/**
	 * Called when connection is deemed open.
	 *
	 * @api public
	 */

	Socket.prototype.onOpen = function () {
	  debug('socket open');
	  this.readyState = 'open';
	  Socket.priorWebsocketSuccess = 'websocket' == this.transport.name;
	  this.emit('open');
	  this.flush();

	  // we check for `readyState` in case an `open`
	  // listener already closed the socket
	  if ('open' == this.readyState && this.upgrade && this.transport.pause) {
	    debug('starting upgrade probes');
	    for (var i = 0, l = this.upgrades.length; i < l; i++) {
	      this.probe(this.upgrades[i]);
	    }
	  }
	};

	/**
	 * Handles a packet.
	 *
	 * @api private
	 */

	Socket.prototype.onPacket = function (packet) {
	  if ('opening' == this.readyState || 'open' == this.readyState) {
	    debug('socket receive: type "%s", data "%s"', packet.type, packet.data);

	    this.emit('packet', packet);

	    // Socket is live - any packet counts
	    this.emit('heartbeat');

	    switch (packet.type) {
	      case 'open':
	        this.onHandshake(parsejson(packet.data));
	        break;

	      case 'pong':
	        this.setPing();
	        break;

	      case 'error':
	        var err = new Error('server error');
	        err.code = packet.data;
	        this.emit('error', err);
	        break;

	      case 'message':
	        this.emit('data', packet.data);
	        this.emit('message', packet.data);
	        break;
	    }
	  } else {
	    debug('packet received with socket readyState "%s"', this.readyState);
	  }
	};

	/**
	 * Called upon handshake completion.
	 *
	 * @param {Object} handshake obj
	 * @api private
	 */

	Socket.prototype.onHandshake = function (data) {
	  this.emit('handshake', data);
	  this.id = data.sid;
	  this.transport.query.sid = data.sid;
	  this.upgrades = this.filterUpgrades(data.upgrades);
	  this.pingInterval = data.pingInterval;
	  this.pingTimeout = data.pingTimeout;
	  this.onOpen();
	  // In case open handler closes socket
	  if  ('closed' == this.readyState) return;
	  this.setPing();

	  // Prolong liveness of socket on heartbeat
	  this.removeListener('heartbeat', this.onHeartbeat);
	  this.on('heartbeat', this.onHeartbeat);
	};

	/**
	 * Resets ping timeout.
	 *
	 * @api private
	 */

	Socket.prototype.onHeartbeat = function (timeout) {
	  clearTimeout(this.pingTimeoutTimer);
	  var self = this;
	  self.pingTimeoutTimer = setTimeout(function () {
	    if ('closed' == self.readyState) return;
	    self.onClose('ping timeout');
	  }, timeout || (self.pingInterval + self.pingTimeout));
	};

	/**
	 * Pings server every `this.pingInterval` and expects response
	 * within `this.pingTimeout` or closes connection.
	 *
	 * @api private
	 */

	Socket.prototype.setPing = function () {
	  var self = this;
	  clearTimeout(self.pingIntervalTimer);
	  self.pingIntervalTimer = setTimeout(function () {
	    debug('writing ping packet - expecting pong within %sms', self.pingTimeout);
	    self.ping();
	    self.onHeartbeat(self.pingTimeout);
	  }, self.pingInterval);
	};

	/**
	* Sends a ping packet.
	*
	* @api public
	*/

	Socket.prototype.ping = function () {
	  this.sendPacket('ping');
	};

	/**
	 * Called on `drain` event
	 *
	 * @api private
	 */

	Socket.prototype.onDrain = function() {
	  for (var i = 0; i < this.prevBufferLen; i++) {
	    if (this.callbackBuffer[i]) {
	      this.callbackBuffer[i]();
	    }
	  }

	  this.writeBuffer.splice(0, this.prevBufferLen);
	  this.callbackBuffer.splice(0, this.prevBufferLen);

	  // setting prevBufferLen = 0 is very important
	  // for example, when upgrading, upgrade packet is sent over,
	  // and a nonzero prevBufferLen could cause problems on `drain`
	  this.prevBufferLen = 0;

	  if (this.writeBuffer.length == 0) {
	    this.emit('drain');
	  } else {
	    this.flush();
	  }
	};

	/**
	 * Flush write buffers.
	 *
	 * @api private
	 */

	Socket.prototype.flush = function () {
	  if ('closed' != this.readyState && this.transport.writable &&
	    !this.upgrading && this.writeBuffer.length) {
	    debug('flushing %d packets in socket', this.writeBuffer.length);
	    this.transport.send(this.writeBuffer);
	    // keep track of current length of writeBuffer
	    // splice writeBuffer and callbackBuffer on `drain`
	    this.prevBufferLen = this.writeBuffer.length;
	    this.emit('flush');
	  }
	};

	/**
	 * Sends a message.
	 *
	 * @param {String} message.
	 * @param {Function} callback function.
	 * @return {Socket} for chaining.
	 * @api public
	 */

	Socket.prototype.write =
	Socket.prototype.send = function (msg, fn) {
	  this.sendPacket('message', msg, fn);
	  return this;
	};

	/**
	 * Sends a packet.
	 *
	 * @param {String} packet type.
	 * @param {String} data.
	 * @param {Function} callback function.
	 * @api private
	 */

	Socket.prototype.sendPacket = function (type, data, fn) {
	  if ('closing' == this.readyState || 'closed' == this.readyState) {
	    return;
	  }

	  var packet = { type: type, data: data };
	  this.emit('packetCreate', packet);
	  this.writeBuffer.push(packet);
	  this.callbackBuffer.push(fn);
	  this.flush();
	};

	/**
	 * Closes the connection.
	 *
	 * @api private
	 */

	Socket.prototype.close = function () {
	  if ('opening' == this.readyState || 'open' == this.readyState) {
	    this.readyState = 'closing';

	    var self = this;

	    function close() {
	      self.onClose('forced close');
	      debug('socket closing - telling transport to close');
	      self.transport.close();
	    }

	    function cleanupAndClose() {
	      self.removeListener('upgrade', cleanupAndClose);
	      self.removeListener('upgradeError', cleanupAndClose);
	      close();
	    }

	    function waitForUpgrade() {
	      // wait for upgrade to finish since we can't send packets while pausing a transport
	      self.once('upgrade', cleanupAndClose);
	      self.once('upgradeError', cleanupAndClose);
	    }

	    if (this.writeBuffer.length) {
	      this.once('drain', function() {
	        if (this.upgrading) {
	          waitForUpgrade();
	        } else {
	          close();
	        }
	      });
	    } else if (this.upgrading) {
	      waitForUpgrade();
	    } else {
	      close();
	    }
	  }

	  return this;
	};

	/**
	 * Called upon transport error
	 *
	 * @api private
	 */

	Socket.prototype.onError = function (err) {
	  debug('socket error %j', err);
	  Socket.priorWebsocketSuccess = false;
	  this.emit('error', err);
	  this.onClose('transport error', err);
	};

	/**
	 * Called upon transport close.
	 *
	 * @api private
	 */

	Socket.prototype.onClose = function (reason, desc) {
	  if ('opening' == this.readyState || 'open' == this.readyState || 'closing' == this.readyState) {
	    debug('socket close with reason: "%s"', reason);
	    var self = this;

	    // clear timers
	    clearTimeout(this.pingIntervalTimer);
	    clearTimeout(this.pingTimeoutTimer);

	    // clean buffers in next tick, so developers can still
	    // grab the buffers on `close` event
	    setTimeout(function() {
	      self.writeBuffer = [];
	      self.callbackBuffer = [];
	      self.prevBufferLen = 0;
	    }, 0);

	    // stop event from firing again for transport
	    this.transport.removeAllListeners('close');

	    // ensure transport won't stay open
	    this.transport.close();

	    // ignore further transport communication
	    this.transport.removeAllListeners();

	    // set ready state
	    this.readyState = 'closed';

	    // clear session id
	    this.id = null;

	    // emit close event
	    this.emit('close', reason, desc);
	  }
	};

	/**
	 * Filters upgrades, returning only those matching client transports.
	 *
	 * @param {Array} server upgrades
	 * @api private
	 *
	 */

	Socket.prototype.filterUpgrades = function (upgrades) {
	  var filteredUpgrades = [];
	  for (var i = 0, j = upgrades.length; i<j; i++) {
	    if (~index(this.transports, upgrades[i])) filteredUpgrades.push(upgrades[i]);
	  }
	  return filteredUpgrades;
	};

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 64 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(__webpack_amd_options__) {module.exports = __webpack_amd_options__;

	/* WEBPACK VAR INJECTION */}.call(exports, {}))

/***/ },
/* 65 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Module dependencies.
	 */

	var keys = __webpack_require__(72);
	var hasBinary = __webpack_require__(71);
	var sliceBuffer = __webpack_require__(78);
	var base64encoder = __webpack_require__(81);
	var after = __webpack_require__(79);
	var utf8 = __webpack_require__(82);

	/**
	 * Check if we are running an android browser. That requires us to use
	 * ArrayBuffer with polling transports...
	 *
	 * http://ghinda.net/jpeg-blob-ajax-android/
	 */

	var isAndroid = navigator.userAgent.match(/Android/i);

	/**
	 * Check if we are running in PhantomJS.
	 * Uploading a Blob with PhantomJS does not work correctly, as reported here:
	 * https://github.com/ariya/phantomjs/issues/11395
	 * @type boolean
	 */
	var isPhantomJS = /PhantomJS/i.test(navigator.userAgent);

	/**
	 * When true, avoids using Blobs to encode payloads.
	 * @type boolean
	 */
	var dontSendBlobs = isAndroid || isPhantomJS;

	/**
	 * Current protocol version.
	 */

	exports.protocol = 3;

	/**
	 * Packet types.
	 */

	var packets = exports.packets = {
	    open:     0    // non-ws
	  , close:    1    // non-ws
	  , ping:     2
	  , pong:     3
	  , message:  4
	  , upgrade:  5
	  , noop:     6
	};

	var packetslist = keys(packets);

	/**
	 * Premade error packet.
	 */

	var err = { type: 'error', data: 'parser error' };

	/**
	 * Create a blob api even for blob builder when vendor prefixes exist
	 */

	var Blob = __webpack_require__(80);

	/**
	 * Encodes a packet.
	 *
	 *     <packet type id> [ <data> ]
	 *
	 * Example:
	 *
	 *     5hello world
	 *     3
	 *     4
	 *
	 * Binary is encoded in an identical principle
	 *
	 * @api private
	 */

	exports.encodePacket = function (packet, supportsBinary, utf8encode, callback) {
	  if ('function' == typeof supportsBinary) {
	    callback = supportsBinary;
	    supportsBinary = false;
	  }

	  if ('function' == typeof utf8encode) {
	    callback = utf8encode;
	    utf8encode = null;
	  }

	  var data = (packet.data === undefined)
	    ? undefined
	    : packet.data.buffer || packet.data;

	  if (global.ArrayBuffer && data instanceof ArrayBuffer) {
	    return encodeArrayBuffer(packet, supportsBinary, callback);
	  } else if (Blob && data instanceof global.Blob) {
	    return encodeBlob(packet, supportsBinary, callback);
	  }

	  // might be an object with { base64: true, data: dataAsBase64String }
	  if (data && data.base64) {
	    return encodeBase64Object(packet, callback);
	  }

	  // Sending data as a utf-8 string
	  var encoded = packets[packet.type];

	  // data fragment is optional
	  if (undefined !== packet.data) {
	    encoded += utf8encode ? utf8.encode(String(packet.data)) : String(packet.data);
	  }

	  return callback('' + encoded);

	};

	function encodeBase64Object(packet, callback) {
	  // packet data is an object { base64: true, data: dataAsBase64String }
	  var message = 'b' + exports.packets[packet.type] + packet.data.data;
	  return callback(message);
	}

	/**
	 * Encode packet helpers for binary types
	 */

	function encodeArrayBuffer(packet, supportsBinary, callback) {
	  if (!supportsBinary) {
	    return exports.encodeBase64Packet(packet, callback);
	  }

	  var data = packet.data;
	  var contentArray = new Uint8Array(data);
	  var resultBuffer = new Uint8Array(1 + data.byteLength);

	  resultBuffer[0] = packets[packet.type];
	  for (var i = 0; i < contentArray.length; i++) {
	    resultBuffer[i+1] = contentArray[i];
	  }

	  return callback(resultBuffer.buffer);
	}

	function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
	  if (!supportsBinary) {
	    return exports.encodeBase64Packet(packet, callback);
	  }

	  var fr = new FileReader();
	  fr.onload = function() {
	    packet.data = fr.result;
	    exports.encodePacket(packet, supportsBinary, true, callback);
	  };
	  return fr.readAsArrayBuffer(packet.data);
	}

	function encodeBlob(packet, supportsBinary, callback) {
	  if (!supportsBinary) {
	    return exports.encodeBase64Packet(packet, callback);
	  }

	  if (dontSendBlobs) {
	    return encodeBlobAsArrayBuffer(packet, supportsBinary, callback);
	  }

	  var length = new Uint8Array(1);
	  length[0] = packets[packet.type];
	  var blob = new Blob([length.buffer, packet.data]);

	  return callback(blob);
	}

	/**
	 * Encodes a packet with binary data in a base64 string
	 *
	 * @param {Object} packet, has `type` and `data`
	 * @return {String} base64 encoded message
	 */

	exports.encodeBase64Packet = function(packet, callback) {
	  var message = 'b' + exports.packets[packet.type];
	  if (Blob && packet.data instanceof Blob) {
	    var fr = new FileReader();
	    fr.onload = function() {
	      var b64 = fr.result.split(',')[1];
	      callback(message + b64);
	    };
	    return fr.readAsDataURL(packet.data);
	  }

	  var b64data;
	  try {
	    b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
	  } catch (e) {
	    // iPhone Safari doesn't let you apply with typed arrays
	    var typed = new Uint8Array(packet.data);
	    var basic = new Array(typed.length);
	    for (var i = 0; i < typed.length; i++) {
	      basic[i] = typed[i];
	    }
	    b64data = String.fromCharCode.apply(null, basic);
	  }
	  message += global.btoa(b64data);
	  return callback(message);
	};

	/**
	 * Decodes a packet. Changes format to Blob if requested.
	 *
	 * @return {Object} with `type` and `data` (if any)
	 * @api private
	 */

	exports.decodePacket = function (data, binaryType, utf8decode) {
	  // String data
	  if (typeof data == 'string' || data === undefined) {
	    if (data.charAt(0) == 'b') {
	      return exports.decodeBase64Packet(data.substr(1), binaryType);
	    }

	    if (utf8decode) {
	      try {
	        data = utf8.decode(data);
	      } catch (e) {
	        return err;
	      }
	    }
	    var type = data.charAt(0);

	    if (Number(type) != type || !packetslist[type]) {
	      return err;
	    }

	    if (data.length > 1) {
	      return { type: packetslist[type], data: data.substring(1) };
	    } else {
	      return { type: packetslist[type] };
	    }
	  }

	  var asArray = new Uint8Array(data);
	  var type = asArray[0];
	  var rest = sliceBuffer(data, 1);
	  if (Blob && binaryType === 'blob') {
	    rest = new Blob([rest]);
	  }
	  return { type: packetslist[type], data: rest };
	};

	/**
	 * Decodes a packet encoded in a base64 string
	 *
	 * @param {String} base64 encoded message
	 * @return {Object} with `type` and `data` (if any)
	 */

	exports.decodeBase64Packet = function(msg, binaryType) {
	  var type = packetslist[msg.charAt(0)];
	  if (!global.ArrayBuffer) {
	    return { type: type, data: { base64: true, data: msg.substr(1) } };
	  }

	  var data = base64encoder.decode(msg.substr(1));

	  if (binaryType === 'blob' && Blob) {
	    data = new Blob([data]);
	  }

	  return { type: type, data: data };
	};

	/**
	 * Encodes multiple messages (payload).
	 *
	 *     <length>:data
	 *
	 * Example:
	 *
	 *     11:hello world2:hi
	 *
	 * If any contents are binary, they will be encoded as base64 strings. Base64
	 * encoded strings are marked with a b before the length specifier
	 *
	 * @param {Array} packets
	 * @api private
	 */

	exports.encodePayload = function (packets, supportsBinary, callback) {
	  if (typeof supportsBinary == 'function') {
	    callback = supportsBinary;
	    supportsBinary = null;
	  }

	  var isBinary = hasBinary(packets);

	  if (supportsBinary && isBinary) {
	    if (Blob && !dontSendBlobs) {
	      return exports.encodePayloadAsBlob(packets, callback);
	    }

	    return exports.encodePayloadAsArrayBuffer(packets, callback);
	  }

	  if (!packets.length) {
	    return callback('0:');
	  }

	  function setLengthHeader(message) {
	    return message.length + ':' + message;
	  }

	  function encodeOne(packet, doneCallback) {
	    exports.encodePacket(packet, !isBinary ? false : supportsBinary, true, function(message) {
	      doneCallback(null, setLengthHeader(message));
	    });
	  }

	  map(packets, encodeOne, function(err, results) {
	    return callback(results.join(''));
	  });
	};

	/**
	 * Async array map using after
	 */

	function map(ary, each, done) {
	  var result = new Array(ary.length);
	  var next = after(ary.length, done);

	  var eachWithIndex = function(i, el, cb) {
	    each(el, function(error, msg) {
	      result[i] = msg;
	      cb(error, result);
	    });
	  };

	  for (var i = 0; i < ary.length; i++) {
	    eachWithIndex(i, ary[i], next);
	  }
	}

	/*
	 * Decodes data when a payload is maybe expected. Possible binary contents are
	 * decoded from their base64 representation
	 *
	 * @param {String} data, callback method
	 * @api public
	 */

	exports.decodePayload = function (data, binaryType, callback) {
	  if (typeof data != 'string') {
	    return exports.decodePayloadAsBinary(data, binaryType, callback);
	  }

	  if (typeof binaryType === 'function') {
	    callback = binaryType;
	    binaryType = null;
	  }

	  var packet;
	  if (data == '') {
	    // parser error - ignoring payload
	    return callback(err, 0, 1);
	  }

	  var length = ''
	    , n, msg;

	  for (var i = 0, l = data.length; i < l; i++) {
	    var chr = data.charAt(i);

	    if (':' != chr) {
	      length += chr;
	    } else {
	      if ('' == length || (length != (n = Number(length)))) {
	        // parser error - ignoring payload
	        return callback(err, 0, 1);
	      }

	      msg = data.substr(i + 1, n);

	      if (length != msg.length) {
	        // parser error - ignoring payload
	        return callback(err, 0, 1);
	      }

	      if (msg.length) {
	        packet = exports.decodePacket(msg, binaryType, true);

	        if (err.type == packet.type && err.data == packet.data) {
	          // parser error in individual packet - ignoring payload
	          return callback(err, 0, 1);
	        }

	        var ret = callback(packet, i + n, l);
	        if (false === ret) return;
	      }

	      // advance cursor
	      i += n;
	      length = '';
	    }
	  }

	  if (length != '') {
	    // parser error - ignoring payload
	    return callback(err, 0, 1);
	  }

	};

	/**
	 * Encodes multiple messages (payload) as binary.
	 *
	 * <1 = binary, 0 = string><number from 0-9><number from 0-9>[...]<number
	 * 255><data>
	 *
	 * Example:
	 * 1 3 255 1 2 3, if the binary contents are interpreted as 8 bit integers
	 *
	 * @param {Array} packets
	 * @return {ArrayBuffer} encoded payload
	 * @api private
	 */

	exports.encodePayloadAsArrayBuffer = function(packets, callback) {
	  if (!packets.length) {
	    return callback(new ArrayBuffer(0));
	  }

	  function encodeOne(packet, doneCallback) {
	    exports.encodePacket(packet, true, true, function(data) {
	      return doneCallback(null, data);
	    });
	  }

	  map(packets, encodeOne, function(err, encodedPackets) {
	    var totalLength = encodedPackets.reduce(function(acc, p) {
	      var len;
	      if (typeof p === 'string'){
	        len = p.length;
	      } else {
	        len = p.byteLength;
	      }
	      return acc + len.toString().length + len + 2; // string/binary identifier + separator = 2
	    }, 0);

	    var resultArray = new Uint8Array(totalLength);

	    var bufferIndex = 0;
	    encodedPackets.forEach(function(p) {
	      var isString = typeof p === 'string';
	      var ab = p;
	      if (isString) {
	        var view = new Uint8Array(p.length);
	        for (var i = 0; i < p.length; i++) {
	          view[i] = p.charCodeAt(i);
	        }
	        ab = view.buffer;
	      }

	      if (isString) { // not true binary
	        resultArray[bufferIndex++] = 0;
	      } else { // true binary
	        resultArray[bufferIndex++] = 1;
	      }

	      var lenStr = ab.byteLength.toString();
	      for (var i = 0; i < lenStr.length; i++) {
	        resultArray[bufferIndex++] = parseInt(lenStr[i]);
	      }
	      resultArray[bufferIndex++] = 255;

	      var view = new Uint8Array(ab);
	      for (var i = 0; i < view.length; i++) {
	        resultArray[bufferIndex++] = view[i];
	      }
	    });

	    return callback(resultArray.buffer);
	  });
	};

	/**
	 * Encode as Blob
	 */

	exports.encodePayloadAsBlob = function(packets, callback) {
	  function encodeOne(packet, doneCallback) {
	    exports.encodePacket(packet, true, true, function(encoded) {
	      var binaryIdentifier = new Uint8Array(1);
	      binaryIdentifier[0] = 1;
	      if (typeof encoded === 'string') {
	        var view = new Uint8Array(encoded.length);
	        for (var i = 0; i < encoded.length; i++) {
	          view[i] = encoded.charCodeAt(i);
	        }
	        encoded = view.buffer;
	        binaryIdentifier[0] = 0;
	      }

	      var len = (encoded instanceof ArrayBuffer)
	        ? encoded.byteLength
	        : encoded.size;

	      var lenStr = len.toString();
	      var lengthAry = new Uint8Array(lenStr.length + 1);
	      for (var i = 0; i < lenStr.length; i++) {
	        lengthAry[i] = parseInt(lenStr[i]);
	      }
	      lengthAry[lenStr.length] = 255;

	      if (Blob) {
	        var blob = new Blob([binaryIdentifier.buffer, lengthAry.buffer, encoded]);
	        doneCallback(null, blob);
	      }
	    });
	  }

	  map(packets, encodeOne, function(err, results) {
	    return callback(new Blob(results));
	  });
	};

	/*
	 * Decodes data when a payload is maybe expected. Strings are decoded by
	 * interpreting each byte as a key code for entries marked to start with 0. See
	 * description of encodePayloadAsBinary
	 *
	 * @param {ArrayBuffer} data, callback method
	 * @api public
	 */

	exports.decodePayloadAsBinary = function (data, binaryType, callback) {
	  if (typeof binaryType === 'function') {
	    callback = binaryType;
	    binaryType = null;
	  }

	  var bufferTail = data;
	  var buffers = [];

	  var numberTooLong = false;
	  while (bufferTail.byteLength > 0) {
	    var tailArray = new Uint8Array(bufferTail);
	    var isString = tailArray[0] === 0;
	    var msgLength = '';

	    for (var i = 1; ; i++) {
	      if (tailArray[i] == 255) break;

	      if (msgLength.length > 310) {
	        numberTooLong = true;
	        break;
	      }

	      msgLength += tailArray[i];
	    }

	    if(numberTooLong) return callback(err, 0, 1);

	    bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
	    msgLength = parseInt(msgLength);

	    var msg = sliceBuffer(bufferTail, 0, msgLength);
	    if (isString) {
	      try {
	        msg = String.fromCharCode.apply(null, new Uint8Array(msg));
	      } catch (e) {
	        // iPhone Safari doesn't let you apply to typed arrays
	        var typed = new Uint8Array(msg);
	        msg = '';
	        for (var i = 0; i < typed.length; i++) {
	          msg += String.fromCharCode(typed[i]);
	        }
	      }
	    }

	    buffers.push(msg);
	    bufferTail = sliceBuffer(bufferTail, msgLength);
	  }

	  var total = buffers.length;
	  buffers.forEach(function(buffer, i) {
	    callback(exports.decodePacket(buffer, binaryType, true), i, total);
	  });
	};

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 66 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Module dependencies.
	 */

	var parser = __webpack_require__(65);
	var Emitter = __webpack_require__(52);

	/**
	 * Module exports.
	 */

	module.exports = Transport;

	/**
	 * Transport abstract constructor.
	 *
	 * @param {Object} options.
	 * @api private
	 */

	function Transport (opts) {
	  this.path = opts.path;
	  this.hostname = opts.hostname;
	  this.port = opts.port;
	  this.secure = opts.secure;
	  this.query = opts.query;
	  this.timestampParam = opts.timestampParam;
	  this.timestampRequests = opts.timestampRequests;
	  this.readyState = '';
	  this.agent = opts.agent || false;
	  this.socket = opts.socket;
	  this.enablesXDR = opts.enablesXDR;

	  // SSL options for Node.js client
	  this.pfx = opts.pfx;
	  this.key = opts.key;
	  this.passphrase = opts.passphrase;
	  this.cert = opts.cert;
	  this.ca = opts.ca;
	  this.ciphers = opts.ciphers;
	  this.rejectUnauthorized = opts.rejectUnauthorized;
	}

	/**
	 * Mix in `Emitter`.
	 */

	Emitter(Transport.prototype);

	/**
	 * A counter used to prevent collisions in the timestamps used
	 * for cache busting.
	 */

	Transport.timestamps = 0;

	/**
	 * Emits an error.
	 *
	 * @param {String} str
	 * @return {Transport} for chaining
	 * @api public
	 */

	Transport.prototype.onError = function (msg, desc) {
	  var err = new Error(msg);
	  err.type = 'TransportError';
	  err.description = desc;
	  this.emit('error', err);
	  return this;
	};

	/**
	 * Opens the transport.
	 *
	 * @api public
	 */

	Transport.prototype.open = function () {
	  if ('closed' == this.readyState || '' == this.readyState) {
	    this.readyState = 'opening';
	    this.doOpen();
	  }

	  return this;
	};

	/**
	 * Closes the transport.
	 *
	 * @api private
	 */

	Transport.prototype.close = function () {
	  if ('opening' == this.readyState || 'open' == this.readyState) {
	    this.doClose();
	    this.onClose();
	  }

	  return this;
	};

	/**
	 * Sends multiple packets.
	 *
	 * @param {Array} packets
	 * @api private
	 */

	Transport.prototype.send = function(packets){
	  if ('open' == this.readyState) {
	    this.write(packets);
	  } else {
	    throw new Error('Transport not open');
	  }
	};

	/**
	 * Called upon open
	 *
	 * @api private
	 */

	Transport.prototype.onOpen = function () {
	  this.readyState = 'open';
	  this.writable = true;
	  this.emit('open');
	};

	/**
	 * Called with data.
	 *
	 * @param {String} data
	 * @api private
	 */

	Transport.prototype.onData = function(data){
	  var packet = parser.decodePacket(data, this.socket.binaryType);
	  this.onPacket(packet);
	};

	/**
	 * Called with a decoded packet.
	 */

	Transport.prototype.onPacket = function (packet) {
	  this.emit('packet', packet);
	};

	/**
	 * Called upon close.
	 *
	 * @api private
	 */

	Transport.prototype.onClose = function () {
	  this.readyState = 'closed';
	  this.emit('close');
	};


/***/ },
/* 67 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Module dependencies
	 */

	var XMLHttpRequest = __webpack_require__(74);
	var XHR = __webpack_require__(75);
	var JSONP = __webpack_require__(76);
	var websocket = __webpack_require__(77);

	/**
	 * Export transports.
	 */

	exports.polling = polling;
	exports.websocket = websocket;

	/**
	 * Polling transport polymorphic constructor.
	 * Decides on xhr vs jsonp based on feature detection.
	 *
	 * @api private
	 */

	function polling(opts){
	  var xhr;
	  var xd = false;
	  var xs = false;
	  var jsonp = false !== opts.jsonp;

	  if (global.location) {
	    var isSSL = 'https:' == location.protocol;
	    var port = location.port;

	    // some user agents have empty `location.port`
	    if (!port) {
	      port = isSSL ? 443 : 80;
	    }

	    xd = opts.hostname != location.hostname || port != opts.port;
	    xs = opts.secure != isSSL;
	  }

	  opts.xdomain = xd;
	  opts.xscheme = xs;
	  xhr = new XMLHttpRequest(opts);

	  if ('open' in xhr && !opts.forceJSONP) {
	    return new XHR(opts);
	  } else {
	    if (!jsonp) throw new Error('JSONP disabled');
	    return new JSONP(opts);
	  }
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 68 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Parses an URI
	 *
	 * @author Steven Levithan <stevenlevithan.com> (MIT license)
	 * @api private
	 */

	var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

	var parts = [
	    'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
	];

	module.exports = function parseuri(str) {
	    var src = str,
	        b = str.indexOf('['),
	        e = str.indexOf(']');

	    if (b != -1 && e != -1) {
	        str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
	    }

	    var m = re.exec(str || ''),
	        uri = {},
	        i = 14;

	    while (i--) {
	        uri[parts[i]] = m[i] || '';
	    }

	    if (b != -1 && e != -1) {
	        uri.source = src;
	        uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
	        uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
	        uri.ipv6uri = true;
	    }

	    return uri;
	};


/***/ },
/* 69 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * JSON parse.
	 *
	 * @see Based on jQuery#parseJSON (MIT) and JSON2
	 * @api private
	 */

	var rvalidchars = /^[\],:{}\s]*$/;
	var rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
	var rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
	var rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g;
	var rtrimLeft = /^\s+/;
	var rtrimRight = /\s+$/;

	module.exports = function parsejson(data) {
	  if ('string' != typeof data || !data) {
	    return null;
	  }

	  data = data.replace(rtrimLeft, '').replace(rtrimRight, '');

	  // Attempt to parse using the native JSON parser first
	  if (global.JSON && JSON.parse) {
	    return JSON.parse(data);
	  }

	  if (rvalidchars.test(data.replace(rvalidescape, '@')
	      .replace(rvalidtokens, ']')
	      .replace(rvalidbraces, ''))) {
	    return (new Function('return ' + data))();
	  }
	};
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 70 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Compiles a querystring
	 * Returns string representation of the object
	 *
	 * @param {Object}
	 * @api private
	 */

	exports.encode = function (obj) {
	  var str = '';

	  for (var i in obj) {
	    if (obj.hasOwnProperty(i)) {
	      if (str.length) str += '&';
	      str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
	    }
	  }

	  return str;
	};

	/**
	 * Parses a simple querystring into an object
	 *
	 * @param {String} qs
	 * @api private
	 */

	exports.decode = function(qs){
	  var qry = {};
	  var pairs = qs.split('&');
	  for (var i = 0, l = pairs.length; i < l; i++) {
	    var pair = pairs[i].split('=');
	    qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
	  }
	  return qry;
	};


/***/ },
/* 71 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {
	/*
	 * Module requirements.
	 */

	var isArray = __webpack_require__(59);

	/**
	 * Module exports.
	 */

	module.exports = hasBinary;

	/**
	 * Checks for binary data.
	 *
	 * Right now only Buffer and ArrayBuffer are supported..
	 *
	 * @param {Object} anything
	 * @api public
	 */

	function hasBinary(data) {

	  function _hasBinary(obj) {
	    if (!obj) return false;

	    if ( (global.Buffer && global.Buffer.isBuffer(obj)) ||
	         (global.ArrayBuffer && obj instanceof ArrayBuffer) ||
	         (global.Blob && obj instanceof Blob) ||
	         (global.File && obj instanceof File)
	        ) {
	      return true;
	    }

	    if (isArray(obj)) {
	      for (var i = 0; i < obj.length; i++) {
	          if (_hasBinary(obj[i])) {
	              return true;
	          }
	      }
	    } else if (obj && 'object' == typeof obj) {
	      if (obj.toJSON) {
	        obj = obj.toJSON();
	      }

	      for (var key in obj) {
	        if (obj.hasOwnProperty(key) && _hasBinary(obj[key])) {
	          return true;
	        }
	      }
	    }

	    return false;
	  }

	  return _hasBinary(data);
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 72 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Gets the keys for an object.
	 *
	 * @return {Array} keys
	 * @api private
	 */

	module.exports = Object.keys || function keys (obj){
	  var arr = [];
	  var has = Object.prototype.hasOwnProperty;

	  for (var i in obj) {
	    if (has.call(obj, i)) {
	      arr.push(i);
	    }
	  }
	  return arr;
	};


/***/ },
/* 73 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * This is the web browser implementation of `debug()`.
	 *
	 * Expose `debug()` as the module.
	 */

	exports = module.exports = __webpack_require__(83);
	exports.log = log;
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;

	/**
	 * Colors.
	 */

	exports.colors = [
	  'lightseagreen',
	  'forestgreen',
	  'goldenrod',
	  'dodgerblue',
	  'darkorchid',
	  'crimson'
	];

	/**
	 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
	 * and the Firebug extension (any Firefox version) are known
	 * to support "%c" CSS customizations.
	 *
	 * TODO: add a `localStorage` variable to explicitly enable/disable colors
	 */

	function useColors() {
	  // is webkit? http://stackoverflow.com/a/16459606/376773
	  return ('WebkitAppearance' in document.documentElement.style) ||
	    // is firebug? http://stackoverflow.com/a/398120/376773
	    (window.console && (console.firebug || (console.exception && console.table))) ||
	    // is firefox >= v31?
	    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
	    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
	}

	/**
	 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
	 */

	exports.formatters.j = function(v) {
	  return JSON.stringify(v);
	};


	/**
	 * Colorize log arguments if enabled.
	 *
	 * @api public
	 */

	function formatArgs() {
	  var args = arguments;
	  var useColors = this.useColors;

	  args[0] = (useColors ? '%c' : '')
	    + this.namespace
	    + (useColors ? ' %c' : ' ')
	    + args[0]
	    + (useColors ? '%c ' : ' ')
	    + '+' + exports.humanize(this.diff);

	  if (!useColors) return args;

	  var c = 'color: ' + this.color;
	  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

	  // the final "%c" is somewhat tricky, because there could be other
	  // arguments passed either before or after the %c, so we need to
	  // figure out the correct index to insert the CSS into
	  var index = 0;
	  var lastC = 0;
	  args[0].replace(/%[a-z%]/g, function(match) {
	    if ('%%' === match) return;
	    index++;
	    if ('%c' === match) {
	      // we only are interested in the *last* %c
	      // (the user may have provided their own)
	      lastC = index;
	    }
	  });

	  args.splice(lastC, 0, c);
	  return args;
	}

	/**
	 * Invokes `console.log()` when available.
	 * No-op when `console.log` is not a "function".
	 *
	 * @api public
	 */

	function log() {
	  // This hackery is required for IE8,
	  // where the `console.log` function doesn't have 'apply'
	  return 'object' == typeof console
	    && 'function' == typeof console.log
	    && Function.prototype.apply.call(console.log, console, arguments);
	}

	/**
	 * Save `namespaces`.
	 *
	 * @param {String} namespaces
	 * @api private
	 */

	function save(namespaces) {
	  try {
	    if (null == namespaces) {
	      localStorage.removeItem('debug');
	    } else {
	      localStorage.debug = namespaces;
	    }
	  } catch(e) {}
	}

	/**
	 * Load `namespaces`.
	 *
	 * @return {String} returns the previously persisted debug modes
	 * @api private
	 */

	function load() {
	  var r;
	  try {
	    r = localStorage.debug;
	  } catch(e) {}
	  return r;
	}

	/**
	 * Enable namespaces listed in `localStorage.debug` initially.
	 */

	exports.enable(load());


/***/ },
/* 74 */
/***/ function(module, exports, __webpack_require__) {

	// browser shim for xmlhttprequest module
	var hasCORS = __webpack_require__(85);

	module.exports = function(opts) {
	  var xdomain = opts.xdomain;

	  // scheme must be same when usign XDomainRequest
	  // http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
	  var xscheme = opts.xscheme;

	  // XDomainRequest has a flow of not sending cookie, therefore it should be disabled as a default.
	  // https://github.com/Automattic/engine.io-client/pull/217
	  var enablesXDR = opts.enablesXDR;

	  // XMLHttpRequest can be disabled on IE
	  try {
	    if ('undefined' != typeof XMLHttpRequest && (!xdomain || hasCORS)) {
	      return new XMLHttpRequest();
	    }
	  } catch (e) { }

	  // Use XDomainRequest for IE8 if enablesXDR is true
	  // because loading bar keeps flashing when using jsonp-polling
	  // https://github.com/yujiosaka/socke.io-ie8-loading-example
	  try {
	    if ('undefined' != typeof XDomainRequest && !xscheme && enablesXDR) {
	      return new XDomainRequest();
	    }
	  } catch (e) { }

	  if (!xdomain) {
	    try {
	      return new ActiveXObject('Microsoft.XMLHTTP');
	    } catch(e) { }
	  }
	}


/***/ },
/* 75 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Module requirements.
	 */

	var XMLHttpRequest = __webpack_require__(74);
	var Polling = __webpack_require__(84);
	var Emitter = __webpack_require__(52);
	var inherit = __webpack_require__(86);
	var debug = __webpack_require__(73)('engine.io-client:polling-xhr');

	/**
	 * Module exports.
	 */

	module.exports = XHR;
	module.exports.Request = Request;

	/**
	 * Empty function
	 */

	function empty(){}

	/**
	 * XHR Polling constructor.
	 *
	 * @param {Object} opts
	 * @api public
	 */

	function XHR(opts){
	  Polling.call(this, opts);

	  if (global.location) {
	    var isSSL = 'https:' == location.protocol;
	    var port = location.port;

	    // some user agents have empty `location.port`
	    if (!port) {
	      port = isSSL ? 443 : 80;
	    }

	    this.xd = opts.hostname != global.location.hostname ||
	      port != opts.port;
	    this.xs = opts.secure != isSSL;
	  }
	}

	/**
	 * Inherits from Polling.
	 */

	inherit(XHR, Polling);

	/**
	 * XHR supports binary
	 */

	XHR.prototype.supportsBinary = true;

	/**
	 * Creates a request.
	 *
	 * @param {String} method
	 * @api private
	 */

	XHR.prototype.request = function(opts){
	  opts = opts || {};
	  opts.uri = this.uri();
	  opts.xd = this.xd;
	  opts.xs = this.xs;
	  opts.agent = this.agent || false;
	  opts.supportsBinary = this.supportsBinary;
	  opts.enablesXDR = this.enablesXDR;

	  // SSL options for Node.js client
	  opts.pfx = this.pfx;
	  opts.key = this.key;
	  opts.passphrase = this.passphrase;
	  opts.cert = this.cert;
	  opts.ca = this.ca;
	  opts.ciphers = this.ciphers;
	  opts.rejectUnauthorized = this.rejectUnauthorized;

	  return new Request(opts);
	};

	/**
	 * Sends data.
	 *
	 * @param {String} data to send.
	 * @param {Function} called upon flush.
	 * @api private
	 */

	XHR.prototype.doWrite = function(data, fn){
	  var isBinary = typeof data !== 'string' && data !== undefined;
	  var req = this.request({ method: 'POST', data: data, isBinary: isBinary });
	  var self = this;
	  req.on('success', fn);
	  req.on('error', function(err){
	    self.onError('xhr post error', err);
	  });
	  this.sendXhr = req;
	};

	/**
	 * Starts a poll cycle.
	 *
	 * @api private
	 */

	XHR.prototype.doPoll = function(){
	  debug('xhr poll');
	  var req = this.request();
	  var self = this;
	  req.on('data', function(data){
	    self.onData(data);
	  });
	  req.on('error', function(err){
	    self.onError('xhr poll error', err);
	  });
	  this.pollXhr = req;
	};

	/**
	 * Request constructor
	 *
	 * @param {Object} options
	 * @api public
	 */

	function Request(opts){
	  this.method = opts.method || 'GET';
	  this.uri = opts.uri;
	  this.xd = !!opts.xd;
	  this.xs = !!opts.xs;
	  this.async = false !== opts.async;
	  this.data = undefined != opts.data ? opts.data : null;
	  this.agent = opts.agent;
	  this.isBinary = opts.isBinary;
	  this.supportsBinary = opts.supportsBinary;
	  this.enablesXDR = opts.enablesXDR;

	  // SSL options for Node.js client
	  this.pfx = opts.pfx;
	  this.key = opts.key;
	  this.passphrase = opts.passphrase;
	  this.cert = opts.cert;
	  this.ca = opts.ca;
	  this.ciphers = opts.ciphers;
	  this.rejectUnauthorized = opts.rejectUnauthorized;

	  this.create();
	}

	/**
	 * Mix in `Emitter`.
	 */

	Emitter(Request.prototype);

	/**
	 * Creates the XHR object and sends the request.
	 *
	 * @api private
	 */

	Request.prototype.create = function(){
	  var opts = { agent: this.agent, xdomain: this.xd, xscheme: this.xs, enablesXDR: this.enablesXDR };

	  // SSL options for Node.js client
	  opts.pfx = this.pfx;
	  opts.key = this.key;
	  opts.passphrase = this.passphrase;
	  opts.cert = this.cert;
	  opts.ca = this.ca;
	  opts.ciphers = this.ciphers;
	  opts.rejectUnauthorized = this.rejectUnauthorized;

	  var xhr = this.xhr = new XMLHttpRequest(opts);
	  var self = this;

	  try {
	    debug('xhr open %s: %s', this.method, this.uri);
	    xhr.open(this.method, this.uri, this.async);
	    if (this.supportsBinary) {
	      // This has to be done after open because Firefox is stupid
	      // http://stackoverflow.com/questions/13216903/get-binary-data-with-xmlhttprequest-in-a-firefox-extension
	      xhr.responseType = 'arraybuffer';
	    }

	    if ('POST' == this.method) {
	      try {
	        if (this.isBinary) {
	          xhr.setRequestHeader('Content-type', 'application/octet-stream');
	        } else {
	          xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
	        }
	      } catch (e) {}
	    }

	    // ie6 check
	    if ('withCredentials' in xhr) {
	      xhr.withCredentials = true;
	    }

	    if (this.hasXDR()) {
	      xhr.onload = function(){
	        self.onLoad();
	      };
	      xhr.onerror = function(){
	        self.onError(xhr.responseText);
	      };
	    } else {
	      xhr.onreadystatechange = function(){
	        if (4 != xhr.readyState) return;
	        if (200 == xhr.status || 1223 == xhr.status) {
	          self.onLoad();
	        } else {
	          // make sure the `error` event handler that's user-set
	          // does not throw in the same tick and gets caught here
	          setTimeout(function(){
	            self.onError(xhr.status);
	          }, 0);
	        }
	      };
	    }

	    debug('xhr data %s', this.data);
	    xhr.send(this.data);
	  } catch (e) {
	    // Need to defer since .create() is called directly fhrom the constructor
	    // and thus the 'error' event can only be only bound *after* this exception
	    // occurs.  Therefore, also, we cannot throw here at all.
	    setTimeout(function() {
	      self.onError(e);
	    }, 0);
	    return;
	  }

	  if (global.document) {
	    this.index = Request.requestsCount++;
	    Request.requests[this.index] = this;
	  }
	};

	/**
	 * Called upon successful response.
	 *
	 * @api private
	 */

	Request.prototype.onSuccess = function(){
	  this.emit('success');
	  this.cleanup();
	};

	/**
	 * Called if we have data.
	 *
	 * @api private
	 */

	Request.prototype.onData = function(data){
	  this.emit('data', data);
	  this.onSuccess();
	};

	/**
	 * Called upon error.
	 *
	 * @api private
	 */

	Request.prototype.onError = function(err){
	  this.emit('error', err);
	  this.cleanup(true);
	};

	/**
	 * Cleans up house.
	 *
	 * @api private
	 */

	Request.prototype.cleanup = function(fromError){
	  if ('undefined' == typeof this.xhr || null === this.xhr) {
	    return;
	  }
	  // xmlhttprequest
	  if (this.hasXDR()) {
	    this.xhr.onload = this.xhr.onerror = empty;
	  } else {
	    this.xhr.onreadystatechange = empty;
	  }

	  if (fromError) {
	    try {
	      this.xhr.abort();
	    } catch(e) {}
	  }

	  if (global.document) {
	    delete Request.requests[this.index];
	  }

	  this.xhr = null;
	};

	/**
	 * Called upon load.
	 *
	 * @api private
	 */

	Request.prototype.onLoad = function(){
	  var data;
	  try {
	    var contentType;
	    try {
	      contentType = this.xhr.getResponseHeader('Content-Type').split(';')[0];
	    } catch (e) {}
	    if (contentType === 'application/octet-stream') {
	      data = this.xhr.response;
	    } else {
	      if (!this.supportsBinary) {
	        data = this.xhr.responseText;
	      } else {
	        data = 'ok';
	      }
	    }
	  } catch (e) {
	    this.onError(e);
	  }
	  if (null != data) {
	    this.onData(data);
	  }
	};

	/**
	 * Check if it has XDomainRequest.
	 *
	 * @api private
	 */

	Request.prototype.hasXDR = function(){
	  return 'undefined' !== typeof global.XDomainRequest && !this.xs && this.enablesXDR;
	};

	/**
	 * Aborts the request.
	 *
	 * @api public
	 */

	Request.prototype.abort = function(){
	  this.cleanup();
	};

	/**
	 * Aborts pending requests when unloading the window. This is needed to prevent
	 * memory leaks (e.g. when using IE) and to ensure that no spurious error is
	 * emitted.
	 */

	if (global.document) {
	  Request.requestsCount = 0;
	  Request.requests = {};
	  if (global.attachEvent) {
	    global.attachEvent('onunload', unloadHandler);
	  } else if (global.addEventListener) {
	    global.addEventListener('beforeunload', unloadHandler, false);
	  }
	}

	function unloadHandler() {
	  for (var i in Request.requests) {
	    if (Request.requests.hasOwnProperty(i)) {
	      Request.requests[i].abort();
	    }
	  }
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 76 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {
	/**
	 * Module requirements.
	 */

	var Polling = __webpack_require__(84);
	var inherit = __webpack_require__(86);

	/**
	 * Module exports.
	 */

	module.exports = JSONPPolling;

	/**
	 * Cached regular expressions.
	 */

	var rNewline = /\n/g;
	var rEscapedNewline = /\\n/g;

	/**
	 * Global JSONP callbacks.
	 */

	var callbacks;

	/**
	 * Callbacks count.
	 */

	var index = 0;

	/**
	 * Noop.
	 */

	function empty () { }

	/**
	 * JSONP Polling constructor.
	 *
	 * @param {Object} opts.
	 * @api public
	 */

	function JSONPPolling (opts) {
	  Polling.call(this, opts);

	  this.query = this.query || {};

	  // define global callbacks array if not present
	  // we do this here (lazily) to avoid unneeded global pollution
	  if (!callbacks) {
	    // we need to consider multiple engines in the same page
	    if (!global.___eio) global.___eio = [];
	    callbacks = global.___eio;
	  }

	  // callback identifier
	  this.index = callbacks.length;

	  // add callback to jsonp global
	  var self = this;
	  callbacks.push(function (msg) {
	    self.onData(msg);
	  });

	  // append to query string
	  this.query.j = this.index;

	  // prevent spurious errors from being emitted when the window is unloaded
	  if (global.document && global.addEventListener) {
	    global.addEventListener('beforeunload', function () {
	      if (self.script) self.script.onerror = empty;
	    }, false);
	  }
	}

	/**
	 * Inherits from Polling.
	 */

	inherit(JSONPPolling, Polling);

	/*
	 * JSONP only supports binary as base64 encoded strings
	 */

	JSONPPolling.prototype.supportsBinary = false;

	/**
	 * Closes the socket.
	 *
	 * @api private
	 */

	JSONPPolling.prototype.doClose = function () {
	  if (this.script) {
	    this.script.parentNode.removeChild(this.script);
	    this.script = null;
	  }

	  if (this.form) {
	    this.form.parentNode.removeChild(this.form);
	    this.form = null;
	    this.iframe = null;
	  }

	  Polling.prototype.doClose.call(this);
	};

	/**
	 * Starts a poll cycle.
	 *
	 * @api private
	 */

	JSONPPolling.prototype.doPoll = function () {
	  var self = this;
	  var script = document.createElement('script');

	  if (this.script) {
	    this.script.parentNode.removeChild(this.script);
	    this.script = null;
	  }

	  script.async = true;
	  script.src = this.uri();
	  script.onerror = function(e){
	    self.onError('jsonp poll error',e);
	  };

	  var insertAt = document.getElementsByTagName('script')[0];
	  insertAt.parentNode.insertBefore(script, insertAt);
	  this.script = script;

	  var isUAgecko = 'undefined' != typeof navigator && /gecko/i.test(navigator.userAgent);
	  
	  if (isUAgecko) {
	    setTimeout(function () {
	      var iframe = document.createElement('iframe');
	      document.body.appendChild(iframe);
	      document.body.removeChild(iframe);
	    }, 100);
	  }
	};

	/**
	 * Writes with a hidden iframe.
	 *
	 * @param {String} data to send
	 * @param {Function} called upon flush.
	 * @api private
	 */

	JSONPPolling.prototype.doWrite = function (data, fn) {
	  var self = this;

	  if (!this.form) {
	    var form = document.createElement('form');
	    var area = document.createElement('textarea');
	    var id = this.iframeId = 'eio_iframe_' + this.index;
	    var iframe;

	    form.className = 'socketio';
	    form.style.position = 'absolute';
	    form.style.top = '-1000px';
	    form.style.left = '-1000px';
	    form.target = id;
	    form.method = 'POST';
	    form.setAttribute('accept-charset', 'utf-8');
	    area.name = 'd';
	    form.appendChild(area);
	    document.body.appendChild(form);

	    this.form = form;
	    this.area = area;
	  }

	  this.form.action = this.uri();

	  function complete () {
	    initIframe();
	    fn();
	  }

	  function initIframe () {
	    if (self.iframe) {
	      try {
	        self.form.removeChild(self.iframe);
	      } catch (e) {
	        self.onError('jsonp polling iframe removal error', e);
	      }
	    }

	    try {
	      // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
	      var html = '<iframe src="javascript:0" name="'+ self.iframeId +'">';
	      iframe = document.createElement(html);
	    } catch (e) {
	      iframe = document.createElement('iframe');
	      iframe.name = self.iframeId;
	      iframe.src = 'javascript:0';
	    }

	    iframe.id = self.iframeId;

	    self.form.appendChild(iframe);
	    self.iframe = iframe;
	  }

	  initIframe();

	  // escape \n to prevent it from being converted into \r\n by some UAs
	  // double escaping is required for escaped new lines because unescaping of new lines can be done safely on server-side
	  data = data.replace(rEscapedNewline, '\\\n');
	  this.area.value = data.replace(rNewline, '\\n');

	  try {
	    this.form.submit();
	  } catch(e) {}

	  if (this.iframe.attachEvent) {
	    this.iframe.onreadystatechange = function(){
	      if (self.iframe.readyState == 'complete') {
	        complete();
	      }
	    };
	  } else {
	    this.iframe.onload = complete;
	  }
	};

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 77 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Module dependencies.
	 */

	var Transport = __webpack_require__(66);
	var parser = __webpack_require__(65);
	var parseqs = __webpack_require__(70);
	var inherit = __webpack_require__(86);
	var debug = __webpack_require__(73)('engine.io-client:websocket');

	/**
	 * `ws` exposes a WebSocket-compatible interface in
	 * Node, or the `WebSocket` or `MozWebSocket` globals
	 * in the browser.
	 */

	var WebSocket = __webpack_require__(88);

	/**
	 * Module exports.
	 */

	module.exports = WS;

	/**
	 * WebSocket transport constructor.
	 *
	 * @api {Object} connection options
	 * @api public
	 */

	function WS(opts){
	  var forceBase64 = (opts && opts.forceBase64);
	  if (forceBase64) {
	    this.supportsBinary = false;
	  }
	  Transport.call(this, opts);
	}

	/**
	 * Inherits from Transport.
	 */

	inherit(WS, Transport);

	/**
	 * Transport name.
	 *
	 * @api public
	 */

	WS.prototype.name = 'websocket';

	/*
	 * WebSockets support binary
	 */

	WS.prototype.supportsBinary = true;

	/**
	 * Opens socket.
	 *
	 * @api private
	 */

	WS.prototype.doOpen = function(){
	  if (!this.check()) {
	    // let probe timeout
	    return;
	  }

	  var self = this;
	  var uri = this.uri();
	  var protocols = void(0);
	  var opts = { agent: this.agent };

	  // SSL options for Node.js client
	  opts.pfx = this.pfx;
	  opts.key = this.key;
	  opts.passphrase = this.passphrase;
	  opts.cert = this.cert;
	  opts.ca = this.ca;
	  opts.ciphers = this.ciphers;
	  opts.rejectUnauthorized = this.rejectUnauthorized;

	  this.ws = new WebSocket(uri, protocols, opts);

	  if (this.ws.binaryType === undefined) {
	    this.supportsBinary = false;
	  }

	  this.ws.binaryType = 'arraybuffer';
	  this.addEventListeners();
	};

	/**
	 * Adds event listeners to the socket
	 *
	 * @api private
	 */

	WS.prototype.addEventListeners = function(){
	  var self = this;

	  this.ws.onopen = function(){
	    self.onOpen();
	  };
	  this.ws.onclose = function(){
	    self.onClose();
	  };
	  this.ws.onmessage = function(ev){
	    self.onData(ev.data);
	  };
	  this.ws.onerror = function(e){
	    self.onError('websocket error', e);
	  };
	};

	/**
	 * Override `onData` to use a timer on iOS.
	 * See: https://gist.github.com/mloughran/2052006
	 *
	 * @api private
	 */

	if ('undefined' != typeof navigator
	  && /iPad|iPhone|iPod/i.test(navigator.userAgent)) {
	  WS.prototype.onData = function(data){
	    var self = this;
	    setTimeout(function(){
	      Transport.prototype.onData.call(self, data);
	    }, 0);
	  };
	}

	/**
	 * Writes data to socket.
	 *
	 * @param {Array} array of packets.
	 * @api private
	 */

	WS.prototype.write = function(packets){
	  var self = this;
	  this.writable = false;
	  // encodePacket efficient as it uses WS framing
	  // no need for encodePayload
	  for (var i = 0, l = packets.length; i < l; i++) {
	    parser.encodePacket(packets[i], this.supportsBinary, function(data) {
	      //Sometimes the websocket has already been closed but the browser didn't
	      //have a chance of informing us about it yet, in that case send will
	      //throw an error
	      try {
	        self.ws.send(data);
	      } catch (e){
	        debug('websocket closed before onclose event');
	      }
	    });
	  }

	  function ondrain() {
	    self.writable = true;
	    self.emit('drain');
	  }
	  // fake drain
	  // defer to next tick to allow Socket to clear writeBuffer
	  setTimeout(ondrain, 0);
	};

	/**
	 * Called upon close
	 *
	 * @api private
	 */

	WS.prototype.onClose = function(){
	  Transport.prototype.onClose.call(this);
	};

	/**
	 * Closes socket.
	 *
	 * @api private
	 */

	WS.prototype.doClose = function(){
	  if (typeof this.ws !== 'undefined') {
	    this.ws.close();
	  }
	};

	/**
	 * Generates uri for connection.
	 *
	 * @api private
	 */

	WS.prototype.uri = function(){
	  var query = this.query || {};
	  var schema = this.secure ? 'wss' : 'ws';
	  var port = '';

	  // avoid port if default for schema
	  if (this.port && (('wss' == schema && this.port != 443)
	    || ('ws' == schema && this.port != 80))) {
	    port = ':' + this.port;
	  }

	  // append timestamp to URI
	  if (this.timestampRequests) {
	    query[this.timestampParam] = +new Date;
	  }

	  // communicate binary support capabilities
	  if (!this.supportsBinary) {
	    query.b64 = 1;
	  }

	  query = parseqs.encode(query);

	  // prepend ? to query
	  if (query.length) {
	    query = '?' + query;
	  }

	  return schema + '://' + this.hostname + port + this.path + query;
	};

	/**
	 * Feature detection for WebSocket.
	 *
	 * @return {Boolean} whether this transport is available.
	 * @api public
	 */

	WS.prototype.check = function(){
	  return !!WebSocket && !('__initialize' in WebSocket && this.name === WS.prototype.name);
	};


/***/ },
/* 78 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * An abstraction for slicing an arraybuffer even when
	 * ArrayBuffer.prototype.slice is not supported
	 *
	 * @api public
	 */

	module.exports = function(arraybuffer, start, end) {
	  var bytes = arraybuffer.byteLength;
	  start = start || 0;
	  end = end || bytes;

	  if (arraybuffer.slice) { return arraybuffer.slice(start, end); }

	  if (start < 0) { start += bytes; }
	  if (end < 0) { end += bytes; }
	  if (end > bytes) { end = bytes; }

	  if (start >= bytes || start >= end || bytes === 0) {
	    return new ArrayBuffer(0);
	  }

	  var abv = new Uint8Array(arraybuffer);
	  var result = new Uint8Array(end - start);
	  for (var i = start, ii = 0; i < end; i++, ii++) {
	    result[ii] = abv[i];
	  }
	  return result.buffer;
	};


/***/ },
/* 79 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = after

	function after(count, callback, err_cb) {
	    var bail = false
	    err_cb = err_cb || noop
	    proxy.count = count

	    return (count === 0) ? callback() : proxy

	    function proxy(err, result) {
	        if (proxy.count <= 0) {
	            throw new Error('after called too many times')
	        }
	        --proxy.count

	        // after first error, rest are passed to err_cb
	        if (err) {
	            bail = true
	            callback(err)
	            // future error callbacks will go to error handler
	            callback = err_cb
	        } else if (proxy.count === 0 && !bail) {
	            callback(null, result)
	        }
	    }
	}

	function noop() {}


/***/ },
/* 80 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Create a blob builder even when vendor prefixes exist
	 */

	var BlobBuilder = global.BlobBuilder
	  || global.WebKitBlobBuilder
	  || global.MSBlobBuilder
	  || global.MozBlobBuilder;

	/**
	 * Check if Blob constructor is supported
	 */

	var blobSupported = (function() {
	  try {
	    var b = new Blob(['hi']);
	    return b.size == 2;
	  } catch(e) {
	    return false;
	  }
	})();

	/**
	 * Check if BlobBuilder is supported
	 */

	var blobBuilderSupported = BlobBuilder
	  && BlobBuilder.prototype.append
	  && BlobBuilder.prototype.getBlob;

	function BlobBuilderConstructor(ary, options) {
	  options = options || {};

	  var bb = new BlobBuilder();
	  for (var i = 0; i < ary.length; i++) {
	    bb.append(ary[i]);
	  }
	  return (options.type) ? bb.getBlob(options.type) : bb.getBlob();
	};

	module.exports = (function() {
	  if (blobSupported) {
	    return global.Blob;
	  } else if (blobBuilderSupported) {
	    return BlobBuilderConstructor;
	  } else {
	    return undefined;
	  }
	})();

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 81 */
/***/ function(module, exports, __webpack_require__) {

	/*
	 * base64-arraybuffer
	 * https://github.com/niklasvh/base64-arraybuffer
	 *
	 * Copyright (c) 2012 Niklas von Hertzen
	 * Licensed under the MIT license.
	 */
	(function(chars){
	  "use strict";

	  exports.encode = function(arraybuffer) {
	    var bytes = new Uint8Array(arraybuffer),
	    i, len = bytes.length, base64 = "";

	    for (i = 0; i < len; i+=3) {
	      base64 += chars[bytes[i] >> 2];
	      base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
	      base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
	      base64 += chars[bytes[i + 2] & 63];
	    }

	    if ((len % 3) === 2) {
	      base64 = base64.substring(0, base64.length - 1) + "=";
	    } else if (len % 3 === 1) {
	      base64 = base64.substring(0, base64.length - 2) + "==";
	    }

	    return base64;
	  };

	  exports.decode =  function(base64) {
	    var bufferLength = base64.length * 0.75,
	    len = base64.length, i, p = 0,
	    encoded1, encoded2, encoded3, encoded4;

	    if (base64[base64.length - 1] === "=") {
	      bufferLength--;
	      if (base64[base64.length - 2] === "=") {
	        bufferLength--;
	      }
	    }

	    var arraybuffer = new ArrayBuffer(bufferLength),
	    bytes = new Uint8Array(arraybuffer);

	    for (i = 0; i < len; i+=4) {
	      encoded1 = chars.indexOf(base64[i]);
	      encoded2 = chars.indexOf(base64[i+1]);
	      encoded3 = chars.indexOf(base64[i+2]);
	      encoded4 = chars.indexOf(base64[i+3]);

	      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
	      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
	      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
	    }

	    return arraybuffer;
	  };
	})("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");


/***/ },
/* 82 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;/* WEBPACK VAR INJECTION */(function(module, global) {/*! http://mths.be/utf8js v2.0.0 by @mathias */
	;(function(root) {

		// Detect free variables `exports`
		var freeExports = typeof exports == 'object' && exports;

		// Detect free variable `module`
		var freeModule = typeof module == 'object' && module &&
			module.exports == freeExports && module;

		// Detect free variable `global`, from Node.js or Browserified code,
		// and use it as `root`
		var freeGlobal = typeof global == 'object' && global;
		if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
			root = freeGlobal;
		}

		/*--------------------------------------------------------------------------*/

		var stringFromCharCode = String.fromCharCode;

		// Taken from http://mths.be/punycode
		function ucs2decode(string) {
			var output = [];
			var counter = 0;
			var length = string.length;
			var value;
			var extra;
			while (counter < length) {
				value = string.charCodeAt(counter++);
				if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
					// high surrogate, and there is a next character
					extra = string.charCodeAt(counter++);
					if ((extra & 0xFC00) == 0xDC00) { // low surrogate
						output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
					} else {
						// unmatched surrogate; only append this code unit, in case the next
						// code unit is the high surrogate of a surrogate pair
						output.push(value);
						counter--;
					}
				} else {
					output.push(value);
				}
			}
			return output;
		}

		// Taken from http://mths.be/punycode
		function ucs2encode(array) {
			var length = array.length;
			var index = -1;
			var value;
			var output = '';
			while (++index < length) {
				value = array[index];
				if (value > 0xFFFF) {
					value -= 0x10000;
					output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
					value = 0xDC00 | value & 0x3FF;
				}
				output += stringFromCharCode(value);
			}
			return output;
		}

		/*--------------------------------------------------------------------------*/

		function createByte(codePoint, shift) {
			return stringFromCharCode(((codePoint >> shift) & 0x3F) | 0x80);
		}

		function encodeCodePoint(codePoint) {
			if ((codePoint & 0xFFFFFF80) == 0) { // 1-byte sequence
				return stringFromCharCode(codePoint);
			}
			var symbol = '';
			if ((codePoint & 0xFFFFF800) == 0) { // 2-byte sequence
				symbol = stringFromCharCode(((codePoint >> 6) & 0x1F) | 0xC0);
			}
			else if ((codePoint & 0xFFFF0000) == 0) { // 3-byte sequence
				symbol = stringFromCharCode(((codePoint >> 12) & 0x0F) | 0xE0);
				symbol += createByte(codePoint, 6);
			}
			else if ((codePoint & 0xFFE00000) == 0) { // 4-byte sequence
				symbol = stringFromCharCode(((codePoint >> 18) & 0x07) | 0xF0);
				symbol += createByte(codePoint, 12);
				symbol += createByte(codePoint, 6);
			}
			symbol += stringFromCharCode((codePoint & 0x3F) | 0x80);
			return symbol;
		}

		function utf8encode(string) {
			var codePoints = ucs2decode(string);

			// console.log(JSON.stringify(codePoints.map(function(x) {
			// 	return 'U+' + x.toString(16).toUpperCase();
			// })));

			var length = codePoints.length;
			var index = -1;
			var codePoint;
			var byteString = '';
			while (++index < length) {
				codePoint = codePoints[index];
				byteString += encodeCodePoint(codePoint);
			}
			return byteString;
		}

		/*--------------------------------------------------------------------------*/

		function readContinuationByte() {
			if (byteIndex >= byteCount) {
				throw Error('Invalid byte index');
			}

			var continuationByte = byteArray[byteIndex] & 0xFF;
			byteIndex++;

			if ((continuationByte & 0xC0) == 0x80) {
				return continuationByte & 0x3F;
			}

			// If we end up here, it’s not a continuation byte
			throw Error('Invalid continuation byte');
		}

		function decodeSymbol() {
			var byte1;
			var byte2;
			var byte3;
			var byte4;
			var codePoint;

			if (byteIndex > byteCount) {
				throw Error('Invalid byte index');
			}

			if (byteIndex == byteCount) {
				return false;
			}

			// Read first byte
			byte1 = byteArray[byteIndex] & 0xFF;
			byteIndex++;

			// 1-byte sequence (no continuation bytes)
			if ((byte1 & 0x80) == 0) {
				return byte1;
			}

			// 2-byte sequence
			if ((byte1 & 0xE0) == 0xC0) {
				var byte2 = readContinuationByte();
				codePoint = ((byte1 & 0x1F) << 6) | byte2;
				if (codePoint >= 0x80) {
					return codePoint;
				} else {
					throw Error('Invalid continuation byte');
				}
			}

			// 3-byte sequence (may include unpaired surrogates)
			if ((byte1 & 0xF0) == 0xE0) {
				byte2 = readContinuationByte();
				byte3 = readContinuationByte();
				codePoint = ((byte1 & 0x0F) << 12) | (byte2 << 6) | byte3;
				if (codePoint >= 0x0800) {
					return codePoint;
				} else {
					throw Error('Invalid continuation byte');
				}
			}

			// 4-byte sequence
			if ((byte1 & 0xF8) == 0xF0) {
				byte2 = readContinuationByte();
				byte3 = readContinuationByte();
				byte4 = readContinuationByte();
				codePoint = ((byte1 & 0x0F) << 0x12) | (byte2 << 0x0C) |
					(byte3 << 0x06) | byte4;
				if (codePoint >= 0x010000 && codePoint <= 0x10FFFF) {
					return codePoint;
				}
			}

			throw Error('Invalid UTF-8 detected');
		}

		var byteArray;
		var byteCount;
		var byteIndex;
		function utf8decode(byteString) {
			byteArray = ucs2decode(byteString);
			byteCount = byteArray.length;
			byteIndex = 0;
			var codePoints = [];
			var tmp;
			while ((tmp = decodeSymbol()) !== false) {
				codePoints.push(tmp);
			}
			return ucs2encode(codePoints);
		}

		/*--------------------------------------------------------------------------*/

		var utf8 = {
			'version': '2.0.0',
			'encode': utf8encode,
			'decode': utf8decode
		};

		// Some AMD build optimizers, like r.js, check for specific condition patterns
		// like the following:
		if (
			true
		) {
			!(__WEBPACK_AMD_DEFINE_RESULT__ = function() {
				return utf8;
			}.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
		}	else if (freeExports && !freeExports.nodeType) {
			if (freeModule) { // in Node.js or RingoJS v0.8.0+
				freeModule.exports = utf8;
			} else { // in Narwhal or RingoJS v0.7.0-
				var object = {};
				var hasOwnProperty = object.hasOwnProperty;
				for (var key in utf8) {
					hasOwnProperty.call(utf8, key) && (freeExports[key] = utf8[key]);
				}
			}
		} else { // in Rhino or a web browser
			root.utf8 = utf8;
		}

	}(this));

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(87)(module), (function() { return this; }())))

/***/ },
/* 83 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * This is the common logic for both the Node.js and web browser
	 * implementations of `debug()`.
	 *
	 * Expose `debug()` as the module.
	 */

	exports = module.exports = debug;
	exports.coerce = coerce;
	exports.disable = disable;
	exports.enable = enable;
	exports.enabled = enabled;
	exports.humanize = __webpack_require__(89);

	/**
	 * The currently active debug mode names, and names to skip.
	 */

	exports.names = [];
	exports.skips = [];

	/**
	 * Map of special "%n" handling functions, for the debug "format" argument.
	 *
	 * Valid key names are a single, lowercased letter, i.e. "n".
	 */

	exports.formatters = {};

	/**
	 * Previously assigned color.
	 */

	var prevColor = 0;

	/**
	 * Previous log timestamp.
	 */

	var prevTime;

	/**
	 * Select a color.
	 *
	 * @return {Number}
	 * @api private
	 */

	function selectColor() {
	  return exports.colors[prevColor++ % exports.colors.length];
	}

	/**
	 * Create a debugger with the given `namespace`.
	 *
	 * @param {String} namespace
	 * @return {Function}
	 * @api public
	 */

	function debug(namespace) {

	  // define the `disabled` version
	  function disabled() {
	  }
	  disabled.enabled = false;

	  // define the `enabled` version
	  function enabled() {

	    var self = enabled;

	    // set `diff` timestamp
	    var curr = +new Date();
	    var ms = curr - (prevTime || curr);
	    self.diff = ms;
	    self.prev = prevTime;
	    self.curr = curr;
	    prevTime = curr;

	    // add the `color` if not set
	    if (null == self.useColors) self.useColors = exports.useColors();
	    if (null == self.color && self.useColors) self.color = selectColor();

	    var args = Array.prototype.slice.call(arguments);

	    args[0] = exports.coerce(args[0]);

	    if ('string' !== typeof args[0]) {
	      // anything else let's inspect with %o
	      args = ['%o'].concat(args);
	    }

	    // apply any `formatters` transformations
	    var index = 0;
	    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
	      // if we encounter an escaped % then don't increase the array index
	      if (match === '%%') return match;
	      index++;
	      var formatter = exports.formatters[format];
	      if ('function' === typeof formatter) {
	        var val = args[index];
	        match = formatter.call(self, val);

	        // now we need to remove `args[index]` since it's inlined in the `format`
	        args.splice(index, 1);
	        index--;
	      }
	      return match;
	    });

	    if ('function' === typeof exports.formatArgs) {
	      args = exports.formatArgs.apply(self, args);
	    }
	    var logFn = enabled.log || exports.log || console.log.bind(console);
	    logFn.apply(self, args);
	  }
	  enabled.enabled = true;

	  var fn = exports.enabled(namespace) ? enabled : disabled;

	  fn.namespace = namespace;

	  return fn;
	}

	/**
	 * Enables a debug mode by namespaces. This can include modes
	 * separated by a colon and wildcards.
	 *
	 * @param {String} namespaces
	 * @api public
	 */

	function enable(namespaces) {
	  exports.save(namespaces);

	  var split = (namespaces || '').split(/[\s,]+/);
	  var len = split.length;

	  for (var i = 0; i < len; i++) {
	    if (!split[i]) continue; // ignore empty strings
	    namespaces = split[i].replace(/\*/g, '.*?');
	    if (namespaces[0] === '-') {
	      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
	    } else {
	      exports.names.push(new RegExp('^' + namespaces + '$'));
	    }
	  }
	}

	/**
	 * Disable debug output.
	 *
	 * @api public
	 */

	function disable() {
	  exports.enable('');
	}

	/**
	 * Returns true if the given mode name is enabled, false otherwise.
	 *
	 * @param {String} name
	 * @return {Boolean}
	 * @api public
	 */

	function enabled(name) {
	  var i, len;
	  for (i = 0, len = exports.skips.length; i < len; i++) {
	    if (exports.skips[i].test(name)) {
	      return false;
	    }
	  }
	  for (i = 0, len = exports.names.length; i < len; i++) {
	    if (exports.names[i].test(name)) {
	      return true;
	    }
	  }
	  return false;
	}

	/**
	 * Coerce `val`.
	 *
	 * @param {Mixed} val
	 * @return {Mixed}
	 * @api private
	 */

	function coerce(val) {
	  if (val instanceof Error) return val.stack || val.message;
	  return val;
	}


/***/ },
/* 84 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Module dependencies.
	 */

	var Transport = __webpack_require__(66);
	var parseqs = __webpack_require__(70);
	var parser = __webpack_require__(65);
	var inherit = __webpack_require__(86);
	var debug = __webpack_require__(73)('engine.io-client:polling');

	/**
	 * Module exports.
	 */

	module.exports = Polling;

	/**
	 * Is XHR2 supported?
	 */

	var hasXHR2 = (function() {
	  var XMLHttpRequest = __webpack_require__(74);
	  var xhr = new XMLHttpRequest({ xdomain: false });
	  return null != xhr.responseType;
	})();

	/**
	 * Polling interface.
	 *
	 * @param {Object} opts
	 * @api private
	 */

	function Polling(opts){
	  var forceBase64 = (opts && opts.forceBase64);
	  if (!hasXHR2 || forceBase64) {
	    this.supportsBinary = false;
	  }
	  Transport.call(this, opts);
	}

	/**
	 * Inherits from Transport.
	 */

	inherit(Polling, Transport);

	/**
	 * Transport name.
	 */

	Polling.prototype.name = 'polling';

	/**
	 * Opens the socket (triggers polling). We write a PING message to determine
	 * when the transport is open.
	 *
	 * @api private
	 */

	Polling.prototype.doOpen = function(){
	  this.poll();
	};

	/**
	 * Pauses polling.
	 *
	 * @param {Function} callback upon buffers are flushed and transport is paused
	 * @api private
	 */

	Polling.prototype.pause = function(onPause){
	  var pending = 0;
	  var self = this;

	  this.readyState = 'pausing';

	  function pause(){
	    debug('paused');
	    self.readyState = 'paused';
	    onPause();
	  }

	  if (this.polling || !this.writable) {
	    var total = 0;

	    if (this.polling) {
	      debug('we are currently polling - waiting to pause');
	      total++;
	      this.once('pollComplete', function(){
	        debug('pre-pause polling complete');
	        --total || pause();
	      });
	    }

	    if (!this.writable) {
	      debug('we are currently writing - waiting to pause');
	      total++;
	      this.once('drain', function(){
	        debug('pre-pause writing complete');
	        --total || pause();
	      });
	    }
	  } else {
	    pause();
	  }
	};

	/**
	 * Starts polling cycle.
	 *
	 * @api public
	 */

	Polling.prototype.poll = function(){
	  debug('polling');
	  this.polling = true;
	  this.doPoll();
	  this.emit('poll');
	};

	/**
	 * Overloads onData to detect payloads.
	 *
	 * @api private
	 */

	Polling.prototype.onData = function(data){
	  var self = this;
	  debug('polling got data %s', data);
	  var callback = function(packet, index, total) {
	    // if its the first message we consider the transport open
	    if ('opening' == self.readyState) {
	      self.onOpen();
	    }

	    // if its a close packet, we close the ongoing requests
	    if ('close' == packet.type) {
	      self.onClose();
	      return false;
	    }

	    // otherwise bypass onData and handle the message
	    self.onPacket(packet);
	  };

	  // decode payload
	  parser.decodePayload(data, this.socket.binaryType, callback);

	  // if an event did not trigger closing
	  if ('closed' != this.readyState) {
	    // if we got data we're not polling
	    this.polling = false;
	    this.emit('pollComplete');

	    if ('open' == this.readyState) {
	      this.poll();
	    } else {
	      debug('ignoring poll - transport state "%s"', this.readyState);
	    }
	  }
	};

	/**
	 * For polling, send a close packet.
	 *
	 * @api private
	 */

	Polling.prototype.doClose = function(){
	  var self = this;

	  function close(){
	    debug('writing close packet');
	    self.write([{ type: 'close' }]);
	  }

	  if ('open' == this.readyState) {
	    debug('transport open - closing');
	    close();
	  } else {
	    // in case we're trying to close while
	    // handshaking is in progress (GH-164)
	    debug('transport not open - deferring close');
	    this.once('open', close);
	  }
	};

	/**
	 * Writes a packets payload.
	 *
	 * @param {Array} data packets
	 * @param {Function} drain callback
	 * @api private
	 */

	Polling.prototype.write = function(packets){
	  var self = this;
	  this.writable = false;
	  var callbackfn = function() {
	    self.writable = true;
	    self.emit('drain');
	  };

	  var self = this;
	  parser.encodePayload(packets, this.supportsBinary, function(data) {
	    self.doWrite(data, callbackfn);
	  });
	};

	/**
	 * Generates uri for connection.
	 *
	 * @api private
	 */

	Polling.prototype.uri = function(){
	  var query = this.query || {};
	  var schema = this.secure ? 'https' : 'http';
	  var port = '';

	  // cache busting is forced
	  if (false !== this.timestampRequests) {
	    query[this.timestampParam] = +new Date + '-' + Transport.timestamps++;
	  }

	  if (!this.supportsBinary && !query.sid) {
	    query.b64 = 1;
	  }

	  query = parseqs.encode(query);

	  // avoid port if default for schema
	  if (this.port && (('https' == schema && this.port != 443) ||
	     ('http' == schema && this.port != 80))) {
	    port = ':' + this.port;
	  }

	  // prepend ? to query
	  if (query.length) {
	    query = '?' + query;
	  }

	  return schema + '://' + this.hostname + port + this.path + query;
	};


/***/ },
/* 85 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Module dependencies.
	 */

	var global = __webpack_require__(90);

	/**
	 * Module exports.
	 *
	 * Logic borrowed from Modernizr:
	 *
	 *   - https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
	 */

	try {
	  module.exports = 'XMLHttpRequest' in global &&
	    'withCredentials' in new global.XMLHttpRequest();
	} catch (err) {
	  // if XMLHttp support is disabled in IE then it will throw
	  // when trying to create
	  module.exports = false;
	}


/***/ },
/* 86 */
/***/ function(module, exports, __webpack_require__) {

	
	module.exports = function(a, b){
	  var fn = function(){};
	  fn.prototype = b.prototype;
	  a.prototype = new fn;
	  a.prototype.constructor = a;
	};

/***/ },
/* 87 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = function(module) {
		if(!module.webpackPolyfill) {
			module.deprecate = function() {};
			module.paths = [];
			// module.parent = undefined by default
			module.children = [];
			module.webpackPolyfill = 1;
		}
		return module;
	}


/***/ },
/* 88 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Module dependencies.
	 */

	var global = (function() { return this; })();

	/**
	 * WebSocket constructor.
	 */

	var WebSocket = global.WebSocket || global.MozWebSocket;

	/**
	 * Module exports.
	 */

	module.exports = WebSocket ? ws : null;

	/**
	 * WebSocket constructor.
	 *
	 * The third `opts` options object gets ignored in web browsers, since it's
	 * non-standard, and throws a TypeError if passed to the constructor.
	 * See: https://github.com/einaros/ws/issues/227
	 *
	 * @param {String} uri
	 * @param {Array} protocols (optional)
	 * @param {Object) opts (optional)
	 * @api public
	 */

	function ws(uri, protocols, opts) {
	  var instance;
	  if (protocols) {
	    instance = new WebSocket(uri, protocols);
	  } else {
	    instance = new WebSocket(uri);
	  }
	  return instance;
	}

	if (WebSocket) ws.prototype = WebSocket.prototype;


/***/ },
/* 89 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Helpers.
	 */

	var s = 1000;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var y = d * 365.25;

	/**
	 * Parse or format the given `val`.
	 *
	 * Options:
	 *
	 *  - `long` verbose formatting [false]
	 *
	 * @param {String|Number} val
	 * @param {Object} options
	 * @return {String|Number}
	 * @api public
	 */

	module.exports = function(val, options){
	  options = options || {};
	  if ('string' == typeof val) return parse(val);
	  return options.long
	    ? long(val)
	    : short(val);
	};

	/**
	 * Parse the given `str` and return milliseconds.
	 *
	 * @param {String} str
	 * @return {Number}
	 * @api private
	 */

	function parse(str) {
	  var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
	  if (!match) return;
	  var n = parseFloat(match[1]);
	  var type = (match[2] || 'ms').toLowerCase();
	  switch (type) {
	    case 'years':
	    case 'year':
	    case 'y':
	      return n * y;
	    case 'days':
	    case 'day':
	    case 'd':
	      return n * d;
	    case 'hours':
	    case 'hour':
	    case 'h':
	      return n * h;
	    case 'minutes':
	    case 'minute':
	    case 'm':
	      return n * m;
	    case 'seconds':
	    case 'second':
	    case 's':
	      return n * s;
	    case 'ms':
	      return n;
	  }
	}

	/**
	 * Short format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */

	function short(ms) {
	  if (ms >= d) return Math.round(ms / d) + 'd';
	  if (ms >= h) return Math.round(ms / h) + 'h';
	  if (ms >= m) return Math.round(ms / m) + 'm';
	  if (ms >= s) return Math.round(ms / s) + 's';
	  return ms + 'ms';
	}

	/**
	 * Long format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */

	function long(ms) {
	  return plural(ms, d, 'day')
	    || plural(ms, h, 'hour')
	    || plural(ms, m, 'minute')
	    || plural(ms, s, 'second')
	    || ms + ' ms';
	}

	/**
	 * Pluralization helper.
	 */

	function plural(ms, n, name) {
	  if (ms < n) return;
	  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
	  return Math.ceil(ms / n) + ' ' + name + 's';
	}


/***/ },
/* 90 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Returns `this`. Execute this without a "context" (i.e. without it being
	 * attached to an object of the left-hand side), and `this` points to the
	 * "global" scope of the current JS execution.
	 */

	module.exports = (function () { return this; })();


/***/ }
/******/ ]);