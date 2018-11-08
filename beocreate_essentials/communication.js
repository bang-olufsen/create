/*Copyright 2018 Bang & Olufsen A/S
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.*/

// Communication

// Handles socket communication between the sound system and the client.

var mdns = require('mdns');
//var dnssd = require('dnssd'); // Replacing mdns.
var fs = require('fs');
var server = require('websocket').server;
var http = require('http');
var https = require('https');
var eventEmitter = require('events').EventEmitter;
var util = require('util');


module.exports = Communicator;

function Communicator() {
	if (! (this instanceof Communicator)) return new Communicator();
	this.acceptConnections = true;
	this.announceService;
	this.connections = [];
	this.connectionLinks = [];
	this.socket;
	this.connectionID = 0;
	
	eventEmitter.call(this);
}

util.inherits(Communicator, eventEmitter);

Communicator.prototype.start = function start(options) {
	
	var self = this;
	
	
	if (!options) options = {};
	if (options.port) {
		wsPort = options.port;
	} else {
		wsPort = 1337; // Default port.
	}
	if (!options.ssl) {
		// If SSL is not specified, run a normal HTTP server.
		this.socket = new server({
			httpServer: http.createServer().listen(wsPort)
		});
		//return true;
	} else {
		// If SSL is set to true, run a HTTPS server.
		this.socket = new server({
			httpServer: https.createServer({
				key:fs.readFileSync(options.sslKey), 
				cert:fs.readFileSync(options.sslCert)
			}).listen(wsPort)
		});
		//return true;
	}
	
	// ANNOUNCE BONJOUR SERVICE
	// This enables clients that have Bonjour discovery to find the product without requiring the user to know and type in the hostname.
	if (options.name) {
		if (options.serviceType) {
			serviceType = options.serviceType;
		} else {
			serviceType = 'beolink-open';
		}
		if (options.advertisePort) {
			advertisePort = options.advertisePort;
		} else {
			advertisePort = wsPort;
		}
		if (options.txtRecord) {
			//this.announceService = new dnssd.Advertisement(dnssd.tcp(serviceType), advertisePort, { name: options.name, txt : options.txtRecord });
			this.announceService = mdns.createAdvertisement(mdns.tcp(serviceType), advertisePort, { name: options.name, txtRecord : options.txtRecord });
		} else {
			this.announceService = mdns.createAdvertisement(mdns.tcp(serviceType), advertisePort, { name: options.name });
		}
		this.announceService.start();
	}
	
	this.socket.on('request', function(request) {
		
		
		if (request.requestedProtocols) {
			switch (request.requestedProtocols[0]) {
				// We'll assume only one type of protocol is requested.
				case "beo-remote":
				case "beocreate-remote":
				case "beo-computer":
				case "beo-source":
					protocol = request.requestedProtocols[0];
					break;
				default:
					protocol = null;
					break;
			}
		} else {
			protocol = null;
		}
		
		if (protocol != null && self.acceptConnections) {
			var connection = request.accept(protocol, request.origin);
			newConnection = addClient(connection, protocol);
			
			self.emit('open', newConnection.ID, newConnection.protocol);
	
			connection.on('message', function(message) {
				// Incoming data.
				// data should always be in serialised JSON format.
				jsonObject = JSON.parse(message.utf8Data);
				self.emit('data', jsonObject, findID(connection));
			});
	
			connection.on('close', function(connection) {
				rmID = removeClient(connection);
				//console.log("Client disconnected.");
				self.emit('close', rmID);
			});
		} else {
			request.reject();
		}
	});
	
	function addClient(connection, protocol) {
		self.connectionID++;
		newConnection = {ID: self.connectionID, protocol: protocol}
		self.connections.push(newConnection);
		self.connectionLinks.push(connection);
		return newConnection;
	}
	
	function removeClient(connection) {
		for (var i = 0; i < self.connectionLinks.length; i++) {
			if (self.connectionLinks[i].connected == false) {
				rmIndex = i;
				break;
			}
		}
		rmID = self.connections[rmIndex].ID;
		self.connectionLinks.splice(rmIndex, 1);
		self.connections.splice(rmIndex, 1);
		return rmID;
	}
	
	function findID(connection) {
		for (var i = 0; i < self.connections.length; i++) {
			if (self.connectionLinks[i] == connection) {
				theID = self.connections[i].ID;
				break;
			}
		}
		return theID;
	}
	
}

Communicator.prototype.disconnectAll = function disconnectAll() {
	this.socket.closeAllConnections();
}

Communicator.prototype.stop = function stop() {
	//server.shutDown();
	this.announceService.stop();
}

Communicator.prototype.send = function send(jsonObject, restrictBroadcast) {
	jsonString = JSON.stringify(jsonObject);
	if (restrictBroadcast) {
		switch (restrictBroadcast) {
			case "beo-remote":
			case "beocreate-remote":
			case "beo-computer":
			case "beo-source":
				for (var i = 0; i < this.connections.length; i++) {
					if (this.connections[i].protocol == restrictBroadcast) {
						this.connectionLinks[i].sendUTF(jsonString);
					}
				}
				break;
			default:
				for (var i = 0; i < this.connections.length; i++) {
					if (this.connections[i].ID == restrictBroadcast) {
						this.connectionLinks[i].sendUTF(jsonString);
					}
				}
				break;
		}
	}
	else { // Send to all clients
		for (var i = 0; i < this.connections.length; i++) {
			this.connectionLinks[i].sendUTF(jsonString);
		}
	}
}