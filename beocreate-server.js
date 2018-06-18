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

// BEOCREATE SERVER
// Server-side Component of the Setup Utility for Project Re:Create
// (c) 2018 Bang & Olufsen A/S

// Node.js
// This is intended to be run on the sound system itself.

// RELEASE VERSION
// Used to determine if software updates need to be installed. *TO DO*
var releaseVersion = 4;

// DEPENDENCIES
var communicator = require("./beocreate_essentials/communication");
var beoDSP = require("./beocreate_essentials/dsp");
var piSystem = require("./beocreate_essentials/pi_system_tools");
var wifi = require("./beocreate_essentials/wifi_setup");
var beoSources = require("./beocreate_essentials/sources");
var Sound = require("aplay");
var fs = require('fs');
var xmlStream = require('xml-stream'); // for parsing DSP XMLs
var http = require('http');
var removeDiacritics = require('diacritics').remove;

var beoCom = communicator();



// CONFIGURATION FILE R/W
var beoConfigFile = "/home/pi/beoconfig.json"; // 
var dspDownloadLocation = "/home/pi/dsp/";

if (fs.existsSync(beoConfigFile)) {
    // If the configuration file exists, read it.
    var beoconfig = JSON.parse( // Read configuration file.
		fs.readFileSync(beoConfigFile)
	);
} else {
	// If not, create the default configuration.
	var beoconfig = {
	  "setup": {
	    "productName": null,
	    "modelName": null,
	    "hostname": null,
	    "profile": null,
		"flashed": false,
	    "step": 0,
	    "wifiMode": "autoHotspot",
	    "ssh": true,
	    "voicePrompts": true
	  },
		"volumeLimit": {
			"value": 100,
			"register": null
		},
		"chSelect": {
			"value": "stereo",
			"register": null
		},
		"balance": {
			"value": 0,
			"register": null
		},
		"crossoverBands": 1,
		"sources": ["optical", "bluetooth"]
	};
	saveConfiguration();
}


function saveConfiguration() { // Save configuration file.
	fs.writeFileSync(beoConfigFile, JSON.stringify(beoconfig));
}

var configSaveTimeout = null;
function saveConfigurationWithDelay() {
	clearTimeout(configSaveTimeout);
	configSaveTimeout = setTimeout(function() {
		saveConfiguration();
	}, 2000);
}

var productName = "BeoCreate 4-Channel Amplifier";

var setupStep = beoconfig.setup.step;
var soundProfile = beoconfig.setup.profile;
if (beoconfig.setup.productName) productName = beoconfig.setup.productName;
var hostname = beoconfig.setup.hostname;
var flashed = beoconfig.setup.flashed;
var sourceList = beoconfig.sources;

beoCom.start({name: productName}); // Opens the server up for remotes to connect.

//beoDSP.readDictionary(dspParameterFile); // Reads the DSP parameter addresses into memory.
//setTimeout(function() {
beoDSP.connectDSP(function(success) {  
	if (success) {
		for (var i = 0; i < 3; i++) {
			// Before the phantom write issue is fixed in the Sigma DSP Daemon, this will read from a register three times to get past them.
			beoDSP.readDSP(16, function(response) { 
			
			}, true);
		}
		dsp({operation: "setVolumeLimit", limit: beoconfig.volumeLimit.value});	
		dsp({operation: "setChSelect", ch: beoconfig.chSelect.value});
	}
}); // Opens a link with the SigmaDSP daemon.
//}, 2000);

wifi.initialise(beoconfig.setup.wifiMode); // Set Wi-Fi to autohotspot, if Wi-Fi is available.

speakIPTimeout = null;
speakIPTimeout = setTimeout(function() {
	if (beoconfig.setup.connectedWith != undefined && beoconfig.setup.connectedWith != null) {
		if (beoconfig.setup.connectedWith == "hostname" || beoconfig.setup.connectedWith == "blank") {
			beoconfig.setup.voicePrompts = false;
		}
		delete beoconfig.setup.connectedWith;
		saveConfiguration();
	}
	if (beoconfig.setup.voicePrompts == true) {
		if (beoconfig.step == 0) {
			speakIP('repeat');
		} else {
			speakIP();
		}
	}
}, 10000);

// COMMUNICATION WITH CLIENTS

beoCom.on("open", function(ID, protocol) {  
	console.log('Connection '+ID+' opened with protocol '+protocol);
	clearTimeout(speakIPTimeout);
});

beoCom.on("data", function(data, connection){
	// Determine what kind of data was received and send it on for further processing.
	switch (data.header) {
		case "dsp":
			dsp(data.content);
			break;
		case "wifi":
			wifiFunctions(data.content);
			break;
		case "setup":
			manageSetup(data.content);
			break;
		case "voicePrompts":
			manageVoicePrompts(data.content);
			break;
		case "handshake":
			handshake(data.content);
			break;
		case "sources":
			manageSources(data.content);
			break;
		case "soundProfile":
			manageSoundProfile(data.content);
			break;
	}
});

function handshake(content) {
	if (content.operation == "doHandshake") {
		if (setupStep != null) {
			beoCom.send({header: "setup", content: {status: setupStep, wifiMode: wifi.mode(), hostname: beoconfig.setup.hostname}});
		} else {
			if (beoconfig.volumeLimit.register != null) {
				volLimit = beoconfig.volumeLimit.value;
			} else {
				volLimit = null;
			}
			if (beoconfig.chSelect.register != null) {
				chSelect = beoconfig.chSelect.value;
			} else {
				chSelect = null;
			}
			if (beoconfig.balance.register != null) {
				balance = beoconfig.balance.value;
			} else {
				balance = null;
			}
			beoCom.send({header: "handshake", content: {name: productName, model: soundProfile, modelName: beoconfig.setup.modelName, hostname: beoconfig.setup.hostname, flashed: flashed, volumeLimit: volLimit, chSelect: chSelect, balance: balance, crossoverBands: beoconfig.crossoverBands, wifiMode: wifi.mode()}});
		}
		if (content.connectedWith == "hostname" || content.connectedWith == "blank") {
			beoconfig.setup.voicePrompts = false;
		}
	}
}


function manageSetup(content) {
	switch (content.operation) {
		case "getStatus":
			beoCom.send({header: "setup", content: {status: setupStep}});
			break;
		case "requestStep":
			setupStep = content.step;
			switch (content.step) {
				case 0:
					beoCom.send({header: "setup", content: {allowStep: 1}});
					break;
				case 1:
					wifi.listAvailable(function(availableNetworks) {  
						beoCom.send({header: "wifi", content: {type: "available", networks: availableNetworks}});
					});
					wifi.listSaved(function(savedNetworks, error) {  
						beoCom.send({header: "wifi", content: {type: "saved", networks: savedNetworks}});
					});
					break;
			}
			break;
		case "setName":
		case "systemName":
			productName = content.name;
			hostname = removeDiacritics(productName);
			beoconfig.setup.hostname = hostname;
			beoconfig.setup.productName = productName;
			saveConfiguration();
			beoCom.send({header: "systemName", content: {name: productName, hostname: hostname, model: soundProfile}});
			if (content.doAutomatedSetup) {
				doAutomatedSetup(1);
			}
			if (content.restartNow) {
				beoSources.configureSource(beoconfig.sources, {productName: productName}, function(success) {
					piSystem.setHostname(hostname, productName, function(success) {
						if (success == true) { 
							console.log("Succesfully set hostname.");
							piSystem.power("reboot");
						} else {
							console.log("Error setting hostname.");	
						}
					});
				
				});
			}
			break;
		case "ssh":
			if (content.type == "get") {
				piSystem.ssh(null, function(mode) {  
					beoCom.send({header: "ssh", content: {enabled: beoconfig.setup.ssh}});
				});
			}
			if (content.type == "enable") {
				piSystem.ssh(true, function(mode) {  
					beoconfig.setup.ssh = true;
					saveConfiguration();
					beoCom.send({header: "ssh", content: {enabled: mode}});
				});
			}
			if (content.type == "disable") {
				piSystem.ssh(false, function(mode) {  
					beoconfig.setup.ssh = false;
					saveConfiguration();
					beoCom.send({header: "ssh", content: {enabled: mode}});
				});
			}
			break;
		case "doAutomated":
			
			break;
	}
}


function manageVoicePrompts(content) {
	if (content.operation == "toggle") {
		if (beoconfig.setup.voicePrompts == true) {
			beoconfig.setup.voicePrompts = false;
		} else {
			beoconfig.setup.voicePrompts = true;
		}
		saveConfigurationWithDelay();
		beoCom.send({header: "voicePrompts", content: {voicePrompts: beoconfig.setup.voicePrompts}});
	}
}


function manageSources(content) {
	switch (content.operation) {
		case "install":
			beoCom.send({header: "sources", content: {message: "installing", source: content.source}});
			beoSources.installSource(content.source, function(response) {
				if (response == true) { 
					beoCom.send({header: "sources", content: {message: true, source: content.source}});
					if (sourceList.indexOf(content.source) == -1) {
						sourceList.push(content.source);
						beoconfig.sources = sourceList;
						saveConfiguration();
					}
					if (content.restartNow) {
						piSystem.power("reboot");
					}
				}
				if (response == -1) {
					beoCom.send({header: "sources", content: {message: -1}});
				}
			});
			break;
		case "list":
			raspotifyIndex = sourceList.indexOf("raspotify");
			if (raspotifyIndex != -1) {
				sourceList[raspotifyIndex] = "spotifyd";
				beoconfig.sources = sourceList;
				saveConfiguration();
			}
			beoCom.send({header: "sources", content: {sources: sourceList}});
			break;
	}
}

//var automatedSetupStep = 0;
function doAutomatedSetup(step) {
	switch (step) {
		case 1:
			if (wifi.mode()) {
				wifi.mode("normal", function(mode) {
					if (mode == "normal") { 
						console.log("Succesfully set Wi-Fi to normal mode.");
						doAutomatedSetup(2);
					} else {
						console.log("Error setting Wi-Fi to normal mode.");	
					}
				});
			} else {
				console.log("No Wi-Fi, skipping to next step.");	
				doAutomatedSetup(2);
			}
			break;
		case 2:
			beoCom.send({header: "bottomProgress", content: "Renaming system..."});
			piSystem.setHostname(hostname, productName, function(success) {
				if (success == true) { 
					console.log("Succesfully set hostname.");
					doAutomatedSetup(3);
				} else {
					console.log("Error setting hostname.");	
				}
			});
			break;
		case 3:
			/*piSystem.setSPI(true, function(success) {
				if (success == true) { 
					console.log("Succesfully enabled SPI bus.");
					doAutomatedSetup(4);
				} else {
					console.log("Error enabling SPI bus.");	
					doAutomatedSetup(7);
				}
			});*/
				doAutomatedSetup(4);
			break;
		case 4:
			wifi.waitForNetwork(function(connected) {
				if (connected == true) { 
					console.log("Network connection detected.");
					doAutomatedSetup(4.5);
				} else {
					console.log("Network connection not detected, switching back to hotspot.");
					if (wifi.mode()) {	
						wifi.mode("hotspot", function(mode) {
							if (mode == "hotspot") { 
								console.log("Succesfully set Wi-Fi to hotspot mode.");
							} else {
								console.log("Error setting Wi-Fi to hotspot mode.");	
							}
						});
					}
				}
			});
			break;
		case 4.5:
			/*beoCom.send({header: "bottomProgress", content: "Installing BT audio..."});
			beoSources.installSource("bluetooth", function(response) {
				if (response == true) { 
					console.log("Bluetooth audio receiver installed.");*/
					if (sourceList.indexOf("bluetooth") == -1) {
						sourceList.push("bluetooth");
						beoconfig.sources = sourceList;
						saveConfiguration();
					}
					doAutomatedSetup(5);
					/*} else {
					console.log("Error installing Bluetooth audio.");
					doAutomatedSetup(5);
				}
			});*/
			break;
		case 5:
			
			/*soundProfile = tempSoundProfile;
			beoconfig.setup.profile = soundProfile;
			if (beoconfig.way == 3 && beoConfig.chSelect.value == "stereo") {
				beoconfig.chSelect.value = "mono";
			}
			saveConfiguration();
			shouldFlashSoundProfile = false;
			downloadSoundProfile(soundProfile, profileBasePath, function(error) {
				if (!error) { 
					console.log("Succesfully downloaded sound profile.");
					doAutomatedSetup(6);
				} else {
					console.log("Error downloading sound profile.");	
					doAutomatedSetup(7);
				}
			});*/
			beoCom.send({header: "bottomProgress", content: "Inst. sound profile..."});
			flashSoundProfileWithName(1, tempSoundProfile, function(response) {
				if (response == true) {
					doAutomatedSetup(7);
				} else {
					console.log("Error flashing the DSP.");
					beoCom.send({header: "plaintext", content: "Couldn't flash DSP."});
					doAutomatedSetup(7);
				}
			});
			break;
		case 6:
			beoDSP.flashEEPROM(dspDownloadLocation+soundProfile+".xml", function(response) {
				if (response == 1) { 
					console.log("Succesfully flashed the DSP.");
					beoconfig.setup.flashed = true;
					saveConfiguration();
					doAutomatedSetup(7);
				} else {
					console.log("Error flashing the DSP.");
					doAutomatedSetup(7);
				}
			});
			break;
		case 7:
			piSystem.expandFilesystem(function(response) {
				if (response == true) { 
					console.log("File system was expanded");
					doAutomatedSetup(8);
				} else {
					console.log("File system already expanded.");
					doAutomatedSetup(8);
				}
			});
			break;
		case 8:
			beoconfig.setup.step = null; // Flag setup as completed
			saveConfiguration();
			beoCom.send({header: "bottomProgress", content: "Restarting..."});
			piSystem.power("reboot");
			break;
	}
	// Turn off hotspot to connect to the internet
	
	// Set hostname.
	
	// Enable SPI bus.
	
	// Wait for a network connection. If no connection is detected after 30 seconds, turn hotspot back on and cancel the rest of the setup.
	
	// Download and flash the sound profile.
	
	// Expand filesystem and reboot.
}

var profileBasePath = "";
var tempSoundProfile = "";
var tempMetadata = {};
var shouldFlashSoundProfile = false;
function manageSoundProfile(content) {
	if (content.operation == "selectModel") {
		tempSoundProfile = content.fileName;
		profileBasePath = content.basePath;
		if (tempSoundProfile != soundProfile) {
			shouldFlashSoundProfile = true;
		}
		beoCom.send({header: "setup", content: {allowStep: 3}});
		if (content.flashNow) {
			flashSoundProfileWithName(1, tempSoundProfile);
		}
	}
	if (content.operation == "flashProfile") {
		if (shouldFlashSoundProfile) {
			shouldFlashSoundProfile = false;
			flashSoundProfileWithName(1, tempSoundProfile);
		}
	}
	if (content.operation == "enableCustom") {
		beoconfig.volumeLimit.register = null;
		beoconfig.chSelect.register = null;
		beoconfig.balance.register = null;
		beoconfig.crossoverBands = null;
		beoCom.send({header: "soundProfile", content: {message: "custom"}});
		saveConfiguration();
	}
}

function flashSoundProfileWithName(stage, fileName, callback) {
	switch (stage) {
		case 1:
			if (!callback) callback = null;
			beoCom.send({header: "soundProfile", content: {message: "downloading"}});
			downloadSoundProfile(fileName, profileBasePath, function(error) {
				if (!error) { 
					console.log("Succesfully downloaded sound profile.");
					tempMetadata = {};
					getBeoMetadata(dspDownloadLocation+fileName+".xml", function(metadata) {
						tempMetadata = metadata;
						//beoCom.send({header: "plainJSON", content: JSON.stringify(metadata)});
						flashSoundProfileWithName(2, fileName, callback);
					});
					//
				} else {
					beoCom.send({header: "soundProfile", content: {message: "downloadError"}});
					console.log("Error downloading sound profile.");	
				}
			});
			break;
		case 2:
			beoCom.send({header: "soundProfile", content: {message: "flashing"}});
			beoDSP.flashEEPROM(dspDownloadLocation+fileName+".xml", function(response) {
				if (response == 1) { 
					soundProfile = tempSoundProfile;
					beoconfig.setup.profile = soundProfile;
					beoconfig.volumeLimit.register = tempMetadata.volumeControlRegister;
					beoconfig.chSelect.register = tempMetadata.channelSelectRegister;
					beoconfig.balance.register = tempMetadata.balanceRegister;
					beoconfig.crossoverBands = tempMetadata.crossoverBands;
					beoconfig.setup.modelName = tempMetadata.modelName;
					if (beoconfig.crossoverBands == 3 && beoconfig.chSelect.value == "stereo") {
						beoconfig.chSelect.value = "mono";
					}
					setTimeout(function() {
						dsp({operation: "setVolumeLimit", limit: beoconfig.volumeLimit.value});
						dsp({operation: "setChSelect", ch: beoconfig.chSelect.value});	
					}, 1000);
					console.log("Succesfully flashed the DSP.");
					beoconfig.setup.flashed = true;
					saveConfiguration();
					beoCom.send({header: "soundProfile", content: {message: "done", newModel: soundProfile}});
					if (callback) callback(true);
				} else {
					console.log("Error flashing the DSP.");
					beoCom.send({header: "soundProfile", content: {message: "flashError"}});
					if (callback) callback(false);
				}
			});
			break;
		}
}

function dsp(content) {
	switch (content.operation) {
		case "setVolumeLimit":
			beoconfig.volumeLimit.value = content.limit;
			saveConfigurationWithDelay();
			dspValue = content.limit/100; // Gain range is 0-1.
			if (beoconfig.volumeLimit.register) {
				beoDSP.writeDSP(beoconfig.volumeLimit.register, dspValue, true, true);
			}
			break;
		case "setChSelect":
			beoconfig.chSelect.value = content.ch;
			saveConfigurationWithDelay();
			if (content.ch == "stereo") dspValue = 0;
			if (content.ch == "left") dspValue = 2;
			if (content.ch == "right") dspValue = 4;
			if (content.ch == "mono") dspValue = 6;
			
			if (beoconfig.chSelect.register) {
				beoDSP.writeDSP(beoconfig.chSelect.register, dspValue, false, true);
			}
			break;
		case "enable":
			beoDSP.writeDSP(content.target, content.enable, true, true);
			break;
		case "flash":
			beoDSP.flashEEPROM(content.file);
			break;
		case "read":
			beoDSP.readDSP(content.target, function(response) { 
				if (content.type == "dec") {
					beoCom.send({header: "plaintext", content: ('Read '+response.dec+' from '+content.target+' ('+response.addr+')')});
				} else {
					beoCom.send({header: "plaintext", content: ('Read '+response.int+' from '+content.target+' ('+response.addr+')')});
				}
			}, true);
			break;
	}
}

function wifiFunctions(content) {
	switch (content.operation) {
		case "listSaved":
			wifi.listSaved(function(savedNetworks, error) {  
				beoCom.send({header: "wifi", content: {type: "saved", networks: savedNetworks}});
			});
			break;
		case "listAvailable":
			wifi.listAvailable(function(availableNetworks) {  
				beoCom.send({header: "wifi", content: {type: "available", networks: availableNetworks}});
			});
			break;
		case "add":
			wifi.addNetwork(content.options, function(theSSID, err) {  
				beoCom.send({header: "wifi", content: {type: "added", SSID: theSSID}});
			});
			break;
		case "remove":
			wifi.removeNetwork(content.ID, function(theID, err) {  
				beoCom.send({header: "wifi", content: {type: "removed", ID: theID, error: err}});
			});
		case "status":
			wifi.getStatus(function(status) {  
				beoCom.send({header: "wifi", content: {type: "status", status: status}});
			});
			break;
		case "setMode":
			wifi.mode(content.mode, function() {  
				beoCom.disconnectAll();
			});
			break;
		case "ip":
			wifi.getIP(function(ipAddress) {  
				beoCom.send({header: "wifi", content: {type: "ip", ip: ipAddress}});
			});
			break;
	}
}

var speech = new Sound();
var voiceFolder = "/home/pi/Music/voice/";
var speechQueue = [];
function speakIP(option) {
	
	speechQueue = [];
	// Get IP address
	wifi.getIP(function(ipAddress) {  
		
		// Fill speech playlist.
		speechQueue.push(500);
		speechQueue.push("ip-of-product");
		speechQueue.push(1000);
		
		ipQueue = [];
		for (var i = 0; i < ipAddress.length; i++) {
		  char = ipAddress.charAt(i);
		  if (char == ".") {
		  	ipQueue.push(500);
		  	ipQueue.push("dot");
		  	ipQueue.push(500);
		  } else {
			ipQueue.push(char);
		  }
		}
		
		speechQueue = speechQueue.concat(ipQueue);
		if (option && option == 'repeat') {
			speechQueue.push(1000);
			speechQueue.push("that-is");
			speechQueue.push(1000);
			speechQueue = speechQueue.concat(ipQueue);
		}
		
		// Play a tone and start speaking.
		speech.play("Music/change-source.wav");
	});
}

speech.on('complete', function() {
	if (speechQueue.length > 0) {
		speechQueue.shift();
		if (speechQueue[0] > 9) {
			// Treat the number as a timeout value to add a pause to the speech.
			speechPause = speechQueue[0];
			speechQueue.shift();
			setTimeout(function() {
				speech.play(voiceFolder+speechQueue[0]+".wav");
			}, speechPause);
		} else {
			speech.play(voiceFolder+speechQueue[0]+".wav");
		}
	}
});




// SOUND PROFILE DOWNLOAD
// Modified from https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries

function downloadSoundProfile(profileName, basePath, callback) {
  var file = fs.createWriteStream(dspDownloadLocation+profileName+".xml");
  var request = http.get(basePath+"/"+profileName+".xml", function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(callback);
    });
  }).on('error', function(err) { // Handle errors
  	//console.log(err)
    fs.unlink("/home/pi/dsp/"+profileName+".xml"); // Delete the file async. (But we don't check the result)
    if (callback) callback(err.message);
  });
};

// Adapted from https://codeforgeek.com/2014/10/parse-large-xml-files-node/
function getBeoMetadata(filePath, callback) {
	stream = fs.createReadStream(filePath);
	xml = new xmlStream(stream);
	xml.preserve('beometa', true);
	xml.collect('subitem');
	xml.on('endElement: beometa', function(data) {
	  //console.dir(item);
	  	dataItems = data.$children;
	  	// Parse the metadata
	  	modelName = null;
	  	modelID = null;
	  	volumeControlRegister = null;
	  	channelSelectRegister = null;
	  	balanceRegister = null;
	  	crossoverBands = null;
	  	for (var i = 0; i < dataItems.length; i++) {
	  		//console.log(typeof dataItems[i]);
			if (typeof dataItems[i] == "object") {
				//console.dir(dataItems[i]);
				if (dataItems[i].$.type) {
					switch (dataItems[i].$.type) {
						case "modelName":
							modelName = dataItems[i].$text;
							modelID = dataItems[i].$.modelID;
							break;
						case "volumeControlRegister":
							volumeControlRegister = parseInt(dataItems[i].$text);
							break;
						case "channelSelectRegister":
							channelSelectRegister = parseInt(dataItems[i].$text);
							break;
						case "balanceRegister":
							balanceRegister = parseInt(dataItems[i].$text);
							break;
						case "crossoverBands":
							crossoverBands = parseInt(dataItems[i].$text);
							break;
					}
				}
			}
	  	}
	  	metadata = {modelName: modelName, modelID: modelID, volumeControlRegister: volumeControlRegister, channelSelectRegister: channelSelectRegister, balanceRegister: balanceRegister, crossoverBands: crossoverBands};
	  	callback(metadata);
	});
}