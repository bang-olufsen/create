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


var settings = {
	autoUpdate: false,
	autoCheck: false
};

beo.bus.on('general', function(event) {
	
	if (event.header == "startup") {
		
		

	}
	
	if (event.header == "activatedExtension") {
		if (event.content == "software-update") {
			checkForUpdate();
		}
	}
});


beo.bus.on('software-update', function(event) {
	
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
		exec("/opt/hifiberry/bin/update --check", function(error, stdout, stderr) {
			lastChecked = checkTime;
			newVersion = stdout.trim();
			if (newVersion) {
				if (debug) console.log("Software update is available – release "+newVersion+".");
				beo.sendToUI({target: "software-update", header: "updateAvailable", content: {version: newVersion, releaseNotes: releaseNotes}});
			} else {
				newVersion = null;
				if (debug) console.log("Product appears to be up to date.");
				beo.sendToUI({target: "software-update", header: "upToDate"});
			}
		});
	} else {
		if (debug) console.log("Checked for update less than 5 minutes ago, sending cached info.");
		if (newVersion) {
			beo.sendToUI({target: "software-update", header: "updateAvailable", content: {version: newVersion, releaseNotes: releaseNotes}});
		} else {
			beo.sendToUI({target: "software-update", header: "upToDate"});
		}
	}
}

var updateInProgress = false;
var updatePhase = 0;
var previousProgress = -5;
function installUpdate() {
	if (!updateInProgress) {
		updateInProgress = true;
		if (beo.developerMode) {
			updateProcess = spawn("/opt/hifiberry/bin/update", ["--simulate"]);
		} else {
			updateProcess = spawn("/opt/hifiberry/bin/update");
		}
		//updateProcess = spawn("curl", ["https://www.hifiberry.com/images/updater-20191030-pi3.tar.gz", "-o", "updater.tar.gz", "--progress-bar"], {cwd: "/data"});
		
		updateProcess.stdout.on('data', function (data) {
			//console.log('stdout: ' + data.toString());
			data = data.toString();
			switch (updatePhase) {
				case 0: // Download starting.
					if (data.indexOf("downloading http") != -1) {
						updatePhase = 1;
					}
					break;
				case 1:
					if (data.indexOf("Could not download updater") != -1) {
						updatePhase = 0;
						beo.sendToUI({target: "software-update", header: "updateError", content: {reason: "downloadError"}});
					}
					if (data.indexOf("unmounting") != -1) {
						updatePhase = 2;
						beo.sendToUI({target: "software-update", header: "updating", content: {progress: 50, phase: "extractingFirmware"}});
					}
					break;
				case 2:
					if (data.indexOf("mounting") != -1) {
						updatePhase = 3;
						beo.sendToUI({target: "software-update", header: "updating", content: {progress: 70, phase: "resizing"}});
					}
					break;
				case 3:
					if (data.indexOf("extracting new kernel") != -1) {
						updatePhase = 4;
						beo.sendToUI({target: "software-update", header: "updating", content: {progress: 75, phase: "extractingKernel"}});
					}
					break;
				case 4:
					if (data.indexOf("migrating") != -1) {
						updatePhase = 5;
						beo.sendToUI({target: "software-update", header: "updating", content: {progress: 85, phase: "copyingFiles"}});
					}
					break;
				case 5:
					if (data.indexOf("switching root file system") != -1) {
						updatePhase = 6;
						beo.sendToUI({target: "software-update", header: "updating", content: {progress: 95, phase: "finalising"}});
					}
					if (data.indexOf("not switching to new version") != -1) {
						updatePhase = 0;
						beo.sendToUI({target: "software-update", header: "updating", content: {progress: 100, phase: "doneSimulation"}});
					}
					break;
				case 6:
					if (data.indexOf("removing") != -1) {
						updatePhase = 0;
						beo.sendToUI({target: "software-update", header: "updating", content: {progress: 100, phase: "done"}});
					}
					break;
			}
		});
		
		updateProcess.stderr.on('data', function (data) {
			data = data.toString();
			if (updatePhase == 1) {
				progressIndex = data.indexOf("%");
				if (progressIndex != -1) {
					percentage = parseFloat(data.substr(progressIndex-5, 5));
					if (percentage - previousProgress >= 5) {
						beo.sendToUI({target: "software-update", header: "updating", content: {progress: Math.round(percentage/2), phase: "download"}});
						previousProgress = percentage;
					}
				}
			}
			
		});
		
		updateProcess.on('exit', function (code) {
			updateInProgress = false;
			console.log('Updater exited with code ' + code.toString());
		});
	}
}


	
module.exports = {
	version: version
};

