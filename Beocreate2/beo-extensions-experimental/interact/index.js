/*Copyright 2019 Bang & Olufsen A/S
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

// BEOCREATE INTERACTION MODULE
// Connect triggers with actions to create an interactive sound system.

// At startup, extensions should announce the triggers and actions they provide.

var SerialPort = require('serialport'); // for communicating through serial ports
var Readline = require('@serialport/parser-readline');

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	
	var version = require("./package.json").version;
	
	var port = null;
	
	beoBus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (SerialPort) {
			
				port = new SerialPort("/dev/ttyACM0");
				var parser = port.pipe(new Readline({ delimiter: '\n' }))
				
				port.on('open', function() {
					if (debug) console.log('Interact: serial port to the external device opened.');
				});
				
				parser.on('data', function(data) {
					processSerialMessage(data);
					//beo4 = data.slice(0, -1).split("*");
					//processBeo4Command(beo4[0], beo4[1], beo4[2]);
				});
				
				port.on('error', function(err) {
					if (debug) console.log('Interact: error with serial port: ', err.message);
				})
			
			}
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "interact") {
				
			}
		}
	});
	
	function processSerialMessage(message) {
		if (debug) console.log("Interact: received: "+message+".");
		//if (debug) console.dir(message);
		switch (message) {
			case "hello":
				serialSend("hello");
				break;
			case "play":
				beoBus.emit("now-playing", {header: "transport", content: {action: "play"}});
				break;
			case "stop":
				beoBus.emit("now-playing", {header: "transport", content: {action: "stop"}});
				break;
			case "fadein":
				beoBus.emit("sound", {header: "unmute", content: {fade: true}});
				break;
			case "fadeout":
				beoBus.emit("sound", {header: "mute", content: {fade: true}});
				break;
			default:
				//if (debug) console.log("Interact: received: "+message+".");
				break;
		}
		
	}
	
	function serialSend(message, newLine) {
		if (newLine) message += "\n";
		if (port) port.write(message, function(err) {
			if (err) {
				return console.log('Interact: serial port write error: ', err.message);
			}
		});
	}
	
	return {
		version: version
	};
};

