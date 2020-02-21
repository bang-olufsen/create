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

// VOLUME LIMIT

var beoDSP = require('../../beocreate_essentials/dsp');

	var version = require("./package.json").version;
	
	var debug = beo.debug;
	var metadata = {};
	
	var defaultSettings = {
		"volumeLimitPi": 100,
		"volumeLimitSPDIF": 100,
		"volumeLimitI2S2": 100
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var canControlVolumeLimit = {
		"volumeLimitPi": false,
		"volumeLimitSPDIF": false,
		"volumeLimitI2S2": false
	};
	
	beo.bus.on('general', function(event) {
		//console.log("Volume Limit received general event: "+event);
		
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "volume-limit") {
				
				beo.bus.emit("ui", {target: "volume-limit", header: "canControlVolumeLimit", content: {canControlVolumeLimit: canControlVolumeLimit, range: 60}});
				
				registersToRead = 0;
				registersRead = 0;
				
				if (canControlVolumeLimit.volumeLimitPi) registersToRead++;
				if (canControlVolumeLimit.volumeLimitSPDIF) registersToRead++;
				if (canControlVolumeLimit.volumeLimitI2S2) registersToRead++;
				
				if (debug) console.log("Reading volume limit for "+registersToRead+" source(s)...");
				
				if (canControlVolumeLimit.volumeLimitSPDIF) {
					beoDSP.readDSP(metadata.volumeLimitSPDIFRegister.value[0], function(response) {
						limit = Math.round(beoDSP.convertVolume("amplification", "%", response.dec));
						if (debug) console.log("Toslink volume limit is at "+limit+" %.");
						if (limit != settings.volumeLimitSPDIF) settings.volumeLimitSPDIF = limit;
						registersRead++;
						if (registersRead == registersToRead) {
							beo.bus.emit("ui", {target: "volume-limit", header: "volumeLimitSettings", content: {settings: settings}});
						}
					});
				}
				
				
				if (canControlVolumeLimit.volumeLimitPi) {
					beoDSP.readDSP(metadata.volumeLimitPiRegister.value[0], function(response) {
						limit = Math.round(beoDSP.convertVolume("amplification", "%", response.dec));
						if (debug) console.log("Raspberry Pi volume limit is at "+limit+" %.");
						if (limit != settings.volumeLimitPi) settings.volumeLimitPi = limit;
						registersRead++;
						if (registersRead == registersToRead) {
							beo.bus.emit("ui", {target: "volume-limit", header: "volumeLimitSettings", content: {settings: settings}});
						}
					});
				}
				
				
				if (canControlVolumeLimit.volumeLimitI2S2) {
					beoDSP.readDSP(metadata.volumeLimitI2S2Register.value[0], function(response) {
						limit = Math.round(beoDSP.convertVolume("amplification", "%", response.dec));
						if (debug) console.log("Expansion connector volume limit is at "+limit+" %.");
						if (limit != settings.volumeLimitI2S2) settings.volumeLimitI2S2 = limit;
						registersRead++;
						if (registersRead == registersToRead) {
							beo.bus.emit("ui", {target: "volume-limit", header: "volumeLimitSettings", content: {settings: settings}});
						}
					});
				}
				
			}
		}
		
	});
	
	beo.bus.on('volume-limit', function(event) {
		
		if (event.header == "settings") {
			
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
			
		}
		
		if (event.header == "setVolumeLimit") {
			
			if (event.content.limit != undefined && event.content.adjustment) {
				if (event.content.limit >= 0 && event.content.limit <= 100) {
					theLimit = event.content.limit;
				} else {
					theLimit = 100;
				}
				if (settings[event.content.adjustment] != undefined) {
					settings[event.content.adjustment] = theLimit;
					applyVolumeLimitFromSettings(event.content.adjustment);
					beo.bus.emit("settings", {header: "saveSettings", content: {extension: "volume-limit", settings: settings}});
				}
			}
			
		}
		
		
	});
	
	
	beo.bus.on('dsp', function(event) {
		
		
		if (event.header == "metadata") {
			
			if (event.content.metadata) {
				metadata = event.content.metadata;
				
				canControlVolumeLimit.volumeLimitPi = (metadata.volumeLimitPiRegister && metadata.volumeLimitPiRegister.value[0] != undefined) ? true : false;
				canControlVolumeLimit.volumeLimitSPDIF = (metadata.volumeLimitSPDIFRegister && metadata.volumeLimitSPDIFRegister.value[0] != undefined) ? true : false;
				canControlVolumeLimit.volumeLimitI2S2 = (metadata.volumeLimitI2S2Register && metadata.volumeLimitI2S2Register.value[0] != undefined) ? true : false;
				
				if (debug && canControlVolumeLimit.volumeLimitPi) console.log("Setting Raspberry Pi volume limit to "+settings.volumeLimitPi+" %...");
				applyVolumeLimitFromSettings("volumeLimitPi");
				
				if (debug && canControlVolumeLimit.volumeLimitSPDIF) console.log("Setting Toslink volume limit to "+settings.volumeLimitSPDIF+" %...");
				applyVolumeLimitFromSettings("volumeLimitSPDIF");
				
				if (debug && canControlVolumeLimit.volumeLimitI2S2) console.log("Setting expansion connector volume limit to "+settings.volumeLimitI2S2+" %...");
				applyVolumeLimitFromSettings("volumeLimitI2S2");
			} else {
				metadata = {};
				canControlVolumeLimit.volumeLimitPi = false;
				canControlVolumeLimit.volumeLimitSPDIF = false;
				canControlVolumeLimit.volumeLimitI2S2 = false;
			}
			
		}
	});
	
	
	function applyVolumeLimitFromSettings(limit) {
		
		if (canControlVolumeLimit[limit]) {
			limitRegister = metadata[limit+"Register"].value[0];
			amplification = beoDSP.convertVolume("%", "amplification", settings[limit]);
			beoDSP.writeDSP(limitRegister, amplification, true, true);
		}
	}
	
module.exports = {
	version: version
};

