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
var fs = require('fs');
var path = require('path');

var debug = beo.debug;
var systemVolume = beo.volume;
var Fs = null;

var version = require("./package.json").version;

var	defaultSettings = {
	"loudness": 5,
	"beosonicDistance": 0,
	"beosonicAngle": 0,
	"beosonicAmbience": 0,
	"presetOrder": ["optimal"],
	"selectedPreset": "optimal"
};
var settings = JSON.parse(JSON.stringify(defaultSettings));

var canDoToneControl = {
	"ambience": false,
	"toneControls": 0
};

var disabledTemporarily = false;

var fullPresetList = {};
var compactPresetList = {};

var presetDirectory = beo.dataDirectory+"/beo-listening-modes"; // Beosonic preset directory.
var systemPresetDirectory = beo.systemDirectory+"/beo-listening-modes";
if (!fs.existsSync(presetDirectory)) fs.mkdirSync(presetDirectory);

beo.bus.on('general', function(event) {
	if (event.header == "startup") {
		
		readAllLocalPresets();
	}
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == "beosonic") {
			beo.sendToUI("beosonic", {header: "beosonicSettings", content: {settings: settings, canDoToneControl: canDoToneControl, presets: compactPresetList}});
		}
		if (event.content.extension == "sound" ||
			event.content.extension == "interact") {
			beo.sendToUI("beosonic", {header: "beosonicPresets", content: {presets: compactPresetList, presetOrder: settings.presetOrder, selectedPreset: settings.selectedPreset}});
		}
	}
});

beo.bus.on('beosonic', function(event) {
	if (event.header == "settings") {
		settings = Object.assign(settings, event.content.settings);
		
	}
	
	if (event.header == "toneTouchSettings") {
		if (event.content.toneTouchXY && event.content.toneTouchXY.length == 2) {
			if (event.content.toneTouchXY[0] >= 0 &&
				event.content.toneTouchXY[0] <= 100 &&
				event.content.toneTouchXY[1] >= 0 &&
				event.content.toneTouchXY[1] <= 100) {
				
				settings.toneTouchXY = event.content.toneTouchXY;
				applyToneTouchFromSettings();
				beo.bus.emit("settings", {header: "saveSettings", content: {extension: "beosonic", settings: settings}});
			}
		}
		
	}
	
	if (event.header == "beosonicSettings") {
		if (event.content.beosonicDistance != undefined && event.content.beosonicAngle != undefined) {
			if (event.content.changedFromPreset) {
				settings.selectedPreset = null;
			}
			settings.beosonicAngle = event.content.beosonicAngle;
			settings.beosonicDistance = event.content.beosonicDistance;
			
			beo.saveSettings("beosonic", settings);
			applyBeosonicFromSettings();
		}
	}
	
	if (event.header == "applyPreset" && event.content.presetID) {
		if (compactPresetList[event.content.presetID]) {
			applyBeosonicPreset(event.content.presetID);
		}
	}
	
	if (event.header == "arrangePresets") {
		if (event.content.presetOrder) {
			settings.presetOrder = event.content.presetOrder;
			if (debug) console.log("Beosonic: preset order is now: "+settings.presetOrder.join(", ")+".");
			beo.saveSettings("beosonic", settings);
		}
	}
	
	if (event.header == "renamePreset") {
		if (event.content.presetID && event.content.name) {
			oldID = event.content.presetID;
			filename = generateFilename(event.content.name);
			if (!compactPresetList[filename]) {
				compactPresetList[filename] = compactPresetList[oldID];
				fullPresetList[filename] = fullPresetList[oldID];
				delete compactPresetList[oldID];
				delete fullPresetList[oldID];
				
				compactPresetList[filename].presetName = event.content.name;
				fullPresetList[filename].beosonic.presetName = event.content.name;
				
				fs.unlinkSync(presetDirectory+"/"+oldID+".json");
				fs.writeFileSync(presetDirectory+"/"+filename+".json", JSON.stringify(fullPresetList[filename]));
				
				index = settings.presetOrder.indexOf(oldID);
				settings.presetOrder.splice(index, 1, filename);
				if (settings.selectedPreset = oldID) settings.selectedPreset = filename;
				beo.saveSettings("beosonic", settings);
				beo.sendToUI("beosonic", {header: "beosonicSettings", content: {settings: settings, presets: compactPresetList}});
			} else {
				beo.sendToUI("beosonic", {header: "renamingPreset", content: {exists: filename}});
			}
		}
	}
	
	if (event.header == "deletePreset") {
		if (event.content.presetID) {
			presetID = event.content.presetID;
			if (compactPresetList[presetID]) {
				delete compactPresetList[presetID];
				delete fullPresetList[presetID];
				
				fs.unlinkSync(presetDirectory+"/"+presetID+".json");
				
				index = settings.presetOrder.indexOf(presetID);
				settings.presetOrder.splice(index, 1);
				beo.saveSettings("beosonic", settings);
				beo.sendToUI("beosonic", {header: "beosonicSettings", content: {settings: settings, presets: compactPresetList}});
				if (debug) console.log("Beosonic preset '"+presetID+"' was deleted.");
			}
		}
	}
	
	if (event.header == "newPreset" && event.content.name) {
		if (event.content.withAdjustments) {
			savePresetToFile(event.content.name, event.content.withAdjustments);
		} else {
			filename = generateFilename(event.content.name);
			if (!compactPresetList[filename]) {
				beo.sendToUI("beosonic", {header: "savingPreset", content: {exists: false}});
			} else {
				beo.sendToUI("beosonic", {header: "savingPreset", content: {exists: filename}});
			}
		}
	}
	
	if (event.header == "loudness") {
		if (event.content.loudness != undefined &&
			event.content.loudness >= 0 &&
			event.content.loudness <= 10) {
			settings.loudness = event.content.loudness;
			
			// Apply loudness.
			
			beo.bus.emit("settings", {header: "saveSettings", content: {extension: "beosonic", settings: settings}});
		}
		
	}
	
	if (event.header == "logTesti") {
		
		console.log(fullPresetList.testi.channels);
		
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
						
						applyBeosonicFromSettings(true);
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

// Beosonic parametres.
var maxGainBass = 6;
var maxGainTreble = 8;
var bassFc = 100;
var trebleFc = 10000;
var bassQ = 0.7;
var trebleQ = 0.7;

var toneTouchLogTimeout = null;


function applyBeosonicFromSettings(log) {
	if (canDoToneControl.toneControls >= 2) {
		// Calculate gains.
		gainEffect = settings.beosonicDistance/50;

		[offsetDiag, quadrantDiag] = getOffsetAndQuadrant(settings.beosonicDistance, settings.beosonicAngle, -45); // Bass and treble are positioned diagonally.
		
		gDiag = [ // Gain effect:
			0+1*gainEffect, // Current
			0-1*gainEffect, // Opposite
			(offsetDiag > 0) ? 0+(offsetDiag)*gainEffect : 0+(offsetDiag*1)*gainEffect, // Neighbour CCW
			(offsetDiag > 0) ? 0+(-offsetDiag)*gainEffect : 0+(-offsetDiag)*gainEffect // Neighbour CW
		];
		
		if (quadrantDiag == 0) {
			gainDiag = [gDiag[1], gDiag[0], gDiag[3], gDiag[2]]; // Low bass, high bass, low treble, high treble
		} else if (quadrantDiag == 90) {
			gainDiag = [gDiag[2], gDiag[3], gDiag[1], gDiag[0]];
		} else if (quadrantDiag == 180) {
			gainDiag = [gDiag[0], gDiag[1], gDiag[2], gDiag[3]];
		} else if (quadrant == 270) {
			gainDiag = [gDiag[3], gDiag[2], gDiag[0], gDiag[1]];
		}
		
		trebleGain = gainDiag[3] * maxGainTreble;
		bassGain = gainDiag[1] * maxGainBass;
		
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
				console.log("Beosonic: treble is at "+Math.round(trebleGain*10)/10+" dB, bass is at "+Math.round(bassGain*10)/10+" dB.");
			}, 500);
		}
	}
}

function getOffsetAndQuadrant(distance, angle, withOffset = 0) {
	angle += withOffset;
	if (angle > 360) angle -= 360;
	if (angle < 0) angle += 360;
	quadrant = 0; // 0, 90, 180, 270
	if (angle < 45 || angle >= 315) { // Warm.
		offset = ((angle > 180) ? angle-360 : angle)/45;
		quadrant = 0;
	} else if (angle < 135 && angle >= 45) { // Energetic.
		offset = (angle-90)/45;
		quadrant = 90;
	} else if (angle < 225 && angle >= 135) { // Bright.
		offset = (angle-180)/45;
		quadrant = 180;
	} else if (angle < 315 && angle >= 225) { // Relaxed.
		offset = (angle-270)/45;
		quadrant = 270;
	}
	return [offset, quadrant];
}
	
Math.radians = function(degrees) {
	return degrees * Math.PI / 180;
};

function tempDisable(disable) {
	if (disable && !disabledTemporarily) {
		disabledTemporarily = true;
		if (debug) console.log("Disabling Beosonic temporarily.");
		applyBeosonicFromSettings(false);
	} else if (!disable && disabledTemporarily) {
		disabledTemporarily = false;
		if (debug) console.log("Re-enabling Beosonic.");
		applyBeosonicFromSettings(true);
	}
}


function applyBeosonicPreset(presetID) {
	for (adjustment in fullPresetList[presetID]) {
		if (adjustment == "beosonic") {
			if (fullPresetList[presetID].beosonic.beosonicAngle != undefined) settings.beosonicAngle = fullPresetList[presetID].beosonic.beosonicAngle;
			if (fullPresetList[presetID].beosonic.beosonicDistance != undefined) settings.beosonicDistance = fullPresetList[presetID].beosonic.beosonicDistance;
			if (fullPresetList[presetID].beosonic.beosonicAmbience != undefined) settings.beosonicAmbience = fullPresetList[presetID].beosonic.beosonicAmbience;
			applyBeosonicFromSettings(true);
		} else {
			if (beo.extensions[adjustment] &&
				beo.extensions[adjustment].applyBeosonicPreset) {
				beo.extensions[adjustment].applyBeosonicPreset(fullPresetList[presetID][adjustment]);
			} else {
				console.error("Extension '"+adjustment+"' couldn't accept settings from Beosonic.");
			}
		}
	}
	
	if (debug) console.log("Beosonic preset '"+compactPresetList[presetID].presetName+"' was applied.");
	settings.selectedPreset = presetID;
	beo.sendToUI("beosonic", {header: "beosonicSettings", content: {settings: settings}});
	beo.saveSettings("beosonic", settings);
}


function readAllLocalPresets() {
	// Read presets from system directory and then from user directory
	presetFiles = fs.readdirSync(systemPresetDirectory);
	for (var i = 0; i < presetFiles.length; i++) {
		readPresetFromFile(systemPresetDirectory+"/"+presetFiles[i], true);
	}
	
	presetFiles = fs.readdirSync(presetDirectory);
	for (var i = 0; i < presetFiles.length; i++) {
		readPresetFromFile(presetDirectory+"/"+presetFiles[i], false);
	}
	
	presetRemoved = false;
	for (o in settings.presetOrder) {
		if (!compactPresetList[settings.presetOrder[o]]) {
			delete settings.presetOrder[o];
			presetRemoved = true;
		}
	}
	if (presetRemoved) {
		settings.presetOrder = settings.presetOrder.filter(function (el) {
			return el != null;
		});
		beo.saveSettings("beosonic", settings);
	}
}

function readPresetFromFile(presetPath, systemPreset) {
	presetFileName = path.basename(presetPath, path.extname(presetPath));
		
		try {
			preset = JSON.parse(fs.readFileSync(presetPath, "utf8"));
			
			presetName = null;
			if (preset['beosonic'] != undefined) { 
				if (preset['beosonic'].presetName) {
					// Preset information record contains a preset name.
					presetName = preset['beosonic'].presetName;
				}
			}
			
			readOnly = (systemPreset) ? true : false;
			
			if (presetName != null) {
				// If the preset has a name, it qualifies.
				adjustments = [];
				for (adjustment in preset) {
					adjustments.push(adjustment);
				}
				compactPresetList[presetFileName] = {presetName: presetName, readOnly: readOnly, adjustments: adjustments};
				fullPresetList[presetFileName] = preset;
				if (settings.presetOrder.indexOf(presetFileName) == -1) {
					settings.presetOrder.push(presetFileName);
					beo.saveSettings("beosonic", settings);
				}
				return presetFileName;
			} else {
				if (debug) console.log("Beosonic: preset '"+presetFileName+"' did not include a preset name. Skipping.");
				return null;
			}
			
		} catch (error) {
			if (debug) console.error("Beosonic: error loading preset '"+presetFileName+"' from '"+presetPath+"':", error);
			return null;
		}
}

function savePresetToFile(withName, withAdjustments) {
	newID = generateFilename(withName);
	fullPresetList[newID] = {"beosonic": {presetName: withName, beosonicAngle: settings.beosonicAngle, beosonicDistance: settings.beosonicDistance, beosonicAmbience: settings.beosonicAmbience}};
	compactPresetList[newID] = {presetName: withName, readOnly: false, adjustments: ["beosonic"]};
	
	// Collect settings for the preset from other extensions:
	for (a in withAdjustments) {
		if (withAdjustments[a] != "beosonic") {
			if (beo.extensions[withAdjustments[a]] &&
				beo.extensions[withAdjustments[a]].getSettingsForBeosonic) {
				adjustmentSettings = beo.extensions[withAdjustments[a]].getSettingsForBeosonic();
				fullPresetList[newID][withAdjustments[a]] = JSON.parse(JSON.stringify(adjustmentSettings));
			}
		}
	}
	
	fs.writeFileSync(presetDirectory+"/"+newID+".json", JSON.stringify(fullPresetList[newID]));
	
	settings.selectedPreset = newID;
	if (settings.presetOrder.indexOf(newID) == -1) settings.presetOrder.push(newID);
	beo.sendToUI("beosonic", {header: "beosonicSettings", content: {settings: settings, presets: compactPresetList, presetSaved: newID}});
	beo.saveSettings("beosonic", settings);
	if (debug) console.log("Beosonic preset '"+withName+"' was saved.")
}

function generateFilename(name) {
	n = name.toLowerCase().replace(/ /g, "-"); // Replace spaces with hyphens
	n = n.replace(/\./g, "-"); // Replace periods with hyphens
	n = n.replace(/-+$/g, ""); // Remove hyphens from the end of the name.
	return n;
}

interact = {
	actions: {
		selectPreset: function(interactData, triggerResult) {
			if (!interactData.preset) {
				index = parseInt(triggerResult);
				if (!isNaN(index)) {
					if (settings.presetOrder[index]) {
						applyBeosonicPreset(settings.presetOrder[index]);
						return compactPresetList[settings.presetOrder[index]].presetName;
					} else {
						return undefined;
					}
				} else if (compactPresetList[triggerResult]) {
					applyBeosonicPreset(triggerResult);
					return compactPresetList[triggerResult].presetName;
				} else {
					presetFound = false;
					for (preset in compactPresetList) {
						if (compactPresetList[preset].presetName == triggerResult) {
							presetFound = preset;
							break;
						}
					}
					if (presetFound) {
						applyBeosonicPreset(presetFound);
						return compactPresetList[presetFound].presetName;
					} else {
						return undefined;
					}
				}
			} else {
				if (compactPresetList[triggerResult]) {
					applyBeosonicPreset(triggerResult);
					return compactPresetList[triggerResult].presetName;
				} else {
					return undefined;
				}
			}
		}
	}
}
	
	
module.exports = {
	version: version,
	tempDisable: tempDisable,
	interact: interact
};
