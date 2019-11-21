/*Copyright 2018-2019 Bang & Olufsen A/S
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

// BEOCREATE DSP PROGRAM MANAGER

var beoDSP = require('../../beocreate_essentials/dsp');
var xmlJS = require('xml-js');
var execSync = require("child_process").execSync;
var fs = require('fs');
var _ = require('underscore');
Gpio = null;
//const Gpio = require('onoff').Gpio;
if (Gpio) {
	const mutePin = new Gpio(2, 'out');
}

	var debug = beo.debug;
	
	var currentMetadata = null;
	var metadataFromDSP = false;
	var currentChecksum = null;
	var dspConnected = false;
	var dspResponding = false;
	
	var dspUpgrade = false;
	
	var version = require("./package.json").version;
	
	var dspPrograms = {};
	
	var dspDirectory = beo.dataDirectory+"/beo-dsp-programs"; // User DSP directory.
	var systemDSPDirectory = beo.systemDirectory+"/beo-dsp-programs"; // System DSP directory.
	
	var defaultSettings = {
		"muteUnknownPrograms": true,
		"autoUpgrade": true
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	if (!fs.existsSync(dspDirectory)) fs.mkdirSync(dspDirectory);
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			readAllDSPPrograms();
			
			beoDSP.connectDSP(function(success) {  
				if (success) {
					beo.bus.emit("general", {header: "requestShutdownTime", content: {extension: "dsp-programs"}});
					dspConnected = true;
					beo.bus.emit('dsp', {header: "connected", content: true});
					
					getCurrentChecksumAndMetadata(function(metadata, fromDSP) {
						currentMetadata = metadata;
						
						shouldUpgrade = checkForDSPUpgrades();
						
						if (!shouldUpgrade) {
							if (metadata) {
								if (debug == 2) {
									console.dir(metadata);
								} else if (debug) {
									console.log("Received metadata from DSP.");
								}
								beo.bus.emit('dsp', {header: "metadata", content: {metadata: metadata, fromDSP: fromDSP}});
							} else {
								if (debug) console.log("No metadata found for current DSP program.");
								beo.bus.emit('dsp', {header: "metadata", content: {metadata: null}});
							}
						} else {
							if (debug) console.log("'"+shouldUpgrade+"' is an upgrade to the current DSP program. Upgrading...");
							installDSPProgram(shouldUpgrade);
						}
						
					}, true);
				}
			}); // Opens a link with the SigmaDSP daemon.
		}
		
		if (event.header == "shutdown") {
			beoDSP.disconnectDSP(function() {
				beo.bus.emit("general", {header: "shutdownComplete", content: {extension: "dsp-programs"}});
				if (debug) console.log("Disconnected from DSP.");
			});
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "dsp-programs") {
				
				info = getCurrentProgramInfo();
				beo.bus.emit("ui", {target: "dsp-programs", header: "showCurrent", content: info});
				beo.bus.emit("ui", {target: "dsp-programs", header: "status", content: {dspConnected: dspConnected, dspResponding: dspResponding}});
				
				programs = {};
				active = 0;
				for (program in dspPrograms) {
					programs[program] = {name: dspPrograms[program].name, checksum: dspPrograms[program].checksum, version: dspPrograms[program].version};
					if (programs[program].checksum == currentChecksum) {
						active++;
						programs[program].active = true;
					} else {
						programs[program].active = false;
					}
				}
				beo.bus.emit("ui", {target: "dsp-programs", header: "allPrograms", content: {programs: programs, activePrograms: active, dspUpgrade: dspUpgrade}});
				beo.bus.emit("ui", {target: "dsp-programs", header: "settings", content: settings});
			}
		}
	});
	
	beo.bus.on('dsp', function(event) {
		
		
	});
	
	beo.bus.on('dsp-programs', function(event) {
		
		if (event.header == "getProgramPreview") {
			
			if (event.content.program) {
				metadata = dspPrograms[event.content.program].metadata;
				current = false;
				if (metadata) {
					name = dspPrograms[event.content.program].name;
					if (metadata.profileVersion) {
						version = metadata.profileVersion.value[0];
					} else {
						version = null;
					}
					id = event.content.program;
				}
			} else {
				metadata = currentMetadata;
				current = true;
				if (metadata) {
					name = getProgramName(metadata);
					if (metadata.profileVersion) {
						version = metadata.profileVersion.value[0];
					} else {
						version = null;
					}
					id = null;
				}
			}
			if (metadata) {
				beo.bus.emit("ui", {target: "dsp-programs", header: "programPreview", content: {id: id, metadata: metadata, name: name, version: version, current: current}});
			} else {
				beo.bus.emit("ui", {target: "dsp-programs", header: "programPreview", content: {metadata: false, current: current}});
			}
			
		}
		
		
		if (event.header == "installProgram") {
			program = null;
			if (event.content && event.content.program) {
				program = event.content.program;
			} else {
				// Called when reinstalling current program.
				// Program has to exist in the DSP program directory. First try to find a metadata match, otherwise use checksum match.
				match = null;
				if (currentMetadata) {
					for (program in dspPrograms) {
						if (_.isEqual(currentMetadata, dspPrograms[program].metadata)) {
							match = program;
							break;
						}
					}
				}
				if (!match) {
					for (program in dspPrograms) {
						if (currentChecksum == dspPrograms[program].checksum) {
							match = program;
							break;
						}
					}
				}
				program = match;
			}
			if (program) {
				installDSPProgram(program);
			}
		}
		
		if (event.header == "loadMetadataProto") {
			beo.bus.emit("ui", {target: "dsp-programs", header: "loadingMetadata"});
			getCurrentChecksumAndMetadata(function(metadata) {
				currentMetadata = metadata;
				
				if (metadata) {
					if (debug == 2) {
						console.dir(metadata);
					} else if (debug) {
						console.log("Received metadata from DSP.");
					}
					beo.bus.emit('dsp', {header: "metadata", content: {metadata: metadata}});
				} else {
					if (debug) console.log("No metadata found for current DSP program.");
				}
				beo.bus.emit("ui", {target: "dsp-programs", header: "metadataLoaded"});
				
			});
		}
		
		if (event.header == "gpioMuteTest" && Gpio) {
			if (event.content.mute) {
				mutePin.writeSync(true);
			} else {
				mutePin.writeSync(false);
			}
		}
		
		if (event.header == "muteUnknown") {
			if (event.content.muteUnknown) {
				settings.muteUnknownPrograms = true;
			} else {
				settings.muteUnknownPrograms = false;
			}
			beo.bus.emit("settings", {header: "saveSettings", content: {extension: "dsp-programs", settings: settings}});
			beo.bus.emit("ui", {target: "dsp-programs", header: "settings", content: settings});
		}
		
		if (event.header == "autoUpgrade") {
			if (event.content.autoUpgrade) {
				settings.autoUpgrade = true;
			} else {
				settings.autoUpgrade = false;
			}
			beo.bus.emit("settings", {header: "saveSettings", content: {extension: "dsp-programs", settings: settings}});
			beo.bus.emit("ui", {target: "dsp-programs", header: "settings", content: settings});
		}
	});
	
	function getCurrentChecksumAndMetadata(callback, startup) {
		if (callback) {
			amplifierMute(true);
			checksumTimeout = setTimeout(function() {
				console.error("DSP request for checksum timed out.");
				dspResponding = false;
				beo.bus.emit("ui", {target: "dsp-programs", header: "status", content: {dspConnected: dspConnected, dspResponding: dspResponding}});
			}, 5000);
			beoDSP.getChecksum(function(checksum) {
				if (debug) console.log("DSP checksum is: "+checksum+".");
				dspResponding = true;
				clearTimeout(checksumTimeout);
				currentChecksum = checksum;
				beoDSP.getXML(function(response) {
					// Reads the current program from the DSP.
					metadata = (response != null) ? parseDSPMetadata(response).metadata : null;
					
					if (metadata) {
						if (!metadataFromDSP && !startup) {
							// Metadata was not received from DSP at startup, but is now (possibly because this is a fresh setup). This should be used to trigger reconfiguration of sources in HiFiBerryOS.
							if (extensions.setup && extensions.setup.restartWhenComplete) {
								extensions.setup.restartWhenComplete("sound-preset", true);
							}
						}
						metadataFromDSP = true;
						amplifierMute(false);
						callback(metadata, true);
					} else {
						// If no metadata was received from the DSP, check if any of the stored programs contains the same checksum and use that metadata.
						metadataFromDSP = false;
						programMatch = null;
						for (program in dspPrograms) {
							if (dspPrograms[program].checksum == currentChecksum) {
								programMatch = program;
								break;
							}
						}
						if (programMatch) {
							if (debug) console.log("No XML received from the DSP, but '"+program+"' matches, using its metadata instead.");
							amplifierMute(false);
							callback(dspPrograms[programMatch].metadata, false);
						} else {
							if (!settings.muteUnknownPrograms) {
								if (debug) console.log("No matching metadata found.");
								amplifierMute(false);
							} else {
								if (debug) console.log("No matching metadata found, keeping amplifier muted.");
							}
							callback(null);
						}
					}
				});
			});
		}
	}
	
	function parseDSPMetadata(xml, fileref) {
		// Get the DSP metadata from the XML as a JavaScript object.
		metadataXML = '<beometa>' + xml.split("</beometa>")[0].split("<beometa>")[1] + "</beometa>";
		beoMeta = {};
		try {
			rawMetadata = xmlJS.xml2js(metadataXML, {compact: true}).beometa.metadata;
			if (rawMetadata) {
				for (var i = 0; i < rawMetadata.length; i++) {
					if (rawMetadata[i]._text) {
						values = rawMetadata[i]._text.split(",");
						for (var v = 0; v < values.length; v++) {
							if (!isNaN(values[v])) values[v] = parseFloat(values[v]);
						}
						beoMeta[rawMetadata[i]._attributes.type] = {value: values};
						for (var key in rawMetadata[i]._attributes) {
						    if (rawMetadata[i]._attributes.hasOwnProperty(key)) {
								if (key != "type") {
									beoMeta[rawMetadata[i]._attributes.type][key] = rawMetadata[i]._attributes[key];
								}
						    }
						}
					}
				}
			} else {
				beoMeta = null;
			}
			return {metadata: beoMeta, error: null};
		} catch (error) {
			if (filename) {
				console.error("Invalid XML encountered in DSP program '"+fileref+"'. Error:", error);
			} else {
				console.error("Invalid XML encountered in the received DSP program. Error:", error);
			}
			return {metadata: null, error: error};
		}
	}
	
	function getProgramName(metadata, id) {
		if (metadata) {
			if (metadata.programName) {
				// Prefer profile name.
				name = metadata.programName.value[0];
			} else if (metadata.profileName) {
				// Prefer profile name.
				name = metadata.profileName.value[0];
			} else if (metadata.modelName) {
				// Fall back to model name...
				name = metadata.modelName.value[0];
			} else if (id) {
				// File name...
				name = id;
			} else {
				name = null;
			}
		} else {
			if (id) {
				name = id;
			} else {
				name = null;
			}
		}
		return name;
	}
	
	function getChecksumFromMetadata(metadata) {
		
		if (metadata) {
			if (metadata.checksum) {
				return metadata.checksum.value[0];
			} else {
				return null;
			}
		}
	}
	
	function getCurrentProgramInfo() {
		version = (currentMetadata.profileVersion) ? currentMetadata.profileVersion.value[0] : null;
		name = getProgramName(currentMetadata);
		return {name: name, version: version};
	}
	
	
	function installDSPProgram(reference, callback) {
		// This function is exposed to the outside.
		beo.bus.emit("now-playing", {header: "transport", content: {action: "stop"}}); // Stop music playback if possible.
		id = null;
		if (dspPrograms[reference]) {
			// This exact DSP program exists.
			id = reference;
		} else {
			version = 0;
			// Match using programID instead.
			for (program in dspPrograms) {
				if (dspPrograms[program].metadata && dspPrograms[program].metadata.programID) {
					if (dspPrograms[program].metadata.programID.value[0] == reference) {
						if (dspPrograms[program].metadata.profileVersion) {
							if (version < dspPrograms[program].metadata.profileVersion.value[0]) {
								version = dspPrograms[program].metadata.profileVersion.value[0];
								id = program;
							}
						} else if (version == 0) {
							id = program;
						}
					}
				}
			}
			if (id && debug) console.log("Matched '"+reference+"' to DSP program '"+id+"' using programID.");
		}
		if (id != null) {
			installAndCheckDSPProgram(id, function(result) {
				// The function will independently send status updates to UI.
					getCurrentChecksumAndMetadata(function(metadata, fromDSP) {
						currentMetadata = metadata;
						if (id == dspUpgrade) {
							dspUpgrade = false;
							beo.bus.emit("ui", {target: "dsp-programs", header: "dspUpgrade", content: {dspUpgrade: false}});
						}
						
						if (metadata) {
							if (debug == 2) {
								console.dir(metadata);
							} else if (debug) {
								console.log("Received metadata from DSP.");
							}
							beo.bus.emit('dsp', {header: "metadata", content: {metadata: metadata, fromDSP: fromDSP}});
						} else {
							if (debug) console.log("No metadata found for current DSP program.");
							beo.bus.emit('dsp', {header: "metadata", content: {metadata: null}});
						}
						
						name = getProgramName(currentMetadata);
						beo.bus.emit("ui", {target: "dsp-programs", header: "showCurrent", content: {name: name}});
						
						if (callback) {
							if (result == true) {
								callback(true);
							} else {
								callback(result);
							}
						}
						
						
					});
			});
		} else {
			console.error("A DSP program matching '"+reference+"' was not found.");
		}
	}
	
	
	function installAndCheckDSPProgram(reference, callback) {
		if (dspPrograms[reference] && fs.existsSync(dspPrograms[reference].path)) {
			path = dspPrograms[reference].path;
			beo.bus.emit("ui", {target: "dsp-programs", header: "flashEEPROM", content: {status: "flashing"}});
			amplifierMute(true);
			if (debug) console.log("Flashing DSP program '"+reference+"'...");
			beoDSP.flashEEPROM(path, function(result, error) {
				if (!error) {
					if (result == true) {
						// Flashing complete, run EEPROM check.
						beo.bus.emit("ui", {target: "dsp-programs", header: "checkEEPROM", content: {status: "checking"}});
						if (debug) console.log("Program write complete, checking EEPROM...");
						beoDSP.checkEEPROM(function(matches) {
							if (matches) {
								beo.bus.emit("ui", {target: "dsp-programs", header: "checkEEPROM", content: {status: "success"}});
								if (debug) console.log("Memory contents match with installed program.");
								callback(true);
							} else {
								if (debug) console.log("Memory contents did not match with installed program.");
								beo.bus.emit("ui", {target: "dsp-programs", header: "checkEEPROM", content: {status: "fail"}});
								callback(false);
							}
						});
					} else {
						callback(500);
						if (debug) console.log("Failed to write DSP program.");
						beo.bus.emit("ui", {target: "dsp-programs", header: "flashEEPROM", content: {status: "fail"}});
					}
				} else {
					callback(500);
					if (debug) console.log("DSPToolkit error.");
					beo.bus.emit("ui", {target: "dsp-programs", header: "flashEEPROM", content: {status: "fail"}});
				}
			});
		} else {
			if (debug) console.log("Specified DSP program '"+reference+"' was not found.");
			callback(404);
		}
		
	}
	
	function readAllDSPPrograms() {
		// Read all programs from the DSP program directory.
		dspFiles = fs.readdirSync(systemDSPDirectory);
		for (var i = 0; i < dspFiles.length; i++) {
			if (!dspPrograms[dspFiles[i].slice(0, -4)] && dspFiles[i].slice(-4) == ".xml") {
				filename = dspFiles[i].slice(0, -4);
				readDSPProgramFromFile(systemDSPDirectory+"/"+dspFiles[i], filename, function(id, path, meta) {
					addDSPProgramToList(id, path, meta, true);
				});
			}
		}
		
		dspFiles = fs.readdirSync(dspDirectory);
		for (var i = 0; i < dspFiles.length; i++) {
			if (!dspPrograms[dspFiles[i].slice(0, -4)] && dspFiles[i].slice(-4) == ".xml") {
				filename = dspFiles[i].slice(0, -4);
				readDSPProgramFromFile(dspDirectory+"/"+dspFiles[i], filename, function(id, path, meta) {
					addDSPProgramToList(id, path, meta, false);
				});
			}
		}
	}
	
	function addDSPProgramToList(id, path, metadata, readOnly) {
		if (!metadata.error) {
			name = getProgramName(metadata.metadata, id);
			checksum = getChecksumFromMetadata(metadata.metadata);
			version = (metadata.metadata.profileVersion) ? metadata.metadata.profileVersion.value[0] : null;
			dspPrograms[id] = {name: name, path: path, metadata: metadata.metadata, checksum: checksum, version: version, filename: id+".xml", readOnly: readOnly};
			if (debug >= 2) console.log("Added DSP program '"+name+"' ("+id+").");
		}
	}
	
	function readDSPProgramFromFile(path, filename, callback) {
		if (callback) {
			stream = fs.createReadStream(path, { start: 1, end: 6000 });
			stream.on("data", function(chunk) {
				snippet = chunk.toString();
				metadata = parseDSPMetadata(snippet, filename);
				callback(filename, path, metadata);
			});
		}
	}
	
	function checkForDSPUpgrades() {
		match = false;
		matchVersion = 0;
		for (program in dspPrograms) {
			if (dspPrograms[program].checksum && dspPrograms[program].checksum != currentChecksum) {
				// Compare program ID and version.
				if (currentMetadata && 
					currentMetadata.programID && 
					dspPrograms[program].metadata && 
					dspPrograms[program].metadata.programID) {
					if (dspPrograms[program].metadata.programID.value[0] == currentMetadata.programID.value[0]) {
						if (dspPrograms[program].metadata.profileVersion &&
							currentMetadata.metadata.profileVersion) {
							if (dspPrograms[program].metadata.profileVersion.value[0] > currentMetadata.metadata.profileVersion.value[0] &&
								dspPrograms[program].metadata.profileVersion.value[0] > matchVersion) {
								match = program;
								matchVersion = dspPrograms[program].metadata.profileVersion.value[0];
							}
						}
					}
				}
				
				// Alternatively, if the metadata lists checksums that this program is an upgrade to, check if there's a match.
				// Requires "upgradeFrom" metadata entry, which can contain multiple comma-separated checksums.
				if (dspPrograms[program].metadata && 
					dspPrograms[program].metadata.upgradeFrom) {
					upgradeFrom = dspPrograms[program].metadata.upgradeFrom.value[0].split(",");
					for (var i = 0; i < upgradeFrom.length; i++) {
						if (upgradeFrom[i].trim() == currentChecksum) {
							if (dspPrograms[program].metadata.profileVersion.value[0]) {
								if (dspPrograms[program].metadata.profileVersion.value[0] > matchVersion) {
									match = program;
									matchVersion = dspPrograms[program].metadata.profileVersion.value[0];
								}
							}
						}
					}
				}
			}
		}
		if (match) {
			if (settings.autoUpgrade == false) {
				if (debug) console.log("An upgrade to the current DSP program is on file.");
				dspUpgrade = match;
			} else {
				return match;
			}
		} else {
			return false;
		}
	}
	
	function amplifierMute(mute) {
		if (mute) {
			execSync("gpio mode 2 out");
			execSync("gpio write 2 1");
			if (debug) console.log("Muted amplifier through GPIO.");
		} else {
			execSync("gpio write 2 0");
			execSync("gpio mode 2 in");
			if (debug) console.log("Unmuted amplifier through GPIO.");
		}
	}

	
module.exports = {
	getCurrentProgramInfo: getCurrentProgramInfo,
	installDSPProgram: installDSPProgram,
	version: version
};

