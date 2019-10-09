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
	var presetDirectory = dataDirectory+"/beo-sound-presets"; // Sound presets directory sits next to the system directory
	
	var version = require("./package.json").version;
	
	var debug = false;
	var metadata = {};
	
	var fullPresetList = {};
	var compactPresetList = {};
	
	var defaultSettings = {
		"selectedSoundPreset": null
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	if (!fs.existsSync(presetDirectory)) fs.mkdirSync(presetDirectory);
	
	
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
				
				beoBus.emit("ui", {target: "sound-preset", header: "presets", content: {compactPresetList: compactPresetList, selectedSoundPreset: settings.selectedSoundPreset}});
				
				
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
			beoBus.emit("ui", {target: "sound-preset", header: "presets", content: {compactPresetList: compactPresetList, selectedSoundPreset: settings.selectedSoundPreset}});
		}
		
		if (event.header == "selectSoundPreset") {
			
			if (event.content.presetID) {
				presetID = event.content.presetID;
				
				if (fullPresetList[presetID] != undefined) {
					if (fullPresetList[presetID]) {
						
						preset = {};
						
						// "Preflights" the selected sound preset by sending the settings to the sound adjustment extensions. The extensions will check them against the DSP metadata and their own capabilities and return a compatibility report.
						checkedPresetContent = {};
						for (soundAdjustment in fullPresetList[presetID]) {
							switch (soundAdjustment) {
								case "sound-preset":
								
									if (fullPresetList[presetID]["sound-preset"].description) {
										preset.description = fullPresetList[presetID]["sound-preset"].description;
									}
									break;
								case "presetName":
									
									break;
								default:
									checkedPresetContent[soundAdjustment] = {status: 1};
									if (extensions[soundAdjustment]) {
										if (extensions[soundAdjustment].checkSettings != undefined) {
											if (debug == 2) console.log("Checking preset content for extension '"+soundAdjustment+"'...");
											checkedPresetContent[soundAdjustment].report = extensions[soundAdjustment].checkSettings(fullPresetList[presetID][soundAdjustment]);
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
						
						
						beoBus.emit("ui", {target: "sound-preset", header: "presetPreview", content: {preset: preset, currentDSPProgram: programName}});
						
					}
				}
				
			}
			
		}
		
		if (event.header == "applySoundPreset") {
			
			if (event.content.presetID && fullPresetList[presetID] != undefined) {
				
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
										extensions[soundAdjustment].applySoundPreset(fullPresetList[presetID][soundAdjustment]);
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
	
	
	function readLocalPresets() {
		presetFiles = fs.readdirSync(presetDirectory);
		productIdentities = [];
		for (var i = 0; i < presetFiles.length; i++) {
			identity = readPresetFromFile(presetDirectory+"/"+presetFiles[i]);
			if (identity != false) productIdentities.push(identity); // Collect product identities from presets and make them automatically available to product-information.
		}
		beoBus.emit("product-information", {header: "addProductIdentities", content: {identities: productIdentities}});
	}
	
	function readPresetFromFile(presetPath) {
		presetFileName = path.basename(presetPath, path.extname(presetPath));
		productIdentity = false;
		try {
			preset = JSON.parse(fs.readFileSync(presetPath, "utf8"));
			
			presetName = null;
			if (preset['product-information'] != undefined && 
				preset['product-information'].modelName) {
				// Product identity record contains a model name.
				presetName = preset['product-information'].modelName;
				productIdentity.modelName = presetName;
				if (preset['product-information'].modelID) {
					productIdentity = {modelName: preset['product-information'].modelName, modelID: preset['product-information'].modelID};
				}
			}
			if (preset['sound-preset'] != undefined && 
				preset['sound-preset'].presetName) {
				// Preset information record contains a preset name.
				presetName = preset['sound-preset'].presetName;
			}
			if (preset.presetName) {
				// Preset name is specified standalone in the file.
				presetName = preset.presetName;
			}
			
			if (presetName != null) {
				// If the preset has a name, it qualifies.
				fullPresetList[presetFileName] = preset;
				compactPresetList[presetFileName] = {presetName: presetName, fileName: presetFileName};
				
				imageName = null;
				if (preset['product-information'] != undefined) {
					if (preset['product-information'].manufacturer && preset['product-information'].manufacturer == "Bang & Olufsen") {
						compactPresetList[presetFileName].bangOlufsenProduct = true;
					} else {
						compactPresetList[presetFileName].bangOlufsenProduct = false;
					}
					
					if (preset['product-information'].modelID) imageName = preset['product-information'].modelID;
					if (preset['product-information'].productImage) imageName = preset['product-information'].productImage;
				} else {
					compactPresetList[presetFileName].bangOlufsenProduct = false;
				}
				
				if (extensions["product-information"].getProductImage) {
					image = extensions["product-information"].getProductImage(imageName);
					if (productIdentity != false) productIdentity.productImage = image.path + image.filename;
				} else {
					image = {path: "/common/", filename: "beocreate.png"};
				}
				compactPresetList[presetFileName].productImage = image.path + image.filename;
				
			} else {
				if (debug) console.log("Sound preset '"+presetFileName+"' did not include a preset name or product model name. Skipping.");
			}
			
		} catch (error) {
			if (debug) console.error("JSON data for sound preset '"+presetFileName+"' is invalid. Skipping.");
		}
		return productIdentity;
	}

	
	return {
		version: version
	};
};

