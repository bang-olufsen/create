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

// Raspberry Pi System Tools

// Can perform some basic Raspberry Pi system tasks, such as setting hostname, expanding root file system and power management (shutdown, reboot).

var child_process = require('child_process');
var fs = require('fs');


var pi_system_tools = module.exports = {
	getHostname: getHostname,
	setHostname: setHostname,
	ssh: ssh,
	setSPI: setSPI,
	expandFilesystem: expandFilesystem,
	power: power
};

function getHostname(callback) {
	command = "hostnamectl --pretty";
	child_process.exec(command, function(error, stdout, stderr) {
		if (error) {
			callback(null, error);
		} else {
			uiName = stdout.slice(0,-1);
			command = "hostnamectl --static";
			child_process.exec(command, function(error, stdout, stderr) {
				if (error) {
					callback(null, error);
				} else {
					staticName = stdout.slice(0,-1);
					callback({ui: uiName, static: staticName});
				}
			});
		}
	});
}

function setHostname(productName, callback) {
	command = "hostnamectl set-hostname \""+productName+"\"";
	child_process.exec(command, function(error, stdout, stderr) {
		if (error) {
			callback(null, error);
		} else {
			command = "hostnamectl --pretty";
			child_process.exec(command, function(error, stdout, stderr) {
				if (error) {
					callback(null, error);
				} else {
					uiName = stdout.slice(0,-1);
					command = "hostnamectl --static";
					child_process.exec(command, function(error, stdout, stderr) {
						if (error) {
							callback(null, error);
						} else {
							staticName = stdout.slice(0,-1);
							// Change name in /etc/hosts
							hostsFile = fs.readFileSync("/etc/hosts", "utf8").split('\n');
							for (var i = 0; i < hostsFile.length; i++) {
								if (hostsFile[i].indexOf("127.0.1.1") != -1) {
									hostsFile[i] = "127.0.1.1       "+staticName;
								}
							}
							hostsText = hostsFile.join("\n");
							fs.writeFileSync("/etc/hosts", hostsText);
							callback(true, {ui: uiName, static: staticName});
						}
					});
				}
			});
		}
	});
}

function ssh(trueMode, callback) {
	if (trueMode != null) {
		if (trueMode == true) {
			mode = 0;
		} else if (trueMode == false) {
			mode = 1;
		}
		command = "raspi-config nonint do_ssh "+mode;
		child_process.exec(command, function(error, stdout, stderr) {
			if (error) {
				callback(null, error);
			} else {
				callback(trueMode);
			}
		});
	} else {
		command = "raspi-config nonint get_ssh";
		child_process.exec(command, function(error, stdout, stderr) {
			if (error) {
				callback(null, error);
			} else {
				if (stdout.indexOf("1") != -1) {
					trueMode = false;
				} else {
					trueMode = true;
				}
				callback(trueMode);
			}
		});
	}
}

function setSPI(mode, callback) {
	if (mode == true || mode == false) {
		if (mode == true) {
			mode = 0;
		} else {
			mode = 1;
		}
		command = "raspi-config nonint do_spi "+mode;
		child_process.exec(command, function(error, stdout, stderr) {
			if (error) {
				callback(null, error);
			} else {
				callback(true);
			}
		});
	}
}

function expandFilesystem(callback) {
	command = "raspi-config nonint get_can_expand";
	child_process.exec(command, function(error, stdout, stderr) {
		if (error) {
			callback(null, error);
		} else if (stdout) {
			if (stdout.indexOf("0") != -1) {
				// Can expand, do it
				command = "raspi-config nonint do_expand_rootfs";
				child_process.exec(command, function(error, stdout, stderr) {
					if (error) {
						callback(null, error);
					} else {
						callback(true);
					}
				});
			} else {
				// Can't expand
				callback(false);
			}
		}
	});
}

function power(operation) {
	// Calling a power function will naturally exit the script.
	if (operation == "reboot") {
		child_process.exec("reboot", function(error, stdout, stderr) {
			//
		});
		process.exit(0);
	}
	if (operation == "shutdown") {
		child_process.exec("shutdown -H now", function(error, stdout, stderr) {
			//
		});
		process.exit(0);
	}
}
