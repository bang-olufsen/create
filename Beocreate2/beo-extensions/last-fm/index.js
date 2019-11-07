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

// LAST.FM CONTROL FOR BEOCREATE

var exec = require("child_process").exec;
var fs = require("fs");

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	var version = require("./package.json").version;
	
	
	var settings = {
		loggedInAs: false
	};
	var configuration = {};
	
	beoBus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			
			
			readAudioControlConfiguration();
			if (configuration.lastfm.username && !configuration.lastfm.username.comment && configuration.lastfm.password && !configuration.lastfm.password.comment) {
				settings.loggedInAs = configuration.lastfm.username.value;
			} else {
				settings.loggedInAs = false;
			}

		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "last-fm") {
				beoBus.emit("ui", {target: "last-fm", header: "lastFMSettings", content: settings});
			}
		}
	});

	
	beoBus.on('last-fm', function(event) {
		

		if (event.header == "logIn") {
			if (event.content.username && event.content.password) {
				configureAudioControl([
					{section: "lastfm", option: "username", value: event.content.username},
					{section: "lastfm", option: "password", value: event.content.password}
				], true, function(success, error) {
					if (success) {
						settings.loggedInAs = event.content.username;
						beoBus.emit("ui", {target: "last-fm", header: "lastFMSettings", content: settings});
					} else {
						beoBus.emit("ui", {target: "last-fm", header: "logInError"});
						configureaudioControl([
							{section: "lastfm", option: "username", remove: true},
							{section: "lastfm", option: "password", remove: true}
						], true);
						settings.loggedInAs = false;
						beoBus.emit("ui", {target: "last-fm", header: "lastFMSettings", content: settings});
					}
				});
			}
		}
		
		if (event.header == "logOut") {
			settings.loggedInAs = false;
			configureAudioControl([
				{section: "lastfm", option: "username", remove: true},
				{section: "lastfm", option: "password", remove: true}
			], true, function() {
				beoBus.emit("ui", {target: "last-fm", header: "lastFMSettings", content: settings});
			});
		}
	});
	
	
	function configureAudioControl(options, relaunch, callback) {
		readAudioControlConfiguration();
		if (Object.keys(configuration).length != 0) {
			if (typeof options == "object" && !Array.isArray(options)) {
				options = [options];
			}
			for (var i = 0; i < options.length; i++) {
				if (options[i].section && options[i].option) {
					if (!configuration[options[i].section]) configuration[options[i].section] = {};
					if (options[i].value) {
						if (debug) console.log("Configuring AudioControl (setting "+options[i].option+" in "+options[i].section+")...")
						configuration[options[i].section][options[i].option] = {value: options[i].value, comment: false};
					} else {
						if (configuration[options[i].section][options[i].option]) {
							if (options[i].remove) {
								if (debug) console.log("Configuring AudioControl (removing "+options[i].option+" in "+options[i].section+")...")
								delete configuration[options[i].section][options[i].option];
							} else {
								if (debug) console.log("Configuring AudioControl (commenting out "+options[i].option+" in "+options[i].section+")...")
								configuration[options[i].section][options[i].option].comment = true;
							}
						}
					}
				}
			}
			writeAudioControlConfiguration();
			if (relaunch) {
				exec("systemctl restart audiocontrol2.service", function(error, stdout, stderr) {
					if (error) {
						if (debug) console.error("Relaunching AudioControl failed: "+error);
						if (callback) callback(false, error);
					} else {
						if (debug) console.error("AudioControl was relaunched.");
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
	
	audioControlConfigModified = 0;
	function readAudioControlConfiguration() {
		if (fs.existsSync("/etc/audiocontrol2.conf")) {
			modified = fs.statSync("/etc/audiocontrol2.conf").mtimeMs;
			if (modified != audioControlConfigModified) {
				// Reads configuration into a JavaScript object for easy access.
				audioControlConfigModified = modified;
				audioControlConfig = fs.readFileSync("/etc/audiocontrol2.conf", "utf8").split('\n');
				section = null;
				for (var i = 0; i < audioControlConfig.length; i++) {
					// Find settings sections.
					if (audioControlConfig[i].indexOf("[") != -1 && audioControlConfig[i].indexOf("]") != -1) {
						section = audioControlConfig[i].trim().slice(1, -1);
						configuration[section] = {};
					} else {
						if (section != null) {
							line = audioControlConfig[i].trim();
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
	
	function writeAudioControlConfiguration() {
		// Saves current configuration back into the file.
		if (fs.existsSync("/etc/audiocontrol2.conf")) {
			audioControlConfig = [];
			for (section in configuration) {
				sectionStart = (audioControlConfig.length != 0) ? "\n["+section+"]" : "["+section+"]";
				audioControlConfig.push(sectionStart);
				for (option in configuration[section]) {
					if (configuration[section][option].comment) {
						line = "#"+option+" = "+configuration[section][option].value;
					} else {
						line = option+" = "+configuration[section][option].value;
					}
					audioControlConfig.push(line);
				}
			}
			fs.writeFileSync("/etc/audiocontrol2.conf", audioControlConfig.join("\n"));
			audioControlConfigModified = fs.statSync("/etc/audiocontrol2.conf").mtimeMs;
		}
	}
	
	return {
		version: version
	}
	
};

