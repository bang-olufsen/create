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

// spotify CONTROL FOR BEOCREATE

var exec = require("child_process").exec;
var fs = require("fs");

	var debug = beo.debug;
	var version = require("./package.json").version;
	
	
	var sources = null;
	
	var settings = {
		spotifyEnabled: false,
		loggedInAs: false
	};
	var configuration = {};
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (beo.extensions.sources &&
				beo.extensions.sources.setSourceOptions &&
				beo.extensions.sources.sourceDeactivated) {
				sources = beo.extensions.sources;
			}
			
			if (sources) {
				getspotifyStatus(function(enabled) {
					sources.setSourceOptions("spotify", {
						enabled: enabled,
						transportControls: true,
						usesHifiberryControl: true,
						aka: "spotify"
					});
				});
			}
			
			readConfiguration();
			// Check login here (removed).
			if (sources && Object.keys(configuration).length == 0) {
				sources.setSourceOptions("spotify", {
					enabled: false
				});
			}
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "spotify") {
				beo.bus.emit("ui", {target: "spotify", header: "spotifySettings", content: settings});
			}
		}
	});
	
	beo.bus.on('product-information', function(event) {
		
		if (event.header == "systemNameChanged") {
			// Listen to changes in system name and update the spotify display name.
			if (event.content.systemName) {
				configure({section: "Authentication", option: "device-name", value: ("'"+event.content.systemName.split(" ").join("-")+"'")}, true);
			}
			
		}
		
		
	});
	
	beo.bus.on('spotify', function(event) {
		
		if (event.header == "spotifyEnabled") {
			
			if (event.content.enabled != undefined) {
				setspotifyStatus(event.content.enabled, function(newStatus, error) {
					beo.bus.emit("ui", {target: "spotify", header: "spotifySettings", content: settings});
					if (sources) sources.setSourceOptions("spotify", {enabled: newStatus});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("spotify");
					}
					if (error) {
						beo.bus.emit("ui", {target: "spotify", header: "errorTogglingspotify", content: {}});
					}
				});
			}
		
		}
		
		
		if (event.header == "logIn") {
			if (event.content.username && event.content.password) {
				configure([
					{section: "global", option: "username", value: event.content.username},
					{section: "global", option: "password", value: event.content.password}
				], true, function(success, error) {
					if (success) {
						settings.loggedInAs = event.content.username;
						beo.bus.emit("ui", {target: "spotify", header: "spotifySettings", content: settings});
					} else {
						beo.bus.emit("ui", {target: "spotify", header: "logInError"});
						configure([
							{section: "global", option: "username", remove: true},
							{section: "global", option: "password", remove: true}
						], true);
						settings.loggedInAs = false;
						beo.bus.emit("ui", {target: "spotify", header: "spotifySettings", content: settings});
					}
				});
			}
		}
		
		if (event.header == "logOut") {
			settings.loggedInAs = false;
			configure([
				{section: "global", option: "username", remove: true},
				{section: "global", option: "password", remove: true}
			], true, function() {
				beo.bus.emit("ui", {target: "spotify", header: "spotifySettings", content: settings});
			});
		}
	});
	
	
	function getspotifyStatus(callback) {
		exec("systemctl is-active --quiet spotify.service").on('exit', function(code) {
			if (code == 0) {
				settings.spotifyEnabled = true;
				callback(true);
			} else {
				settings.spotifyEnabled = false;
				callback(false);
			}
		});
	}
	
	function setspotifyStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now spotify.service").on('exit', function(code) {
				if (code == 0) {
					settings.spotifyEnabled = true;
					if (debug) console.log("Spotify enabled.");
					callback(true);
				} else {
					spotifyEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now spotify.service").on('exit', function(code) {
				settings.spotifyEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("Spotify disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
	function configure(options, relaunch, callback) {
		readConfiguration();
		if (Object.keys(configuration).length != 0) {
			if (typeof options == "object" && !Array.isArray(options)) {
				options = [options];
			}
			for (var i = 0; i < options.length; i++) {
				if (options[i].section && options[i].option) {
					if (!configuration[options[i].section]) configuration[options[i].section] = {};
					if (options[i].value) {
						if (debug) console.log("Configuring Spotify (setting "+options[i].option+" in "+options[i].section+")...")
						configuration[options[i].section][options[i].option] = {value: options[i].value, comment: false};
					} else {
						if (configuration[options[i].section][options[i].option]) {
							if (options[i].remove) {
								if (debug) console.log("Configuring Spotify (removing "+options[i].option+" in "+options[i].section+")...")
								delete configuration[options[i].section][options[i].option];
							} else {
								if (debug) console.log("Configuring Spotify (commenting out "+options[i].option+" in "+options[i].section+")...")
								configuration[options[i].section][options[i].option].comment = true;
							}
						}
					}
				}
			}
			writeConfiguration();
			if (relaunch && settings.spotifyEnabled) {
				exec("systemctl restart spotify.service", function(error, stdout, stderr) {
					if (error) {
						if (debug) console.error("Relaunching Spotify failed: "+error);
						if (callback) callback(false, error);
					} else {
						if (debug) console.error("Spotify was relaunched.");
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
	
	configModified = 0;
	function readConfiguration() {
		if (fs.existsSync("/etc/vollibrespot.conf")) {
			modified = fs.statSync("/etc/vollibrespot.conf").mtimeMs;
			if (modified != configModified) {
				// Reads configuration into a JavaScript object for easy access.
				configModified = modified;
				config = fs.readFileSync("/etc/vollibrespot.conf", "utf8").split('\n');
				section = null;
				for (var i = 0; i < config.length; i++) {
					// Find settings sections.
					var line = config[i].trim();
					if (line.indexOf("[") == 0 && line.indexOf("]") != -1) {
						section = line.slice(1, -1);
						configuration[section] = {};
					} else {
						if (section != null) {
							comment = (line.charAt(0) == "#") ? true : false;
							if (comment) {
								lineItems = line.slice(1).split("=");
							} else {
								lineItems = line.split("=");
							}
							if (lineItems.length == 2) {
								value = lineItems[1].trim();
								if (configuration[section][lineItems[0].trim()] == undefined) configuration[section][lineItems[0].trim()] = {value: value, comment: comment};
							}
						}
					}
				}
			}
		}
	}
	
	function writeConfiguration() {
		// Saves current configuration back into the file.
		if (fs.existsSync("/etc/vollibrespot.conf")) {
			config = [];
			for (section in configuration) {
				sectionStart = (config.length != 0) ? "\n["+section+"]" : "["+section+"]";
				config.push(sectionStart);
				for (option in configuration[section]) {
					if (configuration[section][option].comment) {
						line = "#"+option+" = "+configuration[section][option].value;
					} else {
						line = option+" = "+configuration[section][option].value;
					}
					config.push(line);
				}
			}
			fs.writeFileSync("/etc/vollibrespot.conf", config.join("\n"));
			configModified = fs.statSync("/etc/vollibrespot.conf").mtimeMs;
		}
	}
	
module.exports = {
	version: version,
	isEnabled: getspotifyStatus
};

