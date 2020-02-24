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
			if (event.content.extension == "ssh") {
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
		
		if (event.header == "checkCurrentPassword") {
			if (event.content.currentPassword) {
				checkCurrentPassword("root", event.content.currentPassword, function(result, error) {
					if (!error) {
						beo.bus.emit("ui", {target: "ssh", header: "passwordCorrect", content: {correct: result}});
					} else {
						beo.bus.emit("ui", {target: "ssh", header: "passwordCheckFailed"});
					}
				});
			}
		}
		
		if (event.header == "setNewPassword") { // Current password is still required and checked – the above step is to simply alert the user of a wrong password before they type the new password.
			if (event.content.currentPassword && event.content.newPassword) {
				checkCurrentPassword("root", event.content.currentPassword, function(result, error) {
					if (!error) {
						if (result == true) { // Password matches, change it.
							// Change password here.
							setNewPassword("root", event.content.newPassword, function(success) {
								if (success) {
									settings.sshPasswordChanged = isPasswordChanged("root");
									beo.bus.emit("ui", {target: "ssh", header: "sshSettings", content: settings});
									beo.bus.emit("ui", {target: "ssh", header: "passwordChanged"});
								} else {
									beo.bus.emit("ui", {target: "ssh", header: "passwordChangeFailed"});
								}
							});
						}
					} else {
						beo.bus.emit("ui", {target: "ssh", header: "passwordCheckFailed"});
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
					if (debug) console.log("Remote login (SSH) enabled.");
					if (callback) callback(true);
				} else {
					settings.sshEnabled = false;
					if (callback) callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now sshd.service").on('exit', function(code) {
				settings.sshEnabled = false;
				if (code == 0) {
					if (callback) callback(false);
					if (debug) console.log("Remote login (SSH) disabled.");
				} else {
					if (callback) callback(false, true);
				}
			});
		}
	}
	
	function isPasswordChanged(user) {
		shadow = readShadow(user);
		passwordChanged = (shadow.passwordChanged) ? true : false;
		return passwordChanged;
	}
	
	function checkCurrentPassword(user, password, callback) {
		shadow = readShadow(user);
		if (shadow.passwordSalt) {
			algorithm = null;
			switch (shadow.passwordAlgorithm) {
				case "1":
					algorithm = "md5";
					break;
				case "5":
					algorithm = "sha256";
					break;
				case "6":
					algorithm = "sha512";
					break;
				default:
					console.error("Unexpected password hash algorithm.");
					break;
			}
			if (algorithm) {
				exec("mkpasswd --method="+algorithm+" --salt="+shadow.passwordSalt+" "+password, function(error, stdout, stderr) {
					if (error) {
						console.error("Failed to generate a password hash to check: "+error);
						if (callback) callback(false, error);
					} else {
						passwordItems = stdout.split("$");
						if (passwordItems[3].trim() == shadow.passwordHash.trim()) {
							if (callback) callback(true);
							console.log("Password is correct.");
						} else {
							if (callback) callback(false);
							console.log("Password is incorrect.");
						}
					}
				});
			}
		}
	}
	
	function setNewPassword(user, newPassword, callback) { // Never call this function on its own, always pair it with a check for current password.
		exec("echo -e \""+newPassword+"\n"+newPassword+"\" | passwd "+user, function(error, stdout, stderr) {
			if (error) {
				console.error("Failed to set new password: "+error);
				if (callback) callback(false, error);
			} else {
				if (stderr.indexOf("password for "+user+" changed by "+user) != -1) {
					if (callback) callback(true);
					console.log("Password was changed.");
				} else {
					if (callback) callback(false);
					console.log("Could not change password.");
				}
			}
		});
	}
	
	function readShadow(user) {
		shadowFile = fs.readFileSync("/etc/shadow", "utf8").split("\n");
		shadow = {};
		for (var i = 0; i < shadowFile.length; i++) {
			shadowItem = shadowFile[i].split(":");
			if (shadowItem[0] == user) {
				shadow.passwordChanged = shadowItem[2];
				passwordItem = shadowItem[1].split("$");
				shadow.passwordAlgorithm = passwordItem[1];
				shadow.passwordSalt = passwordItem[2];
				shadow.passwordHash = passwordItem[3];
				break;
			}
		}
		return shadow;
	}
	
module.exports = {
	version: version
}

