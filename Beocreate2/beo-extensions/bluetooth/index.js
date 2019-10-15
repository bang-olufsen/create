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

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	var version = require("./package.json").version;
	
	
	var sources = null;
	
	var bluetoothEnabled = false;
	
	beoBus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (globals.extensions.sources &&
				globals.extensions.sources.setSourceOptions &&
				globals.extensions.sources.sourceDeactivated) {
				sources = globals.extensions.sources;
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
			
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "bluetooth") {
				beoBus.emit("ui", {target: "bluetooth", header: "bluetoothSettings", content: {bluetoothEnabled: bluetoothEnabled}});
			}
		}
	});
	
	beoBus.on('bluetooth', function(event) {
		
		if (event.header == "bluetoothEnabled") {
			
			if (event.content.enabled != undefined) {
				setBluetoothStatus(event.content.enabled, function(newStatus, error) {
					beoBus.emit("ui", {target: "bluetooth", header: "bluetoothSettings", content: {bluetoothEnabled: newStatus}});
					if (sources) sources.setSourceOptions("bluetooth", {enabled: newStatus, playerState: "stopped"});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("bluetooth");
					}
					if (error) {
						beoBus.emit("ui", {target: "bluetooth", header: "errorTogglingBluetooth", content: {}});
					}
				});
			}
		
		}
	});
	
	
	function getBluetoothStatus(callback) {
		exec("systemctl is-active --quiet bluetoothd.service bluealsa.service bluealsa-aplay.service").on('exit', function(code) {
			if (code == 0) {
				bluetoothEnabled = true;
				callback(true);
			} else {
				bluetoothEnabled = false;
				callback(false);
			}
		});
	}
	
	function setBluetoothStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now bluetoothd.service bluealsa.service bluealsa-aplay.service").on('exit', function(code) {
				if (code == 0) {
					bluetoothEnabled = true;
					if (debug) console.log("Bluetooth enabled.");
					callback(true);
				} else {
					bluetoothEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now bluetoothd.service bluealsa.service bluealsa-aplay.service").on('exit', function(code) {
				bluetoothEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("Bluetooth disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
	return {
		version: version
	}

};

