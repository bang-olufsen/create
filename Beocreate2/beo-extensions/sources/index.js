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

// BEOCREATE SOURCES


module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	
	var version = require("./package.json").version;
	
	var activeSources = {};
	var currentSource = null;
	
	var startableSources = {}; // Different sources may hold multiple "sub-sources" (connected devices, physical media) that can be started.
	
	var activationIndex = 0; // Increment and assign to each source, so that it's known which one activated latest.
	
	
	beoBus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "sources") {
				
			}
		}
	});
	
	
	beoBus.on("sources", function(event) {
		
		switch (event.header) {
			case "sourceActivated":
				if (event.content.extension != undefined) {

					for (source in activeSources) {
						// Stop currently active sources, if the source demands it.
						if (source != event.content.extension && event.content.stopOthers) {
							beoBus.emit(source, {header: "stop", content: {reason: "sourceActivated"}});
						}
					}
					
					transportControls = false;
					volumeControl = false;
					if (event.content.transportControls) transportControls = true;
					if (event.content.volumeControl) volumeControl = true;
					
					activationIndex++;
					activeSources[event.content.extension] = {transportControls: transportControls, volumeControl: volumeControl, activationIndex: activationIndex};
					
					if (debug) console.log("Source '"+event.content.extension+"' has activated (index "+activationIndex+").");
					determineCurrentSource();
				}
				break;
			case "sourceDeactivated":
				if (event.content.extension != undefined) {
					if (activeSources[event.content.extension]) {
						if (debug) console.log("Source '"+event.content.extension+"' has deactivated.");
						deactivatedSourceActivationIndex = activeSources[event.content.extension].activationIndex;
						delete activeSources[event.content.extension];
						activationIndex--;
						
						for (source in activeSources) {
							if (activeSources[source].activationIndex > deactivatedSourceActivationIndex) {
								activeSources[source].activationIndex--;
							}
						}
					}
					determineCurrentSource();
				}
				break;
			case "getActiveSources":
			case "getSources":
				beoBus.emit("ui", {target: "sources", header: "activeSources", content: {activeSources: activeSources, currentSource: currentSource}});
				beoBus.emit("ui", {target: "sources", header: "startableSources", content: startableSources});
				break;
			case "startableSources":
				if (event.content.sources && event.content.extension) {
					for (source in startableSources) {
						if (startableSources[source].extension == event.content.extension) {
							if (!event.content.sources[source]) delete startableSources[source];
						}
					}
					for (source in event.content.sources) {
						startableSources[source] = event.content.sources[source];
						startableSources[source].extension = event.content.extension;
					}
					beoBus.emit("ui", {target: "sources", header: "startableSources", content: startableSources});
				}
				break;
			case "startSource":
				if (event.content.sourceID) {
					if (startableSources[event.content.sourceID] && startableSources[event.content.sourceID].extension) {
						beoBus.emit(startableSources[event.content.sourceID].extension, {header: "startSource", content: {sourceID: event.content.sourceID}});
					}
				}
				break;
			case "setSourceVolume":
				if (currentSource && event.content.percentage != undefined) {
					beoBus.emit(currentSource, {header: "setVolume", content: {percentage: event.content.percentage}});
				}
				break;
		}
	});
	
	function determineCurrentSource() {
		if (Object.keys(activeSources).length == 0) { 
			if (currentSource != null) {
				currentSource = null;
				beoBus.emit("led", {header: "fadeTo", content: {options: {colour: "red"}}});
				beoBus.emit("sound", {header: "sourceHandlesVolumeControl", content: {sourceHandlesVolumeControl: false}});
			}
		} else {
			highestActivationIndex = 0;
			latestSource = null;
			for (source in activeSources) {
				if (activeSources[source].activationIndex > highestActivationIndex) {
					highestActivationIndex = activeSources[source].activationIndex;
					latestSource = source;
				}
			}
			if (latestSource != currentSource) {
				currentSource = latestSource;
				if (activeSources[currentSource].volumeControl) {
					if (debug) console.log("Source '"+currentSource+"' has volume control.");
					beoBus.emit("sound", {header: "sourceHandlesVolumeControl", content: {sourceHandlesVolumeControl: true}});
				} else {
					beoBus.emit("sound", {header: "sourceHandlesVolumeControl", content: {sourceHandlesVolumeControl: false}});
				}
				beoBus.emit("led", {header: "fadeTo", content: {options: {colour: "green", speed: "fast"}, then: {action: "fadeOut", after: 10}}});
			}
		}
		beoBus.emit("ui", {target: "sources", header: "activeSources", content: {activeSources: activeSources, currentSource: currentSource}});
		beoBus.emit("sources", {header: "activeSources", content: {activeSources: activeSources, currentSource: currentSource}});
	}
	
	
	return {
		version: version
	};
};




