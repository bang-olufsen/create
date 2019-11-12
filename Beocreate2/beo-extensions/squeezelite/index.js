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

// SQUEEZelite CONTROL FOR BEOCREATE

var exec = require("child_process").exec;
var fs = require("fs");

	var debug = beo.debug;
	var version = require("./package.json").version;
	
	
	var sources = null;
	
	var squeezeliteEnabled = false;
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (beo.extensions.sources &&
				beo.extensions.sources.setSourceOptions &&
				beo.extensions.sources.sourceDeactivated) {
				sources = beo.extensions.sources;
			}
			
			if (sources) {
				getSqueezeliteStatus(function(enabled) {
					sources.setSourceOptions("squeezelite", {
						enabled: enabled,
						aka: ["lms"],
						transportControls: true,
						usesHifiberryControl: true
					});
				});
			}
			
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "squeezelite") {
				beo.bus.emit("ui", {target: "squeezelite", header: "squeezeliteSettings", content: {squeezeliteEnabled: squeezeliteEnabled}});
			}
		}
	});
	
	beo.bus.on('product-information', function(event) {
		
		if (event.header == "systemNameChanged") {
			// Listen to changes in system name and update the shairport-sync display name.
			if (event.content.systemName && fs.existsSync("/var/squeezelite/squeezelite.name")) {
				fs.writeFileSync("/var/squeezelite/squeezelite.name", event.content.systemName);
				if (debug) console.log("System name updated for Squeezelite.");
				if (squeezeliteEnabled) {
					exec("systemctl restart squeezelite.service lmsmpris.service").on('exit', function(code) {
						if (code == 0) {
							// Success
						} else {
							
						}
					});
				}
			}
			
		}
		
		
	});
	
	beo.bus.on('squeezelite', function(event) {
		
		if (event.header == "squeezeliteEnabled") {
			
			if (event.content.enabled != undefined) {
				setSqueezeliteStatus(event.content.enabled, function(newStatus, error) {
					beo.bus.emit("ui", {target: "squeezelite", header: "squeezeliteSettings", content: {squeezeliteEnabled: newStatus}});
					if (sources) sources.setSourceOptions("squeezelite", {enabled: newStatus});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("squeezelite");
					}
					if (error) {
						beo.bus.emit("ui", {target: "squeezelite", header: "errorTogglingsqueezelite", content: {}});
					}
				});
			}
		
		}
	});
	
	
	function getSqueezeliteStatus(callback) {
		exec("systemctl is-active --quiet squeezelite.service lmsmpris.service").on('exit', function(code) {
			if (code == 0) {
				squeezeliteEnabled = true;
				callback(true);
			} else {
				squeezeliteEnabled = false;
				callback(false);
			}
		});
	}
	
	function setSqueezeliteStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now squeezelite.service lmsmpris.service").on('exit', function(code) {
				if (code == 0) {
					squeezeliteEnabled = true;
					if (debug) console.log("Squeezelite enabled.");
					callback(true);
				} else {
					squeezeliteEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now squeezelite.service lmsmpris.service").on('exit', function(code) {
				squeezeliteEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("Squeezelite disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
module.exports = {
	version: version
};

