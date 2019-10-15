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

// SPOTIFYD CONTROL FOR BEOCREATE

var exec = require("child_process").exec;

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	var version = require("./package.json").version;
	
	
	var sources = null;
	
	var spotifydEnabled = false;
	
	beoBus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (globals.extensions.sources &&
				globals.extensions.sources.setSourceOptions &&
				globals.extensions.sources.sourceDeactivated) {
				sources = globals.extensions.sources;
			}
			
			if (sources) {
				getSpotifydStatus(function(enabled) {
					sources.setSourceOptions("spotifyd", {
						enabled: enabled,
						transportControls: true,
						usesHifiberryControl: true
					});
				});
			}
			
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "spotifyd") {
				beoBus.emit("ui", {target: "spotifyd", header: "spotifydSettings", content: {spotifydEnabled: spotifydEnabled}});
			}
		}
	});
	
	beoBus.on('spotifyd', function(event) {
		
		if (event.header == "spotifydEnabled") {
			
			if (event.content.enabled != undefined) {
				setSpotifydStatus(event.content.enabled, function(newStatus, error) {
					beoBus.emit("ui", {target: "spotifyd", header: "spotifydSettings", content: {spotifydEnabled: newStatus}});
					if (sources) sources.setSourceOptions("spotifyd", {enabled: newStatus});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("spotifyd");
					}
					if (error) {
						beoBus.emit("ui", {target: "spotifyd", header: "errorTogglingSpotifyd", content: {}});
					}
				});
			}
		
		}
	});
	
	
	function getSpotifydStatus(callback) {
		exec("systemctl is-active --quiet spotify.service").on('exit', function(code) {
			if (code == 0) {
				spotifydEnabled = true;
				callback(true);
			} else {
				spotifydEnabled = false;
				callback(false);
			}
		});
	}
	
	function setSpotifydStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now spotify.service").on('exit', function(code) {
				if (code == 0) {
					spotifydEnabled = true;
					if (debug) console.log("Spotifyd enabled.");
					callback(true);
				} else {
					spotifydEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now spotify.service").on('exit', function(code) {
				spotifydEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("Spotifyd disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
	return {
		version: version
	}
	
};

