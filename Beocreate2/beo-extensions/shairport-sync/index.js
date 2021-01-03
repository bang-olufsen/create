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

// SHAIRPORT-SYNC (AIRPLAY) INTEGRATION FOR BEOCREATE

var fs = require("fs");
var exec = require('child_process').exec;

var net = require("net");
var dnssd = require("dnssd2"); // for service discovery.
var fetch = require("node-fetch"); // for sending HTTP requests to the DACP server

	var debug = beo.debug;
	
	var version = require("./package.json").version;
	
	var shairportSyncVersion = null;
	var configuration = {};
	
	var shairportSyncEnabled = false;
	var sources = null;
	
	var airPlayAvailable = false;
	var airPlayMetadataStream = null;
	var airPlayMetadataPath = "/tmp/shairport-sync-metadata";
	
	var defaultSettings = {
		"syncVolume": false
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (beo.extensions.sources &&
				beo.extensions.sources.setSourceOptions &&
				beo.extensions.sources.sourceDeactivated) {
				sources = beo.extensions.sources;
			}
			
			if (sources) {
				getShairportSyncStatus(function(enabled) {
					sources.setSourceOptions("shairport-sync", {
						enabled: enabled,
						transportControls: true,
						usesHifiberryControl: true,
						aka: ["ShairportSync"],
						sortName: "AirPlay 1"
					});
				});
			}
			
			// Get version number.
			exec("shairport-sync -V", function(error, stdout, stderr) {
				if (stdout) {
					shairportSyncVersion = stdout;
				} else {
					if (debug) console.error("Error querying shairport-sync version: "+error);
				}
			});
			
			// Check if shairport-sync metadata is available (default location, unless otherwise specified).
			if (fs.existsSync(airPlayMetadataPath)) {
				airPlayAvailable = true;
			}
			
			if (airPlayAvailable) {
				streamMetadata();
				startDiscovery();
			}
		}
		
		if (event.header == "shutdown") {
			stopDiscovery();
			if (airPlayAvailable) {
				streamClosedForShutdown = true;
				airPlayMetadataStream.close();
				exec('echo null > /tmp/shairport-sync-metadata'); // Super dirty hack to get the metadata stream to close.
				beo.bus.emit("general", {header: "shutdownComplete", content: {extension: "shairport-sync"}});
			}
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "shairport-sync") {
				ssncVersion = (shairportSyncVersion) ? shairportSyncVersion.split("-")[0] : false;
				readShairportSyncConfiguration();
				ssncPassword = (configuration.general.password) ? true : false;
				
				beo.bus.emit("ui", {target: "shairport-sync", header: "configuration", content: {usesPassword: ssncPassword, version: ssncVersion, shairportSyncEnabled: shairportSyncEnabled}});
				
			}
		}
	});
	
	
	beo.bus.on('product-information', function(event) {
		
		if (event.header == "systemNameChanged") {
			// Listen to changes in system name and update the shairport-sync display name.
			if (event.content.systemName) {
				configureShairportSync("general", "name", event.content.systemName);
			}
			
		}
		
		
	});
	
	airPlayVolumeSendTimeout = null;
	beo.bus.on('sound', function(event) {
		
		if (event.header == "systemVolume" && 
			!isNaN(event.content.trueVolume &&
			event.content.fromSetVolume)) {
			if (settings.syncVolume) {
				clearTimeout(airPlayVolumeSendTimeout);
				airPlayVolumeSendTimeout = setTimeout(function() {
					airPlayVolume = convertAirPlayVolume(event.content.trueVolume, 1);
					sendDACPCommand("setproperty?dmcp.device-volume=" + airPlayVolume);
				}, 500);
			}
		}
		
		
	});
	
	beo.bus.on('shairport-sync', function(event) {
		
		if (event.header == "settings") {
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
		}
		
		if (event.header == "setPassword") {
			// If password field is set, change password. Otherwise remove it.
			if (event.content.password != false) {
				configureShairportSync("general", "password", event.content.password, true);
				beo.bus.emit("ui", {target: "shairport-sync", header: "usesPassword", content: {usesPassword: true}});
			} else {
				configureShairportSync("general", "password", null, true);
				beo.bus.emit("ui", {target: "shairport-sync", header: "usesPassword", content: {usesPassword: false}});
			}
			
		}
		
		if (event.header == "shairportSyncEnabled") {
			
			if (event.content.enabled != undefined) {
				setShairportSyncStatus(event.content.enabled, function(newStatus, error) {
					beo.bus.emit("ui", {target: "shairport-sync", header: "configuration", content: {shairportSyncEnabled: newStatus}});
					if (sources) sources.setSourceOptions("shairport-sync", {enabled: newStatus});
					if (newStatus == false) {
						if (sources) sources.sourceDeactivated("shairport-sync");
					}
					if (error) {
						beo.bus.emit("ui", {target: "shairportSync", header: "errorTogglingShairportSync", content: {}});
					}
				});
			}
		
		}
		
	
		
		
	});
	
	function getShairportSyncStatus(callback) {
		exec("systemctl is-active --quiet shairport-sync.service").on('exit', function(code) {
			if (code == 0) {
				shairportSyncEnabled = true;
				callback(true);
			} else {
				shairportSyncEnabled = false;
				callback(false);
			}
		});
	}
	
	function setShairportSyncStatus(enabled, callback) {
		if (enabled) {
			exec("systemctl enable --now shairport-sync.service").on('exit', function(code) {
				if (code == 0) {
					shairportSyncEnabled = true;
					if (debug) console.log("Shairport-sync enabled.");
					callback(true);
				} else {
					shairportSyncEnabled = false;
					callback(false, true);
				}
			});
		} else {
			exec("systemctl disable --now shairport-sync.service").on('exit', function(code) {
				shairportSyncEnabled = false;
				if (code == 0) {
					callback(false);
					if (debug) console.log("Shairport-sync disabled.");
				} else {
					callback(false, true);
				}
			});
		}
	}
	
		
	function configureShairportSync(section, option, value, relaunch) {
		readShairportSyncConfiguration();
		if (Object.keys(configuration).length != 0) {
			if (!configuration[section]) {
				configuration[section] = {};
			}
			if (value != undefined || value != null) {
				if (debug) console.log("Configuring shairport-sync (setting "+option+" in "+section+")...");
				configuration[section][option] = value;
			} else {
				if (debug) console.log("Configuring shairport-sync (removing "+option+" from "+section+")...");
				delete configuration[section][option];
			}
			writeShairportSyncConfiguration();
			if (relaunch && shairportSyncEnabled) {
				exec("systemctl restart shairport-sync.service", function(error, stdout, stderr) {
					if (error) {
						if (debug) console.error("Relaunching shairport-sync failed: "+error);
					} else {
						if (debug) console.error("Shairport-sync was relaunched.");
					}
				});
			}
		}
	}
	
	shairportSyncConfigModified = 0;
	function readShairportSyncConfiguration() {
		if (fs.existsSync("/etc/shairport-sync.conf")) {
			modified = fs.statSync("/etc/shairport-sync.conf").mtimeMs;
			if (modified != shairportSyncConfigModified) {
				// Reads shairport-sync configuration into a JavaScript object for easy access.
				shairportSyncConfig = fs.readFileSync("/etc/shairport-sync.conf", "utf8").split('\n');
				section = null;
				for (var i = 0; i < shairportSyncConfig.length; i++) {
					// Find settings sections.
					if ((shairportSyncConfig[i].indexOf(" =") != -1 && shairportSyncConfig[i+1].trim() == "{") || (shairportSyncConfig[i].indexOf(" =") != -1 && shairportSyncConfig[i].indexOf("{") != -1)) {
						section = shairportSyncConfig[i].split("=")[0].trim();
						configuration[section] = {};
					} else {
						line = shairportSyncConfig[i].trim();
						if (line == "}") section = null;
						if (section != null && line != "{") {
							lineItems = line.split("=");
							if (lineItems.length == 2) {
								value = lineItems[1].trim().slice(0, -1);
								if (value.charAt(0) == '"' && value.charAt(value.length-1) == '"') {
									value = value.slice(1, -1);
								} else {
									value = parseFloat(value);
								}
								configuration[section][lineItems[0].trim()] = value;
							}
						}
					}
				}
			}
		}
	}
	
	function writeShairportSyncConfiguration() {
		// Saves current shairport-sync configuration back into the file.
		if (fs.existsSync("/etc/shairport-sync.conf")) {
			shairportSyncConfig = [];
			for (section in configuration) {
				shairportSyncConfig.push(section+" =\n{");
				for (option in configuration[section]) {
					if (isNaN(configuration[section][option])) {
						value = '"'+configuration[section][option]+'"';
					} else {
						value = configuration[section][option];
					}
					shairportSyncConfig.push('\t'+option+' = '+value+';');
				}
				shairportSyncConfig.push("}");
			}
			fs.writeFileSync("/etc/shairport-sync.conf", shairportSyncConfig.join("\n"));
			shairportSyncConfigModified = fs.statSync("/etc/shairport-sync.conf").mtimeMs;
		}
	}
	
	
	
	
	// DACP IMPLEMENTATION
	
	
	var streamClosedForShutdown = false;
	var airPlayMetadataRestartTimeout;
	function streamMetadata() {
		streamClosedForShutdown = false;
		airPlayMetadataStream = fs.createReadStream(airPlayMetadataPath); // read from shairport-sync metadata
		
		if (debug >= 3) console.log("Reading shairport-sync metadata from: "+airPlayMetadataPath+"...");
		airPlayMetadataStream.setEncoding('utf8');
		
		airPlayMetadataStream.on('data', processAirPlayMetadata);
		
		/*airPlayMetadataStream.on('open', function() {
			
		});*/
		beo.bus.emit("general", {header: "requestShutdownTime", content: {extension: "shairport-sync"}});
		
		airPlayMetadataStream.on('close', function(error) {
			if (!error) {
				if (debug >= 3) console.log("AirPlay metadata stream closed.");
				airPlayMetadataStream.destroy();
				if (!streamClosedForShutdown) {
					clearTimeout(airPlayMetadataRestartTimeout);
					airPlayMetadataRestartTimeout = setTimeout(function() {
						streamMetadata();
					}, 2000);
				}
			} else {
				if (debug) console.log("Error closing shairport-sync metadata stream: "+error);
			}
		});
		
		airPlayMetadataStream.on('error', function(error) {
			if (debug) console.log("Error in shairport-sync metadata stream: "+error);
		});
	}
	
	
	var activeRemote = {daid: null, acre: null};
	var dacpServices = {};
	
	var controllableSources = {};
	
	var dataBuffer = "";
	function processAirPlayMetadata(theData) {
		dataBuffer = dataBuffer + theData;
		if (theData.endsWith("</item>\n")) {
			dataItems = dataBuffer.replace(/(\r\n|\n|\r)/gm, "");
			dataItems = dataItems.split("</item>");
			for (i = 0; i < dataItems.length; i++) {
				if (dataItems[i].length == 0) {
					continue;
				}
				dataSubitems = dataItems[i].split("</code><length>");
				//console.log(thisDataItem+"--end--");
				typeAndCode = dataSubitems[0].split("</type><code>");
				if (typeAndCode[1]) {
					theCode = Buffer.from(typeAndCode[1], 'hex').toString("ascii");
					theType = Buffer.from(typeAndCode[0].slice(12), 'hex').toString("ascii");
					decodedData = "";
					if (!dataSubitems[1].startsWith("0")) {
						encodedDataSubitems = dataSubitems[1].split("</length><data encoding=\"base64\">");
						data64 = encodedDataSubitems[1].slice(0, -7);
						if (theCode != "PICT") {
							decodedData = Buffer.from(data64, 'base64').toString();
						}
					}
					
					if ("PICT pbeg pend pfls prsm pvol prgr mdst mden snam snua stal daid acre dapo asal asar asgn minm clip".indexOf(theCode) != -1) {
						// TO DEBUG, UNCOMMENT FOLLOWING:
						//console.log(theType, theCode, ":", decodedData);
					}
					switch (theCode) {
						case "daid":
							activeRemote.daid = decodedData;
							combineDACPInformation("daid", decodedData);
							break;
						case "acre":
							activeRemote.acre = decodedData;
							combineDACPInformation("acre", decodedData);
							break;
						case "pvol":
							//beo.bus.emit("sound", {header: "updateVolume"});
							/*volumeValues = decodedData.split(",");
							if (volumeValues[0] == -144) {
								volumeIsMuted = true;
								self.emit('playback', {volume: -1});
							} else {
								volumeIsMuted = false;
								lastVolume = convertAirPlayVolume(volumeValues[0], 0);
								self.emit('playback', {volume: lastVolume});
							}*/
							break;
					}
				}
			}
	
			//console.log(dataBuffer);
			dataBuffer = ""; // Empty data buffer for next batch.
		} else {
			//console.log("More incoming data...")
		}
	}
	
	
	// Send remote control command to DACP server
	function sendDACPCommand(command, daid) {
		// A target can be specified for the command. Otherwise it will be directed at the active source.
		if (!daid) daid = activeRemote.daid;
		
		
		if (controllableSources["shairport-sync-"+daid]) {
			destination = controllableSources["shairport-sync-"+daid];
			
			if (destination.daid && destination.acre && dacpServices[destination.daid]) {
				fetch('http://' + dacpServices[destination.daid].addresses[0] + ":" + dacpServices[destination.daid].port + "/ctrl-int/1/" + command, {
						headers: {
							'Active-Remote': destination.acre,
							'Host': 'starlight.local.'
						},
					}).then(res => {
					if (res.status == 200 || res.status == 204) {
						// OK.
					} else {
						// No content.
						if (debug) console.log("Error sending DACP command:", res.status, res.statusText, res.text);
					}
				});
			}
		} else {
			//console.log("No controllable source found.");
		}
	}

	
	function combineDACPInformation(type) {
		
		switch (type) {
			case "daid":
				if (dacpServices[activeRemote.daid]) {
					if (!controllableSources["shairport-sync-"+activeRemote.daid]) controllableSources["shairport-sync-"+activeRemote.daid] = {inLimbo: false};
					
					controllableSources["shairport-sync-"+activeRemote.daid].daid = activeRemote.daid;
					controllableSources["shairport-sync-"+activeRemote.daid].origin = dacpServices[activeRemote.daid].hostname;
					if (activeRemote.acre) controllableSources["shairport-sync-"+activeRemote.daid].acre = activeRemote.acre;
				}
				break;
			case "acre":
				if (activeRemote.daid && controllableSources["shairport-sync-"+activeRemote.daid]) {
					controllableSources["shairport-sync-"+activeRemote.daid].acre = activeRemote.acre;
				}
				break;
		}
		if (controllableSources["shairport-sync-"+activeRemote.daid]) {
			if (controllableSources["shairport-sync-"+activeRemote.daid].acre && controllableSources["shairport-sync-"+activeRemote.daid].origin) {
				updateControllableSources();
			}
		}
	}
	
	var sourceDeletionTimeout = null; // Clear the limbo every five minutes, just so that we don't keep hoarding ghosts.
	function clearLimboSources() {
		for (source in controllableSources) {
			if (controllableSources[source].inLimbo) delete controllableSources[source];
		}
	}
	
	function updateControllableSources() {
		allSources = {};
		for (source in controllableSources) {
			if (!controllableSources[source].inLimbo) allSources[source] = controllableSources[source];
		}
		//beo.bus.emit("sources", {header: "startableSources", content: {extension: "shairport-sync", sources: sources}});
	}
	
	// DACP SERVICE DISCOVERY
	
	
	var browser = null;
	
	function startDiscovery() {
		browser = new dnssd.Browser(dnssd.tcp('dacp'));
		
		browser.on('serviceUp', service => discoveryEvent("up", service));
		browser.on('serviceDown', service => discoveryEvent("down", service));
		browser.on('serviceChanged', service => discoveryEvent("changed", service));
		browser.on('error', error => console.log("dnssd error: ", error));
		
		browser.start();
	}
	
	function stopDiscovery() {
		if (browser) browser.stop();
	}
	
	function discoveryEvent(event, service) {
		if (event == "up") {
			dacpServices[service.name.split("_")[2]] = {
				hostname: service.host.slice(0, -7),
				port: service.port,
				addresses: service.addresses
			};
			if (controllableSources["shairport-sync-"+service.name.split("_")[2]]) {
				controllableSources["shairport-sync-"+service.name.split("_")[2]].inLimbo = false;
				updateControllableSources();
			}
		} else if (event == "down") {
			delete dacpServices[service.name.split("_")[2]];
			if (controllableSources["shairport-sync-"+service.name.split("_")[2]]) {
				controllableSources["shairport-sync-"+service.name.split("_")[2]].inLimbo = true;
				updateControllableSources();
				clearTimeout(sourceDeletionTimeout);
				sourceDeletionTimeout = setTimeout(function() {
					clearLimboSources();
				}, 300000);
			}
		}
	}
		
	
	// Check if string ends with string: string.endsWith(suffix);
	String.prototype.endsWith = function(suffix) {
		return this.match(suffix + "$") == suffix;
	};
	
	function convertAirPlayVolume(value, conversionType) {
		if (conversionType == 0) { // Convert from dB (-30 to 0) to abstracted value (0-100).
			return (1 - (value / -30)) * 100;
		}
	
		if (conversionType == 1) { // Convert from abstracted value to dB (-30 to 0).
			return -30 + ((value / 100) * 30);
		}
	}

	
module.exports = {
	version: version,
	isEnabled: getShairportSyncStatus
};
