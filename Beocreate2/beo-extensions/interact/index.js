/*Copyright 2019 Bang & Olufsen A/S
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

// BEOCREATE INTERACTION MODULE
// Connect triggers with actions to create an interactive sound system.



var version = require("./package.json").version;
var SerialPort = require('serialport'); // For communicating through serial ports.
var Readline = SerialPort.parsers.Readline; // For parsing with newline.

var debug = beo.debug;

var defaultSettings = {
	"interactions": {},
	"interactionsEnabled": true,
	"serialPortDevice": null
};
var settings = JSON.parse(JSON.stringify(defaultSettings));


beo.bus.on('general', function(event) {
	
	
	if (event.header == "startup") {
		
		getAllTriggersAndActions();
		
	}
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == "interact") {
			if (!event.content.deepMenu) {
				sendInteractionList();
			} else if (event.content.deepMenu == "serial-port") {
				sendSerialPortList();
			}
		}
		
	}
});

beo.bus.on('interact', function(event) {
	
	if (event.header == "settings") {
		
		if (event.content.settings) {
			settings = Object.assign(settings, event.content.settings);
			startSerialPort();
		}
		
	}
	
	if (event.header == "enableInteractions") {
		settings.interactionsEnabled = (event.content.enabled) ? true : false;
		beo.saveSettings("interact", settings);
		sendInteractionList();
	}
	
	if (event.header == "getInteraction" && event.content.withName) {
		[extension, type, index] = getInteractionByName(event.content.withName);
		interaction = settings.interactions[extension][type][index];
		interaction.triggerExtension = extension;
		interaction.triggerType = type;
		beo.sendToUI("interact", {header: "showInteraction", content: {interaction: interaction}});
	}
	
	if (event.header == "saveInteraction") {
		[extension, type, index] = getInteractionByName(event.content.name);
		if (event.content.triggerExtension == extension &&
			event.content.triggerType == type) { // Directly replace existing interaction.
			i = index;
		} else { // If the interaction doesn't exist or has different extension/trigger, delete it first and then recreate in the right place.
			if (extension != null) settings.interactions[extension][type].splice(index, 1);
			if (!settings.interactions[event.content.triggerExtension]) settings.interactions[event.content.triggerExtension] = {};
			if (!settings.interactions[event.content.triggerExtension][event.content.triggerType]) settings.interactions[event.content.triggerExtension][event.content.triggerType] = [];
			i = settings.interactions[event.content.triggerExtension][event.content.triggerType].push({}) - 1;
		}
		settings.interactions[event.content.triggerExtension][event.content.triggerType][i] = {
			name: event.content.name,
			triggerData: event.content.triggerData,
			actions: event.content.actions
		};
		if (debug) console.log("Saved interaction '"+event.content.name+"'.");
		cleanUpInteractions();
		beo.saveSettings("interact", settings);
		sendInteractionList("new", event.content.name);
	}
	
	if (event.header == "deleteInteraction") {
		[extension, type, index] = getInteractionByName(event.content.withName);
		if (extension != null) {
			settings.interactions[extension][type].splice(index, 1);
			cleanUpInteractions();
			beo.saveSettings("interact", settings);
			sendInteractionList("deleted", event.content.withName);
			if (debug) console.log("Interaction '"+event.content.withName+"' was removed.");
		}
	}
	
	if (event.header == "renameInteraction" &&
		event.content.oldName &&
		event.content.newName) {
		[extension, type, index] = getInteractionByName(event.content.oldName);
		settings.interactions[extension][type][index].name = event.content.newName;
		beo.saveSettings("interact", settings);
		sendInteractionList();
	}
	
	if (event.header == "selectSerialPort") {
		if (event.content && event.content.path) {
			settings.serialPortDevice = event.content.path;
			if (debug) console.log("Interact: selecting serial port '"+settings.serialPortDevice+"'.");
			startSerialPort();
		} else {
			if (debug) console.log("Interact: turning serial port off.");
			settings.serialPortDevice = null;
			stopSerialPort();
		}
		beo.sendToUI("interact", {header: "serialPortSelected", content: {selectedPort: settings.serialPortDevice}});
		beo.saveSettings("interact", settings);
	}
	
	if (event.header == "reconnectSerialPort") {
		startSerialPort();
	}
	
	if (event.header == "trigger") {
		runTrigger("interact", "httpAPI", {addressEnd: event.content.extra, body: event.content.body});
	}
	
});

function sendSerialPortList() {
	SerialPort.list().then(
		ports => {
			beo.sendToUI("interact", {header: "serialPorts", content: {ports: ports, selectedPort: settings.serialPortDevice}});
		},
		err => console.error("Interact couldn't get serial ports:", err));
}

var port = null;
var parser = null;
var portReconnectInterval = null;
function startSerialPort() {
	if (SerialPort && settings.serialPortDevice) {
		if (port && port.isOpen) {
			port.close(function() {
				startSerialPort();
			});
		} else {
		
			port = new SerialPort(settings.serialPortDevice);
			parser = port.pipe(new Readline({ delimiter: '\n' }));
			
			port.on('open', function() {
				if (debug) console.log("Interact: serial port opened to '"+settings.serialPortDevice+"'.");
				beo.bus.emit("interact", {header: "serialPortStatus", content: {status: "opened", port: settings.serialPortDevice}});
				sendSerialPortList();
				clearInterval(portReconnectInterval);
				portReconnectInterval = null;
			});
			
			parser.on('data', function(data) {
				serialReceive(data.slice(0, -1));
			});
			
			port.on('error', function(err) {
				if (!portReconnectInterval) console.error('Interact: serial port error: ', err.message);
			});
			
			port.on("close", function(err) {
				if (err) {
					console.error("Interact: serial port '"+port.path+"' was disconnected.");
					portReconnectInterval = setInterval(function() {
						startSerialPort();
					}, 30000);
					sendSerialPortList();
				} else {
					if (debug) console.log("Interact: serial port to '"+port.path+"' was closed.");
				}
				beo.sendToUI("interact", {header: "serialPortClosed", content: {port: port.path}});
				beo.bus.emit("interact", {header: "serialPortStatus", content: {status: "opened", port: port.path}});
			});
		
		}
	}
}

function stopSerialPort() {
	clearInterval(portReconnectInterval);
	if (port && port.isOpen) {
		port.close();
	}
}


function serialSend(message, newLine = true) {
	if (newLine) message += "\n";
	if (port) port.write(message, function(err) {
		if (err) {
			console.error('Interact: serial port write error: ', err.message);
		}
	});
}

var lastSerialMessage = null;
function serialReceive(data) {
	lastSerialMessage = data;
	if (debug >= 3) console.log("Interact: received serial message:", data);
	if (beo.selectedExtension == "interact") {
		beo.sendToUI("interact", {header: "serialMessage", content: {message: data}});
	}
	runTrigger("interact", "serialReceive", data);
}


var allTriggers = {
	interact: {
		serialReceive: function(data, interactData) {
			if (interactData.matchAll && data == interactData.matchAll) {
				return data;
			} else if (interactData.matchBeginning && data.startsWith(interactData.matchBeginning)) {
				if (interactData.removeBeginning) {
					return data.substr(interactData.matchBeginning.length);
				} else {
					return data;
				}
			} else {
				return undefined;
			}
		},
		httpAPI: function(data, interactData) {
			if (data.addressEnd && data.addressEnd == interactData.addressEnd) {
				if (data.body && data.body.data) {
					return data.body.data;
				} else {
					return true;
				}
			} else {
				return undefined;
			}
		}
	}
};
var allActions = {
	interact: {
		serialSend: function(data, triggerResult, stepResult) {
			data = data.message.toString().split("#trigger").join(triggerResult);
			data = data.split("#previous").join(stepResult);
			serialSend(data);
			return data;
		}
	}
};

function sendInteractionList(special = null, name = null) {
	interactions = [];
	for (extension in settings.interactions) {
		for (type in settings.interactions[extension]) {
			for (i in settings.interactions[extension][type]) {
				interactions.push({
					name: settings.interactions[extension][type][i].name,
					triggerExtension: extension,
					triggerType: type
				});
			}
		}
	}
	beo.sendToUI("interact", {header: "interactions", content: {interactions: interactions, interactionsEnabled: settings.interactionsEnabled, special: special, name: name}});
}

function cleanUpInteractions() {
	for (extension in settings.interactions) {
		if (Object.keys(settings.interactions[extension]).length == 0) {
			delete settings.interactions[extension];
		} else {
			for (type in settings.interactions[extension]) {
				if (settings.interactions[extension][type].length == 0) {
					delete settings.interactions[extension][type];
				}
			}
		}
	}
}

function getInteractionByName(name) {
	found = false;
	for (extension in settings.interactions) {
		for (type in settings.interactions[extension]) {
			for (i in settings.interactions[extension][type]) {
				if (settings.interactions[extension][type][i].name == name) {
					found = true;
					break;
				}
			}
			if (found) break;
		}
		if (found) break;
	}
	
	if (found) {
		return [extension, type, i];
	} else {
		return [null, null, null];
	}
}

function getAllTriggersAndActions() {
	for (extension in beo.extensions) {
		if (extension != "interact" && beo.extensions[extension].interact) {
			var imported = 0;
			if (beo.extensions[extension].interact.triggers) {
				allTriggers[extension] = beo.extensions[extension].interact.triggers;
				imported = 1;
			}
			if (beo.extensions[extension].interact.actions) {
				allActions[extension] = beo.extensions[extension].interact.actions;
				imported = (imported) ? 3 : 2;
			}
			if (debug > 2) {
				if (imported == 1) {
					if (debug > 2) console.log("Interact imported triggers from '"+extension+"'.");
				} else if (imported == 2) {
					if (debug > 2) console.log("Interact imported actions from '"+extension+"'.");
				} else if (imported == 3) {
					if (debug > 2) console.log("Interact imported triggers and actions from '"+extension+"'.");
				}
			}
		}
	}
}

async function runTrigger(extension, type, data = null) { // Other extensions can call the trigger.
	if (settings.interactions[extension] && settings.interactionsEnabled) {
		if (settings.interactions[extension][type] &&
			allTriggers[extension][type]) {
			for (i in settings.interactions[extension][type]) { // Check all interactions that include this trigger.
				if (settings.interactions[extension][type][i].actions) {
					triggerResult = await allTriggers[extension][type](data, settings.interactions[extension][type][i].triggerData);
					if (triggerResult != undefined) { // If the trigger function doesn't return undefined, run the actions.
						if (beo.selectedExtension == "interact") beo.sendToUI("interact", "runInteraction", {name: settings.interactions[extension][type][i].name});
						var stepResult = null;
						for (a in settings.interactions[extension][type][i].actions) {
							actionExtension = settings.interactions[extension][type][i].actions[a].extension;
							actionName = settings.interactions[extension][type][i].actions[a].type;
							if (allActions[actionExtension][actionName]) {
								try {
									var result = await allActions[actionExtension][actionName](settings.interactions[extension][type][i].actions[a].data, triggerResult, stepResult);
									if (result) stepResult = result;
								} catch (error) {
									console.error("Interact: error running action '"+actionName+"' for extension '"+actionExtension+"':", error);
								}
							}
						}
					}
				}
			}
		}
	}
}



module.exports = {
	version: version,
	runTrigger: runTrigger
};
