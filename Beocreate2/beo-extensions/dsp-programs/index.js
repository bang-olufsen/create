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
var fs = require('fs');
var _ = require('underscore');
Gpio = null;
//const Gpio = require('onoff').Gpio;
if (Gpio) {
	const mutePin = new Gpio(2, 'out');
}

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	
	var currentMetadata = {};
	var currentChecksum = null;
	
	var version = require("./package.json").version;
	
	var dspPrograms = {};
	
	var dspDirectory = systemDirectory+"/../beo-dsp-programs"; // DSP program directory sits next to the system directory.
	
	if (!fs.existsSync(dspDirectory)) fs.mkdirSync(dspDirectory);
	
	beoBus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			readAllDSPPrograms();
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "dsp-programs") {
				
				name = getProgramName(currentMetadata);
				beoBus.emit("ui", {target: "dsp-programs", header: "showCurrent", content: {name: name}});
				
				programs = {};
				active = 0;
				for (program in dspPrograms) {
					programs[program] = {name: dspPrograms[program].name, checksum: dspPrograms[program].checksum}
					if (programs[program].checksum == currentChecksum) {
						active++;
						programs[program].active = true;
					} else {
						programs[program].active = false;
					}
				}
				beoBus.emit("ui", {target: "dsp-programs", header: "allPrograms", content: {programs: programs, activePrograms: active}});
			}
		}
	});
	
	beoBus.on('dsp', function(event) {
		
		if (event.header == "connected") {
			
			if (event.content == true) {
				
				getCurrentChecksumAndMetadata(function(metadata) {
					currentMetadata = metadata;
					
					if (metadata) {
						if (debug == 2) {
							console.dir(metadata);
						} else if (debug) {
							console.log("Received metadata from DSP.");
						}
						beoBus.emit('dsp', {header: "metadata", content: {metadata: metadata}});
					} else {
						if (debug) console.log("No metadata found for current DSP program.");
					}
					
				});
			
			}
			
		}
	});
	
	beoBus.on('dsp-programs', function(event) {
		
		if (event.header == "getProgramPreview") {
			
			if (event.content.program) {
				metadata = dspPrograms[event.content.program].metadata;
				current = false;
				name = dspPrograms[event.content.program].name;
				if (metadata.profileVersion) {
					version = metadata.profileVersion.value[0];
				} else {
					version = null;
				}
				id = event.content.program;
			} else {
				metadata = currentMetadata;
				current = true;
				name = getProgramName(metadata);
				if (metadata.profileVersion) {
					version = metadata.profileVersion.value[0];
				} else {
					version = null;
				}
				id = null;
			}
			beoBus.emit("ui", {target: "dsp-programs", header: "programPreview", content: {id: id, metadata: metadata, name: name, version: version, current: current}});
			
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
			beoBus.emit("ui", {target: "dsp-programs", header: "loadingMetadata"});
			getCurrentChecksumAndMetadata(function(metadata) {
				currentMetadata = metadata;
				
				if (metadata) {
					if (debug == 2) {
						console.dir(metadata);
					} else if (debug) {
						console.log("Received metadata from DSP.");
					}
					beoBus.emit('dsp', {header: "metadata", content: {metadata: metadata}});
				} else {
					if (debug) console.log("No metadata found for current DSP program.");
				}
				beoBus.emit("ui", {target: "dsp-programs", header: "metadataLoaded"});
				
			});
		}
		
		if (event.header == "gpioMuteTest" && Gpio) {
			if (event.content.mute) {
				mutePin.writeSync(true);
			} else {
				mutePin.writeSync(false);
			}
		}
	});
	
	function getCurrentChecksumAndMetadata(callback) {
		if (callback) {
			beoDSP.getChecksum(function(checksum) {
				if (debug) console.log("DSP checksum is: "+checksum+".");
				currentChecksum = checksum;
				beoDSP.getXML(function(response) {
					// Reads the current program from the DSP.
					metadata = parseDSPMetadata(response);
					
					if (metadata) {
						callback(metadata);
					} else {
						// If no metadata was received from the DSP, check if any of the stored programs contains the same checksum and use that metadata.
						for (program in dspPrograms) {
							if (dspPrograms[program].checksum == currentChecksum) {
								callback(dspPrograms[program].metadata);
								break;
							}
							callback(null);
						}
					}
				});
			});
			
		}
	}
	
	function parseDSPMetadata(xml) {
		// Get the DSP metadata from the XML as a JavaScript object.
		metadataXML = '<beometa>' + xml.split("</beometa>")[0].split("<beometa>")[1] + "</beometa>";
		beoMeta = {};
		rawMetadata = xmlJS.xml2js(metadataXML, {compact: true}).beometa.metadata;
		if (rawMetadata) {
			for (var i = 0; i < rawMetadata.length; i++) {
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
		} else {
			beoMeta = null;
		}
		return beoMeta;
	}
	
	function getProgramName(metadata, filename) {
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
			} else if (filename) {
				// File name...
				name = filename.slice(0, -4);
			} else {
				name = null;
			}
		} else {
			if (filename) {
				name = filename.slice(0, -4);
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
	
	function getCurrentProgramName() {
		return getProgramName(currentMetadata);
	}
	
	
	function installDSPProgram(program, callback) {
		// This function is exposed to the outside.
		beoBus.emit("now-playing", {header: "transport", content: {action: "stop"}}); // Stop music playback if possible.
		installAndCheckDSPProgram(program, function(result) {
			// The function will independently send status updates to UI.
				getCurrentChecksumAndMetadata(function(metadata) {
					currentMetadata = metadata;
					
					if (metadata) {
						if (debug == 2) {
							console.dir(metadata);
						} else if (debug) {
							console.log("Received metadata from DSP.");
						}
						beoBus.emit('dsp', {header: "metadata", content: {metadata: metadata}});
					} else {
						if (debug) console.log("No metadata found for current DSP program.");
					}
					
					name = getProgramName(currentMetadata);
					beoBus.emit("ui", {target: "dsp-programs", header: "showCurrent", content: {name: name}});
					
					if (callback) {
						if (result == true) {
							callback(true);
						} else {
							callback(result);
						}
					}
					
				});
		});
	}
	
	
	function installAndCheckDSPProgram(reference, callback) {
		path = dspDirectory+"/"+dspPrograms[reference].filename;
		if (dspPrograms[reference] && fs.existsSync(path)) {
			beoBus.emit("ui", {target: "dsp-programs", header: "flashEEPROM", content: {status: "flashing"}});
			if (debug) console.log("Flashing DSP program '"+reference+"'...");
			beoDSP.flashEEPROM(path, function(result, error) {
				if (!error) {
					if (result == true) {
						// Flashing complete, run EEPROM check.
						beoBus.emit("ui", {target: "dsp-programs", header: "checkEEPROM", content: {status: "checking"}});
						if (debug) console.log("Program write complete, checking EEPROM...");
						beoDSP.checkEEPROM(function(matches) {
							if (matches) {
								callback(true);
								beoBus.emit("ui", {target: "dsp-programs", header: "checkEEPROM", content: {status: "success"}});
								if (debug) console.log("Memory contents match with installed program.");
							} else {
								callback(false);
								if (debug) console.log("Memory contents did not match with installed program.");
								beoBus.emit("ui", {target: "dsp-programs", header: "checkEEPROM", content: {status: "fail"}});
							}
						});
					} else {
						callback(500);
						if (debug) console.log("Failed to write DSP program.");
						beoBus.emit("ui", {target: "dsp-programs", header: "flashEEPROM", content: {status: "fail"}});
					}
				} else {
					callback(500);
					if (debug) console.log("DSPToolkit error.");
					beoBus.emit("ui", {target: "dsp-programs", header: "flashEEPROM", content: {status: "fail"}});
				}
			});
		} else {
			if (debug) console.log("Specified DSP program '"+reference+"' was not found.");
			callback(404);
		}
		
	}
	
	function readAllDSPPrograms() {
		// Read all programs from the DSP program directory.
		dspFiles = fs.readdirSync(dspDirectory);
		for (var i = 0; i < dspFiles.length; i++) {
			if (!dspPrograms[dspFiles[i].slice(0, -4)] && dspFiles[i].slice(-4) == ".xml") {
				readDSPProgramFromFile(dspFiles[i], function(filename, name, checksum, meta) {
					dspPrograms[filename.slice(0, -4)] = {name: name, metadata: meta, checksum: checksum, filename: filename};
				});
			}
		}
	}
	
	function readDSPProgramFromFile(filename, callback) {
		if (callback) {
			stream = fs.createReadStream(dspDirectory+"/"+filename, { start: 1, end: 6000 });
			
			stream.on("data", function(chunk) {
				snippet = chunk.toString();
				metadata = parseDSPMetadata(snippet);
				name = getProgramName(metadata, filename);
				checksum = getChecksumFromMetadata(metadata);
				callback(filename, name, checksum, metadata);
			});
		}
	}

	
	return {
		getCurrentProgramName: getCurrentProgramName,
		installDSPProgram: installDSPProgram,
		version: version
	};
};

