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

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var extensions = globals.extensions;
	var selectedExtension = globals.selectedExtension;
	var setup = globals.setup;
	var debug = globals.debug;
	
	var version = require("./package.json").version;
	
	beoBus.on('general', function(event) {
		
		if (event.header == "activatedExtension") {
			selectedExtension = event.content;
			if (setupFlow.length > 0) {
				checkIfMoreSteps(true);
			}
		}
		
	});
	
	var setupFlow = [];
	
	beoBus.on('setup', function(event) {

		if (event.header == "getSetupStatus") {
			// The client always asks for this when it connects.
			if (setupFlow.length == 0) {
				// No extensions in the setup flow.
				beoBus.emit("ui", {target: "setup", header: "setupStatus", content: {setupFlow: setupFlow, setup: setup, selectedExtension: selectedExtension}});
			} else {
				if (!setup) {
					// Setup will start with the first extension when the client connects for the first time.
					setup = true;
					setupFlow.unshift({extension: "setup", shown: false, allowAdvancing: true}); // Add the "welcome" screen to the beginning of the flow.
					beoBus.emit("setup", {header: "startingSetup", content: {withExtension: setupFlow[0].extension}});
					beoBus.emit("ui", {target: "setup", header: "setupStatus", content: {setupFlow: setupFlow, setup: setup, selectedExtension: setupFlow[0].extension}});
				} else {
					// If setup is already underway, just send the current status. The UI will should pick up.
					beoBus.emit("ui", {target: "setup", header: "setupStatus", content: {setupFlow: setupFlow, setup: setup, selectedExtension: selectedExtension}});
				}
			}
			
		}
		
		if (event.header == "nextStep") {
			for (var i = 0; i < setupFlow.length; i++) {
				if (setupFlow[i].extension == selectedExtension) {
					if (setupFlow[i+1]) {
						// Command the next step.
						beoBus.emit("ui", {target: "setup", header: "showExtension", content: {extension: setupFlow[i+1].extension, lastStep: true}});
					} else {
						// No more extensions, finish.
						setupFlow = [];
						setup = false;
						beoBus.emit("setup", {header: "finishingSetup"});
						beoBus.emit("ui", {target: "setup", header: "setupStatus", content: {setupFlow: setupFlow, setup: setup, selectedExtension: selectedExtension}});
					}
					break;
				}
			}
		}
		
	});
	
	function joinSetupFlow(extension, options) {
		// An extension can join the setup flow at any time, but it might not get its preferred placement if some extension have already been shown to the user.
		joins = true;
		for (var i = 0; i < setupFlow.length; i++) {
			// Check that this extension doesn't already exist in the flow.
			if (setupFlow[i].extension == extension) {
				joins = false;
				break;
			}
		}
		if (joins) {
			// Create an entry.
			newStep = {extension: extension, shown: false, allowAdvancing: false};
			if (options.before) newStep.before = options.before;
			if (options.after) newStep.after = options.after;
			// Next, determine the placement.
			newIndex = setupFlow.length; // Default to adding the extension to the end.
			
			// First fill out these indexes, then check if we need to resolve conflicts:
			beforeExisting = null; // If the new extension wants to be before an existing one.
			beforeNew = null; // If an existing extension wants to be before the new one.
			afterExisting = null; // If the new extension wants to be after an existing one.
			afterNew = null; // If an existing extension wants to be after the new one.
			
			for (var i = 0; i < setupFlow.length; i++) {
				if (newStep.before) {
					if (newStep.before.indexOf(setupFlow[i].extension) != -1) {
						beforeExisting = i;
					}
				}
				if (newStep.after) {
					if (newStep.after.indexOf(setupFlow[i].extension) != -1) {
						afterExisting = i+1;
					}
				}
			}
			
			setupFlow.splice(newIndex, 0, newStep); // Add to the flow.
			beoBus.emit("ui", {target: "setup", header: "joinSetupFlow", content: {extension: extension, setupFlow: setupFlow}});
			if (debug) console.log("Extension '"+extension+"' joined setup flow.");
			checkIfMoreSteps();
		}
		
		return joins;
	}
	
	function allowAdvancing(extension, allow) {
		// Controls whether or not the "Next Step" button is enabled for a given extension.
		for (var i = 0; i < setupFlow.length; i++) {
			if (setupFlow[i].extension == extension) {
				setupFlow[i].allowAdvancing = allow;
				beoBus.emit("ui", {target: "setup", header: "allowAdvancing", content: {extension: extension, allow: allow}});
				break;
			}
		}
		
	}
	
	function leaveSetupFlow(extension) {
		// If an extension decides it doesn't need setup anymore, it can leave the setup flow even during setup if it hasn't been shown yet.
		leaves = false;
		for (var i = 0; i < setupFlow.length; i++) {
			if (setupFlow[i].extension == extension && !setupFlow[i].shown) {
				leaves = true;
				break;
			}
		}
		if (leaves) {
			setupFlow.splice(i, 1);
			beoBus.emit("ui", {target: "setup", header: "leaveSetupFlow", content: {extension: extension, setupFlow: setupFlow}});
			checkIfMoreSteps();
		}
		return leaves;
	}
	
	function checkIfMoreSteps(setShown) {
		for (var i = 0; i < setupFlow.length; i++) {
			// Check and send if more extensions are queued. Controls if the assistant bar shows "Next Step" or "Finish Setup".
			if (setupFlow[i].extension == selectedExtension) {
				if (setShown) setupFlow[i].shown = true;
				if (i < setupFlow.length-1) {
					beoBus.emit("ui", {target: "setup", header: "assistantButton", content: {lastStep: false}});
				} else {
					beoBus.emit("ui", {target: "setup", header: "assistantButton", content: {lastStep: true}});
				}
				break;
			}
		}
	}
	
	
	return {
		joinSetupFlow: joinSetupFlow,
		leaveSetupFlow: leaveSetupFlow,
		allowAdvancing: allowAdvancing,
		setupFlow: setupFlow,
		version: version
	};
};

