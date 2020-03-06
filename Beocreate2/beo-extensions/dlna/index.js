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

// DLNA CONTROL FOR BEOCREATE

var exec = require("child_process").exec;
var fs = require("fs");

	var debug = beo.debug;
	var version = require("./package.json").version;
	
	
	var sources = null;
	
	var dlnaEnabled = false;
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (beo.extensions.sources &&
				beo.extensions.sources.setSourceOptions &&
				beo.extensions.sources.sourceDeactivated) {
				sources = beo.extensions.sources;
			}
			
			if (sources) {
				getDLNAStatus(function(enabled) {
					sources.setSourceOptions("dlna", {
						enabled: enabled,
						aka: ["upnp"],
						transportControls: false,
						usesHifiberryControl: true
					});
				});
			}
			
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "dlna") {
				beo.bus.emit("ui", {target: "dlna", header: "dlnaSettings", content: {dlnaEnabled: dlnaEnabled}});
			}
		}
	});
	
	beo.bus.on('product-information', function(event) {
		
		if (event.header == "systemNameChanged") {
			// Listen to changes in system name and update the shairport-sync display name.
			if (event.content.systemName && fs.existsSync("/etc/dlnampris.conf")) {
				// TODO: Change dlnampris.conf
				if (debug) console.log("System name updated for DLNA.");
				if (dlnaEnabled) {
					exec("systemctl restart dlnampris.service").on('exit', function(code) {
						if (code == 0) {
							// Success
						} else {
							
						}
					});
				}
			}
			
		}
		
		
	});
	
	beo.bus.on('dlna', function(event) {
		
		if (event.header == "dlnaEnabled") {
			
			if (event.content.enabled != undefined) {
				setDLNAStatus(event.content.enabled, function(newStatus, error) {
					beo.bus.emit("ui", {target: "dlna", header: "dlnaSettings", content: {dlnaEnabled: newStatus}});
					if (sources) sources.setSourceOptions("dlna", {enabled: newStatus});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("dlna");
					}
					if (error) {
						beo.bus.emit("ui", {target: "dlna", header: "errorTogglingdlna", content: {}});
					}
				});
			}
		
		}
	});
	
	
	function getDLNAStatus(callback) {
		exec("systemctl is-active --quiet dlnampris.service").on('exit', function(code) {
			if (code == 0) {
				dlnaEnabled = true;
				callback(true);
			} else {
				dlnaEnabled = false;
				callback(false);
			}
		});
	}
	
	function setDLNAStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now dlnampris.service").on('exit', function(code) {
				if (code == 0) {
					dlnaEnabled = true;
					if (debug) console.log("DLNA enabled.");
					callback(true);
				} else {
					dlnaEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now dlnampris.service").on('exit', function(code) {
				dlnaEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("DLNA disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
module.exports = {
	version: version,
	isEnabled: getDLNAStatus
};

