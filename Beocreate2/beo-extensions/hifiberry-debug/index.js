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

var exec = require("child_process").exec;
var fs = require("fs");

var debug = beo.debug;
var version = require("./package.json").version;

var collecting = false;
var archive = null;
var archiveDownloadTimeout;

beo.bus.on('general', function(event) {
	
	if (event.header == "startup") {
		

	}
	
	if (event.header == "activatedExtension") {
		if (event.content == "hifiberry-debug") {
			
			if (!collecting) {
				if (archive) {
					beo.sendToUI("hifiberry-debug", {header: "archive", content: {archiveURL: archive}});
				} else {
					beo.sendToUI("hifiberry-debug", {header: "archive"});
				}
			} else {
				beo.sendToUI("hifiberry-debug", {header: "collecting"});
			}
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



	
module.exports = {
	version: version
};

