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

// BEOCREATE TONE CONTROLS

var beoDSP = require('../../beocreate_essentials/dsp');

	var debug = beo.debug;
	var systemVolume = beo.volume;
	var Fs = null;
	
	var version = require("./package.json").version;
	
	var	defaultSettings = {
		"loudness": 5,
		"toneTouchXY": [50,50],
		"toneTouchAmbience": 0
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var canDoToneControl = {
		"ambience": false,
		"toneControls": 0
	};
	
	var disabledTemporarily = false;
	
	beo.bus.on('general', function(event) {
		if (event.header == "startup") {
			
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "tone-controls") {
				beo.bus.emit("ui", {target: "tone-controls", header: "toneControlSettings", content: {settings: settings}});
				beo.bus.emit("ui", {target: "tone-controls", header: "canDoToneControl", content: {canDoToneControl: canDoToneControl}});
			}
		}
	});
	
	beo.bus.on('tone-controls', function(event) {
		if (event.header == "settings") {
			settings = event.content.settings;
			
		}
		
		if (event.header == "toneTouchSettings") {
			if (event.content.toneTouchXY && event.content.toneTouchXY.length == 2) {
				if (event.content.toneTouchXY[0] >= 0 &&
					event.content.toneTouchXY[0] <= 100 &&
					event.content.toneTouchXY[1] >= 0 &&
					event.content.toneTouchXY[1] <= 100) {
					
					settings.toneTouchXY = event.content.toneTouchXY;
					applyToneTouchFromSettings();
					beo.bus.emit("settings", {header: "saveSettings", content: {extension: "tone-controls", settings: settings}});
				}
			}
			
		}
		
		if (event.header == "loudness") {
			if (event.content.loudness != undefined &&
				event.content.loudness >= 0 &&
				event.content.loudness <= 10) {
				settings.loudness = event.content.loudness;
				
				// Apply loudness.
				
				beo.bus.emit("settings", {header: "saveSettings", content: {extension: "tone-controls", settings: settings}});
			}
			
		}
	});
	
	beo.bus.on('dsp', function(event) {
		
		
		if (event.header == "metadata") {
			
			if (event.content.metadata) {
				metadata = event.content.metadata;
				
				if (metadata.sampleRate) {
					Fs = parseInt(metadata.sampleRate.value[0]);
					if (metadata["toneControlLeftRegisters"] &&
					 	metadata["toneControlRightRegisters"] &&
					 	metadata["toneControlLeftRegisters"].value[0] != undefined &&
					 	metadata["toneControlRightRegisters"].value[0] != undefined) { 	
						if (metadata["toneControlLeftRegisters"].value[0].split("/")[1] == metadata["toneControlRightRegisters"].value[0].split("/")[1]) {
							canDoToneControl.toneControls = parseInt(metadata["toneControlLeftRegisters"].value[0].split("/")[1])/5; // Save how many filters are in this bank.
							
							applyToneTouchFromSettings(true);
						}
					} else {
						canDoToneControl.toneControls = 0;
					}
				} else {
					Fs = null;
					canDoToneControl.toneControls = 0;
				}
				
			} else {
				metadata = {};
				canDoToneControl.toneControls = 0;
				canDoToneControl.ambience = 0;
			}
			
		}
	});
	
	// ToneTouch parametres.
	var maxGainBass = 6;
	var maxGainTreble = 8;
	var bassFc = 100;
	var trebleFc = 10000;
	var bassQ = 0.7;
	var trebleQ = 0.7;
	
	var toneTouchLogTimeout = null;
	
	function applyToneTouchFromSettings(log) {
		if (canDoToneControl.toneControls >= 2) {
			
			// Calculate gains.
			trebleGain = (settings.toneTouchXY[0] - 50) / 50 * maxGainTreble;
			bassGain = (settings.toneTouchXY[1] - 50) / 50 * maxGainBass;
			
			if (!disabledTemporarily) {
				// Calculate shelving filters.
				trebleCoeffs = beoDSP.highShelf(Fs, trebleFc, trebleGain, trebleQ, 0);
				bassCoeffs = beoDSP.lowShelf(Fs, bassFc, bassGain, bassQ, 0);
			} else {
				trebleCoeffs = [1,0,0,1,0,0];
				bassCoeffs = [1,0,0,1,0,0];
			}
			
			// Apply treble to both channels.
			beoDSP.safeloadWrite(parseInt(metadata["toneControlLeftRegisters"].value[0].split("/")[0]), [trebleCoeffs[5], trebleCoeffs[4], trebleCoeffs[3], trebleCoeffs[2]*-1, trebleCoeffs[1]*-1], true);
			beoDSP.safeloadWrite(parseInt(metadata["toneControlRightRegisters"].value[0].split("/")[0]), [trebleCoeffs[5], trebleCoeffs[4], trebleCoeffs[3], trebleCoeffs[2]*-1, trebleCoeffs[1]*-1], true);
			
			// Apply bass to both channels.
			beoDSP.safeloadWrite(parseInt(metadata["toneControlLeftRegisters"].value[0].split("/")[0])+5, [bassCoeffs[5], bassCoeffs[4], bassCoeffs[3], bassCoeffs[2]*-1, bassCoeffs[1]*-1], true);
			beoDSP.safeloadWrite(parseInt(metadata["toneControlRightRegisters"].value[0].split("/")[0])+5, [bassCoeffs[5], bassCoeffs[4], bassCoeffs[3], bassCoeffs[2]*-1, bassCoeffs[1]*-1], true);
			
			if (debug == 2 || log) {
				clearTimeout(toneTouchLogTimeout);
				toneTouchLogTimeout = setTimeout(function() {
					console.log("ToneTouch: treble is at "+Math.round(trebleGain*10)/10+" dB, bass is at "+Math.round(bassGain*10)/10+" dB.");
				}, 500);
			}
		}
	}
	
	
	function tempDisable(disable) {
		if (disable && !disabledTemporarily) {
			disabledTemporarily = true;
			if (debug) console.log("Disabling tone controls temporarily.");
			applyToneTouchFromSettings(false);
		} else if (!disable && disabledTemporarily) {
			disabledTemporarily = false;
			if (debug) console.log("Re-enabling tone controls.");
			applyToneTouchFromSettings(true);
		}
	}
	
	
module.exports = {
	version: version,
	tempDisable: tempDisable
};
