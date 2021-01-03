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

var beoDSP = require('../../beocreate_essentials/dsp');

	var debug = beo.debug;
	
	var metadata = {};
	var defaultSettings = {
			"toslinkEnabled": false, 
			"sensitivity": "high",
			"toslinkStopsOtherSources": true
		};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	var canControlToslink = {
			"enabled": false,
			"sensitivity": false
		};
	var canControlToslinkSensitivity = false;
	
	var canReadToslinkStatus = false;
	var toslinkSignal = false;
	var toslinkActive = false;
	
	var sources = null;
	var soundSyncLG = false;
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			if (beo.extensions.sources &&
				beo.extensions.sources.setSourceOptions &&
				beo.extensions.sources.sourceActivated &&
				beo.extensions.sources.sourceDeactivated) {
				sources = beo.extensions.sources;
			}	
			if (sources) {
				sources.setSourceOptions("toslink", {
					enabled: settings.toslinkEnabled,
					playerState: "stopped",
					stopOthers: settings.toslinkStopsOtherSources,
					usesHifiberryControl: false,
					sortName: "Optical Input"
				});
			}
			
			if (beo.extensions["dsp-programs"] && beo.extensions["dsp-programs"].getSigmaTCPSettings) {
				configuration = beo.extensions["dsp-programs"].getSigmaTCPSettings();
				if (configuration.server && 
					configuration.server.lgsoundsync && 
					configuration.server.lgsoundsync == 1 &&
					!configuration.server.lgsoundsync.comment) {
					soundSyncLG = true
				} else {
					soundSyncLG = false;
				}
			}
		}
		
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "toslink") {
				beo.bus.emit("ui", {target: "toslink", header: "toslinkSettings", content: {settings: settings, canControlToslink: canControlToslink, canReadToslinkStatus: canReadToslinkStatus, toslinkStatus: toslinkSignal, soundSyncLG: soundSyncLG}});
			}
		}
		
		if (event.header == "shutdown") {
			
			clearInterval(toslinkStatusReadInterval);
			
		}
	});
	
	beo.bus.on('dsp', function(event) {
		
		
		if (event.header == "metadata") {
			
			if (event.content.metadata) {
				metadata = event.content.metadata;
				
				if (metadata.enableSPDIFRegister && metadata.enableSPDIFRegister.value) {
					canControlToslink.enabled = true;
				} else {
					canControlToslink.enabled = false;
				}
				
				if (metadata.sensitivitySPDIFRegister && metadata.sensitivitySPDIFRegister.value) {
					canControlToslink.sensitivity = true;
				} else {
					canControlToslink.sensitivity = false;
				}
				
				if (metadata.readSPDIFOnRegister && metadata.readSPDIFOnRegister.value) {
					canReadToslinkStatus = true;
					readToslinkStatus(true);
				} else {
					canReadToslinkStatus = false;
					readToslinkStatus(false);
				}
				
				applyToslinkEnabledFromSettings();
				applyToslinkSensitivityFromSettings();
				
			} else {
				metadata = {};
				readToslinkStatus(false);
				canControlToslink.enabled = false;
				canControlToslink.sensitivity = false;
				canReadToslinkStatus = false;
			}
		}
	});
	
	beo.bus.on('toslink', function(event) {
		
		if (event.header == "settings") {
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
		}
		
		if (event.header == "toslinkEnabled") {
			if (event.content.enabled != undefined) {
				settings.toslinkEnabled = event.content.enabled;
				beo.bus.emit("ui", {target: "toslink", header: "toslinkSettings", content: {settings: settings, canControlToslink: canControlToslink}});
				beo.bus.emit("settings", {header: "saveSettings", content: {extension: "toslink", settings: settings}});
				applyToslinkEnabledFromSettings();
			}
		}
		
		if (event.header == "soundSyncEnabled") {
			if (event.content.enabled != undefined) {
				if (beo.extensions["dsp-programs"] && beo.extensions["dsp-programs"].configureSigmaTCP) {
					soundSyncLG = (event.content.enabled) ? true : false;
					soundSyncOn = (event.content.enabled) ? "1" : "0";
					beo.extensions["dsp-programs"].configureSigmaTCP([
						{section: "server", option: "lgsoundsync", value: soundSyncOn}
					], true);
					beo.sendToUI("toslink", {header: "toslinkSettings", content: {soundSyncLG: soundSyncLG}});
				}
			}
		}
		
		if (event.header == "setSensitivity") {
			if (event.content.sensitivity) {
				switch (event.content.sensitivity) {
					case "high":
					case "medium":
					case "low":
						settings.sensitivity = event.content.sensitivity;
						applyToslinkSensitivityFromSettings();
						beo.bus.emit("ui", {target: "toslink", header: "toslinkSettings", content: {settings: settings, canControlToslink: canControlToslink}});
						beo.bus.emit("settings", {header: "saveSettings", content: {extension: "toslink", settings: settings}});
						break;
				}
			}
		}
		
		if (event.header == "toslinkStopsOtherSources") {
			if (event.content.stopsOtherSources != undefined) {
				settings.toslinkStopsOtherSources = event.content.stopsOtherSources;
				beo.bus.emit("ui", {target: "toslink", header: "toslinkSettings", content: {settings: settings, canControlToslink: canControlToslink}});
				beo.bus.emit("settings", {header: "saveSettings", content: {element: "toslink", settings: settings}});
				if (sources) {
					sources.setSourceOptions("toslink", {
						stopOthers: settings.toslinkStopsOtherSources
					});
				}
			}
		}
	});
	
	
	function applyToslinkEnabledFromSettings() {
		if (canControlToslink.enabled) {
			if (settings.toslinkEnabled) {
				if (sources) sources.setSourceOptions("toslink", {enabled: true});
				beoDSP.writeDSP(metadata.enableSPDIFRegister.value[0], 1, false);
				if (toslinkSignal == true) {
					toslinkActive = true;
					if (sources) sources.sourceActivated("toslink", "playing");
				}
			} else {
				beoDSP.writeDSP(metadata.enableSPDIFRegister.value[0], 0, false);
				if (toslinkSignal == true) {
					toslinkActive = false;
					if (sources) sources.sourceDeactivated("toslink", "stopped");
				}
				if (sources) sources.setSourceOptions("toslink", {enabled: false});
			}
		}
	}
	
	function applyToslinkSensitivityFromSettings() {
		if (canControlToslink.sensitivity) {
			levelValue = null;
			switch (settings.sensitivity) {
				case "high":
					levelValue = beoDSP.convertVolume("dB", "amplification", -60);
					break;
				case "medium":
					levelValue = beoDSP.convertVolume("dB", "amplification", -40);
					break;
				case "low":
					levelValue = beoDSP.convertVolume("dB", "amplification", -20);
					break;
			}
			if (levelValue) {
				if (debug) console.log("Setting Toslink sensitivity to "+settings.sensitivity+".");
				beoDSP.writeDSP(metadata["sensitivitySPDIFRegister"].value[0], levelValue, true, true);
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
								if (toslinkSignal == false) {
									toslinkSignal = true;
									beo.bus.emit("ui", {target: "toslink", header: "toslinkStatus", content: {status: toslinkSignal}});
									if (settings.toslinkEnabled) {
										toslinkActive = true;
										if (sources) sources.sourceActivated("toslink", "playing");
									}
									//if (debug) console.log("Toslink activated.");
								}
							} else if (response.dec == 0) {
								if (toslinkSignal == true) {
									toslinkSignal = false;
									beo.bus.emit("ui", {target: "toslink", header: "toslinkStatus", content: {status: toslinkSignal}});
									if (toslinkActive) {
										toslinkActive = false;
										if (sources) sources.sourceDeactivated("toslink", "stopped");
									}
									//if (debug) console.log("Toslink deactivated.");
								}
							}
						}
					});
				}
			}, 2000);
		}
	}
	
		
module.exports = {
	isEnabled: function(callback) {callback(settings.toslinkEnabled)}
}
