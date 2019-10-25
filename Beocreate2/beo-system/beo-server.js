/*Copyright 2017-2019 Bang & Olufsen A/S
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

// Beocreate Essentials
var beoCom = require("../beocreate_essentials/communication")();
var piSystem = require('../beocreate_essentials/pi_system_tools');

// END DEPENDENCIES

var systemVersion = require("./package.json").version;
var defaultSystemConfiguration = {
	"cardType": "Beocreate 4-Channel Amplifier",
	"port": 80,
	"language": "en"
};
var systemConfiguration = JSON.parse(JSON.stringify(defaultSystemConfiguration));

var systemStatus = "normal"; 
/* Possible status codes: 
	'normal': standard operation
	'yellow': something requires attention, not critical
	'red': something has failed miserably, critical
*/
var extensionsRequestingShutdownTime = [];

global.systemDirectory = __dirname;
global.dataDirectory = "/etc/beocreate"; // Data directory for settings, sound presets, product images, etc.

var debugMode = false;
var daemonMode = false;

console.log("Beocreate 2 ("+systemVersion+"), copyright 2017-2019 Bang & Olufsen");


// CHECK COMMAND LINE ARGUMENTS
cmdArgs = process.argv.slice(2);
if (cmdArgs.indexOf("v") != -1) debugMode = 1;
if (cmdArgs.indexOf("vv") != -1) debugMode = 2;
if (cmdArgs.indexOf("vvv") != -1) debugMode = 2;
if (cmdArgs.indexOf("d") != -1) daemonMode = true;


// LOAD SYSTEM SETTINGS
// Contains sound card type, port to use, possibly disabled extensions.
if (fs.existsSync(dataDirectory+"/system.json")) {
	try {
		systemConfiguration = Object.assign(systemConfiguration, JSON.parse(fs.readFileSync(dataDirectory+"/system.json")));
	} catch (error) {
		console.error("Error loading system.json for system settings:", error);
		var systemConfiguration = JSON.parse(JSON.stringify(defaultsystemConfiguration));
	}
}


// BEOBUS

// A shared 'bus' where different parts of the system can broadcast messages.
var beoBus = new EventEmitter();
//beoBus.setMaxListeners(0); // An unknown, potentially large number of listeners can be listening to the same events, so let's not limit that. This is not available with eventemitter3.

var uiSettings = {
	disclosure: {}
};

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

function sendToUI(event) {
	// A direct "send to UI" method without going through BeoBus.
	if (event.header && event.target && event.content) {
		beoCom.send({header: event.header, target: event.target, content: event.content});
	} else if (event.header && event.target) {
		beoCom.send({header: event.header, target: event.target});
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
			if (event.content.extension) rebootSystem(event.content.extension);
			break;
		case "requestShutdown":
			if (event.content.extension) shutdownSystem(event.content.extension);
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
			if (fs.existsSync(dataDirectory+"/"+event.content.extension+".json")) { 
				settings = JSON.parse( // Read settings file.
					fs.readFileSync(dataDirectory+"/"+event.content.extension+".json")
				);
				// Return the parsed JSON.
				beoBus.emit(event.content.extension, {header: "settings", content: {settings: settings}});
				if (debugMode == 2) console.log("Settings loaded for '"+event.content.extension+"'.");
			} else {
				// If the settings file doesn't exist, return null.
				beoBus.emit(event.content.extension, {header: "settings", content: {settings: null}});
			}
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

function saveSettings(extension, settings, immediately) {
	if (immediately) { // Save immediately.
		fs.writeFileSync(dataDirectory+"/"+extension+".json", JSON.stringify(settings));
		if (debugMode == 2) console.log("Settings saved for '"+extension+"' (immediately).");
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
			if (debugMode == 2) console.log("Settings saved for '"+extension+"'.");
	    }
	}
	settingsToBeSaved = {}; // Clear settings from the queue.
}

function getAllSettings() {
	if (fs.existsSync(dataDirectory)) {
		settingsFiles = fs.readdirSync(dataDirectory);
		//console.log(sources);
		if (settingsFiles.length != 0) {
			for (var s = 0; s < settingsFiles.length; s++) {
				if (settingsFiles[s].indexOf(".json") != -1 && settingsFiles[s] != "system.json") { // Check that this is a JSON file.
					try {
						settings = JSON.parse( // Read settings file.
							fs.readFileSync(dataDirectory+"/"+settingsFiles[s])
						);
						
						// Return the parsed JSON.
						beoBus.emit(settingsFiles[s].split(".json")[0], {header: "settings", content: {settings: settings}});
						if (debugMode == 2) console.log("Settings loaded for '"+settingsFiles[s].split(".json")[0]+"'.");
					} catch (error) {
						console.error("Error loading settings for '"+settingsFiles[s].split(".json")[0]+"':", error);
					}
				}
			}
		}
	} else {
		fs.mkdirSync(dataDirectory);
	}
}


// LOAD EXTENSIONS, ASSEMBLE UI AND START SERVERS
var extensions = {}; // Import Node logic from extensions into this object.
var extensionsList = {};
var extensionsLoaded = false;
var beoUI = assembleBeoUI();
if (beoUI == false) console.log("User interface could not be constructed. 'index.html' is missing.");
var selectedExtension = null;


// HTTP & EXPRESS SERVERS
var expressServer = express();
var beoServer = http.createServer(expressServer).listen(systemConfiguration.port); // Create a HTTP server.

etags = (debugMode) ? false : true; // Disable etags (caching) when running with debug.
expressServer.use("/common", express.static(systemDirectory+"/common", {etag: etags})); // For product images.
expressServer.use("/product-images", express.static(dataDirectory+"/beo-product-images", {etag: etags})); // For product images.
expressServer.use("/extensions", express.static(systemDirectory+"/../beo-extensions", {etag: etags})); // For extensions.
expressServer.get("/", function (req, res) {
	// Root requested, serve the complete UI
	if (beoUI != false) {
		res.status(200);
		if (debugMode) {
			res.send(assembleBeoUI()); // No cache - use in development/debug
	  	} else {
	  		res.send(beoUI); // Cached version - use this in production
	  	}
	} else {
		// Return an error page.
		//fileServer.serveFile('./common/ui-error.html', 500, {}, request, response);
	}
});
// REST API endpoint to talk to extensions.
expressServer.use(express.json());
expressServer.post("/:extension/:header", function (req, res) {
	if (debugMode == 3) console.log("API request received at /"+req.params.extension+"/"+req.params.header+":", req.body);
	beoBus.emit(req.params.extension, {header: req.params.header, content: req.body});
	res.status(200);
	res.send("OK");
});

// START WEBSOCKET
beoCom.startSocket({server: beoServer, acceptedProtocols: ["beocreate"]});


getAllSettings();

beoBus.emit('general', {header: "startup", content: {debug: debugMode, systemVersion: systemVersion, extensions: extensionsList}});

if (systemConfiguration.runAtStart) {
	try {
		exec(systemConfiguration.runAtStart);
	} catch (error) {
		console.error("Could not run 'at start' command: "+error);
	}
}

if (debugMode) {
	// If we're in debug, don't play startup sound, just output to log.
	console.log("System startup.");
} else {
	// Play startup sound:
	playProductSound("startup");
}


function assembleBeoUI() {
	extensionsPath = systemDirectory+"/../beo-extensions";
	menus = [];
	if (fs.existsSync(extensionsPath)) {
		if (fs.existsSync(__dirname+'/navigation.txt')) {
			navigationItems = fs.readFileSync(__dirname+'/navigation.txt', "utf8").split("\n");
		} else {
			navigationItems = [];
		}
		extensionsNames = fs.readdirSync(extensionsPath);
		if (systemConfiguration.enabledExtensions && systemConfiguration.enabledExtensions.length > 0) {
			tempExtensionsNames = [];
			for (var e = 0; e < extensionsNames.length; e++) {
				if (enabledExtensions.indexOf(extensionsNames[e]) != -1) {
					tempExtensionsNames.push(extensionsNames[e]);
				} else {
					if (debugMode) console.log("Extension '"+extensionsNames[e]+"' is listed to be loaded, excluding unlisted extensions.");
				}
			}
			extensionsNames = tempExtensionsNames;
		} else if (systemConfiguration.disabledExtensions && systemConfiguration.disabledExtensions.length > 0) {
			tempExtensionsNames = [];
			for (var e = 0; e < extensionsNames.length; e++) {
				if (disabledExtensions.indexOf(extensionsNames[e]) == -1) {
					tempExtensionsNames.push(extensionsNames[e]);
				} else {
					if (debugMode) console.log("Extension '"+extensionsNames[e]+"' is disabled and won't be loaded.");
				}
			}
			extensionsNames = tempExtensionsNames;
		}
		
		allExtensions = {};
		menuStructure = [];
		scripts = [];
		translations = {};
		
		for (var i = 0; i < navigationItems.length; i++) {
			// Add top-level navigation to the menu structure.
			if (navigationItems[i].trim() != "-") {
				// Navigation item.
				if (extensionsNames.indexOf(navigationItems[i]) != -1) {
					// Check that this extension exists.
					menuStructure.push({kind: "menu", menu: navigationItems[i], submenus: []});
				}
			} else {
				// Separator.
				menuStructure.push({kind: "separator"});
			}
		}
		
		// Load all extensions.
		for (var e = 0; e < extensionsNames.length; e++) {
			if (extensionsNames[e].charAt(0) != ".") {
				if (debugMode == 2) console.log("Loading extension '"+extensionsNames[e]+"'...");
				extension = loadExtensionWithPath(extensionsNames[e], extensionsPath+"/"+extensionsNames[e], "extensions", false);
				if (extension != null) {
					allExtensions[extensionsNames[e]] = extension;
					/*if (extensionsNames[e] == "sources") {
						// Load sources too.
						sources = fs.readdirSync(__dirname+'/sources');
						for (var so = 0; so < sources.length; so++) {
							allExtensions[sources[so]] = loadExtensionWithPath(sources[so], __dirname+"/sources/"+sources[so], "sources", true);
						}
					}*/
				} else {
					for (var i = 0; i < menuStructure.length; i++) {
						if (menuStructure[i].menu == extensionsNames[e]) {
							menuStructure.splice(i, 1);
							break;
						}
					}
				}
			}
		}
		
		// Now we have an object that contains all extensions accessible by name. We also know what is the preferred parent menu for each, if applicable. Next go through all extensions and place them in the correct menu-submenu structure.
		// If the menu is a top level menu that doesn't exist, create it. Otherwise do nothing
		// If the menu is a submenu for a top level menu that doesn't yet exist, check for that top level menu and create it if it exists, otherwise leave as a top menu.
		// If the menu is a submenu and the top level menu exists, put it in.

		for (extension in allExtensions) {
			context = allExtensions[extension].context;
			if (allExtensions[extension].isSource) context = "sources";
			
			if (context) {
				// Prefers to be a submenu.
				menuPlaced = false;
				for (var m = 0; m < menuStructure.length; m++) {
					// Check if the top level menu exists.
					if (menuStructure[m].kind == "menu") {
						if (menuStructure[m].menu == context) {
							// Top level menu was found, put the submenu into it.
							menuStructure[m].submenus.push(extension);
							menuPlaced = true;
							break;
						}
					}
				}
				if (!menuPlaced) {
					// No existing top level menu was found.
					if (allExtensions[context]) {
						// Find the top-level extension and add it.
						menuStructure.push({kind: "menu", menu: context, submenus: [extension]});
					} else {
						// No parent menu was found in all extensions, make this a parent menu.
						menuStructure.push({kind: "menu", menu: extension, submenus: []});
					}
				}
			} else {
				// Prefers to be a top level menu.
				menuPlaced = false;
				for (var m = 0; m < menuStructure.length; m++) {
					// Check if the top level menu exists.
					if (menuStructure[m].kind == "menu") {
						if (menuStructure[m].menu == extension) {
							// Top level menu was found, do nothing.
							menuPlaced = true;
							break;
						}
					}
				}
				if (!menuPlaced) {
					// No existing top level menu was found, add it.
					menuStructure.push({kind: "menu", menu: extension, submenus: []});
				}
			}
		}
		// If a separator is the last item, remove it – it's not needed.
		if (menuStructure[menuStructure.length-1].kind == "separator") menuStructure.pop();
		
		// Now the menus are organised in the structure. Next, loop through the structure to assemble the markup.
		for (var m = 0; m < menuStructure.length; m++) {
			if (menuStructure[m].kind == "menu") {
				// Add top-level menus and submenus.
				readyMenu = allExtensions[menuStructure[m].menu].menu;
				scripts = scripts.concat(allExtensions[menuStructure[m].menu].scripts);
				for (var s = 0; s < menuStructure[m].submenus.length; s++) {
					readyMenu += "\n\n"+allExtensions[menuStructure[m].submenus[s]].menu;
					scripts = scripts.concat(allExtensions[menuStructure[m].submenus[s]].scripts);
				}
				menus.push('<section class="top-level">\n'+readyMenu+"</section>\n");
			} else if (menuStructure[m].kind == "separator") {
				// Add navigation separator.
				menus.push('<div class="nav-separator"></div>');
			}
		}
		
		// Print translations into a script tag.
		if (Object.keys(translations).length != 0) {
			//console.dir(translations);
			translations = "<script>\n\n// TRANSLATIONS\n\n var translations = "+JSON.stringify(translations)+"\n\n</script>";
		} else {
			translations = "";
		}
		
		extensionsLoaded = true;
	} else {
		menus.push("<script>\n\n// NO EXTENSIONS\n\n notify({title: 'Extensions folder missing', message: 'If you did not deliberately remove the folder from the product\'s file system, contact Bang & Olufsen Create support team.', id: 'noExtensions'});\nnoExtensions = true;\n\n</script>");
		translations = "";
	}
	
	if (fs.existsSync(__dirname+'/common/index.html')) {
		bodyClass = (systemConfiguration.cardType && systemConfiguration.cardType.indexOf("Beocreate") == -1) ? '<body class="hifiberry-os ' : '<body class="';
		completeUI = fs.readFileSync(systemDirectory+'/common/index.html', "utf8").replace("<html>", '<html lang="'+systemConfiguration.language+'">').replace('<body class="', bodyClass).replace("</beo-dynamic-ui>", "").replace("<beo-dynamic-ui>", menus.join("\n\n")).replace("</beo-translations>", "").replace("<beo-translations>", translations).replace("</beo-scripts>", "").replace("<beo-scripts>", scripts.join("\n"));
		
		
		return completeUI;
	} else {
		return false;
	}
	
}



function loadExtensionWithPath(extensionName, fullPath, basePath) {
	
	isSource = false;
	if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory() && fs.existsSync(fullPath+'/menu.html')) { 
		// A directory is a menu and its menu.html exists.
		menu = fs.readFileSync(fullPath+'/menu.html', "utf8"); // Read the menu from file.
		
		// First check if this extension is included or excluded with this hardware.
		shouldIncludeExtension = true;
		enableWith = menu.match(/data-enable-with="(.*?)"/g);
		disableWith = menu.match(/data-disable-with="(.*?)"/g);
		if (enableWith != null || disableWith != null) {
			shouldIncludeExtension = false;
			cardType = systemConfiguration.cardType.toLowerCase();
			if (enableWith != null) {
				if (enableWith[0].slice(18, -1).toLowerCase().split(", ").indexOf(cardType) != -1) 
					shouldIncludeExtension = true;
			} else if (disableWith != null) {
				if (disableWith[0].slice(19, -1).toLowerCase().split(", ").indexOf(cardType) == -1) shouldIncludeExtension = true;
			}
		}
		
		
		if (shouldIncludeExtension) {
			menu = menu.replace('>', ' data-asset-path="'+basePath+'/'+extensionName+'">'); // Add asset path.
			if (menu.indexOf('<div class="menu-screen source') != -1) isSource = true; 
			menu = menu.split('€/').join(basePath+'/'+extensionName+'/'); // Replace the special character in src with the correct asset path
			//menu = menu.split('€systemName').join(systemName); // Replace the special character in src with the correct asset path
			
			context = menu.match(/data-context="(.*?)"/g); // Get menu context (who it wants as a parent menu, if any).
			if (context != null) context = context[0].slice(14, -1).split("/")[0];
			
			// Load a translation array, if it exists.
			if (systemConfiguration.language != "en" && fs.existsSync(fullPath+'/translations/'+systemConfiguration.language+'.json')) {
				translations[menuPath] = JSON.parse(fs.readFileSync(fullPath+'/translations/'+systemConfiguration.language+'.json', "utf8"));
			}
			
			// Load the Node code for this extension
			extensionLoadedSuccesfully = false;
			if (!extensionsLoaded) {
				try {
					require.resolve(fullPath);
					try {
						extensions[extensionName] = require(fullPath)(beoBus, {
							systemConfiguration: systemConfiguration,
							extensions: extensions,
							extensionsList: extensionsList,
							setup: false,
							selectedExtension: selectedExtension, 
							debug: debugMode,
							daemon: daemonMode,
							sendToUI: sendToUI,
							download: download,
							downloadJSON: downloadJSON
						});
						extensionLoadedSuccesfully = true;
					}
					catch (error) {
						console.log("Error loading extension '"+extensionName+"':");
						console.log(error);
						extensionLoadedSuccesfully = false;
					}
				}
				catch (error) {
					if (debugMode) console.log("Extension '"+extensionName+"' has no server-side code.");
					extensionLoadedSuccesfully = true;
				}
			}
			if (!extensionsLoaded) extensionsList[extensionName] = ({isSource: isSource, loadedSuccesfully: extensionLoadedSuccesfully});
			
			// Extract scripts into a separate array
			extensionScripts = menu.match(/^<script.*/gm);
			menu = menu.replace(/^<script.*/gm, "");
			return {menu: menu, scripts: extensionScripts, context: context, isSource: isSource};
		} else {
			return null;
		}
	} else {
		return null;
	}
	
	
	
	
}



// CLIENT COMMUNICATION (BEOCOM)


beoCom.on("open", function(connectionID, protocol) {
	// Connection opens. Nothing actually needs to be done here. The client will request setup status, which will get processed by the "setup" extension.
	
});


beoCom.on("data", function(data, connection) {
	// When data is received from the client, it is restructured as a targeted BeoBus event (so that the backend of an extension can receive data from its front end).
	eventType = undefined;
	eventHeader = undefined;
	eventContent = undefined;
	
	//console.log(data);
	
	switch (data.target) {
		
		// Match our special event types first.
		case "general":
			if (data.header == "activatedExtension") {
				selectedExtension = data.content.extension;
				eventType = "general";
				eventHeader = "activatedExtension";
				eventContent = data.content.extension;
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
		if (debugMode) console.log("Received insufficient data for processing.");
	}
});


// PRODUCT SOUND EFFECTS
var productSound = null;
function playProductSound(sound) {
	if (debugMode) console.log("Playing sound: "+sound+"...");
	if (!productSound) productSound = new aplay();
	soundPath = __dirname+"/sounds/";
	soundFile = null;
	switch (sound) {
		case "startup":
			soundFile = "startup.wav";
			break;
	}
	if (soundFile) productSound.play(soundPath+soundFile);
}


// DOWNLOAD & UPLOAD
// General-purpose download and upload functions available to extensions.

// Modified from https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries
function download(url, destination, destinationFilename, callback) {
	if (url) {
		filename = url.substring(url.lastIndexOf('/') + 1);
		if (destinationFilename) filename = destinationFilename;
		if (debugMode) console.log("Downloading '"+filename+"' to '"+destination+"'...");
		if (destination.charAt(destination.length-1) == "/") destination = destination.slice(0, -1);
		var file = fs.createWriteStream(destination+"/"+filename);
		protocol = null;
		if (url.indexOf("https") != -1) {
			protocol = https;
		} else if (url.indexOf("http") != -1) {
			protocol = http;
		}
		if (protocol) {
			var request = protocol.get(url, function(response) {
				response.pipe(file);
				file.on('finish', function() {
					if (debugMode) console.log("Download of '"+filename+"' complete.");
					file.close(function(err) {
						if (!err) {
							if (callback) callback(true);
						} else {
							if (callback) callback(null, err);
						}
					});
				});
			}).on('error', function(error) { // Handle errors
				//console.log(err)
				if (debugMode) console.log("Download of '"+filename+"' failed.");
				fs.unlink(destination+"/"+filename); // Delete the file async. (But we don't check the result)
				if (callback) callback(error.message);
			});
		}
	} else {
		if (debugMode) console.log("No URL specified for download.")
	}
}

// Adapted from https://usefulangle.com/post/109/nodejs-read-json
function downloadJSON(url, callback) {
	protocol = null;
	if (url.indexOf("https") != -1) {
		protocol = https;
	} else if (url.indexOf("http") != -1) {
		protocol = http;
	}
	if (protocol) {
		var request = protocol.get(url, function(response) {
			var data = '';
			var jsonData;
			
			response.on('data', function(stream) {
				data += stream;
			});
			response.on('end', function() {
				err = null;
				try {
					jsonData = JSON.parse(data);
					//if (callback) callback(jsonData);
				} catch (error) {
					err = error;
					//if (callback) callback(null, error);
				}
				if (!err) {
					if (callback) callback(jsonData);
				} else {
					if (callback) callback(null, err);
				}
			});
		}).on('error', function(error) { // Handle errors
			if (debugMode) console.log("Download of '"+url+"' failed.");
			if (callback) callback(null, error.message);
		});
	} else {
		if (callback) callback(null, false);
	}
}


// SERVER SHUTDOWN
// Keep this at the bottom so it's easy to find.
//var extensionsRequestingShutdownTime = []; // This is found at the top.
var shutdownTimeout = null;
var powerCommand = null;

//setTimeout(function() {
process.once('SIGINT', function() {
	if (debugMode) console.log("SIGINT received. Starting shutdown.");
	startShutdown();
});

process.once('SIGTERM', function() {
	if (debugMode) console.log("SIGTERM received. Starting shutdown.");
	startShutdown();
});
//}, 2000);

function rebootSystem(extension) {
	if (extension) {
		if (debugMode) console.log("Reboot requested by '"+extension+"'.");
		powerCommand = "reboot";
		beoCom.send({header: "powerStatus", target: "general", content: {status: "rebooting"}});
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

function shutdownSystem(extension) {
	if (extension) {
		if (debugMode) console.log("Shutdown requested by '"+extension+"'.");
		powerCommand = "shutdown";
		beoCom.send({header: "powerStatus", target: "general", content: {status: "shuttingDown"}});
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
		if (debugMode) console.log("Stopped WebSocket communication.");
		beoServer.close(function() {
			if (debugMode) console.log("Stopped HTTP server. Shutdown complete.");
		    if (powerCommand) {
		    	if (debugMode) console.log("Executing Raspberry Pi "+powerCommand+".");
		    	piSystem.power(powerCommand);
		    } 
		   
			/*setTimeout(function() {
				log();
			}, 100);*/
			
			console.log("Exiting Beocreate 2.");
		    process.exit(0);
		});
		
	});
	
}

/* process.on( 'exit', function() {
	console.log("Forcing exit...");
    process.kill( process.pid, 'SIGTERM' );
} ); */