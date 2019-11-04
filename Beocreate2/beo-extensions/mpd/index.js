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

// MPD CONTROL FOR BEOCREATE

var exec = require("child_process").exec;

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	
	var version = require("./package.json").version;
	
	
	var sources = null;
	
	var mpdEnabled = false;
	
	beoBus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (globals.extensions.sources &&
				globals.extensions.sources.setSourceOptions &&
				globals.extensions.sources.sourceDeactivated) {
				sources = globals.extensions.sources;
			}
			
			if (sources) {
				getMPDStatus(function(enabled) {
					sources.setSourceOptions("mpd", {
						enabled: enabled,
						transportControls: true,
						usesHifiberryControl: true
					});
				});
			}
			
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "mpd") {
				beoBus.emit("ui", {target: "mpd", header: "mpdSettings", content: {mpdEnabled: mpdEnabled}});
			}
		}
	});
	
	beoBus.on('mpd', function(event) {
		
		if (event.header == "mpdEnabled") {
			
			if (event.content.enabled != undefined) {
				setMPDStatus(event.content.enabled, function(newStatus, error) {
					beoBus.emit("ui", {target: "mpd", header: "mpdSettings", content: {mpdEnabled: newStatus}});
					if (sources) sources.setSourceOptions("mpd", {enabled: newStatus});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("mpd");
					}
					if (error) {
						beoBus.emit("ui", {target: "mpd", header: "errorTogglingMPD", content: {}});
					}
				});
			}
		
		}
	});
	
	
	function getMPDStatus(callback) {
		exec("systemctl is-active --quiet mpd.service mpd-mpris.service").on('exit', function(code) {
			if (code == 0) {
				mpdEnabled = true;
				callback(true);
			} else {
				mpdEnabled = false;
				callback(false);
			}
		});
	}
	
	function setMPDStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now mpd.service mpd-mpris.service").on('exit', function(code) {
				if (code == 0) {
					mpdEnabled = true;
					if (debug) console.log("MPD enabled.");
					callback(true);
				} else {
					mpdEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now mpd.service mpd-mpris.service").on('exit', function(code) {
				mpdEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("MPD disabled.");
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

