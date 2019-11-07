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

var exec = require('child_process').exec;
var fs = require('fs');


var pi_system_tools = module.exports = {
	getHostname: getHostname,
	setHostname: setHostname,
	getSerial: getSerial,
	ssh: ssh,
	setSPI: setSPI,
	expandFilesystem: expandFilesystem,
	power: power
};

function getHostname(callback) {
	command = "/usr/bin/hostnamectl --pretty";
	exec(command, function(error, stdout, stderr) {
		if (error) {
			callback(null, error);
		} else {
			uiName = stdout.replace(/\r?\n|\r/g, ""); // Remove newlines
			command = "/usr/bin/hostnamectl --static";
			exec(command, function(error, stdout, stderr) {
				if (error) {
					callback(null, error);
				} else {
					staticName = stdout.slice(0,-1);
					if (uiName == "") uiName = null;
					callback({ui: uiName, static: staticName});
				}
			});
		}
	});
}

function setHostname(productName, callback) {
	command = "/usr/bin/hostnamectl set-hostname --pretty \""+productName+"\"";
	exec(command, function(error, stdout, stderr) {
		if (error) {
			callback(null, error);
		} else {
			n = productName.replace(/ /g, "-"); // Replace spaces with hyphens
			n = n.replace(/\r?\n|\r/g, ""); // Remove newlines
			n = n.replace(/\./g, "-"); // Replace periods with hyphens
			n = n.replace(/_/g, "-"); // Replace underscores with hyphens
			n = n.replace(/[^\x00-\x7F]/g, ""); // Remove non-ascii characters
			n = n.replace(/-+$/g, ""); // Remove hyphens from the end of the name.
			command = "/usr/bin/hostnamectl set-hostname --static "+n;
			exec(command, function(error, stdout, stderr) {
				if (error) {
					callback(null, error);
				} else {
					command = "/usr/bin/hostnamectl --pretty";
					exec(command, function(error, stdout, stderr) {
						if (error) {
							callback(null, error);
						} else {
							uiName = stdout.replace(/\r?\n|\r/g, ""); // Remove newlines
							if (fs.existsSync("/etc/systemname")) {
								fs.writeFileSync("/etc/systemname", uiName);
							}
							command = "/usr/bin/hostnamectl --static";
							exec(command, function(error, stdout, stderr) {
								if (error) {
									callback(null, error);
								} else {
									staticName = stdout.slice(0,-1);
									if (uiName == "") uiName = null;
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
									setTimeout(function() {
										exec("systemctl restart avahi-daemon");
									}, 500);
								}
							});
						}
					});
				}
			});
		}
	});
}

function getSerial(callback) {
	// Get serial number from CPUInfo (can be used as a unique reference to the system)
	serial = null;
	if (fs.existsSync("/proc/cpuinfo", "utf8")) {
		cpuInfo = fs.readFileSync("/proc/cpuinfo", "utf8").split('\n');
		for (var i = 0; i < cpuInfo.length; i++) {
			if (cpuInfo[i].indexOf("Serial\t") != -1) {
				serial = cpuInfo[i].split(": ")[1];
			}
		}
	}
	callback(serial);
}


function ssh(trueMode, callback) {
	if (trueMode != null) {
		if (trueMode == true) {
			mode = 0;
		} else if (trueMode == false) {
			mode = 1;
		}
		command = "/usr/bin/raspi-config nonint do_ssh "+mode;
		exec(command, function(error, stdout, stderr) {
			if (error) {
				callback(null, error);
			} else {
				callback(trueMode);
			}
		});
	} else {
		command = "/usr/bin/raspi-config nonint get_ssh";
		exec(command, function(error, stdout, stderr) {
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
		command = "/usr/bin/raspi-config nonint do_spi "+mode;
		exec(command, function(error, stdout, stderr) {
			if (error) {
				callback(null, error);
			} else {
				callback(true);
			}
		});
	}
}

function expandFilesystem(callback) {
	command = "/usr/bin/raspi-config nonint get_can_expand";
	exec(command, function(error, stdout, stderr) {
		if (error) {
			callback(null, error);
		} else if (stdout) {
			if (stdout.indexOf("0") != -1) {
				// Can expand, do it
				command = "/usr/bin/raspi-config nonint do_expand_rootfs";
				exec(command, function(error, stdout, stderr) {
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

function power(operation, callback) {
	// Calling a power function will naturally exit the script.
	if (operation == "reboot") {
		exec("/bin/reboot", function(error, stdout, stderr) {
			//process.exit(0);
		});
		//process.exit(0);
	}
	if (operation == "shutdown") {
		exec("/usr/sbin/shutdown now", function(error, stdout, stderr) {
			//
		});
		//process.exit(0);
	}
}
