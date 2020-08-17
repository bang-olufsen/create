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
var exec = require("child_process").exec;
var spawn = require("child_process").spawn;
var fs = require("fs");
var _ = require('underscore');


	var debug = beo.debug;
	
	var currentMetadata = null;
	var metadataFromDSP = false;
	var currentChecksum = null;
	var dspConnected = false;
	var dspResponding = false;
	
	var dspUpgrade = false;
	
	var reconfigurePostSetup = false;
	
	var version = require("./package.json").version;
	
	var dspPrograms = {};
	
	var dspDirectory = beo.dataDirectory+"/beo-dsp-programs"; // User DSP directory.
	var systemDSPDirectory = beo.systemDirectory+"/beo-dsp-programs"; // System DSP directory.
	
	var defaultSettings = {
		"muteUnknownPrograms": true,
		"autoUpgrade": true,
		"noGPIOMute": false
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	if (!fs.existsSync(dspDirectory)) fs.mkdirSync(dspDirectory);
	
	var configuration = {}; // /etc/sigmatcp.conf
	
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
						
						shouldAutoInstall = checkIfShouldAutoInstall();
						if (!shouldAutoInstall) {
							shouldUpgrade = checkForDSPUpgrades();
							if (!shouldUpgrade) {
								if (metadata) {
									if (debug == 2) {
										console.dir(metadata);
									} else if (debug) {
										console.log("Received metadata from DSP.");
									}
									beo.bus.emit('dsp', {header: "metadata", content: {metadata: metadata, fromDSP: fromDSP}});
									if (beo.selectedExtension == "dsp-programs") sendDSPPrograms();
								} else {
									if (debug) console.log("No metadata found for current DSP program.");
									beo.bus.emit('dsp', {header: "metadata", content: {metadata: null}});
								}
							} else {
								if (debug) console.log("'"+shouldUpgrade+"' is an upgrade to the current DSP program. Upgrading...");
								installDSPProgram(shouldUpgrade);
							}
						} else {
							if (debug) console.log("DSP program '"+shouldAutoInstall+"' is set to be auto-installed. Installing...");
							installDSPProgram(shouldAutoInstall);
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
			if (event.content.extension == "dsp-programs") {
				
				sendDSPPrograms();
			}
		}
	});
	
	beo.bus.on('dsp', function(event) {
		
		
	});
	
	beo.bus.on('dsp-programs', function(event) {
		
		if (event.header == "settings") {
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
		}
		
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
		
		if (event.header == "storeAdjustments") {
			storeAdjustments();
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
		
		if (event.header == "muteUnknown") {
			if (event.content.muteUnknown) {
				settings.muteUnknownPrograms = true;
			} else {
				settings.muteUnknownPrograms = false;
			}
			beo.saveSettings("dsp-programs", settings);
			beo.sendToUI("dsp-programs", {header: "settings", content: settings});
		}
		
		if (event.header == "autoUpgrade") {
			if (event.content.autoUpgrade) {
				settings.autoUpgrade = true;
			} else {
				settings.autoUpgrade = false;
			}
			beo.saveSettings("dsp-programs", settings);
			beo.sendToUI("dsp-programs", {header: "settings", content: settings});
		}
		
		if (event.header == "server-notify") {
			// Called by the HiFiBerry SigmaDSP server.
			console.log("Notification from DSP:", event.content);
		}
	});
	
	beo.bus.on('setup', function(event) {
	
		if (event.header == "postSetup") {
			if (reconfigurePostSetup) {
				reconfigurePostSetup = false;
				if (debug) console.log("Running HiFiBerry reconfigure script.");
				configureProcess = spawn("/opt/hifiberry/bin/reconfigure-players", {detached: true, stdio: "ignore"});
				configureProcess.unref();
			}
		}
				
	});
	
	function sendDSPPrograms() {
		info = getCurrentProgramInfo();
		beo.sendToUI("dsp-programs", "showCurrent", info);
		beo.sendToUI("dsp-programs", "status", {dspConnected: dspConnected, dspResponding: dspResponding});
		
		programs = {};
		active = 0;
		for (program in dspPrograms) {
			if (beo.systemConfiguration.dspModel) {
				compareType = beo.systemConfiguration.dspModel.toLowerCase();
			} else if (beo.systemConfiguration.cardType) {
				compareType = beo.systemConfiguration.cardType.toLowerCase();
			} else {
				compareType = null;
			}
			if (!dspPrograms[program].device || !compareType ||
				(dspPrograms[program].device.toLowerCase() == compareType)) {
				programs[program] = {name: dspPrograms[program].name, checksum: dspPrograms[program].checksum, version: dspPrograms[program].version, active: dspPrograms[program].active};
				if (programs[program].active) active++;
			}
		}
		beo.sendToUI("dsp-programs", "allPrograms", {programs: programs, activePrograms: active, dspUpgrade: dspUpgrade});
		beo.sendToUI("dsp-programs", "settings", settings);
	}
	
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
				setTimeout(function() {
					getXML(function(response) {
						// Reads the current program from the DSP.
						metadata = (response != null) ? parseDSPMetadata(response).metadata : null;
						
						if (metadata) {
							if (!metadataFromDSP && !startup) {
								// Metadata was not received from DSP at startup, but is now (possibly because this is a fresh setup). This should be used to trigger reconfiguration of sources in HiFiBerryOS.
								if (beo.setup) {
									reconfigurePostSetup = true;
									if (beo.extensions.setup && beo.extensions.setup.requestPostSetup) {
										beo.extensions.setup.requestPostSetup("dsp-programs");
									}
								} else {
									if (debug) console.log("Running HiFiBerry reconfigure script.");
									beo.sendToUI("dsp-programs", {header: "configuringSystem"});
									configureProcess = spawn("/opt/hifiberry/bin/reconfigure-players", {detached: true, stdio: "ignore"});
									configureProcess.unref();
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
								dspPrograms[program].active = false;
								if (dspPrograms[program].checksum == currentChecksum) {
									programMatch = program;
									dspPrograms[program].active = true;
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
				}, 500); // Delay getting XML.
				
			});
		}
	}
	
	function getXML(callback) {
		exec("dsptoolkit get-xml", {maxBuffer: 256000}, function(error, stdout, stderr,) {
			if (stdout && stdout.length > 10) {
				if (callback) callback(stdout);
			} else {
				if (callback) callback(null); 
			}
		});
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
		if (currentMetadata) {
			version = (currentMetadata.profileVersion) ? currentMetadata.profileVersion.value[0] : null;
		} else {
			version = null;
		}
		name = getProgramName(currentMetadata);
		return {name: name, version: version, metadataFromDSP: metadataFromDSP};
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
						settings.autoUpgradedTo = id;
						beo.saveSettings("dsp-programs", settings);
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
					
					if (settings.autoInstall) {
						delete settings.autoInstall;
						beo.saveSettings("dsp-programs", settings);
						if (extensions.sound && extensions.sound.checkCurrentMixerAndReconfigure) extensions.sound.checkCurrentMixerAndReconfigure();
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
						beo.bus.emit("daisy-chain", {header: "disableDaisyChaining", content: {reason: "dspInstalled"}});
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
	
	function storeAdjustments(callback) {
		beo.sendToUI("dsp-programs", {header: "storeAdjustments", content: {status: "storing"}});
		if (debug) console.log("Storing sound adjustments in DSP EEPROM...");
		beoDSP.storeAdjustments(function(success, error) {
			if (success) {
				beo.sendToUI("dsp-programs", {header: "storeAdjustments", content: {status: "finish"}});
				if (debug) console.log("Sound adjustments stored in EEPROM.");
			} else {
				if (error) {
					console.error("Storing sound adjustments failed, error:", error);
				} else {
					console.error("Storing sound adjustments failed, reason unknown.");
				}
				beo.sendToUI("dsp-programs", {header: "storeAdjustments", content: {status: "fail"}});
			}
			if (callback) callback(success);
		});
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
			device = (metadata.metadata.modelName) ? metadata.metadata.modelName.value[0] : null;
			dspPrograms[id] = {name: name, path: path, metadata: metadata.metadata, checksum: checksum, version: version, filename: id+".xml", device: device, readOnly: readOnly};
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
						if (dspPrograms[program].metadata.profileVersion && currentMetadata.metadata &&
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
				if (!settings.autoUpgradedTo || settings.autoUpgradedTo != match) {
					if (debug) console.log("An upgrade to the current DSP program is on file.");
					dspUpgrade = match;
				}
			} else {
				return match;
			}
		} else {
			return false;
		}
	}
	
	function checkIfShouldAutoInstall() {
		if (settings.autoInstall) {
			if (dspPrograms[settings.autoInstall] &&
			 	!dspPrograms[settings.autoInstall].active) {
				// Check that this program exists and that it isn't the active one.
				return settings.autoInstall;
			} else {
				delete settings.autoInstall;
				beo.saveSettings("dsp-programs", settings);
				return false;
			}
		} else {
			return false;
		}
	}
	
	function setAutoInstallProgram(program) {
		if (!program) {
			// Current program.
			for (prog in dspPrograms) {
				if (dspPrograms[prog].active) {
					settings.autoInstall = prog;
					beo.saveSettings("dsp-programs", settings);
					break;
				}
			}
		} else {
			if (dspPrograms[program]) {
				settings.autoInstall = program;
				beo.saveSettings("dsp-programs", settings);
			}
		}
	}
	
	function amplifierMute(mute) {
		if (!settings.noGPIOMute) {
			try {
				pigpioRunning = !isNaN(execSync("pigs t", {encoding: "utf8"}).trim());
			} catch (error) {
				console.error("PiGPIO is not running.");
				pigpioRunning = false;
			}
			if (pigpioRunning) {
				if (mute) {
					
					try {
						//execSync("gpio mode 2 out");
						//execSync("gpio write 2 1");
						execSync("pigs m 27 w w 27 1");
						if (debug) console.log("Muted amplifier through GPIO.");
						beo.bus.emit("dsp", {header: "amplifierMuted"});
					} catch (error) {
						console.error("Could not mute amplifier:", error);
					}
				} else {
					try {
						//execSync("gpio write 2 0");
						//execSync("gpio mode 2 in");
						execSync("pigs w 27 0 m 27 r");
						if (debug) console.log("Unmuted amplifier through GPIO.");
					} catch (error) {
						console.error("Could not unmute amplifier:", error);
					}
					beo.bus.emit("dsp", {header: "amplifierUnmuted"});
				}
			}
		} else if (!mute) {
			beo.bus.emit("dsp", {header: "amplifierUnmuted"});
		}
	}
	
	
	

	function configure(options, relaunch, callback) {
		readConfiguration();
		if (Object.keys(configuration).length != 0) {
			if (typeof options == "object" && !Array.isArray(options)) {
				options = [options];
			}
			for (var i = 0; i < options.length; i++) {
				if (options[i].section && options[i].option) {
					if (!configuration[options[i].section]) configuration[options[i].section] = {};
					if (options[i].value) {
						if (debug) console.log("Configuring SigmaTCPServer (setting "+options[i].option+" in "+options[i].section+")...")
						configuration[options[i].section][options[i].option] = {value: options[i].value, comment: false};
					} else {
						if (configuration[options[i].section][options[i].option]) {
							if (options[i].remove) {
								if (debug) console.log("Configuring SigmaTCPServer (removing "+options[i].option+" in "+options[i].section+")...")
								delete configuration[options[i].section][options[i].option];
							} else {
								if (debug) console.log("Configuring SigmaTCPServer (commenting out "+options[i].option+" in "+options[i].section+")...")
								configuration[options[i].section][options[i].option].comment = true;
							}
						}
					}
				}
			}
			writeConfiguration();
			if (relaunch) {
				beo.sendToUI("dsp-programs", {header: "configuringSigmaTCP", content: {status: "start"}});
				exec("systemctl restart sigmatcp.service", function(error, stdout, stderr) {
					if (error) {
						if (debug) console.error("Relaunching SigmaTCPServer failed: "+error);
						if (callback) callback(false, error);
					} else {
						if (debug) console.error("SigmaTCPServer was relaunched.");
						if (callback) callback(true);
					}
					beo.sendToUI("dsp-programs", {header: "configuringSigmaTCP", content: {status: "finish"}});
				});
			} else {
				if (callback) callback(true);
			}
		} else {
			if (callback) callback(false);
		}
	}
	
	configModified = 0;
	function readConfiguration() {
		if (fs.existsSync("/etc/sigmatcp.conf")) {
			modified = fs.statSync("/etc/sigmatcp.conf").mtimeMs;
			if (modified != configModified) {
				// Reads configuration into a JavaScript object for easy access.
				configModified = modified;
				config = fs.readFileSync("/etc/sigmatcp.conf", "utf8").split('\n');
				section = null;
				for (var i = 0; i < config.length; i++) {
					// Find settings sections.
					if (config[i].indexOf("[") != -1 && config[i].indexOf("]") != -1) {
						section = config[i].trim().slice(1, -1);
						configuration[section] = {};
					} else {
						if (section != null) {
							line = config[i].trim();
							comment = (line.charAt(0) == "#") ? true : false;
							if (comment) {
								lineItems = line.slice(1).split("=");
							} else {
								lineItems = line.split("=");
							}
							if (lineItems.length == 2) {
								value = lineItems[1].trim();
								configuration[section][lineItems[0].trim()] = {value: value, comment: comment};
							}
						}
					}
				}
			}
			return configuration;
		}
	}
	
	function writeConfiguration() {
		// Saves current configuration back into the file.
		if (fs.existsSync("/etc/sigmatcp.conf")) {
			config = [];
			for (section in configuration) {
				sectionStart = (config.length != 0) ? "\n["+section+"]" : "["+section+"]";
				config.push(sectionStart);
				for (option in configuration[section]) {
					if (configuration[section][option].comment) {
						line = "#"+option+" = "+configuration[section][option].value;
					} else {
						line = option+" = "+configuration[section][option].value;
					}
					config.push(line);
				}
			}
			fs.writeFileSync("/etc/sigmatcp.conf", config.join("\n"));
			configModified = fs.statSync("/etc/sigmatcp.conf").mtimeMs;
		}
	}
	

	
module.exports = {
	getCurrentProgramInfo: getCurrentProgramInfo,
	installDSPProgram: installDSPProgram,
	setAutoInstallProgram: setAutoInstallProgram,
	storeAdjustments: storeAdjustments,
	version: version,
	getSigmaTCPSettings: readConfiguration,
	configureSigmaTCP: configure
};

