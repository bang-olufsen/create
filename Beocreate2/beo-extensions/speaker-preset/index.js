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

	var extensions = beo.extensions;
	var presetDirectory = beo.dataDirectory+"/beo-speaker-presets"; // Sound presets directory.
	var systemPresetDirectory = beo.systemDirectory+"/beo-speaker-presets";
	
	var version = require("./package.json").version;
	
	var debug = beo.debug;
	var metadata = {};
	
	var fullPresetList = {};
	var compactPresetList = {};
	
	var defaultSettings = {
		"selectedSpeakerPreset": null
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var productIdentitiesFetched = false;
	
	migrateSoundPresets();
	if (!fs.existsSync(presetDirectory)) fs.mkdirSync(presetDirectory);
	
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			
			readLocalPresets();
			
			if (!settings.selectedSpeakerPreset) {
				// If no sound preset has been selected, join the setup flow.
				if (extensions["setup"] && extensions["setup"].joinSetupFlow) {
					extensions["setup"].joinSetupFlow("speaker-preset", {after: ["choose-country", "network"], before: ["product-information"]});
				}
			}
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "speaker-preset") {
				
				checkIdentities();
				
				beo.bus.emit("ui", {target: "speaker-preset", header: "presets", content: {compactPresetList: compactPresetList, currentSpeakerPreset: settings.selectedSpeakerPreset}});
				
				
			}
			
			if (event.content.extension == "sound") {
				
				if (settings.selectedSpeakerPreset) {
					if (compactPresetList[settings.selectedSpeakerPreset]) {
						name = compactPresetList[settings.selectedSpeakerPreset].presetName;
					} else {
						name = null;
					}
				} else {
					name = null;
				}
				beo.sendToUI("speaker-preset", {header: "currentPresetName", content: {presetName: name}});
			}
		}
		
	});
	
	beo.bus.on('speaker-preset', function(event) {
		
		if (event.header == "settings") {
			
			if (event.content.settings) {
				settings = event.content.settings;
			}
			
		}
		
		if (event.header == "reloadPresets") {
			readLocalPresets();
			beo.bus.emit("ui", {target: "speaker-preset", header: "presets", content: {compactPresetList: compactPresetList, currentSpeakerPreset: settings.selectedSpeakerPreset}});
		}
		
		if (event.header == "selectSpeakerPreset") {
			
			selectSpeakerPreset(event.content.presetID);
			
		}
		
		if (event.header == "deleteSpeakerPreset") {
			
			deleteSpeakerPreset(event.content.presetID);
			
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
		
		if (event.header == "applySpeakerPreset") {
			presetID = event.content.presetID;
			if (presetID && fullPresetList[presetID] != undefined) {
				if (fullPresetList[presetID]["speaker-preset"].samplingRate) {
					samplingRate = fullPresetList[presetID]["speaker-preset"].samplingRate;
				} else {
					samplingRate = null;
				}
				for (soundAdjustment in fullPresetList[presetID]) {
					if (!event.content.excludedSettings || event.content.excludedSettings.indexOf(soundAdjustment) == -1) {
						switch (soundAdjustment) {
							case "speaker-preset":
							case "presetName":
								// Do nothing.
								break;
							default:
								if (extensions[soundAdjustment]) {
									if (extensions[soundAdjustment].applySpeakerPreset != undefined) {
										if (debug) console.log("Applying sound preset for extension '"+soundAdjustment+"'...");
										extensions[soundAdjustment].applySpeakerPreset(fullPresetList[presetID][soundAdjustment], samplingRate);
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
				if (!settings.selectedSpeakerPreset) {
					if (extensions["setup"] && extensions["setup"].allowAdvancing) {
						extensions["setup"].allowAdvancing("speaker-preset", true);
					}
				}
				settings.selectedSpeakerPreset = event.content.presetID;
				
				beo.bus.emit("settings", {header: "saveSettings", content: {extension: "speaker-preset", settings: settings}});
				
				if (event.content.installDefault && fullPresetList[presetID]["speaker-preset"].fallbackDSP) {
					if (extensions["dsp-programs"] && extensions["dsp-programs"].installDSPProgram) {
						extensions["dsp-programs"].installDSPProgram(fullPresetList[presetID]["speaker-preset"].fallbackDSP, function(result) {
							if (result == true) {
								beo.bus.emit("ui", {target: "speaker-preset", header: "presetApplied", content: {presetID: event.content.presetID}});
								if (debug) console.log("Installing default DSP program succeeded. Sound preset applied.");
							} else {
								if (debug) console.log("Installing default DSP program unsuccessful.");
							}
						});
					}
				} else {
					beo.bus.emit("ui", {target: "speaker-preset", header: "presetApplied", content: {presetID: event.content.presetID}});
				}
				beo.bus.emit("daisy-chain", {header: "disableDaisyChaining", content: {reason: "speakerPresetSelected"}});
			}
			
		}
		
		
	});
	
	
	beo.bus.on('dsp', function(event) {
		
		
		if (event.header == "metadata") {
			
			if (event.content.metadata) {
				metadata = event.content.metadata;
				
			} else {
				metadata = {};
			}
	
		}
	});
	
	function selectSpeakerPreset(presetID) {
	
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
					if (fullPresetList[presetID]["speaker-preset"].samplingRate) {
						samplingRate = fullPresetList[presetID]["speaker-preset"].samplingRate;
					} else {
						samplingRate = null;
					}
					for (soundAdjustment in fullPresetList[presetID]) {
						switch (soundAdjustment) {
							case "speaker-preset":
							
								if (fullPresetList[presetID]["speaker-preset"].description) {
									preset.description = fullPresetList[presetID]["speaker-preset"].description;
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
					metadataFromDSP = false;
					if (extensions["dsp-programs"]) {
						if (extensions["dsp-programs"].getCurrentProgramInfo.name != undefined) {
							programInfo = extensions["dsp-programs"].getCurrentProgramInfo();
							programName = programInfo.name;
							metadataFromDSP = programInfo.metadataFromDSP;
						}
					}
					installDefaultDSP = (!metadataFromDSP) ? true : false;
					
					preset.content = checkedPresetContent;
					
					// Collects metadata for display.
					preset.productImage = compactPresetList[presetID].productImage;
					preset.presetName = compactPresetList[presetID].presetName;
					preset.fileName = compactPresetList[presetID].fileName;
					preset.bangOlufsenProduct = compactPresetList[presetID].bangOlufsenProduct;
					
					
					beo.bus.emit("ui", {target: "speaker-preset", header: "presetPreview", content: {preset: preset, productIdentity: identity, currentDSPProgram: programName, installDefaultDSP: installDefaultDSP}});
					
				}
			}
			
		}
	}
	
	function readLocalPresets() {
		// Read presets from system directory and then from user directory
		presetFiles = fs.readdirSync(systemPresetDirectory);
		for (var i = 0; i < presetFiles.length; i++) {
			preset = readPresetFromFile(systemPresetDirectory+"/"+presetFiles[i], true);
			if (preset.presetName && !compactPresetList[preset.presetName]) {
				compactPresetList[preset.presetName] = preset.presetCompact;
				fullPresetList[preset.presetName] = preset.presetFull;
			}
		}
		
		presetFiles = fs.readdirSync(presetDirectory);
		for (var i = 0; i < presetFiles.length; i++) {
			preset = readPresetFromFile(presetDirectory+"/"+presetFiles[i], false);
			if (preset.presetName && !compactPresetList[preset.presetName]) {
				compactPresetList[preset.presetName] = preset.presetCompact;
				fullPresetList[preset.presetName] = preset.presetFull;
			}
		}
		//beo.bus.emit("product-information", {header: "addProductIdentities", content: {identities: productIdentities}});
	}
	
	function checkIdentities(force) {
		if (extensions["product-information"] && extensions["product-information"].getProductIdentity) {
			for (preset in compactPresetList) {
				if (!compactPresetList[preset].identityChecked || force) {
					identityName = null;
					identity = null;
					if (fullPresetList[preset]["speaker-preset"] && fullPresetList[preset]["speaker-preset"].productIdentity) {
						identity = extensions["product-information"].getProductIdentity(fullPresetList[preset]["speaker-preset"].productIdentity);
						identityName = fullPresetList[preset]["speaker-preset"].productIdentity;
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
	
	function readPresetFromFile(presetPath, systemPreset) {
		presetFileName = path.basename(presetPath, path.extname(presetPath));
		
		try {
			preset = JSON.parse(fs.readFileSync(presetPath, "utf8"));
			
			presetName = null;
			if (preset['product-information'] != undefined && 
				preset['product-information'].modelName) {
				// Product identity record contains a model name.
				presetName = preset['product-information'].modelName;
			}
			if (preset['speaker-preset'] != undefined) { 
				if (preset['speaker-preset'].presetName) {
					// Preset information record contains a preset name.
					presetName = preset['speaker-preset'].presetName;
				}
			}
			
			readOnly = (systemPreset) ? true : false;
			
			if (presetName != null && preset["speaker-preset"]) {
				// If the preset has a name, it qualifies.
				
				presetCompact = {presetName: presetName, fileName: presetFileName, productImage: "/common/beocreate-generic.png", bangOlufsenProduct: false, identityChecked: false, readOnly: readOnly};
				return {presetFull: preset, presetCompact: presetCompact, presetName: presetFileName, error: null};
				
			} else {
				if (debug) console.log("Speaker preset '"+presetFileName+"' did not include a preset name or product model name. Skipping.");
				return {presetName: null, error: null};
			}
			
		} catch (error) {
			if (debug) console.error("Error loading preset '"+presetFileName+"' from '"+presetPath+"':", error);
			return {presetName: null, error: error};
		}
	}
	
	function deleteSpeakerPreset(preset) {
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
			beo.bus.emit("ui", {target: "speaker-preset", header: "presets", content: {compactPresetList: compactPresetList, currentSpeakerPreset: settings.selectedSpeakerPreset, action: "presetRemoved"}});
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
					beo.bus.emit("ui", {target: "speaker-preset", header: "presetImport", content: {message: "existingPresetReadOnly", existingPresetName: compactPresetList[name].presetName}});
					fs.unlinkSync(path);
					uploadedPresetPath = null;
				} else {
					// Ask to replace the existing preset.
					beo.bus.emit("ui", {target: "speaker-preset", header: "presetImport", content: {message: "askToReplace", existingPresetName: compactPresetList[name].presetName}});
				}
			}
		} else {
			if (uploadedPreset.error) {
				beo.bus.emit("ui", {target: "speaker-preset", header: "presetImport", content: {message: "invalidJSON"}});
			} else {
				beo.bus.emit("ui", {target: "speaker-preset", header: "presetImport", content: {message: "noPresetName"}});
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
			beo.bus.emit("ui", {target: "speaker-preset", header: "presets", content: {compactPresetList: compactPresetList, currentSpeakerPreset: settings.selectedSpeakerPreset}});
			beo.bus.emit("ui", {target: "speaker-preset", header: "presetImport", content: {message: "success", newPresetName: compactPresetList[name].presetName}});
			selectSpeakerPreset(name);
			uploadedPresetPath = null;
			uploadedPreset = null;
		}
	}
	
	function migrateSoundPresets() {
		if (fs.existsSync(beo.dataDirectory+"/beo-sound-presets")) {
			if (!fs.existsSync(presetDirectory)) {
				fs.renameSync(beo.dataDirectory+"/beo-sound-presets", presetDirectory);
				presetFiles = fs.readdirSync(presetDirectory);
				for (var i = 0; i < presetFiles.length; i++) {
					if (presetFiles[i].substr(-4) == "json") {
						try {
							preset = fs.readFileSync(presetDirectory+"/"+presetFiles[i], "utf8");
							fs.writeFileSync(presetDirectory+"/"+presetFiles[i], preset.replace('"sound-preset":', '"speaker-preset":'));
							
						} catch (error) {
							if (debug) console.error("Error migrating preset '"+presetFiles[i]+"' from '"+presetDirectory+"':", error);
						}
					}
				}
			} else {
				require("child_process").execSync("rm -rf "+beo.dataDirectory+"/beo-sound-presets");
			}
			if (fs.existsSync(beo.dataDirectory+"/sound-preset.json")) {
				oldSettings = beo.getSettings("sound-preset");
				if (oldSettings && oldSettings.selectedSoundPreset) {
					settings.selectedSpeakerPreset = oldSettings.selectedSoundPreset;
					fs.unlinkSync(beo.dataDirectory+"/sound-preset.json");
					beo.saveSettings("speaker-preset", settings);
				}
			}
			console.log("Sound presets have been migrated to speaker presets.");
		}
	}
	
	function getCurrentSpeakerPreset() {
		return {id: settings.selectedSpeakerPreset, name: compactPresetList[settings.selectedSpeakerPreset]};
	}

	
module.exports = {
	version: version,
	processUpload: processUpload,
	getCurrentSpeakerPreset: getCurrentSpeakerPreset
};

