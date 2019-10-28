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

// SOUND PRESETS

var fs = require('fs');
var path = require('path');
var beoDSP = require('../../beocreate_essentials/dsp');

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var extensions = globals.extensions;
	var presetDirectory = dataDirectory+"/beo-sound-presets"; // Sound presets directory.
	
	var version = require("./package.json").version;
	
	var debug = false;
	var metadata = {};
	
	var fullPresetList = {};
	var compactPresetList = {};
	
	var defaultSettings = {
		"selectedSoundPreset": null
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var productIdentitiesFetched = false;
	
	
	beoBus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (event.content.debug) debug = true;
			
			readLocalPresets();
			
			if (!settings.selectedSoundPreset) {
				// If no sound preset has been selected, join the setup flow.
				if (extensions["setup"] && extensions["setup"].joinSetupFlow) {
					extensions["setup"].joinSetupFlow("sound-preset", {after: ["choose-country", "network"], before: ["product-information"]});
				}
			}
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "sound-preset") {
				
				checkIdentities();
				
				beoBus.emit("ui", {target: "sound-preset", header: "presets", content: {compactPresetList: compactPresetList, currentSoundPreset: settings.selectedSoundPreset}});
				
				
			}
		}
		
	});
	
	beoBus.on('sound-preset', function(event) {
		
		if (event.header == "settings") {
			
			if (event.content.settings) {
				settings = event.content.settings;
			}
			
		}
		
		if (event.header == "reloadPresets") {
			readLocalPresets();
			beoBus.emit("ui", {target: "sound-preset", header: "presets", content: {compactPresetList: compactPresetList, currentSoundPreset: settings.selectedSoundPreset}});
		}
		
		if (event.header == "selectSoundPreset") {
			
			selectSoundPreset(event.content.presetID);
			
		}
		
		if (event.header == "deleteSoundPreset") {
			
			deleteSoundPreset(event.content.presetID);
			
		}
		
		if (event.header == "replaceExistingPreset") {
			if (uploadedPresetPath && uploadedPreset) {
				if (event.content.replace) {
					movePresetToPlaceAndPreview(uploadedPresetPath);
				} else {
					// Clean up.
					fs.unlinkSync(uploadedPresetPath);
					uploadedPresetPath = null;
					uploadedPreset = null;
				}
			}
		}
		
		if (event.header == "applySoundPreset") {
			
			if (event.content.presetID && fullPresetList[presetID] != undefined) {
				samplingRate = (fullPresetList["sound-preset"].samplingRate) ? fullPresetList["sound-preset"].samplingRate : null;
				for (soundAdjustment in fullPresetList[presetID]) {
					if (!event.content.excludedSettings || event.content.excludedSettings.indexOf(soundAdjustment) == -1) {
						switch (soundAdjustment) {
							case "sound-preset":
							case "presetName":
								// Do nothing.
								break;
							default:
								if (extensions[soundAdjustment]) {
									if (extensions[soundAdjustment].applySoundPreset != undefined) {
										if (debug) console.log("Applying sound preset for extension '"+soundAdjustment+"'...");
										extensions[soundAdjustment].applySoundPreset(fullPresetList[presetID][soundAdjustment], samplingRate);
									} else {
										if (debug) console.log("Extension '"+soundAdjustment+"' does not support applying a sound preset.");
									}
								} else {
									if (debug) console.log("Extension '"+soundAdjustment+"' does not exist on this system.");
								}	
								break;
						}
					}
				}
				if (!event.content.excludedSettings || event.content.excludedSettings.indexOf("product-information") == -1) {
					if (extensions["product-information"] && extensions["product-information"].setProductIdentity) {
						extensions["product-information"] && extensions["product-information"].setProductIdentity(compactPresetList[presetID].productIdentity);
					}
				}
				if (!settings.selectedSoundPreset) {
					if (extensions["setup"] && extensions["setup"].allowAdvancing) {
						extensions["setup"].allowAdvancing("sound-preset", true);
					}
				}
				settings.selectedSoundPreset = event.content.presetID;
				
				beoBus.emit("settings", {header: "saveSettings", content: {extension: "sound-preset", settings: settings}});
				if (event.content.installFallback && fullPresetList[presetID]["sound-preset"].fallbackDSP) {
					if (extensions["dsp-programs"] && extensions["dsp-programs"].installDSPProgram) {
						extensions["dsp-programs"].installDSPProgram(fullPresetList[presetID]["sound-preset"].fallbackDSP, function(result) {
							if (result == true) {
								beoBus.emit("ui", {target: "sound-preset", header: "presetApplied", content: {presetID: event.content.presetID}});
							}
						});
					}
				} else {
					beoBus.emit("ui", {target: "sound-preset", header: "presetApplied", content: {presetID: event.content.presetID}});
				}
			}
			
		}
		
		
	});
	
	
	beoBus.on('dsp', function(event) {
		
		
		if (event.header == "metadata") {
			
			if (event.content.metadata) {
				metadata = event.content.metadata;
				
			} else {
				metadata = {};
			}
	
		}
	});
	
	function selectSoundPreset(presetID) {
	
		if (presetID) {
			
			if (fullPresetList[presetID] != undefined) {
				if (fullPresetList[presetID]) {
					
					preset = {};
					
					// "Preflights" the selected sound preset by sending the settings to the sound adjustment extensions. The extensions will check them against the DSP metadata and their own capabilities and return a compatibility report.
					checkedPresetContent = {};
					identity = null;
					if (compactPresetList[presetID].productIdentity) {
						identity = extensions["product-information"].getProductIdentity(compactPresetList[presetID].productIdentity);
						identityStatus = (identity) ? 0 : 1;
						checkedPresetContent["product-information"] = {status: identityStatus, report: identity};
					}
					samplingRate = (fullPresetList["sound-preset"].samplingRate) ? fullPresetList["sound-preset"].samplingRate : null;
					for (soundAdjustment in fullPresetList[presetID]) {
						switch (soundAdjustment) {
							case "sound-preset":
							
								if (fullPresetList[presetID]["sound-preset"].description) {
									preset.description = fullPresetList[presetID]["sound-preset"].description;
								}
								break;
							case "presetName":
							case "product-information":
								
								break;
							default:
								checkedPresetContent[soundAdjustment] = {status: 1};
								if (extensions[soundAdjustment]) {
									if (extensions[soundAdjustment].checkSettings != undefined) {
										if (debug == 2) console.log("Checking preset content for extension '"+soundAdjustment+"'...");
										checkedPresetContent[soundAdjustment].report = extensions[soundAdjustment].checkSettings(fullPresetList[presetID][soundAdjustment], samplingRate);
										checkedPresetContent[soundAdjustment].status = 0;
										
									} else {
										if (debug) console.log("Extension '"+soundAdjustment+"' does not support checking preset content.");
										checkedPresetContent[soundAdjustment].status = 2;
									}
								} else {
									if (debug) console.log("Extension '"+soundAdjustment+"' does not exist on this system.");
								}	
								break;
						}
					}
					
					programName = false;
					if (extensions["dsp-programs"]) {
						if (extensions["dsp-programs"].getCurrentProgramName != undefined) {
							programName = extensions["dsp-programs"].getCurrentProgramName();
						}
					}
					
					preset.content = checkedPresetContent;
					
					// Collects metadata for display.
					preset.productImage = compactPresetList[presetID].productImage;
					preset.presetName = compactPresetList[presetID].presetName;
					preset.fileName = compactPresetList[presetID].fileName;
					preset.bangOlufsenProduct = compactPresetList[presetID].bangOlufsenProduct;
					
					
					beoBus.emit("ui", {target: "sound-preset", header: "presetPreview", content: {preset: preset, productIdentity: identity, currentDSPProgram: programName}});
					
				}
			}
			
		}
	}
	
	function readLocalPresets() {
		presetFiles = fs.readdirSync(presetDirectory);
		for (var i = 0; i < presetFiles.length; i++) {
			preset = readPresetFromFile(presetDirectory+"/"+presetFiles[i]);
			if (preset.presetName) {
				compactPresetList[preset.presetName] = preset.presetCompact;
				fullPresetList[preset.presetName] = preset.presetFull;
			}
		}
		//beoBus.emit("product-information", {header: "addProductIdentities", content: {identities: productIdentities}});
	}
	
	function checkIdentities(force) {
		if (extensions["product-information"] && extensions["product-information"].getProductIdentity) {
			for (preset in compactPresetList) {
				if (!compactPresetList[preset].identityChecked || force) {
					identityName = null;
					identity = null;
					if (fullPresetList[preset]["sound-preset"] && fullPresetList[preset]["sound-preset"].productIdentity) {
						identity = extensions["product-information"].getProductIdentity(fullPresetList[preset]["sound-preset"].productIdentity);
						identityName = fullPresetList[preset]["sound-preset"].productIdentity;
					} else if (fullPresetList[preset]["product-information"] && fullPresetList[preset]["product-information"].modelID) {
						identity = extensions["product-information"].getProductIdentity(fullPresetList[preset]["product-information"].modelID);
						identityName = fullPresetList[preset]["product-information"].modelID;
					}
					if (identity) {
						if (identity.manufacturer && identity.manufacturer == "Bang & Olufsen") {
							compactPresetList[preset].bangOlufsenProduct = true;
						}
						if (identity.productImage[1]) {
							compactPresetList[preset].productImage = identity.productImage[1];
						}
						compactPresetList[preset].productIdentity = identityName;
					}
					compactPresetList[preset].identityChecked = true;
				}
			}
		}
	}
	
	function readPresetFromFile(presetPath) {
		presetFileName = path.basename(presetPath, path.extname(presetPath));
		
		try {
			preset = JSON.parse(fs.readFileSync(presetPath, "utf8"));
			
			presetName = null;
			if (preset['product-information'] != undefined && 
				preset['product-information'].modelName) {
				// Product identity record contains a model name.
				presetName = preset['product-information'].modelName;
			}
			if (preset['sound-preset'] != undefined) { 
				if (preset['sound-preset'].presetName) {
					// Preset information record contains a preset name.
					presetName = preset['sound-preset'].presetName;
				}
				readOnly = (preset["sound-preset"].readOnly) ? true : false;
			} else {
				readOnly = false;
			}
			
			if (presetName != null && preset["sound-preset"]) {
				// If the preset has a name, it qualifies.
				
				presetCompact = {presetName: presetName, fileName: presetFileName, productImage: "/common/beocreate-generic.png", bangOlufsenProduct: false, identityChecked: false, readOnly: readOnly};
				return {presetFull: preset, presetCompact: presetCompact, presetName: presetFileName, error: null};
				
			} else {
				if (debug) console.log("Sound preset '"+presetFileName+"' did not include a preset name or product model name. Skipping.");
				return {presetName: null, error: null};
			}
			
		} catch (error) {
			if (debug) console.error("Error loading preset '"+presetFileName+"' from '"+presetPath+"':", error);
			return {presetName: null, error: error};
		}
	}
	
	function deleteSoundPreset(preset) {
		if (compactPresetList[preset]) {
			
			if (compactPresetList[preset].productIdentity && 
				extensions["product-information"] && 
				extensions["product-information"].deleteProductIdentity) {
				extensions["product-information"].deleteProductIdentity(compactPresetList[preset].productIdentity);
			}
			
			if (debug) console.log("Removing sound preset '"+preset+"'.");
			delete compactPresetList[preset];
			delete fullPresetList[preset];
			
			if (fs.existsSync(presetDirectory+"/"+preset+".json")) fs.unlinkSync(presetDirectory+"/"+preset+".json");
			beoBus.emit("ui", {target: "sound-preset", header: "presets", content: {compactPresetList: compactPresetList, currentSoundPreset: settings.selectedSoundPreset, action: "presetRemoved"}});
		}
	}
	
	uploadedPresetPath = null;
	uploadedPreset = null;
	function processUpload(path) {
		uploadedPresetPath = path;
		uploadedPreset = readPresetFromFile(path);
		if (uploadedPreset.presetName) {
			// Preset qualifies.
			name = uploadedPreset.presetName;
			if (!compactPresetList[name]) {
				// Preset does not yet exist, add it and go straight to previewing it.
				movePresetToPlaceAndPreview(path);
			} else {
				// Preset with this file name exists.
				if (compactPresetList[name].readOnly) {
					// The existing preset is read only and can't be replaced.
					beoBus.emit("ui", {target: "sound-preset", header: "presetImport", content: {message: "existingPresetReadOnly", existingPresetName: compactPresetList[name].presetName}});
					fs.unlinkSync(path);
					uploadedPresetPath = null;
				} else {
					// Ask to replace the existing preset.
					beoBus.emit("ui", {target: "sound-preset", header: "presetImport", content: {message: "askToReplace", existingPresetName: compactPresetList[name].presetName}});
				}
			}
		} else {
			if (uploadedPreset.error) {
				beoBus.emit("ui", {target: "sound-preset", header: "presetImport", content: {message: "invalidJSON"}});
			} else {
				beoBus.emit("ui", {target: "sound-preset", header: "presetImport", content: {message: "noPresetName"}});
			}
			fs.unlinkSync(path);
			uploadedPresetPath = null;
			uploadedPreset = null;
		}
	}
	
	function movePresetToPlaceAndPreview(path) {
		if (uploadedPreset) {
			name = uploadedPreset.presetName;
			fs.renameSync(path, presetDirectory+"/"+name+".json");
			compactPresetList[name] = uploadedPreset.presetCompact;
			fullPresetList[name] = uploadedPreset.presetFull;
			
			if (fullPresetList[name]["product-information"]) {
				// Add product identity, if available.
				if (extensions["product-information"] && 
					extensions["product-information"].addProductIdentity) {
					extensions["product-information"].addProductIdentity(fullPresetList[name]["product-information"]);
				}
			}
			checkIdentities();
			beoBus.emit("ui", {target: "sound-preset", header: "presets", content: {compactPresetList: compactPresetList, currentSoundPreset: settings.selectedSoundPreset}});
			beoBus.emit("ui", {target: "sound-preset", header: "presetImport", content: {message: "success", newPresetName: compactPresetList[name].presetName}});
			selectSoundPreset(name);
			uploadedPresetPath = null;
			uploadedPreset = null;
		}
	}

	
	return {
		version: version,
		processUpload: processUpload
	};
};

