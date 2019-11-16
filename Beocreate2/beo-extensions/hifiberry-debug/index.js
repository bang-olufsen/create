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

var collecting = false;

beo.bus.on('general', function(event) {
	
	if (event.header == "startup") {
		
		if (fs.existsSync("/tmp/hifiberry-debug.zip")) {
			dl = beo.addDownloadRoute("hifiberry-debug", "archive.zip", "/tmp/hifiberry-debug.zip", true);
		}

	}
	
	if (event.header == "activatedExtension") {
		if (event.content == "hifiberry-debug") {
			
			if (!collecting) {
				if (fs.existsSync("/tmp/hifiberry-debug.zip")) {
					beo.sendToUI({target: "hifiberry-debug", header: "archive", content: {archiveURL: dl, archiveDate: fs.statSync("/tmp/hifiberry-debug.zip").mtimeMs}});
				} else {
					beo.sendToUI({target: "hifiberry-debug", header: "archive"});
					beo.removeDownloadRoute("hifiberry-debug", "archive.zip");
				}
			} else {
				beo.sendToUI({target: "hifiberry-debug", header: "archive"});
			}
		}
		
		
	}
});


beo.bus.on('hifiberry-debug', function(event) {
	
	if (event.header == "collect") {
		beo.sendToUI({target: "hifiberry-debug", header: "collecting"});
		collecting = true;
		beo.removeDownloadRoute("hifiberry-debug", "archive.zip");
		if (debug) console.log("Collecting HiFiBerry diagnostic information...");
		exec("/opt/hifiberry/bin/debuginfo", function(error, stdout, stderr) {
			collecting = false;
			if (!error) {
				if (fs.existsSync("/tmp/hifiberry-debug.zip")) {
					dl = beo.addDownloadRoute("hifiberry-debug", "archive.zip", "/tmp/hifiberry-debug.zip", true);
					beo.sendToUI({target: "hifiberry-debug", header: "finished"});
					beo.sendToUI({target: "hifiberry-debug", header: "archive", content: {archiveURL: dl, archiveDate: fs.statSync("/tmp/hifiberry-debug.zip").mtimeMs}});
					if (debug) console.log("Diagnostic information archive is now available to download.");
				} else {
					beo.sendToUI({target: "hifiberry-debug", header: "error"});
					if (debug) console.log("Unknown error creating diagnostic information archive.");
				}
			} else {
				beo.sendToUI({target: "hifiberry-debug", header: "error"});
				if (debug) console.log("Error creating diagnostic information archive:", error);
			}
		});
	}
	
	
});



	
module.exports = {
	version: version
};

