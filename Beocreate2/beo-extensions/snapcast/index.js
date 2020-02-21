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

// SNAPCAST CONTROL FOR BEOCREATE

var exec = require("child_process").exec;
var fs = require("fs");

	var debug = beo.debug;
	
	var version = require("./package.json").version;
	
	
	var sources = null;
	
	var settings = {
		snapcastEnabled: false,
		serverAddress: null,
		autoJoin: false
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
				getSnapcastStatus(function(enabled) {
					sources.setSourceOptions("snapcast", {
						enabled: enabled,
						transportControls: false,
						usesHifiberryControl: true
					});
				});
			}
			
			readSnapcastConfiguration();
			if (configuration.server && configuration.server.value != "0.0.0.0") {
				settings.serverAddress = configuration.server.value;
			} else {
				settings.serverAddress = null;
			}
			
			if (configuration.autostart && configuration.autostart.value == "1") {
				settings.autoJoin = true;
			} else {
				settings.autoJoin = false;
			}
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "snapcast") {
				beo.bus.emit("ui", {target: "snapcast", header: "snapcastSettings", content: settings});
			}
		}
	});
	
	beo.bus.on('snapcast', function(event) {
		
		if (event.header == "snapcastEnabled") {
			
			if (event.content.enabled != undefined) {
				setSnapcastStatus(event.content.enabled, function(newStatus, error) {
					beo.bus.emit("ui", {target: "snapcast", header: "snapcastSettings", content: settings});
					if (sources) sources.setSourceOptions("snapcast", {enabled: newStatus});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("snapcast");
					}
					if (error) {
						beo.bus.emit("ui", {target: "snapcast", header: "errorTogglingSnapcast", content: {}});
					}
				});
			}
		
		}
		
		if (event.header == "autoJoin") {
			
			if (event.content.enabled != undefined) {
				settings.autoJoin = event.content.enabled;
				value = (settings.autoJoin) ? "1" : "0";
				relaunch = settings.snapcastEnabled;
				configureSnapcast([{option: "autostart", value: value}], relaunch, function(success) {
					beo.bus.emit("ui", {target: "snapcast", header: "snapcastSettings", content: settings});
				});
			}
		
		}
		
		if (event.header == "setServerAddress") {
			
			if (event.content.address != undefined) {
				settings.serverAddress = event.content.address;
				relaunch = settings.snapcastEnabled;
				configureSnapcast([{option: "server", value: settings.serverAddress}], relaunch, function(success) {
					beo.bus.emit("ui", {target: "snapcast", header: "snapcastSettings", content: settings});
				});
			} else {
				settings.serverAddress = null;
				relaunch = settings.snapcastEnabled;
				configureSnapcast([{option: "server", remove: true}], relaunch, function(success) {
					beo.bus.emit("ui", {target: "snapcast", header: "snapcastSettings", content: settings});
				});
			}
		
		}
	});
	
	
	function getSnapcastStatus(callback) {
		exec("systemctl is-active --quiet snapcastmpris.service").on('exit', function(code) {
			if (code == 0) {
				settings.snapcastEnabled = true;
				callback(true);
			} else {
				settings.snapcastEnabled = false;
				callback(false);
			}
		});
	}
	
	function setSnapcastStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now snapcastmpris.service").on('exit', function(code) {
				if (code == 0) {
					settings.snapcastEnabled = true;
					if (debug) console.log("Snapcast enabled.");
					callback(true);
				} else {
					settings.snapcastEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now snapcastmpris.service").on('exit', function(code) {
				settings.snapcastEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("Snapcast disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
function configureSnapcast(options, relaunch, callback) {
	readSnapcastConfiguration();
	//if (Object.keys(configuration).length != 0) {
		if (typeof options == "object" && !Array.isArray(options)) {
			options = [options];
		}
		for (var i = 0; i < options.length; i++) {
			if (options[i].option) {
				if (options[i].value) {
					if (debug) console.log("Configuring Snapcast (setting "+options[i].option+")...")
					configuration[options[i].option] = {value: options[i].value, comment: false};
				} else {
					if (configuration[options[i].option]) {
						if (options[i].remove) {
							if (debug) console.log("Configuring Snapcast (removing "+options[i].option+")...")
							delete configuration[options[i].option];
						} else {
							if (debug) console.log("Configuring Snapcast (commenting out "+options[i].option+")...")
							configuration[options[i].option].comment = true;
						}
					}
				}
			}
		}
		writeSnapcastConfiguration();
		if (relaunch) {
			exec("systemctl restart snapcastmpris.service", function(error, stdout, stderr) {
				if (error) {
					if (debug) console.error("Relaunching Snapcast failed: "+error);
					if (callback) callback(false, error);
				} else {
					if (debug) console.error("Snapcast was relaunched.");
					if (callback) callback(true);
				}
			});
		} else {
			if (callback) callback(true);
		}
	/*} else {
		if (callback) callback(false);
	}*/
}

snapcastConfigModified = 0;
function readSnapcastConfiguration() {
	if (fs.existsSync("/etc/snapcastmpris.conf")) {
		modified = fs.statSync("/etc/snapcastmpris.conf").mtimeMs;
		if (modified != snapcastConfigModified) {
			// Reads configuration into a JavaScript object for easy access.
			snapcastConfigModified = modified;
			snapcastConfig = fs.readFileSync("/etc/snapcastmpris.conf", "utf8").split('\n');
			section = null;
			commentCounter = 0;
			for (var i = 0; i < snapcastConfig.length; i++) {
				
				line = snapcastConfig[i].trim();
				comment = (line.charAt(0) == "#") ? true : false;
				if (comment) {
					lineItems = line.slice(1).split("=");
				} else {
					lineItems = line.split("=");
				}
				if (lineItems.length == 2) {
					value = lineItems[1].trim();
					configuration[lineItems[0].trim()] = {value: value, comment: comment};
				} else if (comment) {
					configuration["comment-"+commentCounter] = {text: line, comment: true};
					commentCounter++;
				}
			}
		}
		return configuration;
	}
}

function writeSnapcastConfiguration() {
	// Saves current configuration back into the file.
	//if (fs.existsSync("/etc/snapcastmpris.conf")) {
		snapcastConfig = [];
		
		for (option in configuration) {
			if (configuration[option].comment) {
				if (configuration[option].text) {
					line = configuration[option].text;
				} else {
					line = "#"+option+" = "+configuration[option].value;
				}
			} else {
				line = option+" = "+configuration[option].value;
			}
			snapcastConfig.push(line);
		}
		fs.writeFileSync("/etc/snapcastmpris.conf", snapcastConfig.join("\n"));
		snapcastConfigModified = fs.statSync("/etc/snapcastmpris.conf").mtimeMs;
	//}
}
	
module.exports = {
	version: version,
	isEnabled: getSnapcastStatus
};

