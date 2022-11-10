/*Copyright 2017-2021 Bang & Olufsen A/S
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

// BEOCREATE 2


// Set NODE_PATH first, so that the buildroot-installed modules are found:
process.env.NODE_PATH = "/usr/lib/node_modules/";
require('module').Module._initPaths();

process.on('warning', e => console.warn(e.stack));

// DEPENDENCIES

var http = require('http');
var https = require('https');
var express = require('express');
var fs = require('fs');
var exec = require("child_process").exec;
var EventEmitter = require('eventemitter3');
var aplay = require('aplay');
var _ = require('underscore');

// Beocreate Essentials
var beoCom = require("../beocreate_essentials/communication")();
var piSystem = require('../beocreate_essentials/pi_system_tools');

// END DEPENDENCIES

var systemVersion = require("./package.json").version;
var defaultSystemConfiguration = {
	"cardType": "Beocreate 4-Channel Amplifier",
	"cardFeatures": [],
	"port": 80,
	"httpsPort": 443,
	"language": "en",
	"defaultAppearance": "default",
	"customisationPath": "/custom/beocreate"
};
var systemConfiguration = JSON.parse(JSON.stringify(defaultSystemConfiguration));

var defaultUISettings = {
	"disclosure": {}
};
var uiSettings = JSON.parse(JSON.stringify(defaultUISettings));

var systemStatus = "normal"; 
/* Possible status codes: 
	'normal': standard operation
	'yellow': something requires attention, not critical
	'red': something has failed miserably, critical
*/
var extensionsRequestingShutdownTime = [];

systemDirectory = __dirname;
dataDirectory = "/etc/beocreate"; // Data directory for settings, sound presets, product images, etc.

var debugMode = false;
var daemonMode = false;
var developerMode = false;
var quietMode = false;
var forceBeosounds = false;
var allowCustomisation = true;
var useHTTPS = null;

console.log("Beocreate 2 ("+systemVersion+"), copyright 2017-2021 Bang & Olufsen A/S. MIT open source licence.");


// CHECK COMMAND LINE ARGUMENTS
cmdArgs = process.argv.slice(2);
if (cmdArgs.indexOf("v") != -1) debugMode = 1;
if (cmdArgs.indexOf("vv") != -1) debugMode = 2;
if (cmdArgs.indexOf("vvv") != -1) debugMode = 3;
if (cmdArgs.indexOf("d") != -1) daemonMode = true;
if (cmdArgs.indexOf("dev") != -1) developerMode = true;
if (cmdArgs.indexOf("q") != -1) quietMode = true;
if (cmdArgs.indexOf("no-custom") != -1) allowCustomisation = false;
if (cmdArgs.indexOf("no-https") != -1) useHTTPS = false;

if (debugMode) console.log("Debug logging level: "+debugMode+".");
if (developerMode) console.log("Developer mode.");
if (!allowCustomisation) console.log("Customisations are disabled.");

if (!fs.existsSync(dataDirectory)) {
	fs.mkdirSync(dataDirectory);
	console.log("Created user data directory '"+dataDirectory+"'.");
}

// BEOBUS

// A shared 'bus' where different parts of the system can broadcast messages.
var beoBus = new EventEmitter();
//beoBus.setMaxListeners(0); // An unknown, potentially large number of listeners can be listening to the same events, so let's not limit that. This is not available with eventemitter3.


beoBus.on("ui", function(event) {
	// Send a 'ui' event to transmit data to the user interface on the client.
	
	if (event.header && event.target && event.content) {
		beoCom.send({header: event.header, target: event.target, content: event.content});
	} else if (event.header && event.target) {
		beoCom.send({header: event.header, target: event.target});
	} else {
		if (event.header == "settings" && event.content.settings) {
			uiSettings = event.content.settings;
		}
		if (event.header == "getUISettings") {
			beoCom.send({header: "settings", target: "ui", content: {settings: uiSettings}});
		}
		if (event.header == "disclosure") {
			if (event.content.element && event.content.isOn != undefined)
			uiSettings.disclosure[event.content.element] = event.content.isOn;
			saveSettings("ui", uiSettings);
		}
	}
});

function sendToUI(target, header, content = undefined) {
	// A direct "send to UI" method without going through BeoBus.
	if (typeof header == "string") {
		beoCom.send({header: header, target: target, content: content});
	} else {
		// Also supports legacy "target, event" syntax, where header and content are in the same object.
		if (target && header.header && header.content) {
			beoCom.send({header: header.header, target: target, content: header.content});
		} else if (target && header.header) {
			beoCom.send({header: header.header, target: target});
		}
	}
}

beoBus.on('general', function(event) {
	switch (event.header) {
		case "requestShutdownTime":
			if (event.content.extension) requestShutdownTimeForExtension(event.content.extension);
			break;
		case "shutdownComplete":
			if (event.content.extension) completeShutdownForExtension(event.content.extension);
			break;
		case "requestReboot":
		case "requestRestart":
			if (event.content.extension) {
				overrideUIActions = (event.content.overrideUIActions) ? true : false;
				rebootSystem(event.content.extension, overrideUIActions);
			}
			break;
		case "requestShutdown":
			if (event.content.extension) {
				overrideUIActions = (event.content.overrideUIActions) ? true : false;
				shutdownSystem(event.content.extension, overrideUIActions);
			}
			break;
		case "requestServerRestart":
			if (event.content.extension) restartServer(event.content.extension);
			break;
	}
});


// GET AND STORE SETTINGS

settingsToBeSaved = {};
settingsSaveTimeout = null;

beoBus.on("settings", function(event) {
	// Handles the saving and retrieval of configuration files for extensions.
	if (event.header == "getSettings") {
		if (event.content.extension) {
			beoBus.emit(event.content.extension, {header: "settings", content: {settings: getSettings(event.content.extension)}});
		}
	} else if (event.header == "saveSettings") {
		// Two ways to save settings: either immediately or collectively 10 seconds after the last request.
		if (event.content.extension && event.content.settings) {
			immediately = false
			if (event.content.immediately) immediately = true;
			saveSettings(event.content.extension, event.content.settings, immediately);
		}
	}
});

function getSettings(extension) {
	if (extension) {
		if (fs.existsSync(dataDirectory+"/"+extension+".json")) { 
			try {
				file = fs.readFileSync(dataDirectory+"/"+extension+".json", "utf8").trim();
				if (file) {
					settings = JSON.parse(file);
					// Return the parsed JSON.
					if (debugMode >= 2) console.log("Settings loaded for '"+extension+"'.");
				} else {
					if (debugMode >= 2) console.log("Settings file for '"+extension+"' is empty.");
					settings = null;
				}
			} catch (error) {
				console.error("Error loading settings for '"+extension+"':", error);
				settings = null;
			}
		} else {
			// If the settings file doesn't exist, load OEM custom defaults or return null.
			if (customisations && fs.existsSync(systemConfiguration.customisationPath+"/defaults/"+extension+".json")) { 
				try {
					file = fs.readFileSync(systemConfiguration.customisationPath+"/defaults/"+extension+".json", "utf8").trim();
					if (file) {
						settings = JSON.parse(file);
						// Return the parsed JSON.
						if (debugMode >= 1) console.log("OEM default settings loaded for '"+extension+"'.");
					} else {
						if (debugMode >= 1) console.log("OEM default settings file for '"+extension+"' is empty.");
						settings = null;
					}
				} catch (error) {
					console.error("Error loading OEM default settings for '"+extension+"':", error);
					settings = null;
				}
			} else {
				// If the settings file doesn't exist, return null.
				settings = null;
			}
		}
	} else {
		settings = null;
	}
	return settings;
}

function saveSettings(extension, settings, immediately) {
	if (immediately) { // Save immediately.
		fs.writeFileSync(dataDirectory+"/"+extension+".json", JSON.stringify(settings));
		if (debugMode >= 2) console.log("Settings saved for '"+extension+"' (immediately).");
	} else { // Add to the queue.
		settingsToBeSaved[extension] = settings;
		clearTimeout(settingsSaveTimeout);
		settingsSaveTimeout = setTimeout(function() {
			savePendingSettings();
		}, 10000);
	}
}

function savePendingSettings() {
	for (var extension in settingsToBeSaved) {
	    if (settingsToBeSaved.hasOwnProperty(extension)) {
	        fs.writeFileSync(dataDirectory+"/"+extension+".json", JSON.stringify(settingsToBeSaved[extension]));
			if (debugMode >= 2) console.log("Settings saved for '"+extension+"'.");
	    }
	}
	settingsToBeSaved = {}; // Clear settings from the queue.
}

function getAllSettings() {
	if (fs.existsSync(dataDirectory)) {
		for (extension in extensions) {
			if (fs.existsSync(dataDirectory+"/"+extension+".json")) { // Check if settings exist for this extension.
				beoBus.emit(extension, {header: "settings", content: {settings: getSettings(extension)}});
			}
		}
	}
}


// LOAD SYSTEM SETTINGS
// Contains sound card type, port to use, possibly disabled extensions.
tempSystemConfiguration = getSettings('system');
if (tempSystemConfiguration != null) systemConfiguration = Object.assign(systemConfiguration, tempSystemConfiguration);


// Load UI settings.
tempUISettings = getSettings('ui');
if (tempUISettings != null) uiSettings = Object.assign(uiSettings, tempUISettings);



// LOAD EXTENSIONS, ASSEMBLE UI AND START SERVERS
var extensions = {}; // Import Node logic from extensions into this object.
var extensionsList = {};
var extensionsLoaded = false;
var extensionsPath = systemDirectory+"/../beo-extensions";
var userExtensionsPath = dataDirectory+"/beo-extensions";
var customisations = null;

var expressServer = express(); // Create Express instance.

global.beo = {
	bus: beoBus,
	systemDirectory: systemDirectory+"/..",
	dataDirectory: dataDirectory,
	customisationDirectory: systemConfiguration.customisationPath,
	systemVersion: systemVersion,
	systemConfiguration: systemConfiguration,
	extensions: extensions,
	extensionsList: extensionsList,
	saveSettings: saveSettings,
	getSettings: getSettings,
	requestShutdownTime: requestShutdownTimeForExtension,
	completeShutdown: completeShutdownForExtension,
	setup: false,
	selectedExtension: selectedExtension, 
	selectedDeepMenu: selectedDeepMenu,
	debug: debugMode,
	developerMode: developerMode,
	daemon: daemonMode,
	sendToUI: sendToUI,
	download: download,
	addDownloadRoute: addDownloadRoute,
	removeDownloadRoute: removeDownloadRoute,
	underscore: _,
	expressServer: expressServer,
	customisations: customisations
};

loadCustomisations();
loadAllServerExtensions();
var selectedExtension = null;
var selectedDeepMenu = null;


// HTTP & EXPRESS SERVERS
if (useHTTPS != false && // By specifying false HTTPS can be disabled ('http' command argument).
	fs.existsSync(dataDirectory+"/server.key") && 
	fs.existsSync(dataDirectory+"/server.cert")) {
	// Create HTTPS server if certificate and keys are found on the system (experimental).
	var beoServerHTTPS = https.createServer({
		key: fs.readFileSync(dataDirectory+"/server.key"),
		cert: fs.readFileSync(dataDirectory+"/server.cert")
	}, expressServer);
	if (debugMode) console.log("HTTPS is enabled on the server.");
	useHTTPS = true;
} 
// Create normal HTTP server.
var beoServer = http.createServer(expressServer);
	
beoServer.on("error", function(error) {
	switch (error.code) {
		case "EADDRINUSE":
			console.error("HTTP server port is already in use. Exiting...")
			startShutdown();
			break;
		default:
			console.error("HTTP server error. Exiting just in case. Error:", error);
			startShutdown();
			break;
	}
	
});
if (useHTTPS) {
	beoServerHTTPS.on("error", function(error) {
		switch (error.code) {
			case "EADDRINUSE":
				console.error("HTTP server port is already in use. Exiting...")
				startShutdown();
				break;
			default:
				console.error("HTTP server error. Exiting just in case. Error:", error);
				startShutdown();
				break;
		}
	});

	beoServerHTTPS.listen(systemConfiguration.httpsPort); // Listen on the HTTPS port.
}
beoServer.listen(systemConfiguration.port); // Listen on the HTTP port.


etags = (developerMode) ? false : true; // Disable etags (caching) when running with debug.
expressServer.use("/common", express.static(systemDirectory+"/common", {etag: etags})); // For common system assets.
if (customisations) expressServer.use("/extensions", express.static(systemConfiguration.customisationPath+"/beo-extensions-override", {etag: etags})); // For customisation overrides/additions.
expressServer.use("/extensions", express.static(dataDirectory+"/beo-extensions", {etag: etags})); // For user extensions.
expressServer.use("/extensions", express.static(systemDirectory+"/../beo-extensions", {etag: etags})); // For system extensions.
expressServer.use("/views", express.static(dataDirectory+"/beo-views", {etag: etags})); // For user appearances.
expressServer.use("/views", express.static(systemDirectory+"/../beo-views", {etag: etags})); // For system appearances.
if (customisations) expressServer.use("/custom", express.static(systemConfiguration.customisationPath+"/assets", {etag: etags})); // For customisations.
expressServer.use("/misc", express.static(systemDirectory+"/../misc", {etag: etags})); // For other files.
expressServer.get("/", function (req, res) {
	if (debugMode) console.log("Loading user interface for default appearance...");
	ui = loadAppearance(systemConfiguration.defaultAppearance);
	if (ui) {
		res.status(200);
		res.send(ui);
	} else {
		res.status(404);
		res.sendFile(systemDirectory+"/common/appearance-not-found.html");
	}
});
expressServer.get("/view/:appearance", function (req, res) {
	// Serve an alternate appearance.
	if (debugMode) console.log("Loading user interface for appearance '"+req.params.appearance+"'...");
	ui = loadAppearance(req.params.appearance);
	if (ui) {
		res.status(200);
		res.send(ui);
	} else {
		res.status(404);
		res.sendFile(systemDirectory+"/common/appearance-not-found.html");
	}
});
// REST API endpoint to talk to extensions.
expressServer.use(express.json());
expressServer.post("/:extension/:header/:extra*?", function (req, res) {
	if (req.params.header == "upload") {
		if (debugMode) console.log("File upload for '"+req.params.extension+"':", req.header("fileName"));
		if (extensions[req.params.extension] && extensions[req.params.extension].processUpload) { // Check that the extension can receive this file, then save it to the upload directory and call the extension to process it.
			if (req.header("customData")) {
				customData = JSON.parse(req.header("customData"));
			} else {
				customData = null;
			}
			if (!fs.existsSync(dataDirectory+"/beo-uploads")) fs.mkdirSync(dataDirectory+"/beo-uploads");
			if (!fs.existsSync(dataDirectory+"/beo-uploads/"+req.params.extension)) fs.mkdirSync(dataDirectory+"/beo-uploads/"+req.params.extension);
			var fileName = req.header("fileName").replace("/", "-").replace("..", "-");
			var filePath = dataDirectory+"/beo-uploads/"+req.params.extension+"/"+fileName;
			
			var fileStream = fs.createWriteStream(filePath);
			fileStream.on("finish", function() {
				try {
					extensions[req.params.extension].processUpload(filePath, customData);
				} catch (error) {
					console.error("Error processing file upload:", error);
				}
			});
			req.pipe(fileStream);
			req.on("end", function() {
				res.status(202);
				res.send("OK");
				
			});
		} else {
			console.error("'"+req.params.extension+"' does not support uploading files.");
			res.status(501);
			res.send("cannotReceive");
		}
	} else {
		if (debugMode >= 3) console.log("API request received at /"+req.params.extension+"/"+req.params.header+":", req.body, req.params.extra);
		beoBus.emit(req.params.extension, {header: req.params.header, content: {body: req.body, extra: req.params.extra}});
		res.status(200);
		res.send("OK");
	}
});

// Serve downloads:
var downloadRoutes = {};
expressServer.get("/:extension/download/:urlPath", function (req, res) {
	
	if (downloadRoutes[req.params.extension]) {
		if (downloadRoutes[req.params.extension][req.params.urlPath]) {
			// Serve file from the specified path.
			if (debugMode >= 2) console.log("Sending file '"+downloadRoutes[req.params.extension][req.params.urlPath].filePath+"' for download.");
			res.download(downloadRoutes[req.params.extension][req.params.urlPath].filePath);
			if (!downloadRoutes[req.params.extension][req.params.urlPath].permanent) {
				if (debugMode) console.log("Download route for '"+downloadRoutes[req.params.extension][req.params.urlPath].filePath+"' was removed automatically.");
				delete downloadRoutes[req.params.extension][req.params.urlPath];
			}
		} else {
			console.error("The requested download is not available.");
			res.status(404);
			res.send("Notfound");
		}
	} else {
		console.error("The requested download is not available.");
		res.status(404);
		res.send("Notfound");
	}
});



function addDownloadRoute(extension, urlPath, filePath, permanent = false) {
	if (extension && urlPath && filePath) {
		if (!downloadRoutes[extension]) downloadRoutes[extension] = {};
		if (!downloadRoutes[extension][urlPath]) downloadRoutes[extension][urlPath] = {filePath: filePath, permanent: permanent};
		if (debugMode) console.log("'"+filePath+"' is now allowed to be downloaded.");
		return extension+"/download/"+urlPath;
	}
}

function removeDownloadRoute(extension, urlPath) {
	if (downloadRoutes[extension] && downloadRoutes[extension][urlPath]) {
		if (debugMode) console.log("Download route for '"+downloadRoutes[extension][urlPath].filePath+"' was removed.");
		delete downloadRoutes[extension][urlPath];
	}
}

// START WEBSOCKET
if (useHTTPS) {
	beoCom.startSocket({server: [beoServer, beoServerHTTPS], acceptedProtocols: ["beocreate"]});
} else {
	beoCom.startSocket({server: beoServer, acceptedProtocols: ["beocreate"]});
}


getAllSettings();

beoBus.emit('general', {header: "startup", content: {debug: debugMode, systemVersion: systemVersion}});

if (systemConfiguration.runAtStart) {
	try {
		exec(systemConfiguration.runAtStart);
	} catch (error) {
		console.error("Could not run 'at start' command: "+error);
	}
}

console.log("System startup.");

if (!fs.existsSync(dataDirectory+"/beo-extensions")) fs.mkdirSync(dataDirectory+"/beo-extensions");

// STARTUP SOUND PLAYBACK
// Actual sound (if any) is defined in the playback function.

// Non-DSP sound devices
if (systemConfiguration.cardFeatures.indexOf("dsp") == -1 && !quietMode) {
	if (!fs.existsSync("/etc/quiet_start")) {
		playProductSound("startup");
	} else {
		fs.writeFileSync("/etc/quiet_start", "Used.");
	}
}

// DSP sound devices
beoBus.on('dsp', function(event) {
	if (event.header == "amplifierUnmuted") {
		if (!startupSoundPlayed) {
			if (!fs.existsSync("/etc/quiet_start") && !quietMode) {
				setTimeout(function() {
					playProductSound("startup");
				}, 1000);
			} else {
				fs.writeFileSync("/etc/quiet_start", "Used.");
			}
		}
	}
});





function loadAllServerExtensions() {
	
	menuName = "menu";
		
	masterList = {};
	
	if (fs.existsSync(extensionsPath)) {
		extensionsNames = fs.readdirSync(extensionsPath);
		for (var i = 0; i < extensionsNames.length; i++) {
			if (extensionsNames[i].charAt(0) != ".") {
				masterList[extensionsNames[i]] = {userExtension: false, basePath: extensionsPath};
			}
		}
	}
	
	if (fs.existsSync(userExtensionsPath)) {
		extensionsNames = fs.readdirSync(userExtensionsPath);
		for (var i = 0; i < extensionsNames.length; i++) {
			if (extensionsNames[i].charAt(0) != ".") {
				if (!masterList[extensionsNames[i]] || systemConfiguration.preferUserExtensions) {
					if (masterList[extensionsNames[i]]) {
						if (debugMode) console.log("Loading user extension '"+extensionsNames[i]+"' instead of equivalent system extension.");
					}
					// If user extensions are preferred, extensions in the user directory will replace system extensions with the same name.
					masterList[extensionsNames[i]] = {userExtension: true, basePath: userExtensionsPath};
				}
			}
		}
	}
	
	// Load all extensions.
	for (extensionName in masterList) {
		loadExtensionWithPath(extensionName, masterList[extensionName].userExtension, menuName, "extensions");
	}
	
	extensionsLoaded = true;
}


function loadExtensionWithPath(extensionName, userExtension, menuName, basePath) {
	
	// Mode 0: Load only server-side code.
	// Mode 1: Load UI for this appearance.
	
	shouldLoad = shouldLoadExtension(0, extensionName, userExtension, menuName);
	
	if (!shouldLoad) return null;
	
	isSource = false;
	
	extensionsList[extensionName] = {loadedSuccessfully: false, isSource: false, menuTitle: null};
	
	// Load the Node code for this extension.
	
	try {
		extensions[extensionName] = require(fullPath);
		extensionsList[extensionName].loadedSuccessfully = true;
		extensionLoadedSuccessfully = true;
	}
	catch (error) {
		console.error("Error loading extension '"+extensionName+"':", error);
		extensionLoadedSuccessfully = false;
	}
	
	return extensionLoadedSuccessfully;
}


function shouldLoadExtension(mode, extensionName, userExtension, menuName = null) {
	
	// Mode 0: Load check for server-side code.
	// Mode 1: Check for UI existence.
	
	if (menuName == null) menuName = "menu";
	var excludedBySystemConfig = false;
	
	if (systemConfiguration.enabledExtensions && systemConfiguration.enabledExtensions.length > 0) {
		if (systemConfiguration.enabledExtensions.indexOf(extensionName) != -1) {
			if (debugMode && !extensionsLoaded) console.log("Extension '"+extensionName+"' is listed to be loaded, excluding unlisted extensions.");
		} else {
			excludedBySystemConfig = true;
		}
	} else if (systemConfiguration.disabledExtensions && systemConfiguration.disabledExtensions.length > 0) {
		if (systemConfiguration.disabledExtensions.indexOf(extensionName) != -1) {
			if (debugMode && !extensionsLoaded) console.log("Extension '"+extensionName+"' is disabled and won't be loaded.");
			excludedBySystemConfig = true;
		}
	}
	
	var excludedByCustomisation = false;
	if (customisations && 
		customisations.disabledExtensions &&
		customisations.disabledExtensions.length > 0) {
		if (customisations.disabledExtensions.indexOf(extensionName) != -1) {
			if (debugMode && !extensionsLoaded) console.log("Extension '"+extensionName+"' is disabled by customisation and won't be loaded.");
			excludedByCustomisation = true;
		}
	}
	
	if (excludedByCustomisation) return false;
	
	paths = [
		(!userExtension) ? extensionsPath+"/"+extensionName : userExtensionsPath+"/"+extensionName,
		(userExtension) ? extensionsPath+"/"+extensionName : userExtensionsPath+"/"+extensionName
	];
	
	try {
		packageJSON = require(paths[0]+"/package.json");
	} catch (error) {
		try {
			packageJSON = require(paths[1]+"/package.json");
		} catch (error) {
			packageJSON = null;
		}
	}
	
	// First check if this extension is included or excluded with this product.
	
	shouldIncludeExtension = true;
	
	if (packageJSON && packageJSON.beocreate) {
		// Check support/unsupport for card/features from package.json file.
		if (packageJSON.beocreate.requireCardFeatures && 
			typeof systemConfiguration.cardFeatures == "object") {
			shouldIncludeExtension = true;
			for (f in packageJSON.beocreate.requireCardFeatures) {
				if (systemConfiguration.cardFeatures.indexOf(packageJSON.beocreate.requireCardFeatures[f]) == -1) shouldIncludeExtension = false;
			}
		}
		if (packageJSON.beocreate.rejectCardFeatures && 
			shouldIncludeExtension && 
			typeof systemConfiguration.cardFeatures == "object") {
			shouldIncludeExtension = true;
			for (f in packageJSON.beocreate.rejectCardFeatures) {
				if (systemConfiguration.cardFeatures.indexOf(packageJSON.beocreate.rejectCardFeatures[f]) != -1) shouldIncludeExtension = false;
			}
		}
		
		cardType = systemConfiguration.cardType.toLowerCase();
		if (packageJSON.beocreate.enableWith) {
			shouldIncludeExtension = false;
			if (typeof packageJSON.beocreate.enableWith == "string") {
				if (packageJSON.beocreate.enableWith.toLowerCase() == cardType) shouldIncludeExtension = true;
			} else {
				for (c in packageJSON.beocreate.enableWith) {
					if (packageJSON.beocreate.enableWith[c].toLowerCase() == cardType) shouldIncludeExtension = true;
				}
			}
		} else if (packageJSON.beocreate.disableWith) {
			shouldIncludeExtension = true;
			if (typeof packageJSON.beocreate.disableWith == "string") {
				if (packageJSON.beocreate.disableWith.toLowerCase() == cardType) shouldIncludeExtension = false;
			} else {
				for (c in packageJSON.beocreate.disableWith) {
					if (packageJSON.beocreate.disableWith[c].toLowerCase() == cardType) shouldIncludeExtension = false;
				}
			}
		}
	}
	
	
	
	if (!shouldIncludeExtension) return false;
	
	
	if (mode == 0) {
		fullPath = paths[0];
		try {
			require.resolve(fullPath);
		}
		catch (error) {
			fullPath = paths[1];
			try {
				require.resolve(fullPath);
			}
			catch (error) {
				if (debugMode > 2) {
					console.error("Extension '"+extensionName+"' has no server-side code:", error);
				} else if (debugMode) {
					console.log("Extension '"+extensionName+"' has no server-side code.");
				}
				return false;
			}
		}
	} 
	if (mode == 1) {
		extensionExists = false;
		var menuPath = null;
		for (p in paths) {
			if (!extensionExists) {
				fullPath = paths[p];
				if (fs.existsSync(fullPath) && 
					fs.statSync(fullPath).isDirectory()) { 
					if (menuName.charAt(0) != "*") {
						if (fs.existsSync(fullPath+'/'+menuName+'.html')){
							extensionExists = true;
							menuName += ".html";
							menuPath = fullPath+"/"+menuName;
						}
					} else {
						// Wildcard matching.
						files = fs.readdirSync(fullPath).filter(fn => fn.endsWith(menuName.substring(1)+".html"));
						if (files.length == 1) {
							menuName = files[0];
							extensionExists = true;
							menuPath = fullPath+"/"+menuName;
						}
					}
				}
			}
		}
		if (customisations && 
			fs.existsSync(systemConfiguration.customisationPath+'/beo-extensions-override/'+extensionName+'/'+menuName)) {
			// Override extension markup from customisation.
			menuPath = systemConfiguration.customisationPath+'/beo-extensions-override/'+extensionName+'/'+menuName;
		}
		if (!extensionExists) return false;
	}
	
	
	if (packageJSON) {
		return {packageJSON: packageJSON, path: menuPath, directory: fullPath};
	} else {
		return {packageJSON: null, path: menuPath, directory: fullPath};
	}
	
}


function loadAppearance(appearance) {

	if (fs.existsSync(dataDirectory+"/beo-views/"+appearance)) {
		appearancePath = dataDirectory+"/beo-views/"+appearance;
	} else if (fs.existsSync(systemDirectory+"/../beo-views/"+appearance)) {
		appearancePath = systemDirectory+"/../beo-views/"+appearance;
	} else {
		return false;
	}
	
	var extensionsListClient = {};
	masterList = [];
	// Check if some extensions are excluded or exlusively included.
	if (fs.existsSync(extensionsPath)) {
		extensionsNames = fs.readdirSync(extensionsPath);
		for (var i = 0; i < extensionsNames.length; i++) {
			if (extensionsNames[i].charAt(0) != ".") {
				masterList[extensionsNames[i]] = {userExtension: false};
			}
		}
	}
	
	if (fs.existsSync(userExtensionsPath)) {
		extensionsNames = fs.readdirSync(userExtensionsPath);
		for (var i = 0; i < extensionsNames.length; i++) {
			if (extensionsNames[i].charAt(0) != ".") {
				if (!masterList[extensionsNames[i]] || systemConfiguration.preferUserExtensions) {
					// If user extensions are preferred, extensions in the user directory will replace system extensions with the same name.
					masterList[extensionsNames[i]] = {userExtension: true};
				}
			}
		}
	}
	
	var menus = [];
	var scripts = [];
	var stylesheets = [];
	var strings = {};
	
	if (Object.keys(masterList).length > 0) {
		
		navigationSets = [];
		menuName = "menu";
		try {
			manifest = JSON.parse(fs.readFileSync(appearancePath+'/manifest.json', "utf8"));
			if (manifest.navigationSets) navigationSets = manifest.navigationSets;
			if (manifest.extensionMarkupFileName) menuName = manifest.extensionMarkupFileName;
		} catch (error) {
			console.error("Error loading manifest.json for appearance '"+appearance+"':",error);
			manifest = {};
		}
		
		// Load the markup for all extensions.
		for (extensionName in masterList) {
			shouldLoad = shouldLoadExtension(1, extensionName, masterList[extensionName].userExtension, menuName);
			if (shouldLoad) {
				extensionsListClient[extensionName] = {assetPath: "/extensions/"+extensionName};
				
				menus.push(fs.readFileSync(shouldLoad.path, "utf8").replace(/^<script.*€.*/gm, "").replace(/€\//g, "/extensions/"+extensionName+"/")); // Read the menu from file, remove legacy client scripts and replace asset path placeholder.
				// Read scripts and stylesheets.
				if (manifest.extensionScriptFileName || manifest.extensionStylesheetFileName) {
					files = fs.readdirSync(shouldLoad.directory);
					
					// € matches extension name, * is a wildcard.
					if (manifest.extensionScriptFileName.match(/€|\*/g)) {
						pattern = manifest.extensionScriptFileName.replace(/€/g, extensionName).replace(/\*/g, ".*")+"\\.js";
						regex = new RegExp(pattern);
						filtered = files.filter(fn => (fn.match(regex) ? true : false));
						if (filtered.length == 1) scripts.push("/extensions/"+extensionName+"/"+filtered[0]);
					} else {
						i = files.indexOf(manifest.extensionScriptFileName+".js");
						if (i != -1) scripts.push("/extensions/"+extensionName+"/"+files.i);
					}
					
					if (manifest.extensionStylesheetFileName.match(/€|\*/g)) {
						pattern = manifest.extensionStylesheetFileName.replace(/€/g, extensionName).replace(/\*/g, ".*")+"\\.css";
						regex = new RegExp(pattern);
						filtered = files.filter(fn => (fn.match(regex) ? true : false));
						if (filtered.length == 1) stylesheets.push("/extensions/"+extensionName+"/"+filtered[0]);
					} else {
						i = files.indexOf(manifest.extensionStylesheetFileName+".css");
						if (i != -1) stylesheets.push("/extensions/"+extensionName+"/"+files.i);
					}
				}
				
				// Read strings (translations);
				var stringsPath = null;
				if (customisations &&
					fs.existsSync(systemConfiguration.customisationPath+'/beo-extensions-override/'+extensionName+'/strings/'+systemConfiguration.language+'.json')) {
					stringsPath = systemConfiguration.customisationPath+'/beo-extensions-override/'+extensionName+'/strings/'+systemConfiguration.language+'.json';
				} else if (fs.existsSync(shouldLoad.directory+'/strings/'+systemConfiguration.language+'.json')) {
					stringsPath = shouldLoad.directory+'/strings/'+systemConfiguration.language+'.json';
				}
				if (stringsPath) {
					try {
						strings[extensionName] = require(stringsPath);
					} catch (error) {
						console.error("Error loading strings for extension '"+extensionName+"':", error);
					}
				}	
			}
		}
	}
	
	// Read appearance from disk.
	if (fs.existsSync(appearancePath+'/index.html')) {
		
		if (customisations) {
			if (customisations.stylesheet) stylesheets.push(customisations.stylesheet);
			if (customisations.navigationSets) navigationSets = customisations.navigationSets;
		}
		
		stylesheetMarkup = "";
		for (s in stylesheets) {
			stylesheetMarkup += '\t<link rel="stylesheet" href="'+stylesheets[s]+'">\n';
		}
		
		scriptMarkup = "";
		for (s in scripts) {
			scriptMarkup += '<script type="text/javascript" charset="utf-8" src="'+scripts[s]+'"></script>\n';
		}
		
		if (customisations && 
			customisations.systemClass) {
			var systemType = customisations.systemClass; // Use custom body class.
			var pageTitle = customisations.brand;
		} else if (systemConfiguration.cardType && 
			systemConfiguration.cardType.indexOf("Beocreate") != -1) {
			var systemType = "beocreate";
			var pageTitle = "Beocreate";
		} else {
			var systemType = "hifiberry";
			var pageTitle = "HiFiBerry";
		}
		bodyClassString = '<body class="'+systemType+' ';
		completeUI = fs.readFileSync(appearancePath+'/index.html', "utf8").replace("<html>", '<html lang="'+systemConfiguration.language+'">').replace("<title></", '<title>'+pageTitle+"</").replace('<body class="', bodyClassString).replace("</beo-dynamic-ui>", "").replace("<beo-dynamic-ui>", menus.join("\n\n")).replace("</beo-styles>", "").replace("<beo-styles>", stylesheetMarkup).replace("<beo-scripts>", "<script>systemType = '"+systemType+"';extensions = "+JSON.stringify(extensionsListClient)+";\n navigationSets = "+JSON.stringify(navigationSets)+";\ndebug = "+debugMode+";\ndeveloperMode = "+(developerMode)+";\ncustomisations = "+JSON.stringify(customisations)+";\ntranslations = "+JSON.stringify(strings)+"</script>\n").replace("</beo-scripts>", scriptMarkup);
		
		return completeUI;
	} else {
		return false;
	}
	
}


function loadCustomisations() {
	if (allowCustomisation && 
		systemConfiguration.customisationPath
		&& fs.existsSync(systemConfiguration.customisationPath+"/customisation.json")) {
		try {
			customisations = require(systemConfiguration.customisationPath+"/customisation.json");
			if (customisations.brand && customisations.systemClass) {
				beo.customisations = customisations;
				if (customisations.appearance) systemConfiguration.defaultAppearance = customisations.appearance;
				console.log("Customisations for '"+customisations.brand+"' loaded.");
			} else {
				customisations = null;
			}
		} catch (error) {
			console.error("Error loading customisations:", error);
		}
	}
}


// CLIENT COMMUNICATION (BEOCOM)


beoCom.on("open", function(connectionID, protocol) {
	// Connection opens. Nothing actually needs to be done here. The client will request setup status, which will get processed by the "setup" extension.
	beoBus.emit('general', {header: "connected"});
});


beoCom.on("data", function(data, connection) {
	// When data is received from the client, it is restructured as a targeted BeoBus event (so that the backend of an extension can receive data from its front end).
	var eventType = undefined;
	var eventHeader = undefined;
	var eventContent = undefined;
	var suppressError = false;
	
	//console.log(data);
	
	switch (data.target) {
		
		// Match our special event types first.
		case "general":
			if (data.header == "activatedExtension") {
				selectedExtension = data.content.extension;
				global.beo.selectedExtension = selectedExtension;
				selectedDeepMenu = data.content.deepMenu;
				global.beo.selectedDeepMenu = selectedDeepMenu;
				eventType = "general";
				eventHeader = "activatedExtension";
				eventContent = {extension: data.content.extension, deepMenu: data.content.deepMenu};
			}
			if (data.header == "reload") {
				content = (data.content) ? data.content : null;
				suppressError = true;
				sendToUI("general", "reload", data.content);
			}
			break;
		case "test":
		
			break;
			
		// The target attribute doesn't match any of the special event types, so the data is probably meant for a specific extension.
		default:
			eventType = data.target;
			eventHeader = data.header;
			if (data.content != undefined) eventContent = data.content;
			break;
	}
	
	if (eventType != undefined && eventHeader != undefined && eventContent != undefined) {
		beoBus.emit(eventType, {header: eventHeader, content: eventContent});
	} else if (eventType != undefined && eventHeader != undefined) {
		beoBus.emit(eventType, {header: eventHeader});
	} else {
		if (debugMode && !suppressError) console.error("Received insufficient data for processing:", data);
	}
});


// PRODUCT SOUND EFFECTS
var startupSoundPlayed = false;
var productSound = null;
function playProductSound(sound) {
	
	soundDirectory = systemDirectory+"/sounds/";
	soundPath = null;
	switch (sound) {
		case "startup":
			if (systemConfiguration.cardType.indexOf("Beocreate") != -1) soundPath = soundDirectory+"startup.wav";
			if (customisations && 
				customisations.sounds &&
				customisations.sounds.startup) soundPath = customisations.sounds.startup;
			startupSoundPlayed = true;
			break;
	}
	if (soundPath) {
		if (debugMode) console.log("Playing sound: "+sound+"...");
		if (!productSound) productSound = new aplay();
		productSound.play(soundPath);
	}
}


// DOWNLOAD & UPLOAD
// General-purpose download and upload functions available to extensions.

// Modified from https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries
function download(url, destination, filename = null) {
	return new Promise(function(resolve, reject) {
		if (url) {
			if (!filename) filename = url.substring(url.lastIndexOf('/') + 1);
			protocol = null;
			if (url.indexOf("https") != -1) {
				protocol = https;
			} else if (url.indexOf("http") != -1) {
				protocol = http;
			}
			if (protocol) {
				var request = protocol.get(url, function(response) {
					if (response.statusCode == 200) {
						var file = fs.createWriteStream(destination+"/"+filename);
						response.pipe(file);
						file.on('finish', function() {
							file.close(function(err) {
								if (!err) {
									resolve(destination+"/"+filename);
								} else {
									fs.unlink(destination+"/"+filename); // Delete the file asynchronously.
									reject(err);
								}
							});
						});
					} else {
						error = new Error("Error in downloading file. Server response was "+response.statusCode+".");
						reject(error);
					}
				}).on('error', function(error) { // Handle errors.
					console.error("Error in downloading file:", error);
					fs.unlink(destination+"/"+filename, (err) => {
						if (err) console.error("Error deleting file:", err);
					});
					reject(error);
				});
			} else {
				reject("The URL has no valid protocol.");
			}
		} else {
			reject("No URL specified for download.");
		}
	});
}



// SERVER SHUTDOWN
// Keep this at the bottom so it's easy to find.
//var extensionsRequestingShutdownTime = []; // This is found at the top.
var shutdownTimeout = null;
var powerCommand = null;
var shutdownDone = false;


process.once('SIGINT', function() {
	if (!shutdownDone) {
		if (debugMode) console.log("\nSIGINT received. Starting shutdown.");
		startShutdown();
	} else {
		console.log("Exiting Beocreate 2.");
		process.exit(0);
	}
});

process.once('SIGTERM', function() {
	if (!shutdownDone) {
		if (debugMode) console.log("\nSIGTERM received. Starting shutdown.");
		startShutdown();
	} else {
		console.log("Exiting Beocreate 2.");
		process.exit(0);
	}
});

function rebootSystem(extension, overrideUIActions) {
	if (extension) {
		if (debugMode) console.log("Reboot requested by '"+extension+"'.");
		powerCommand = "reboot";
		beoCom.send({header: "powerStatus", target: "general", content: {status: "rebooting", overrideUIActions: overrideUIActions}});
		startShutdown();
	}
}

function restartServer(extension) {
	if (extension) {
		if (debugMode) console.log("Server restart requested by '"+extension+"'.");
		if (daemonMode) {
			beoCom.send({header: "powerStatus", target: "general", content: {status: "serverRestart"}});
			restarter = exec('systemctl restart beocreate2'); //, { detached: true });
			//restarter.unref();
		} else {
			if (debugMode) console.log("Server is not indicated to be running as a daemon. Please restart manually.");
		}
		
	}
}

function shutdownSystem(extension, overrideUIActions) {
	if (extension) {
		if (debugMode) console.log("Shutdown requested by '"+extension+"'.");
		powerCommand = "shutdown";
		beoCom.send({header: "powerStatus", target: "general", content: {status: "shuttingDown", overrideUIActions: overrideUIActions}});
		startShutdown();
	}
}

function startShutdown(extension) {
	if (extensionsRequestingShutdownTime.length != 0) {
		if (debugMode) console.log("Extension(s) requesting shutdown time: '"+extensionsRequestingShutdownTime.join("', '")+"'.");
		shutdownTimeout = setTimeout(function() {
				if (extensionsRequestingShutdownTime.length != 0) {
					if (debugMode) console.log("Extension(s) '"+extensionsRequestingShutdownTime.join("', '")+"' requested time for shutdown but did not respond in time. Carrying on...");
				}
			completeShutdown();
		}, 5000);
		beoBus.emit('general', {header: "shutdown"});
	} else {
		beoBus.emit('general', {header: "shutdown"});
		completeShutdown();
	}
}

function requestShutdownTimeForExtension(extensionID) {
	if (extensionsRequestingShutdownTime.indexOf(extensionID) == -1) {
		extensionsRequestingShutdownTime.push(extensionID);
	}
}

function completeShutdownForExtension(extensionID) {
	i = extensionsRequestingShutdownTime.indexOf(extensionID);
	if (i != -1) {
		extensionsRequestingShutdownTime.splice(i, 1);
		if (shutdownTimeout != null) {
			if (debugMode) console.log("'"+extensionID+"' completed shutdown.");
			if (extensionsRequestingShutdownTime.length == 0) {
				clearTimeout(shutdownTimeout);
				shutdownTimeout = null;
				if (debugMode) console.log("All extensions completed shutdown.");
				completeShutdown();
			}
		}
	}
}

function completeShutdown() {
	
	beoCom.stopSocket(function() {
		if (debugMode) console.log("Saving pending settings...");
		savePendingSettings();
		if (debugMode) console.log("Stopped WebSocket communication.");
		beoServer.close(function() {
			if (debugMode) console.log("Stopped HTTP server. Shutdown complete.");
			shutdownDone = true;
		    if (powerCommand) {
		    	if (debugMode) console.log("Executing Raspberry Pi "+powerCommand+". It will trigger process exit.");
		    	piSystem.power(powerCommand);
		    } else {
				console.log("Exiting Beocreate 2.");
				process.exit(0);
			}
		   
		
		});
		
	});
	
}
