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
	autoCheck: true,
	manualUpdateTrack: null
};
var settings = JSON.parse(JSON.stringify(defaultSettings));

var autoUpdate = "latest";
var previousVersionChecked = false;
var previousVersion = null;

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
			checkForPreviousVersion();
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
	
	if (event.header == "manualUpdateMode") {
		if (event.content.mode != undefined) {
			switch (event.content.mode) {
				case false:
				case null:
				case "default":
				case "auto":
					beo.saveSettings("software-update", settings);
					settings.manualUpdateTrack = null;
					break;
				case "critical":
				case "stable":
				case "latest":
				case "experimental":
					settings.manualUpdateTrack = event.content.mode;
					beo.saveSettings("software-update", settings);
					break;
			}
		}
		autoUpdateMode();
	}
	
	if (event.header == "install") {
		installUpdate();
	}
	
	if (event.header == "restorePreviousVersion") {
		beo.sendToUI("software-update", {header: "restoringPreviousVersion", content: {stage: "start"}});
		exec("/opt/hifiberry/bin/reactivate-previous-release", function(error, stdout, stderr) {
			if (stdout) {
				if (stdout.indexOf("No previous release") != -1) {
					beo.sendToUI("software-update", {header: "restoringPreviousVersion", content: {stage: "fail", reason: "notFound"}});
				}
				if (stdout.indexOf("Unknown partition") != -1) {
					beo.sendToUI("software-update", {header: "restoringPreviousVersion", content: {stage: "fail", reason: "unknownPartition"}});
				}
			}
		});
	}
	
	
});

var lastChecked = 0;
var newVersion = null;
var releaseNotes = "";

function checkForUpdate(forceCheck) {
	checkTime = new Date().getTime();
	updateTrack = (settings.manualUpdateTrack) ? settings.manualUpdateTrack : ((autoUpdate != false || autoUpdate != "critical") ? autoUpdate : "latest");
	if (checkTime - lastChecked > 300000 || forceCheck) {
		exec("/opt/hifiberry/bin/update --"+updateTrack+" --check", function(error, stdout, stderr) {
			lastChecked = checkTime;
			updateLines = stdout.trim().split("\n");
			newVersion = updateLines[0];
			if (newVersion) {
				if (newVersion.indexOf("Couldn't") != -1) { // Error checking for update.
					console.error("There was an error checking for update ('"+updateTrack+"' track): "+newVersion);
					lastChecked = 0;
					newVersion = null;
					releaseNotes = "";
					beo.sendToUI("software-update", "errorChecking");
				} else {
					if (debug) console.log("Software update is available – release "+newVersion+" ('"+updateTrack+"' track).");
					updateLines.splice(0, 1);
					releaseNotes = updateLines.join("\n").trim();
					beo.sendToUI("software-update", {header: "updateAvailable", content: {version: newVersion, releaseNotes: releaseNotes}});
				}
			} else {
				newVersion = null;
				releaseNotes = "";
				if (debug) console.log("Product appears to be up to date ('"+updateTrack+"' track).");
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
		updateTrack = (settings.manualUpdateTrack) ? settings.manualUpdateTrack : ((autoUpdate != false || autoUpdate != "critical") ? autoUpdate : "latest");
		/*if (beo.developerMode) {
			if (debug) console.log("Starting software update simulation.");
			updateProcess = spawn("/opt/hifiberry/bin/update", ["--simulate", "--"+updateTrack]);
		} else {*/
			if (debug) console.log("Starting software update.");
			updateProcess = spawn("/opt/hifiberry/bin/update", ["--"+updateTrack]);
		//}
		
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
	if (mode != undefined) {
		switch (mode) {
			case "critical":
			case "stable":
			case "latest":
			case "experimental":
				fs.writeFileSync("/etc/updater.release", mode);
				autoUpdate = mode;
				break;
			case false:
				fs.writeFileSync("/etc/updater.release", "off");
				autoUpdate = false;
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
					autoUpdate = modeRead;
					break;
				default:
					autoUpdate = false;
					break;
			}
		} else {
			autoUpdate = false;
		}
	}
	beo.sendToUI("software-update", {header: "autoUpdateMode", content: {mode: autoUpdate, manualMode: settings.manualUpdateTrack}});
}

function checkForPreviousVersion() {
	if (!previousVersionChecked) {
		if (fs.existsSync("/boot/zImage.bak")) {
			previousVersion = true;
			if (fs.existsSync("/etc/hifiberry.version.previous")) {
				previousVersion = fs.readFileSync("/etc/hifiberry.version.previous", "utf8").trim();
			}
		} else {
			previousVersion = false;
		}
		previousVersionChecked = true;
	}
	beo.sendToUI("software-update", {header: "previousVersion", content: {previousVersion: previousVersion}});
}


	
module.exports = {
	version: version
};

