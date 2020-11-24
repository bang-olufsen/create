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

// Openhome CONTROL FOR BEOCREATE

var exec = require("child_process").exec;
var fs = require("fs");

	var debug = beo.debug;
	var version = require("./package.json").version;
	
	var settings = {
		openhomeEnabled: false,
		room: "Living room",
	}
	
	
	var sources = null;
	
	var openhomeEnabled = false;
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (beo.extensions.sources &&
				beo.extensions.sources.setSourceOptions &&
				beo.extensions.sources.sourceDeactivated) {
				sources = beo.extensions.sources;
			}
			
			if (sources) {
				getopenhomeStatus(function(enabled) {
					settings.openhomeEnabled = enabled;
					sources.setSourceOptions("openhome", {
						enabled: enabled,
						aka: ["upmpdcli"],
						transportControls: false,
						usesHifiberryControl: true
					});
				});
				
				getset_room();
			}
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "openhome") {
				beo.bus.emit("ui", {target: "openhome", header: "openhomeSettings", content: settings});
			}
		}
	});
	
	beo.bus.on('product-information', function(event) {
		
		if (event.header == "systemNameChanged") {
			// do nothing, let the reconfigure-players script handle the system name change
		}
		
	});
	
	beo.bus.on('openhome', function(event) {
		
		if (event.header == "openhomeEnabled") {
			
			if (event.content.enabled != undefined) {
				setopenhomeStatus(event.content.enabled, function(newStatus, error) {
					settings.openhomeEnabled = newStatus
					beo.bus.emit("ui", {target: "openhome", header: "openhomeSettings", content: settings});
					if (sources) sources.setSourceOptions("openhome", {enabled: newStatus});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("openhome");
					}
					if (error) {
						beo.bus.emit("ui", {target: "openhome", header: "errorTogglingopenhome", content: {}});
					}
				});
			}
		
		}
		
		
		if (event.header == "setRoom") {
			if (event.content.room != undefined) {
				getset_room(event.content.room);
			}
		}
		
	});
	
	function getset_room(name=null) {
		res = null
		
		if (name === null) {
			cmd = '/opt/hifiberry/bin/openhome-room'
		} else {
			cmd = '/opt/hifiberry/bin/openhome-room "'+name+'"'
		}
		exec(cmd, (err, stdout, stderr) => {
			if (err) {
				console.log("OpenHome error:", err);
				return;
			}
			settings.room = stdout
			beo.bus.emit("ui", {target: "openhome", header: "openhomeSettings", content: settings});
		});
	}
	
	
	function getopenhomeStatus(callback) {
		exec("systemctl is-active --quiet upmpdcli.service").on('exit', function(code) {
			if (code == 0) {
				openhomeEnabled = true;
				callback(true);
			} else {
				openhomeEnabled = false;
				callback(false);
			}
		});
	}
	
	function setopenhomeStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now upmpdcli.service").on('exit', function(code) {
				if (code == 0) {
					openhomeEnabled = true;
					if (debug) console.log("openhome enabled.");
					callback(true);
				} else {
					openhomeEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now upmpdcli.service").on('exit', function(code) {
				openhomeEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("openhome disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
module.exports = {
	version: version,
	isEnabled: getopenhomeStatus
};

