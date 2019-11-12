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

// SSH CONTROL FOR BEOCREATE

var exec = require("child_process").exec;
var fs = require("fs");

	var debug = beo.debug;
	var version = require("./package.json").version;
	
	
	var settings = {
		sshEnabled: false,
		sshPasswordChanged: false
	};
	var configuration = {};
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			
			getSSHStatus();
			settings.sshPasswordChanged = isPasswordChanged("root");

		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "ssh") {
				settings.sshPasswordChanged = isPasswordChanged("root");
				beo.bus.emit("ui", {target: "ssh", header: "sshSettings", content: settings});
			}
		}
	});

	
	beo.bus.on('ssh', function(event) {
		

		if (event.header == "sshEnabled") {
			if (event.content.enabled != undefined) {
				setSSHStatus(event.content.enabled, function(newStatus, error) {
					beo.bus.emit("ui", {target: "ssh", header: "sshSettings", content: settings});
					if (error) {
						beo.bus.emit("ui", {target: "ssh", header: "errorTogglingSSH", content: {}});
					}
				});
			}
		}
		
	});


	function getSSHStatus(callback) {
		exec("systemctl is-active --quiet sshd.service").on('exit', function(code) {
			if (code == 0) {
				settings.sshEnabled = true;
				if (callback) callback(true);
			} else {
				settings.sshEnabled = false;
				if (callback) callback(false);
			}
		});
	}
	
	function setSSHStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now sshd.service").on('exit', function(code) {
				if (code == 0) {
					settings.sshEnabled = true;
					if (debug) console.log("SSH enabled.");
					if (callback) callback(true);
				} else {
					spotifydEnabled = false;
					if (callback) callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now sshd.service").on('exit', function(code) {
				settings.sshEnabled = false;
				if (code == 0) {
					if (callback) callback(false);
					if (debug) console.log("SSH disabled.");
				} else {
					if (callback) callback(false, true);
				}
			});
		}
	}
	
	function isPasswordChanged(user) {
		passwordChanged = null;
		shadow = fs.readFileSync("/etc/shadow", "utf8").split("\n");
		for (var i = 0; i < shadow.length; i++) {
			shadowItem = shadow[i].split(":");
			if (shadowItem[0] == user) {
				passwordChanged = (shadowItem[2] != "") ? true : false;
				break;
			}
		}
		return passwordChanged;
	}
	
module.exports = {
	version: version
}

