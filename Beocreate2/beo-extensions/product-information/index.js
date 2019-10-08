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
var fs = require("fs");

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var extensions = globals.extensions;
	var setup = globals.setup;
	var download = globals.download;
	var debug = globals.debug;
	
	var version = require("./package.json").version;
	
	var hasInternet = false;
	
	var systemID = null;
	var systemNames = {ui: "BeoCreate 4-Channel Amplifier", static: "beocreate-4-channel-amplifier"};
	var systemVersion = null;
	
	var defaultSettings = {
		"modelID": "beocreate-4ca-mk1", 
		"modelName": "BeoCreate 4-Channel Amplifier",
		"productImage": "/product-images/beocreate-4ca-mk1.png"
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var productIdentities = {};
	
	var imageDirectory = systemDirectory+"/../beo-product-images/";
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
						beoBus.emit('product-information', {header: "productIdentity", content: {systemName: systemName.ui, modelID: settings.modelID, modelName: settings.modelName, productImage: settings.productImage, systemID: systemID}});
					} else {
						// If the UI name is not defined, assume this is a first-run scenario and give the system a default name that contains the system ID ("Beocreate_a1b2c3d4").
						if (!systemID) systemID = "new";
						piSystem.setHostname("Beocreate_"+systemID.replace(/^0+/, ''), function(success, response) {
							if (extensions["setup"] && extensions["setup"].joinSetupFlow) {
								extensions["setup"].joinSetupFlow("product-information", {after: ["choose-country", "network", "sound-preset"], allowAdvancing: true});
							}
							if (success == true) { 
								systemName = response;
								if (debug) console.log("System name is now '"+systemName.ui+"' ("+systemName.static+").");
								beoBus.emit('product-information', {header: "productIdentity", content: {systemName: systemName.ui, modelID: settings.modelID, modelName: settings.modelName, productImage: settings.productImage, systemID: systemID}});
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
				beoBus.emit("ui", {target: "product-information", header: "showProductIdentity", content: {systemName: systemName.ui, modelID: settings.modelID, modelName: settings.modelName, productImage: settings.productImage, systemVersion: systemVersion, systemID: systemID}});
			}
		}
	});
	
	beoBus.on('network', function(event) {
		
		if (event.header == "internetStatus") {
			if (event.content == true) {
				hasInternet = true;
				if (downloadQueue.length > 0) downloadProductImage();
			} else {
				hasInternet = false;
			}
		}
	});
	
	beoBus.on('product-information', function(event) {
		
		if (event.header == "settings") {
			
			if (event.content.settings) {
				settings = event.content.settings;
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
			validatedSettings.productImage = getProductImage(theSettings.productImage).filename;
			compatibilityIssues.productImage = 0;
		} else {
			validatedSettings.productImage = "beocreate";
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
			if (debug) console.log("Product model name is now '"+settings.modelName+"'.");
			beoBus.emit("settings", {header: "saveSettings", content: {extension: "product-information", settings: settings}});
			beoBus.emit('product-information', {header: "productIdentity", content: {systemName: systemName.ui, modelID: settings.modelID, modelName: settings.modelName, productImage: settings.productImage, systemID: systemID}});
			beoBus.emit("ui", {target: "product-information", header: "showProductModel", content: {modelID: settings.modelID, modelName: settings.modelName, productImage: settings.productImage}});
		}
	}
	
	
	function getProductImage(reference) {
		url = null;
		imageName = undefined;
		if (reference && reference.indexOf("/") != -1) {
			imageName = reference.substring(reference.lastIndexOf('/') + 1);
			if (reference.indexOf("http") != -1) url = reference;
		} else if (reference != undefined) {
			imageName = reference;
		}
		if (imageName) {
			if (imageName.indexOf(".png") == -1) imageName += ".png";
			if (fs.existsSync(imageDirectory+"/"+imageName)) {
				image = imageName;
				return {filename: imageName, path: "/product-images/"};
			} else {
				if (url) {
					downloadProductImage(url);
					return {filename: imageName, path: "/product-images/"};
				} else {
					return {filename: "beocreate.png", path: "/common/"};
				}
			}
		} else {
			return {filename: "beocreate.png", path: "/common/"};
		}
		
	}
	
	downloadQueue = [];
	function downloadProductImage(url) {
		if (hasInternet) {
			if (!url && downloadQueue.length > 0) {
				for (var i = 0; i < downloadQueue.length; i++) {
					download(downloadQueue[i], imageDirectory, null, function(success, err) {
		
					});
				}
				downloadQueue = [];
			} else {
				download(url, imageDirectory, null, function(success, err) {
					
				});
			}
		} else {
			downloadQueue.push(url);
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




