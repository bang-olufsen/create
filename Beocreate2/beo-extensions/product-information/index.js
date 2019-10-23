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

// BEOCREATE PRODUCT INFORMATION

var piSystem = require("../../beocreate_essentials/pi_system_tools");
var beoCom = require("../../beocreate_essentials/communication")();
var fs = require("fs");

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var extensions = globals.extensions;
	var setup = globals.setup;
	var download = globals.download;
	var debug = globals.debug;
	
	var hifiberryOS = (globals.systemConfiguration.cardType && globals.systemConfiguration.cardType.indexOf("Beocreate") == -1) ? true : false;
	var genericProductImage = "";
	if (!hifiberryOS) {
		genericProductImage = "/common/beocreate-generic.png";
	} else {
		genericProductImage = "/common/hifiberry-generic.png";
	}
	
	var version = require("./package.json").version;
	
	var hasInternet = false;
	
	var systemID = null;
	var systemName = {ui: null, static: null};
	var systemVersion = null;
	
	var defaultSettings = {
		"modelID": "beocreate-4ca-mk1", 
		"modelName": "BeoCreate 4-Channel Amplifier",
		"productImage": "/product-images/beocreate-4ca-mk1.png",
		"bonjourEnabled": false
	};
	if (hifiberryOS) {
		defaultSettings = {
			"modelID": "hifiberry", 
			"modelName": "HiFiBerry",
			"productImage": false,
			"bonjourEnabled": false
		};
	}
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var currentProductImage = (!settings.productImage) ? genericProductImage : settings.productImage;
	
	var productIdentities = {};
	
	var imageDirectory = dataDirectory+"/beo-product-images/";
	if (!fs.existsSync(imageDirectory)) fs.mkdirSync(imageDirectory);
	
	beoBus.on('general', function(event) {
		
		if (event.header == "startup") {
			systemVersion = event.content.systemVersion;
			systemVersionReadable = event.content.systemVersionReadable;
			
			piSystem.getSerial(function(serial) {
				if (serial != null) {
					systemID = serial;
				} else {
					systemID = null;
				}
			
				piSystem.getHostname(function(response, err) {
					// Wait for the system name before starting services.
					
					if (!err) systemName = response;
					if (systemName.ui) {
						
						beoBus.emit('product-information', {header: "productIdentity", content: {systemName: systemName.ui, modelID: settings.modelID, modelName: settings.modelName, productImage: currentProductImage, systemID: systemID}});
						startOrUpdateBonjour();
					} else {
						// If the UI name is not defined, assume this is a first-run scenario and give the system a default name that contains the system ID ("Beocreate-a1b2c3d4").
						if (!systemID) systemID = "new";
						if (!hifiberryOS) {
							newName = "Beocreate-"+systemID.replace(/^0+/, '');
						} else {
							newName = "HiFiBerry";
						}
						piSystem.setHostname(newName, function(success, response) {
							if (extensions["setup"] && extensions["setup"].joinSetupFlow) {
								extensions["setup"].joinSetupFlow("product-information", {after: ["choose-country", "network", "sound-preset"], allowAdvancing: true});
							}
							if (success == true) { 
								systemName = response;
								if (debug) console.log("System name is now '"+systemName.ui+"' ("+systemName.static+").");
								beoBus.emit('product-information', {header: "productIdentity", content: {systemName: systemName.ui, modelID: settings.modelID, modelName: settings.modelName, productImage: currentProductImage, systemID: systemID}});
								startOrUpdateBonjour();
							} else {
								if (debug) console.error("Setting system name failed: "+response);
							}
						});
					}
				});
			});
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "product-information") {
				beoBus.emit("ui", {target: "product-information", header: "showProductIdentity", content: {systemName: systemName.ui, modelID: settings.modelID, modelName: settings.modelName, productImage: currentProductImage, systemVersion: systemVersion, systemID: systemID, hifiberryOS: hifiberryOS, systemConfiguration: globals.systemConfiguration}});
			}
		}
		
		if (event.header == "shutdown") {
			if (beoCom.isBonjourStarted()) {
				beoCom.stopBonjour(function() {
					beoBus.emit("general", {header: "shutdownComplete", content: {extension: "product-information"}});
				});
			}
		}
	});

	
	beoBus.on('product-information', function(event) {
		
		if (event.header == "settings") {
			
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
				currentProductImage = getProductImage(settings.productImage, true)[1];
			}
			
		}
		
		if (event.header == "setSystemName") {
			if (event.content.newSystemName) {
				if (debug) console.log("Setting system name...");
				piSystem.setHostname(event.content.newSystemName, function(success, response) {
					if (success == true) { 
						systemName = response;
						if (debug) console.log("System name is now '"+systemName.ui+"' ("+systemName.static+").");
						beoBus.emit('product-information', {header: "systemNameChanged", content: {systemName: systemName.ui, staticName: systemName.static}});
						startOrUpdateBonjour("systemName");
						beoBus.emit("ui", {target: "product-information", header: "showSystemName", content: {systemName: systemName.ui, staticName: systemName.static}});
						if (!setup) {
							//beoBus.emit("ui", {target: "product-information", header: "askToRestartAfterSystemNameChange"});
							// No need to ask for restart, system name can be changed without restarting.
						}
					} else {
						if (debug) console.error("Setting system name failed: "+response);
					}
				});
			}
		}
		
		if (event.header == "getSystemName") {
			beoBus.emit("ui", {target: "product-information", header: "showSystemName", content: {systemName: systemName.ui, systemVersion: systemVersion}});
		}
		
		if (event.header == "setProductModel") {
			if (event.content.modelID) {
				setProductModel(event.content.modelID);
			}
		}
		
		if (event.header == "addProductIdentities") {
			if (event.content.identities) {
				newIdentities = [];
				for (var i = 0; i < event.content.identities.length; i++) {
					if (!productIdentities[event.content.identities[i].modelID]) {
						productIdentities[event.content.identities[i].modelID] = {modelName: event.content.identities[i].modelName, productImage: event.content.identities[i].productImage};
						newIdentities.push(event.content.identities[i].modelName);
					}
				}
				if (debug && newIdentities.length > 0) console.log("Added product identities: "+newIdentities.join(", ")+".");
			}
		}
		
		if (event.header == "getProductIdentities") {
			beoBus.emit("ui", {target: "product-information", header: "allProductIdentities", content: {identities: productIdentities}});
		}
		
		if (event.header == "restartProduct") {
			if (debug) console.error("User-requested product reboot...");
			beoBus.emit("general", {header: "requestReboot", content: {extension: "product-information"}});
			
		}
		
		if (event.header == "shutdownProduct") {
			if (debug) console.error("User-requested product shutdown...");
			beoBus.emit("general", {header: "requestShutdown", content: {extension: "product-information"}});
			
		}
		
		
		
	});
	

	beoBus.on('network', function(event) {
		
		if (event.header == "internetStatus") {
			if (event.content == true) {
				hasInternet = true;
				if (downloadQueue.length > 0) downloadProductImage(downloadQueue);
			} else {
				hasInternet = false;
			}
		}
		
		if (event.header == "newIPAddresses") {
			//if (event.content == true) {
				if (!bonjourStartedRecently && settings.bonjourEnabled) {
					if (debug) console.log("New IP addresses, restarting Bonjour advertisement...");
					clearTimeout(bonjourRestartDelay);
					bonjourRestartDelay = setTimeout(function() {
						beoCom.restartBonjour(); 
					}, 2000);
				}
			//}
		}
	});
	
	var bonjourStartedRecently = true;
	var bonjourRestartDelay = null;
	
	function startOrUpdateBonjour(newData) {
		if (settings.bonjourEnabled) {
			systemStatus = (!globals.setup) ? "normal" : "yellow";
			if (!beoCom.isBonjourStarted()) {
				// Bonjour is currently not advertising, start.
				if (debug) console.log("Advertising system as '"+systemName.ui+"'...");
				beoCom.startBonjour({name: systemName.ui, serviceType: "beocreate", advertisePort: globals.systemConfiguration.port, txtRecord: {"type": settings.modelID, "typeui": settings.modelName, "id": systemID, "image": currentProductImage, "status": systemStatus}});
				beoBus.emit("general", {header: "requestShutdownTime", content: {extension: "product-information"}});
				setTimeout(function() {
					bonjourStartedRecently = false;
				}, 2000);
			} else {
				// Bonjour is already advertising, see what needs to be done.
				if (newData == "status" || newData == "model") {
					// If new data is system status or model change, only update TXT record.
					if (debug) console.log("Updating TXT record of Bonjour advertisement...");
					beoCom.updateTxtRecord({"type": settings.modelID, "typeui": settings.modelName, "id": systemID, "image": currentProductImage, "status": systemStatus});
				} else {
					// For anything else, stop and restart advertisement.
					beoCom.stopBonjour(function() {
						startOrUpdateBonjour(); // Run this again, easy.
					});
				}
			}
		}
	}
	
	
	function getProductInformation() {
		return {systemName: systemName.ui, modelID: settings.modelID, modelName: settings.modelName, productImage: settings.productImage, systemID: systemID};
	}
	
	function checkSettings(theSettings) {
		
		validatedSettings = {};
		compatibilityIssues = {};
		
		if (theSettings.modelName != undefined) {
			validatedSettings.modelName = theSettings.modelName;
			compatibilityIssues.modelName = 0;
		}
		
		if (theSettings.modelID != undefined) {
			validatedSettings.modelID = theSettings.modelID;
			compatibilityIssues.modelID = 0;
		}
		
		if (theSettings.designer != undefined) {
			validatedSettings.designer = theSettings.designer;
			compatibilityIssues.designer = 0;
		}
		
		if (theSettings.manufacturer != undefined) {
			validatedSettings.manufacturer = theSettings.manufacturer;
			compatibilityIssues.manufacturer = 0;
		}
		
		if (theSettings.productImage != undefined) {
			validatedSettings.productImage = getProductImage(theSettings.productImage)[0];
			compatibilityIssues.productImage = 0;
		} else {
			validatedSettings.productImage = false;
			compatibilityIssues.productImage = 0;
		}
		
		if (theSettings.produced != undefined) {
			if (!isNaN(theSettings.produced)) {
				validatedSettings.produced = theSettings.produced;
				compatibilityIssues.produced = 0;
			} else if (Array.isArray(theSettings.produced)) {
				if (!isNaN(theSettings.produced[0]) && !isNaN(theSettings.produced[1])) {
					validatedSettings.produced = theSettings.produced;
					compatibilityIssues.produced = 0;
				} else {
					compatibilityIssues.produced = 1;
				}
			} else {
				compatibilityIssues.produced = 1;
			}
		}
		
		
		return {compatibilityIssues: compatibilityIssues, validatedSettings: validatedSettings, previewProcessor: "product_information.generateSettingsPreview"};
	}
	
	function applySoundPreset(theSettings) {
		validatedSettings = checkSettings(theSettings).validatedSettings;
		if (validatedSettings.modelID) {
			setProductModel(validatedSettings.modelID);
		}
	}
	
	
	function setProductModel(modelID) {
		if (productIdentities[modelID]) {
			settings.modelID = modelID;
			settings.modelName = productIdentities[modelID].modelName;
			settings.productImage = productIdentities[modelID].productImage;
			currentProductImage = getProductImage(settings.productImage, true)[1];
			if (debug) console.log("Product model name is now '"+settings.modelName+"'.");
			beoBus.emit("settings", {header: "saveSettings", content: {extension: "product-information", settings: settings}});
			beoBus.emit('product-information', {header: "productIdentity", content: {systemName: systemName.ui, modelID: settings.modelID, modelName: settings.modelName, productImage: currentProductImage, systemID: systemID}});
			startOrUpdateBonjour("model");
			beoBus.emit("ui", {target: "product-information", header: "showProductModel", content: {modelID: settings.modelID, modelName: settings.modelName, productImage: currentProductImage}});
		}
	}
	
	
	function getProductImage(reference, noDownload) {
		url = null;
		imageName = undefined;
		if (reference && reference.indexOf("/") != -1) {
			imageName = reference.substring(reference.lastIndexOf('/') + 1);
			if (reference.indexOf("http") != -1) url = reference;
		} else if (reference != undefined) {
			imageName = reference;
		}
		if (imageName == "beocreate-generic.png") {
			return ["/common/beocreate-generic.png", "/common/beocreate-generic.png"];
		} else if (imageName == "hifiberry-generic.png") {
			return ["/common/hifiberry-generic.png", "/common/hifiberry-generic.png"];
		} else if (imageName) {
			if (imageName.indexOf(".png") == -1) imageName += ".png";
			if (fs.existsSync(imageDirectory+"/"+imageName)) {
				image = imageName;
				return ["/product-images/"+imageName, "/product-images/"+imageName];
			} else {
				if (url && !noDownload) {
					downloadProductImage(url);
					return ["/product-images/"+imageName, "/product-images/"+imageName];
				} else {
					return [false, genericProductImage];
				}
			}
		} else {
			return [false, genericProductImage];
		}
		
	}
	
	downloadQueue = [];
	function downloadProductImage(queue, downloaded, failed) {
		if (hasInternet) {
			fromURL = null;
			if (queue != false && queue != null) {
				if (typeof queue == "string") {
					fromURL = queue;
					queue = false;
				} else {
					if (Array.isArray(queue)) {
						// The queue is a queue, take the first item.
						fromURL = queue.shift();
						if (queue.length == 0) queue = false;
					} else {
						// The "queue" is an object (a single entry).
						fromURL = queue;
						queue = false;
					}
				}
			} else if (queue == false) {
				// No more queue items, trigger callback.
				downloadQueue = [];
				if (callback) callback(downloaded, failed);
			} else {
				console.error("No extensions to download.");
				if (callback) callback(false);
			}
			
			if (fromURL) {
				download(downloadQueue[i], imageDirectory, null, function(success, err) {
					downloadProductImage(queue, downloaded, failed);
				});
			}
		} else {
			if (typeof queue == "string") downloadQueue.push(queue);
		}
	}
	
	function getProductInformation() {
		return {systemName: systemName.ui, modelID: settings.modelID, modelName: settings.modelName, productImage: settings.productImage, systemID: systemID};
	}
	
	
	return {
		checkSettings: checkSettings,
		getProductInformation: getProductInformation,
		applySoundPreset: applySoundPreset,
		getProductImage: getProductImage,
		getProductInformation: getProductInformation,
		version: version
	};
};




