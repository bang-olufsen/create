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

// SPOTIFY CONNECT (SPOTIFYD) INTEGRATION FOR BEOCREATE

var fs = require("fs");
var exec = require('child_process').exec;

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	
	var version = require("./package.json").version;
	
	var spotifydVersion = null;
	var configuration = {};
	
	
	beoBus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			// Get version number.
			exec("shairport-sync -V", function(error, stdout, stderr) {
				if (error) {
					if (debug) console.error("Error querying spotifyd version: "+error);
				} else {
					spotifydVersion = stdout;
				}
			});
			
			
			
		}
		
		if (event.header == "shutdown") {
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "spotifyd") {
				spotifydVersion = (spotifydVersion) ? spotifydVersion.split("-")[0] : null;
				
				beoBus.emit("ui", {target: "spotifyd", header: "configuration", content: {version: spotifydVersion}});
				
			}
		}
	});
	
	
	beoBus.on('product-information', function(event) {
		
		if (event.header == "systemNameChanged") {
			// Listen to changes in system name and update the shairport-sync display name.
			if (event.content.systemName) {
				configureSpotifyd("general", "name", event.content.systemName);
			}
			
		}
		
		
	});
	
	beoBus.on('spotifyd', function(event) {
		
		
		
		if (event.header == "toggleEnabled") {
			
		}
		
		if (event.header == "transport" && event.content.action) {
			if (debug) console.log("Spotifyd transport command: "+event.content.action+".");
			switch (event.content.action) {
				case "playPause":
					
					break;
				case "play":
					
					break;
				case "stop":
					
					break;
				case "next":
					
					break;
				case "previous":
					
					break;
			}
		
		}
		
		if (event.header == "startSource") {
			
		}
		
		if (event.header == "stop") {

			if (event.content.reason && event.content.reason == "sourceActivated") {
				if (debug) console.log("spotifyd was stopped by another source.");
			}
		}
		
		if (event.header == "setVolume") {
			if (event.content.percentage != undefined) {
				
			}
		}
		
		
	});
	
	
	

	
	return {
		version: version
	};
};
