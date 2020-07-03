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

// HIFIBERRY DEBUG INFORMATION COLLECTOR FOR BEOCREATE

const fetch = require("node-fetch");
var exec = require("child_process").exec;
var fs = require("fs");

var debug = beo.debug;
var version = require("./package.json").version;

var collecting = false;
var archive = null;
var archiveDownloadTimeout;

var hifiberryState = {};
var previousExtension = null

beo.bus.on('general', function(event) {
	
	if (event.header == "startup") {
		

	}
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == "hifiberry-debug") {
			
			if (!collecting) {
				if (archive) {
					beo.sendToUI("hifiberry-debug", {header: "archive", content: {archiveURL: archive}});
				} else {
					beo.sendToUI("hifiberry-debug", {header: "archive"});
				}
			} else {
				beo.sendToUI("hifiberry-debug", {header: "collecting"});
			}
			
			readState();
			if (hifiberryState.CURRENT_EXCLUSIVE && hifiberryState.CURRENT_EXCLUSIVE == "1") {
				exclusiveAudio = true;
			} else {
				exclusiveAudio = false;
			}
			
			if (hifiberryState.CURRENT_SAMPLERATE) {
				resamplingRate = parseFloat(hifiberryState.CURRENT_SAMPLERATE);
			} else {
				resamplingRate = 0;
			}
			
			beo.sendToUI("hifiberry-debug", {header: "state", content: {exclusiveAudio: exclusiveAudio, resamplingRate: resamplingRate}});
		}
		
		if (event.content.extension != previousExtension) {
			fetch("http://127.0.1.1:3141/api/activate/beo_extension_"+event.content.extension, {method: "post"});
			if (previousExtension) fetch("http://127.0.1.1:3141/api/deactivate/beo_extension_"+previousExtension, {method: "post"});
			previousExtension = event.content.extension;
		}
	}
});


beo.bus.on('hifiberry-debug', function(event) {
	
	if (event.header == "collect") {
		beo.sendToUI("hifiberry-debug", {header: "collecting"});
		collecting = true;
		clearTimeout(archiveDownloadTimeout);
		beo.removeDownloadRoute("hifiberry-debug", "archive.zip");
		if (debug) console.log("Collecting HiFiBerry diagnostic information...");
		exec("/opt/hifiberry/bin/debuginfo", function(error, stdout, stderr) {
			collecting = false;
			if (!error) {
				if (fs.existsSync("/tmp/hifiberry-debug.zip")) {
					archive = beo.addDownloadRoute("hifiberry-debug", "archive.zip", "/tmp/hifiberry-debug.zip", true);
					beo.sendToUI("hifiberry-debug", {header: "finished"});
					beo.sendToUI("hifiberry-debug", {header: "archive", content: {archiveURL: archive}});
					archiveDownloadTimeout = setTimeout(function() {
						// Time out the archive after 5 minutes so that the data is guaranteed to be fairly fresh.
						beo.sendToUI("hifiberry-debug", {header: "archive"});
						beo.removeDownloadRoute("hifiberry-debug", "archive.zip");
						archive = null;
						if (debug) console.log("Diagnostic information archive has timed out.");
					}, 300000);
					if (debug) console.log("Diagnostic information archive is now available to download for 5 minutes.");
				} else {
					beo.sendToUI("hifiberry-debug", {header: "error"});
					if (debug) console.log("Unknown error creating diagnostic information archive.");
				}
			} else {
				beo.sendToUI("hifiberry-debug", {header: "error"});
				if (debug) console.log("Error creating diagnostic information archive:", error);
			}
		});
	}
	
	
});

hifiberryStateModified = 0;
function readState() {
	if (fs.existsSync("/etc/hifiberry.state")) {
		modified = fs.statSync("/etc/hifiberry.state").mtimeMs;
		if (modified != hifiberryStateModified) {
			// Reads configuration into a JavaScript object for easy access.
			hifiberryStateModified = modified;
			state = fs.readFileSync("/etc/hifiberry.state", "utf8").split('\n');
			for (var i = 0; i < state.length; i++) {
				
				line = state[i].trim();
				lineItems = line.split("=");
				if (lineItems.length == 2) {
					hifiberryState[lineItems[0].trim()] = lineItems[1].trim();
				}
			}
		}
		return hifiberryState;
	}
}

function reportUsage(key, duration) {
	try {
		fetch("http://127.0.1.1:3141/api/use/beo_"+key+"/"+duration, {method: "post"});
	} catch (error) {
		console.error("Can't report usage: ", error);
	}
}

function reportActivation(key, active) {
	try {
		if (active) {
			fetch("http://127.0.1.1:3141/api/activate/"+key, {method: "post"});
		} else {
			fetch("http://127.0.1.1:3141/api/deactivate/"+key, {method: "post"});
		}
	} catch (error) {
		console.error("Can't report activation: ", error);
	}
}

module.exports = {
	reportUsage: reportUsage,
	reportActivation: reportActivation,
	version: version
};

