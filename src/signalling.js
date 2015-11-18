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