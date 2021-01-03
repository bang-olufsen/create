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

// BEOCREATE ELEMENTS MODULE

var exec = require("child_process").exec;
var fs = require("fs");

	var debug = beo.debug;
	var version = require("./package.json").version;
	
	
	var sources = null;
	
	var settings = {
		bluetoothEnabled: false,
		bluetoothDiscoverable: false,
		pairingMode: null
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
				getBluetoothStatus(function(enabled) {
					sources.setSourceOptions("bluetooth", {
						enabled: enabled,
						transportControls: true,
						usesHifiberryControl: true
					});
				});
			}
			
			readBluetoothConfiguration();
			if (configuration.General &&
				configuration.General.DiscoverableTimeout != undefined) {
				if (configuration.General.DiscoverableTimeout.value == "0") {
					settings.pairingMode = "always";
				} else {
					settings.pairingMode = parseFloat(configuration.General.DiscoverableTimeout.value);
				}
			} else {
				settings.pairingMode = null;
			}
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "bluetooth") {
				getBluetoothDiscoveryStatus(function() {
					beo.sendToUI("bluetooth", "bluetoothSettings", {settings: settings});
				});
			}
		}
	});
	
	beo.bus.on('product-information', function(event) {
		
		if (event.header == "systemNameChanged") {
			// Listen to changes in system name and update the shairport-sync display name.
			if (event.content.systemName) {
				configureBluetooth({section: "General", option: "Name", value: event.content.systemName}, true);
			}
			
		}
		
		
	});
	
	beo.bus.on('bluetooth', function(event) {
		
		if (event.header == "bluetoothEnabled") {
			
			if (event.content.enabled != undefined) {
				setBluetoothStatus(event.content.enabled, function(newStatus, error) {
					beo.bus.emit("ui", {target: "bluetooth", header: "bluetoothSettings", content: {settings: settings }});
					if (sources) sources.setSourceOptions("bluetooth", {enabled: newStatus, playerState: "stopped"});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("bluetooth");
					}
					if (error) {
						beo.bus.emit("ui", {target: "bluetooth", header: "errorTogglingBluetooth", content: {}});
					}
				});
			}
		
		}

		if (event.header == "bluetoothDiscoverable") {			
			if (event.content.enabled != undefined) {
				setBluetoothDiscoverable(event.content.enabled, function(newStatus) {
					beo.sendToUI("bluetooth", {header: "bluetoothSettings", content: {settings: settings}});
				})
			}		
		}
		
		if (event.header == "setPairingMode") {
			if (event.content.mode) {
				timeout = null;
				if (event.content.mode == "always") {
					timeout = 0;
				} else if (!isNaN(event.content.mode)) {
					timeout = event.content.mode;
				}
				if (timeout != null) {
					configureBluetooth({section: "General", option: "DiscoverableTimeout", value: timeout.toString()}, true);
					settings.pairingMode = event.content.mode;
					beo.sendToUI("bluetooth", {header: "bluetoothSettings", content: {settings: settings}});
					setBluetoothDiscoverable(true);
				}
			}
		}
	});
	
	
	function getBluetoothStatus(callback) {
		exec("systemctl is-active --quiet bluealsa-aplay.service").on('exit', function(code) {
			if (code == 0) {
				settings.bluetoothEnabled = true;
				callback(true);
			} else {
				settings.bluetoothEnabled = false;
				callback(false);
			}
		});
	}

	function getBluetoothDiscoveryStatus(callback) {
		exec("bluetoothctl show | grep 'Discoverable: yes'").on('exit', function(code) {
			if (code == 0) {
				settings.bluetoothDiscoverable = true;
				callback(true);
			} else {
				settings.bluetoothDiscoverable = false;
				callback(false);
			}
		});
	}
	
	var bluetoothDiscoveryTimeout = null;
	
	function setBluetoothDiscoverable(enabled, callback) {
		clearTimeout(bluetoothDiscoveryTimeout);
		if (enabled) {
			exec("bluetoothctl discoverable yes").on('exit', function(code) {
				if (code == 0) {
					settings.bluetoothDiscoverable = true;
					
					if (settings.pairingMode != "always" && settings.pairingMode != null) {
						bluetoothDiscoveryTimeout = setTimeout(function() {
							getBluetoothDiscoveryStatus(function() {
								beo.sendToUI("bluetooth", {header: "bluetoothSettings", content: {settings: settings}});
							});
						}, settings.pairingMode*1000+2000);
					}
					if (callback) callback(true);
				} else {
					settings.bluetoothDiscoverable = false;
					if (callback) callback(false, true);
				}
			});
		} else {
			exec("bluetoothctl discoverable no").on('exit', function(code) {
				if (code == 0) {
					settings.bluetoothDiscoverable = false;
					if (callback) callback(false);
				} else {
					settings.bluetoothDiscoverable = false;
					if (callback) callback(false, true);
				}
			});
		}
	}
	
	function setBluetoothStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now bluetooth.service bluealsa.service bluealsa-aplay.service").on('exit', function(code) {
				if (code == 0) {
					settings.bluetoothEnabled = true;
					if (debug) console.log("Bluetooth enabled.");
					callback(true);
				} else {
					settings.bluetoothEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now bluetooth.service bluealsa.service bluealsa-aplay.service").on('exit', function(code) {
				settings.bluetoothEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("Bluetooth disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
	
	function configureBluetooth(options, relaunch, callback) {
		readBluetoothConfiguration();
		if (Object.keys(configuration).length != 0) {
			if (typeof options == "object" && !Array.isArray(options)) {
				options = [options];
			}
			for (var i = 0; i < options.length; i++) {
				if (options[i].section && options[i].option) {
					if (!configuration[options[i].section]) configuration[options[i].section] = {};
					if (options[i].value) {
						if (debug) console.log("Configuring Bluetooth (setting "+options[i].option+" in "+options[i].section+")...")
						configuration[options[i].section][options[i].option] = {value: options[i].value, comment: false};
					} else {
						if (configuration[options[i].section][options[i].option]) {
							if (options[i].remove) {
								if (debug) console.log("Configuring Bluetooth (removing "+options[i].option+" in "+options[i].section+")...")
								delete configuration[options[i].section][options[i].option];
							} else {
								if (debug) console.log("Configuring Bluetooth (commenting out "+options[i].option+" in "+options[i].section+")...")
								configuration[options[i].section][options[i].option].comment = true;
							}
						}
					}
				}
			}
			writeBluetoothConfiguration();
			if (relaunch && settings.bluetoothEnabled) {
				exec("systemctl restart bluetooth.service bluealsa.service bluealsa-aplay.service", function(error, stdout, stderr) {
					if (error) {
						if (debug) console.error("Relaunching Bluetooth failed: "+error);
						if (callback) callback(false, error);
					} else {
						if (debug) console.error("Bluetooth was relaunched.");
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
	
	bluetoothConfigModified = 0;
	function readBluetoothConfiguration() {
		if (fs.existsSync("/etc/bluetooth/main.conf")) {
			modified = fs.statSync("/etc/bluetooth/main.conf").mtimeMs;
			if (modified != bluetoothConfigModified) {
				// Reads configuration into a JavaScript object for easy access.
				bluetoothConfig = fs.readFileSync("/etc/bluetooth/main.conf", "utf8").split('\n');
				section = null;
				for (var i = 0; i < bluetoothConfig.length; i++) {
					// Find settings sections.
					if (bluetoothConfig[i].indexOf("[") != -1 && bluetoothConfig[i].indexOf("]") != -1) {
						section = bluetoothConfig[i].trim().slice(1, -1);
						configuration[section] = {};
					} else {
						if (section != null) {
							line = bluetoothConfig[i].trim();
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
	
	function writeBluetoothConfiguration() {
		// Saves current configuration back into the file.
		if (fs.existsSync("/etc/bluetooth/main.conf")) {
			bluetoothConfig = [];
			for (section in configuration) {
				bluetoothConfig.push("["+section+"]");
				for (option in configuration[section]) {
					if (configuration[section][option].comment) {
						line = "#"+option+" = "+configuration[section][option].value;
					} else {
						line = option+" = "+configuration[section][option].value;
					}
					bluetoothConfig.push(line);
				}
			}
			fs.writeFileSync("/etc/bluetooth/main.conf", bluetoothConfig.join("\n"));
			bluetoothConfigModified = fs.statSync("/etc/bluetooth/main.conf").mtimeMs;
		}
	}
	
interact = {
	actions: {
		startPairing: function() {
			setBluetoothDiscoverable(true);
		}
	}
}
	
module.exports = {
	version: version,
	isEnabled: getBluetoothStatus,
	isDiscoveryRunning: getBluetoothDiscoveryStatus,
	interact: interact
};

