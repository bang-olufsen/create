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

// SETUP MANAGER FOR BEOCREATE ELEMENTS

	var extensions = beo.extensions;
	var selectedExtension = beo.selectedExtension;
	var debug = beo.debug;
	
	var defaultSettings = {
			"firstTimeSetup": true,
			"doingPostSetup": false
		};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var version = require("./package.json").version;
	
	var doPostSetup = false;
	var setupFlowOrder = ["choose-country", "network", "speaker-preset", "product-information", "privacy"];
	
	if (beo.customisations && 
		beo.customisations.setupFlowOrder &&
		typeof beo.customisations.setupFlowOrder == "object") {
		setupFlowOrder = beo.customisations.setupFlowOrder;
	}
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "activatedExtension") {
			selectedExtension = event.content.extension;
			if (setupFlow.length > 2) {
				checkIfMoreSteps(true);
				beo.bus.emit("ui", {target: "setup", header: "extensionChanged", content: {selectedExtension: selectedExtension}});
			}
		}
		
	});
	
	var setupFlow = [{extension: "setup", shown: false, allowAdvancing: true}, {extension: "setup-finish", shown: false, allowAdvancing: true}];
	// Setup is in the flow by default and two times, because it shows both introduction and finish screens.
	
	beo.bus.on('setup', function(event) {
		
		if (event.header == "settings") {
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
		}

		if (event.header == "getSetupStatus") {
			// The client always asks for this when it connects.
			if (setupFlow.length == 2) {
				// No (actual) extensions in the setup flow.
				if (settings.doingPostSetup) {
					settings.doingPostSetup = false;
					beo.saveSettings("setup", settings);
					beo.setup = true;
					selectedExtension = "setup-finish";
					beo.sendToUI("setup", "setupStatus", {setupFlow: [{extension: "setup-finish", shown: true, allowAdvancing: true}], setup: beo.setup, selectedExtension: selectedExtension, firstTime: settings.firstTimeSetup});
				} else {
					beo.sendToUI("setup", "setupStatus", {setupFlow: [], setup: beo.setup, selectedExtension: selectedExtension});
				}
			} else {
				if (!beo.setup) {
					// Setup will start with the first extension when the client connects for the first time.
					beo.setup = true;
					setupFinished = false;
					//setupFlow.unshift({extension: "setup", shown: false, allowAdvancing: true}); // Add the "welcome" screen to the beginning of the flow.
					selectedExtension = setupFlow[0].extension;
					beo.bus.emit("setup", {header: "startingSetup", content: {withExtension: setupFlow[0].extension}});
					beo.sendToUI("setup", "setupStatus", {setupFlow: setupFlow, setup: beo.setup, selectedExtension: selectedExtension, reset: true, firstTime: settings.firstTimeSetup});
				} else {
					// If setup is already underway, just send the current status. The UI should pick up.
					beo.sendToUI("setup", "setupStatus", {setupFlow: setupFlow, setup: beo.setup, selectedExtension: selectedExtension, firstTime: settings.firstTimeSetup});
				}
			}
			
		}
		
		if (event.header == "nextStep") {
			for (var i = 0; i < setupFlow.length; i++) {
				if (setupFlow[i].extension == selectedExtension) {
					if (setupFlow[i+1]) {
						// Command the next step.
						beo.bus.emit("setup", {header: "advancing", content: {fromExtension: selectedExtension}});
						beo.sendToUI("setup", "showExtension", {extension: setupFlow[i+1].extension});
						if (setupFlow[i+1].extension == "setup-finish") {
							if (doPostSetup) {
								settings.doingPostSetup = true;
								beo.saveSettings("setup", settings);
								beo.bus.emit("setup", {header: "postSetup"});
								beo.sendToUI("setup", "doingPostSetup", {now: true});
							}
						}
					} else {
						// No more extensions, finish.
						setupFlow = [{extension: "setup", shown: false, allowAdvancing: true}, {extension: "setup-finish", shown: false, allowAdvancing: true}];
						beo.setup = false;
						beo.bus.emit("setup", {header: "finishingSetup"});
						beo.sendToUI("setup", "setupStatus", {setupFlow: [], setup: "finished", selectedExtension: selectedExtension});
						settings.firstTimeSetup = false;
						setupFinished = true;
						beo.saveSettings("setup", settings);
					}
					break;
				}
			}
		}
		
	});
	
	
	function joinSetupFlow(extension, options) {
		// An extension can join the setup flow at any time, but it might not get its preferred placement if some extensions have already been shown to the user.
		
		joins = true;
		for (var i = 0; i < setupFlow.length; i++) {
			// Check that this extension doesn't already exist in the flow.
			if (setupFlow[i].extension == extension) {
				joins = false;
				break;
			}
		}
		if (extension == "setup" && extension == "setup-finish") joins = false;
		if (joins) {
			// Create an entry.
			allowAdvancing = (options.allowAdvancing) ? true : false
			newStep = {extension: extension, shown: false, allowAdvancing: allowAdvancing};
			
			var flowStart = (setupFlowOrder[0] != "setup") ? ["setup"] : [];
			var flowEnd = (setupFlowOrder[setupFlowOrder.length - 1] != "setup-finish") ? ["setup-finish"] : [];
			var theOrder = flowStart.concat(setupFlowOrder, flowEnd);
			
			tempFlow = [];
			for (i in setupFlow) {
				tempFlow[theOrder.indexOf(setupFlow[i].extension)] = setupFlow[i];
			}
			var index = theOrder.indexOf(extension);
			if (index == -1) index = tempFlow.length - 1; // Add to the end but before setup-finish.
			
			var lastShown = 0;
			for (var i = 0; i < setupFlow.length; i++) {
				if (setupFlow[i].shown) lastShown = i;
			}
			
			if (lastShown > index) {
				tempFlow[index] = newStep;
			} else {
				tempFlow[lastShown+1] = newStep;
			}
			setupFlow = tempFlow.filter(function (el) {
		  		return el != null;
			});
			
			beo.sendToUI("setup", "joinSetupFlow", {extension: extension, setupFlow: setupFlow});
			if (debug) console.log("Extension '"+extension+"' joined setup flow.");
			checkIfMoreSteps();
		}
		return joins;
	}
	
	function allowAdvancing(extension, allow) {
		// Controls whether or not the "Next Step" button is enabled for a given extension.
		if (extension != "setup" && extension != "setup-finish") {
			for (var i = 0; i < setupFlow.length; i++) {
				if (setupFlow[i].extension == extension) {
					setupFlow[i].allowAdvancing = allow;
					beo.sendToUI("setup", "allowAdvancing", {extension: extension, allow: allow});
					break;
				}
			}
		}
	}

	postSetupExtensions = [];
	function requestPostSetup(extension) {
		if (postSetupExtensions.indexOf(extension) == -1) postSetupExtensions.push(extension);
		doPostSetup = true;
		beo.sendToUI("setup", "doingPostSetup", {postSetup: doPostSetup});
	}
	
	function postSetupDone(extension) {
		index = postSetupExtensions.index(extension);
		if (index != -1) {
			postSetupExtensions.splice(index, 1);
			if (postSetupExtensions.length == 0) {
				doPostSetup = false;
				settings.doingPostSetup = false;
				beo.saveSettings("setup", settings);
				beo.sendToUI("setup", "doingPostSetup", {postSetup: doPostSetup});
			}
		}
	}
	
	function leaveSetupFlow(extension) {
		// If an extension decides it doesn't need setup anymore, it can leave the setup flow even during setup if it hasn't been shown yet.
		leaves = false;
		if (extension != "setup" && extension != "setup-finish") {
			for (var i = 0; i < setupFlow.length; i++) {
				if (setupFlow[i].extension == extension) {
					if (!setupFlow[i].shown) {
						leaves = true;
					} else {
						// If the extension can't be removed (it has been already shown), allow advancing over it.
						setupFlow[i].allowAdvancing = true;
						beo.sendToUI("setup", "allowAdvancing", {extension: extension, allow: true});
					}
					break;
				}
			}
			if (leaves) {
				setupFlow.splice(i, 1);
				beo.sendToUI("setup", "leaveSetupFlow", {extension: extension, setupFlow: setupFlow});
				checkIfMoreSteps();
			}
		}
		return leaves;
	}
	
	function checkIfMoreSteps(setShown) {
		for (var i = 0; i < setupFlow.length; i++) {
			// Check and send if more extensions are queued. Controls if the assistant bar shows "Next Step" or "Finish Setup".
			if (setupFlow[i].extension == selectedExtension) {
				if (setShown) setupFlow[i].shown = true;
				if (i < setupFlow.length-1) {
					beo.sendToUI("setup", "assistantButton", {lastStep: false});
				} else {
					beo.sendToUI("setup", "assistantButton", {lastStep: true});
				}
				break;
			}
		}
	}
	
	
module.exports = {
	joinSetupFlow: joinSetupFlow,
	leaveSetupFlow: leaveSetupFlow,
	allowAdvancing: allowAdvancing,
	requestPostSetup: requestPostSetup,
	postSetupDone: postSetupDone,
	setupFlow: setupFlow,
	version: version
};

