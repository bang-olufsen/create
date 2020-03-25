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

// HIFIBERRY SOFTWARE UPDATE FOR BEOCREATE

var exec = require("child_process").exec;
var spawn = require("child_process").spawn;
var fs = require("fs");

var debug = beo.debug;
var version = require("./package.json").version;


var defaultSettings = {
	autoCheck: true
};
var settings = JSON.parse(JSON.stringify(defaultSettings));

var autoUpdate = "latest";

beo.bus.on('general', function(event) {
	
	if (event.header == "startup") {
		
		if (settings.autoCheck) {
			autoUpdateMode();
			startAutoCheckTimeout();
		}

	}
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == "software-update") {
			checkForUpdate();
			autoUpdateMode();
		}
		
		if (event.content == "general-settings") {
			if (newVersion) {
				beo.sendToUI("software-update", {header: "badge", content: {badge: 1}});
			} else {
				beo.sendToUI("software-update", {header: "badge"});
			}
		}
	}
	
	if (event.header == "connected") {
		if (newVersion) {
			beo.sendToUI("software-update", {header: "badge", content: {badge: 1}});
		}
	}
});


beo.bus.on('software-update', function(event) {
	
	if (event.header == "settings") {
		if (event.content.settings) {
			settings = Object.assign(settings, event.content.settings);
		}
	}
	
	if (event.header == "autoUpdateMode") {
		if (event.content.mode != undefined) {
			autoUpdateMode(event.content.mode);
		}
	}
	
	if (event.header == "install") {
		installUpdate();
	}
	
	
});

var lastChecked = 0;
var newVersion = null;
var releaseNotes = "";

function checkForUpdate(forceCheck) {
	checkTime = new Date().getTime();
	if (checkTime - lastChecked > 300000 || forceCheck) {
		exec("/opt/hifiberry/bin/update --"+autoUpdate+" --check", function(error, stdout, stderr) {
			lastChecked = checkTime;
			updateLines = stdout.trim().split("\n");
			newVersion = updateLines[0];
			if (newVersion) {
				if (debug) console.log("Software update is available – release "+newVersion+".");
				updateLines.splice(0, 1);
				releaseNotes = updateLines.join("\n").trim();
				beo.sendToUI("software-update", {header: "updateAvailable", content: {version: newVersion, releaseNotes: releaseNotes}});
			} else {
				newVersion = null;
				releaseNotes = "";
				if (debug) console.log("Product appears to be up to date.");
				beo.sendToUI("software-update", {header: "upToDate"});
			}
		});
	} else {
		if (debug) console.log("Checked for update less than 5 minutes ago, sending cached info.");
		if (newVersion) {
			beo.sendToUI("software-update", {header: "updateAvailable", content: {version: newVersion, releaseNotes: releaseNotes}});
		} else {
			beo.sendToUI("software-update", {header: "upToDate"});
		}
	}
	if (settings.autoCheck) startAutoCheckTimeout();
}

var updateInProgress = false;
var updatePhase = 0;
var previousProgress = -5;
function installUpdate() {
	if (!updateInProgress) {
		updateInProgress = true;
		if (beo.developerMode) {
			if (debug) console.log("Starting software update simulation.");
			updateProcess = spawn("/opt/hifiberry/bin/update", ["--simulate", "--"+autoUpdate]);
		} else {
			if (debug) console.log("Starting software update.");
			updateProcess = spawn("/opt/hifiberry/bin/update", ["--"+autoUpdate]);
		}
		//updateProcess = spawn("curl", ["https://www.hifiberry.com/images/updater-20191030-pi3.tar.gz", "-o", "updater.tar.gz", "--progress-bar"], {cwd: "/data"});
		
		updateProcess.stdout.on('data', function (data) {
			//console.log('stdout: ' + data.toString());
			data = data.toString();
			switch (updatePhase) {
				case 0: // Download starting.
					if (data.indexOf("downloading http") != -1) {
						updatePhase = 1;
						if (debug) console.log("Downloading update...");
					}
					break;
				case 1:
					if (data.indexOf("Could not download updater") != -1) {
						updatePhase = 0;
						beo.sendToUI("software-update", {header: "updateError", content: {reason: "downloadError"}});
						console.error("Update download was unsuccessful.");
					}
					if (data.indexOf("unmounting") != -1) {
						updatePhase = 2;
						beo.sendToUI("software-update", {header: "updating", content: {progress: 50, phase: "extractingFirmware"}});
						if (debug) console.log("Extracting firmware...");
					}
					break;
				case 2:
					if (data.indexOf("mounting") != -1) {
						updatePhase = 3;
						beo.sendToUI("software-update", {header: "updating", content: {progress: 70, phase: "resizing"}});
						if (debug) console.log("Resizing file system...");
					}
					break;
				case 3:
					if (data.indexOf("extracting new kernel") != -1) {
						updatePhase = 4;
						beo.sendToUI("software-update", {header: "updating", content: {progress: 75, phase: "extractingKernel"}});
						if (debug) console.log("Extracting new kernel...");
					}
					break;
				case 4:
					if (data.indexOf("migrating") != -1) {
						updatePhase = 5;
						beo.sendToUI("software-update", {header: "updating", content: {progress: 85, phase: "copyingFiles"}});
						if (debug) console.log("Copying files from current installation to new installation...");
					}
					break;
				case 5:
					if (data.indexOf("switching root file system") != -1) {
						updatePhase = 6;
						beo.sendToUI("software-update", {header: "updating", content: {progress: 95, phase: "finalising"}});
						if (debug) console.log("Switching root file system...");
					}
					if (data.indexOf("not switching to new version") != -1) {
						updatePhase = 0;
						beo.sendToUI("software-update", {header: "updating", content: {progress: 100, phase: "doneSimulation"}});
						if (debug) console.log("Update simulation complete.");
					}
					break;
				case 6:
					if (data.indexOf("removing") != -1) {
						updatePhase = 0;
						beo.sendToUI("software-update", {header: "updating", content: {progress: 100, phase: "done"}});
						if (debug) console.log("Removing updater and restarting...");
					}
					break;
			}
		});
		
		updateProcess.stderr.on('data', function (data) {
			data = data.toString();
			if (updatePhase == 1) { // Updates from curl.
				progressIndex = data.indexOf("%");
				if (progressIndex != -1) { 
					percentage = parseFloat(data.substr(progressIndex-5, 5));
					if (percentage - previousProgress >= 5) {
						beo.sendToUI("software-update", {header: "updating", content: {progress: Math.round(percentage/2), phase: "download"}});
						previousProgress = percentage;
					}
				}
			}
			
		});
		
		updateProcess.on('exit', function (code) {
			updateInProgress = false;
			console.log('Software updater process exited (code '+code.toString()+").");
		});
	}
}

var autoCheckTimeout;
function startAutoCheckTimeout() {
	clearTimeout(autoCheckTimeout);
	autoCheckTimeout = setTimeout(function() {
		checkForUpdate();
	}, 86400000) // Check once per day.
}

function autoUpdateMode(mode) {
	if (mode) {
		switch (mode) {
			case "critical":
			case "stable":
			case "latest":
			case "experimental":
				fs.writeFileSync("/etc/updater.release", mode);
				break;
			case false:
				fs.writeFileSync("/etc/updater.release", "off");
				break;
		}
	} else {
		if (fs.existsSync("/etc/updater.release")) {
			modeRead = fs.readFileSync("/etc/updater.release", "utf8").trim();
			switch (modeRead) {
				case "critical":
				case "stable":
				case "latest":
				case "experimental":
					mode = modeRead;
					break;
				default:
					mode = false;
					break;
			}
		} else {
			mode = false;
		}
	}
	autoUpdate = (mode) ? mode : "latest";
	beo.sendToUI("software-update", {header: "autoUpdateMode", content: {mode: autoUpdate}});
}


	
module.exports = {
	version: version
};

