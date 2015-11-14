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

var bigInt = require("big-integer");

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