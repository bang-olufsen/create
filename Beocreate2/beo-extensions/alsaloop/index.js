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

// DAC+ ADC ANALOGUE INPUT CONTROL FOR BEOCREATE

var exec = require("child_process").exec;

	var debug = beo.debug;
	var version = require("./package.json").version;
	
	
	var sources = null;
	
	var loopEnabled = false;
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (beo.extensions.sources &&
				beo.extensions.sources.setSourceOptions &&
				beo.extensions.sources.sourceDeactivated) {
				sources = beo.extensions.sources;
			}
			
			if (sources) {
				getLoopStatus(function(enabled) {
					sources.setSourceOptions("alsaloop", {
						enabled: enabled,
						transportControls: ["play", "stop"],
						startable: true,
						usesHifiberryControl: true
					});
				});
			}
			
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "alsaloop") {
				beo.bus.emit("ui", {target: "alsaloop", header: "alsaloopSettings", content: {loopEnabled: loopEnabled}});
			}
		}
	});
	
	beo.bus.on('alsaloop', function(event) {
		
		if (event.header == "loopEnabled") {
			
			if (event.content.enabled != undefined) {
				setLoopStatus(event.content.enabled, function(newStatus, error) {
					beo.bus.emit("ui", {target: "alsaloop", header: "alsaloopSettings", content: {loopEnabled: newStatus}});
					if (sources) sources.setSourceOptions("alsaloop", {enabled: newStatus});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("alsaloop");
					}
					if (error) {
						beo.bus.emit("ui", {target: "alsaloop", header: "errorTogglingAlsaloop", content: {}});
					}
				});
			}
		
		}
	});
	
	
	function getLoopStatus(callback) {
		exec("systemctl is-active --quiet alsaloop.service").on('exit', function(code) {
			if (code == 0) {
				loopEnabled = true;
				callback(true);
			} else {
				loopEnabled = false;
				callback(false);
			}
		});
	}
	
	function setLoopStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now alsaloop.service").on('exit', function(code) {
				if (code == 0) {
					loopEnabled = true;
					if (debug) console.log("ADC enabled.");
					callback(true);
				} else {
					loopEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now alsaloop.service").on('exit', function(code) {
				loopEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("ADC disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
module.exports = {
	version: version,
	isEnabled: getLoopStatus
};

