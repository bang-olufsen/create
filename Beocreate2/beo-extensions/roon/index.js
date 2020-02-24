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

// ROON CONTROL FOR BEOCREATE

var exec = require("child_process").exec;

	var debug = beo.debug;
	
	var version = require("./package.json").version;
	
	var sources = null;
	
	var roonEnabled = false;
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (beo.extensions.sources &&
				beo.extensions.sources.setSourceOptions &&
				beo.extensions.sources.sourceDeactivated) {
				sources = beo.extensions.sources;
			}
			
			if (sources) {
				getRoonStatus(function(enabled) {
					sources.setSourceOptions("roon", {
						enabled: enabled,
						aka: ["raat"],
						transportControls: true,
						usesHifiberryControl: true
					});
				});
			}
			
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "roon") {
				beo.bus.emit("ui", {target: "roon", header: "roonSettings", content: {roonEnabled: roonEnabled}});
			}
		}
	});
	
	beo.bus.on('roon', function(event) {
		
		if (event.header == "roonEnabled") {
			
			if (event.content.enabled != undefined) {
				setRoonStatus(event.content.enabled, function(newStatus, error) {
					beo.bus.emit("ui", {target: "roon", header: "roonSettings", content: {roonEnabled: newStatus}});
					if (sources) sources.setSourceOptions("roon", {enabled: newStatus});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("roon");
					}
					if (error) {
						beo.bus.emit("ui", {target: "roon", header: "errorTogglingRoon", content: {}});
					}
				});
			}
		
		}
	});
	
	
	function getRoonStatus(callback) {
		exec("systemctl is-active --quiet raat.service").on('exit', function(code) {
			if (code == 0) {
				roonEnabled = true;
				callback(true);
			} else {
				roonEnabled = false;
				callback(false);
			}
		});
	}
	
	function setRoonStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now raat.service").on('exit', function(code) {
				if (code == 0) {
					roonEnabled = true;
					if (debug) console.log("Roon enabled.");
					callback(true);
				} else {
					roonEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now raat.service").on('exit', function(code) {
				roonEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("Roon disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
module.exports = {
	version: version,
	isEnabled: getRoonStatus
};
