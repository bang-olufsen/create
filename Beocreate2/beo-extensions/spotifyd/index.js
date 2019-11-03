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
var fs = require("fs");

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	var version = require("./package.json").version;
	
	
	var sources = null;
	
	var settings = {
		spotifydEnabled: false,
		loggedInAs: false
	};
	var configuration = {};
	
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
			
			readSpotifydConfiguration();
			if (configuration.global.username && !configuration.global.username.comment && configuration.global.password && !configuration.global.password.comment) {
				settings.loggedInAs = configuration.global.username.value;
			} else {
				settings.loggedInAs = false;
			}
			if (sources && Object.keys(configuration).length == 0) {
				sources.setSourceOptions("spotifyd", {
					enabled: false
				});
			}
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "spotifyd") {
				beoBus.emit("ui", {target: "spotifyd", header: "spotifydSettings", content: settings});
			}
		}
	});
	
	beoBus.on('product-information', function(event) {
		
		if (event.header == "systemNameChanged") {
			// Listen to changes in system name and update the spotifyd display name.
			if (event.content.systemName) {
				configureSpotifyd({section: "global", option: "device_name", value: event.content.systemName.split(" ").join("")}, true);
			}
			
		}
		
		
	});
	
	beoBus.on('spotifyd', function(event) {
		
		if (event.header == "spotifydEnabled") {
			
			if (event.content.enabled != undefined) {
				setSpotifydStatus(event.content.enabled, function(newStatus, error) {
					beoBus.emit("ui", {target: "spotifyd", header: "spotifydSettings", content: settings});
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
		
		
		if (event.header == "logIn") {
			if (event.content.username && event.content.password) {
				configureSpotifyd([
					{section: "global", option: "username", value: event.content.username},
					{section: "global", option: "password", value: event.content.password}
				], true, function(success, error) {
					if (success) {
						settings.loggedInAs = event.content.username;
						beoBus.emit("ui", {target: "spotifyd", header: "spotifydSettings", content: settings});
					} else {
						beoBus.emit("ui", {target: "spotifyd", header: "logInError"});
						configureSpotifyd([
							{section: "global", option: "username", remove: true},
							{section: "global", option: "password", remove: true}
						], true);
						settings.loggedInAs = false;
						beoBus.emit("ui", {target: "spotifyd", header: "spotifydSettings", content: settings});
					}
				});
			}
		}
		
		if (event.header == "logOut") {
			settings.loggedInAs = false;
			configureSpotifyd([
				{section: "global", option: "username", remove: true},
				{section: "global", option: "password", remove: true}
			], true, function() {
				beoBus.emit("ui", {target: "spotifyd", header: "spotifydSettings", content: settings});
			});
		}
	});
	
	
	function getSpotifydStatus(callback) {
		exec("systemctl is-active --quiet spotify.service").on('exit', function(code) {
			if (code == 0) {
				settings.spotifydEnabled = true;
				callback(true);
			} else {
				settings.spotifydEnabled = false;
				callback(false);
			}
		});
	}
	
	function setSpotifydStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now spotify.service").on('exit', function(code) {
				if (code == 0) {
					settings.spotifydEnabled = true;
					if (debug) console.log("Spotifyd enabled.");
					callback(true);
				} else {
					spotifydEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now spotify.service").on('exit', function(code) {
				settings.spotifydEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("Spotifyd disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
	function configureSpotifyd(options, relaunch, callback) {
		readSpotifydConfiguration();
		if (Object.keys(configuration).length != 0) {
			if (typeof options == "object" && !Array.isArray(options)) {
				options = [options];
			}
			for (var i = 0; i < options.length; i++) {
				if (options[i].section && options[i].option) {
					if (!configuration[options[i].section]) configuration[options[i].section] = {};
					if (options[i].value) {
						if (debug) console.log("Configuring spotifyd (setting "+options[i].option+" in "+options[i].section+")...")
						configuration[options[i].section][options[i].option] = {value: options[i].value, comment: false};
					} else {
						if (configuration[options[i].section][options[i].option]) {
							if (options[i].remove) {
								if (debug) console.log("Configuring spotifyd (removing "+options[i].option+" in "+options[i].section+")...")
								delete configuration[options[i].section][options[i].option];
							} else {
								if (debug) console.log("Configuring spotifyd (commenting out "+options[i].option+" in "+options[i].section+")...")
								configuration[options[i].section][options[i].option].comment = true;
							}
						}
					}
				}
			}
			writeSpotifydConfiguration();
			if (relaunch && settings.spotifydEnabled) {
				exec("systemctl restart spotify.service", function(error, stdout, stderr) {
					if (error) {
						if (debug) console.error("Relaunching spotifyd failed: "+error);
						if (callback) callback(false, error);
					} else {
						if (debug) console.error("Spotifyd was relaunched.");
						if (callback) callback(true);
					}
				});
			} else {
				if (callback) callback(true);
			}
		} else {
			if (callback) callback(false);
		}
	}
	
	spotifydConfigModified = 0;
	function readSpotifydConfiguration() {
		if (fs.existsSync("/etc/spotifyd.conf")) {
			modified = fs.statSync("/etc/spotifyd.conf").mtimeMs;
			if (modified != spotifydConfigModified) {
				// Reads configuration into a JavaScript object for easy access.
				spotifydConfigModified = modified;
				spotifydConfig = fs.readFileSync("/etc/spotifyd.conf", "utf8").split('\n');
				section = null;
				for (var i = 0; i < spotifydConfig.length; i++) {
					// Find settings sections.
					if (spotifydConfig[i].indexOf("[") != -1 && spotifydConfig[i].indexOf("]") != -1) {
						section = spotifydConfig[i].trim().slice(1, -1);
						configuration[section] = {};
					} else {
						if (section != null) {
							line = spotifydConfig[i].trim();
							comment = (line.charAt(0) == "#") ? true : false;
							if (comment) {
								lineItems = line.slice(1).split("=");
							} else {
								lineItems = line.split("=");
							}
							if (lineItems.length == 2) {
								value = lineItems[1].trim();
								configuration[section][lineItems[0].trim()] = {value: value, comment: comment};
							}
						}
					}
				}
			}
		}
	}
	
	function writeSpotifydConfiguration() {
		// Saves current configuration back into the file.
		if (fs.existsSync("/etc/spotifyd.conf")) {
			spotifydConfig = [];
			for (section in configuration) {
				spotifydConfig.push("["+section+"]");
				for (option in configuration[section]) {
					if (configuration[section][option].comment) {
						line = "#"+option+" = "+configuration[section][option].value;
					} else {
						line = option+" = "+configuration[section][option].value;
					}
					spotifydConfig.push(line);
				}
			}
			fs.writeFileSync("/etc/spotifyd.conf", spotifydConfig.join("\n"));
			spotifydConfigModified = fs.statSync("/etc/spotifyd.conf").mtimeMs;
		}
	}
	
	return {
		version: version
	}
	
};

