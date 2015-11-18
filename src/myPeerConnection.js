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