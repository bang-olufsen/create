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

// HIFIBERRY AUDIOCONTROL INTERACTION FOR BEOCREATE

var exec = require("child_process").exec;
var fs = require("fs");

var debug = beo.debug;
var version = require("./package.json").version;

var configuration = {};


beo.bus.on('general', function(event) {
	
	if (event.header == "startup") {
		

	}
	
});


beo.bus.on('hifiberry-audiocontrol', function(event) {
	
	
	
	
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
			commentCounter = 0;
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
						} else if (comment) {
							configuration["comment-"+commentCounter] = {text: line, comment: true};
							commentCounter++;
						}
					}
				}
			}
		}
		return configuration;
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
					if (configuration[section][option].text) {
						line = configuration[section][option].text;
					} else {
						line = "#"+option+" = "+configuration[section][option].value;
					}
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

	
module.exports = {
	getSettings: readAudioControlConfiguration,
	configure: configureAudioControl,
	version: version
};

