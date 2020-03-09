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

var settings = {
	serverAddress: null,
	squeezeliteEnabled: true
}

var configuration = {};


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
		
		readSqueezeliteConfiguration();
		if (configuration.server && configuration.server.value != "0.0.0.0") {
			settings.serverAddress = configuration.server.value;
		} else {
			settings.serverAddress = null;
		}

	}
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == "squeezelite") {
			settings.squeezeliteEnabled = 
			beo.bus.emit("ui", {target: "squeezelite", header: "squeezeliteSettings", content: settings});
		}
	}
	
});

beo.bus.on('product-information', function(event) {
	
	if (event.header == "systemNameChanged") {
		// Listen to changes in system name and update the shairport-sync display name.
		if (event.content.systemName && fs.existsSync("/var/squeezelite/squeezelite.name")) {
			fs.writeFileSync("/var/squeezelite/squeezelite.name", event.content.systemName);
			if (debug) console.log("System name updated for Squeezelite.");
			if (settings.squeezeliteEnabled) {
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
	
	if (event.header == "setServerAddress") {
		
		if (event.content.address != undefined) {
			settings.serverAddress = event.content.address;
			relaunch = settings.squeezeliteEnabled;
			configureSqueezelite([{option: "server", value: settings.serverAddress}], relaunch, function(success) {
				beo.bus.emit("ui", {target: "squeezelite", header: "squeezeliteSettings", content: settings});
			});
		} else {
			settings.serverAddress = null;
			relaunch = settings.squeezeliteEnabled;
			configureSqueezelite([{option: "server", remove: true}], relaunch, function(success) {
				beo.bus.emit("ui", {target: "squeezelite", header: "squeezeliteSettings", content: settings});
			});
		}
	
	}
});


function getSqueezeliteStatus(callback) {
	exec("systemctl is-active --quiet squeezelite.service lmsmpris.service").on('exit', function(code) {
		if (code == 0) {
			settings.squeezeliteEnabled = true;
			callback(true);
		} else {
			settings.squeezeliteEnabled = false;
			callback(false);
		}
	});
}

function setSqueezeliteStatus(enabled, callback) {
	if (enabled) {
		exec("systemctl enable --now squeezelite.service lmsmpris.service").on('exit', function(code) {
			if (code == 0) {
				settings.squeezeliteEnabled = true;
				if (debug) console.log("Squeezelite enabled.");
				callback(true);
			} else {
				settings.squeezeliteEnabled = false;
				callback(false, true);
			}
		});
	} else {
		exec("systemctl disable --now squeezelite.service lmsmpris.service").on('exit', function(code) {
			settings.squeezeliteEnabled = false;
			if (code == 0) {
				callback(false);
				if (debug) console.log("Squeezelite disabled.");
			} else {
				callback(false, true);
			}
		});
	}
}


function configureSqueezelite(options, relaunch, callback) {
	readSqueezeliteConfiguration();
	if (typeof options == "object" && !Array.isArray(options)) {
		options = [options];
	}
	for (var i = 0; i < options.length; i++) {
		if (options[i].option) {
			if (options[i].value) {
				if (debug) console.log("Configuring Squeezelite (setting "+options[i].option+")...")
				configuration[options[i].option] = {value: options[i].value, comment: false};
			} else {
				if (configuration[options[i].option]) {
					if (options[i].remove) {
						if (debug) console.log("Configuring Squeezelite (removing "+options[i].option+")...")
						delete configuration[options[i].option];
					} else {
						if (debug) console.log("Configuring Squeezelite (commenting out "+options[i].option+")...")
						configuration[options[i].option].comment = true;
					}
				}
			}
		}
	}
	writeSqueezeliteConfiguration();
	if (relaunch) {
		exec("systemctl restart squeezelite.service", function(error, stdout, stderr) {
			if (error) {
				if (debug) console.error("Relaunching squeezelite failed: "+error);
				if (callback) callback(false, error);
			} else {
				if (debug) console.error("squeezelite was relaunched.");
				if (callback) callback(true);
			}
		});
	} else {
		if (callback) callback(true);
	}
}

squeezeliteConfigModified = 0;

function writeSqueezeliteConfiguration() {
	// Saves current configuration back into the file.
	fs.writeFileSync("/etc/squeezelite.json", JSON.stringify(configuration));
	squeezeliteConfigModified = fs.statSync("/etc/squeezelite.json").mtimeMs;
}


function readSqueezeliteConfiguration() {
	configuration={}
	if (fs.existsSync("/etc/squeezelite.json")) {
		modified = fs.statSync("/etc/squeezelite.json").mtimeMs;
		if (modified != squeezeliteConfigModified) {
			// Reads configuration into a JavaScript object for easy access.
			squeezeliteConfigModified = modified;
			squeezeliteConfig = fs.readFileSync("/etc/squeezelite.json", "utf8").split('\n');
			configuration = JSON.parse(squeezeliteConfig)
		}
	}
	return configuration;
}

	
module.exports = {
	version: version,
	isEnabled: getSqueezeliteStatus
};

