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

// BEOCREATE TOSLINK

module.exports = function(beoBus, globals) {
	var module = {};
	var beoBus = beoBus;
	var beoDSP = globals.dsp;
	var debug = false;
	
	var metadata = {};
	var defaultSettings = {
			"toslinkEnabled": true, 
			"toslinkStopsOtherSources": true
		};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	var canControlToslink = true;
	
	var canReadToslinkStatus = false;
	var toslinkStatus = false;
	
	beoBus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (event.content.debug) debug = event.content.debug;
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "toslink") {
				beoBus.emit("ui", {target: "toslink", header: "toslinkSettings", content: {settings: settings, canControlToslink: canControlToslink, canReadToslinkStatus: canReadToslinkStatus, toslinkStatus: toslinkStatus}});
			}
		}
		
		if (event.header == "shutdown") {
			
			clearInterval(toslinkStatusReadInterval);
			
		}
	});
	
	beoBus.on('dsp', function(event) {
		
		
		if (event.header == "metadata") {
			
			if (event.content.metadata) {
				metadata = event.content.metadata;
				
				if (metadata.enableSPDIFRegister && metadata.enableSPDIFRegister.value) {
					canControlToslink = true;
				} else {
					canControlToslink = false;
				}
				
				if (metadata.readSPDIFOnRegister && metadata.readSPDIFOnRegister.value) {
					canReadToslinkStatus = true;
					readToslinkStatus(true);
				} else {
					canReadToslinkStatus = false;
					readToslinkStatus(false);
				}
				
				applyToslinkEnabledFromSettings();
				
			} else {
				metadata = {};
				readToslinkStatus(false);
				canControlToslink = false;
				canReadToslinkStatus = false;
			}
		}
	});
	
	beoBus.on('toslink', function(event) {
		
		if (event.header == "settings") {
			if (event.content.settings) {
				settings = event.content.settings;
			}
		}
		
		if (event.header == "toslinkEnabled") {
			if (event.content.enabled != undefined) {
				settings.toslinkEnabled = event.content.enabled;
				applyToslinkEnabledFromSettings();
				beoBus.emit("ui", {target: "toslink", header: "toslinkSettings", content: {settings: settings, canControlToslink: canControlToslink}});
				beoBus.emit("settings", {header: "saveSettings", content: {extension: "toslink", settings: settings}});
			}
		}
		
		if (event.header == "toslinkStopsOtherSources") {
			if (event.content.stopsOtherSources != undefined) {
				settings.toslinkStopsOtherSources = event.content.stopsOtherSources;
				beoBus.emit("ui", {target: "toslink", header: "toslinkSettings", content: {settings: settings, canControlToslink: canControlToslink}});
				beoBus.emit("settings", {header: "saveSettings", content: {element: "toslink", settings: settings}});
			}
		}
	});
	
	
	function applyToslinkEnabledFromSettings() {
		if (canControlToslink) {
			if (settings.toslinkEnabled) {
				beoDSP.writeDSP(metadata.enableSPDIFRegister.value[0], 1, false);
				if (toslinkStatus == true) {
					beoBus.emit("sources", {header: "sourceActivated", content: {extension: "toslink", stopOthers: settings.toslinkStopsOtherSources, transportControls: false}});
				}
			} else {
				beoDSP.writeDSP(metadata.enableSPDIFRegister.value[0], 0, false);
				if (toslinkStatus == true) {
					beoBus.emit("sources", {header: "sourceDeactivated", content: {extension: "toslink"}});
				}
			}
		}
	}
	
	var toslinkStatusReadInterval = null;
	function readToslinkStatus(start) {
		clearInterval(toslinkStatusReadInterval);
		if (start == true) {
			if (debug) console.log("Polling Toslink status every 2 seconds...");
			toslinkStatusReadInterval = setInterval(function() {
				if (canReadToslinkStatus) {
					beoDSP.readDSP(metadata.readSPDIFOnRegister.value[0], function(response) {
						if (response.dec != null) {
							if (response.dec == 1) {
								if (toslinkStatus == false) {
									toslinkStatus = true;
									beoBus.emit("ui", {target: "toslink", header: "toslinkStatus", content: {status: toslinkStatus}});
									if (settings.toslinkEnabled) beoBus.emit("sources", {header: "sourceActivated", content: {extension: "toslink", stopOthers: settings.toslinkStopsOtherSources, transportControls: false}});
									//if (debug) console.log("Toslink activated.");
								}
							} else if (response.dec == 0) {
								if (toslinkStatus == true) {
									toslinkStatus = false;
									beoBus.emit("ui", {target: "toslink", header: "toslinkStatus", content: {status: toslinkStatus}});
									beoBus.emit("sources", {header: "sourceDeactivated", content: {extension: "toslink"}});
									//if (debug) console.log("Toslink deactivated.");
								}
							}
						}
					});
				}
			}, 2000);
		}
	}
	
	return module;
};

