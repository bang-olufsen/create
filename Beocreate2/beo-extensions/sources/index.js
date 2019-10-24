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
var request = require("request");

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	
	var version = require("./package.json").version;
	
	
	var allSources = {};
	var activeSources = {};
	var currentSource = null;
	var lastSource = null;
	
	var startableSources = {}; // Different sources may hold multiple "sub-sources" (connected devices, physical media) that can be started.
	
	var activationIndex = 0; // Increment and assign to each source, so that it's known which one activated latest.
	var defaultSettings = {
			"port": 81 // HiFiBerry API port.
		};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	
	
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
			case "settings":
			
				if (event.content.settings) {
					settings = Object.assign(settings, event.content.settings);
				}
				break;
			case "getSources":
				beoBus.emit("ui", {target: "sources", header: "sources", content: {sources: allSources, currentSource: currentSource}});
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
			case "metadata": // Metadata from AudioControl.
				if (event.content) {
					processAudioControlMetadata(event.content);
				}
				break;
			case "getMetadata":
				audioControlGet("metadata");
				break;
			case "transport":
				if (currentSource && allSources[currentSource].transportControls) {
					if (allSources[currentSource].usesHifiberryControl) {
						audioControl(event.content.action, function(success) {
							if (!success) {
								switch (event.content.action) {
									case "playPause":
									case "play":
									case "stop":
									case "next":
									case "previous":
										beoBus.emit(currentSource, {header: "transport", content: {action: event.content.action}});
										break;
								}
							}
						});
					} else {
						switch (event.content.action) {
							case "playPause":
							case "play":
							case "stop":
							case "next":
							case "previous":
								beoBus.emit(currentSource, {header: "transport", content: {action: event.content.action}});
								break;
						}
					}
				}
				break;
			case "toggleLove":
				if (currentSource && allSources[currentSource].canLove) {
					if (!allSources[currentSource].metadata.loved) {
						love = true;
					} else {
						love = false;
					}
					if (allSources[currentSource].usesHifiberryControl) {
						action = (love) ? "love" : "unlove";
						
						audioControl(action, function(success) {
							if (success) {
								allSources[currentSource].metadata.loved = love;
								beoBus.emit("sources", {header: "metadataChanged", content: {metadata: allSources[currentSource].metadata, extension: currentSource}});
							}
						});
					}
				}
				break;
		}
	});
	
	
	// HIFIBERRY AUDIOCONTROL INTEGRATION
	
	
	function audioControlGet(dataType, callback) {
		switch (dataType) {
			case "metadata":
				endpoint = "/api/track/metadata";
				processor = processAudioControlMetadata;
				break;
			case "status":
				endpoint = "/api/player/status";
				processor = processAudioControlStatus;
				break;
		}
		if (endpoint && processor) {
			request.get({
				url: "http://127.0.1.1:"+settings.port+endpoint,
				json: true
			}, function(err, res, body) {
				if (err) {
					if (debug) console.log("Could not retrieve data: " + err);
					if (callback) callback(false);
				} else {
					if (res.statusCode == 200) {
						processor(body);
						if (callback) callback(true);
					} else {
						// No content.
						if (debug) console.log("Error retrieving data from AudioControl:", res.statusCode, err, body);
						if (callback) callback(false);
					}
				}
			});
		}
	}


	function audioControl(operation, callback) {
		switch (operation) {
			case "playPause":
			case "play":
			case "stop":
			case "next":
			case "previous":
				endpoint = "/api/player/"+operation.toLowerCase();
				break;
			case "love":
			case "unlove":
				endpoint = "/api/track/"+operation.toLowerCase();
				break;
		}
		if (endpoint) {
			request.post("http://127.0.1.1:"+settings.port+endpoint, function(err, res, body) {
				if (err) {
					if (debug) console.log("Could not send HiFiBerry control command: " + err);
					if (callback) callback(false, err);
				} else {
					if (callback) callback(true);
				}
			});
		}
	}
	
	sampleData = {
		"artist": "Nimanty & Solarsoul", 
		"title": "The Starry Sky (Original Space Ambient Mix)", 
		"albumArtist": "None", 
		"albumTitle": "The Starry Sky (Original Space Ambient Mix) - EP", 
		"artUrl": "artwork/cover-96fcd96903c89e62dc6e68d41eace55f.jpg", 
		"discNumber": null, 
		"tracknumber": null, 
		"playerName": "ShairportSync", 
		"playerState": "playing", 
		"playCount": null, 
		"mbid": null, 
		"loved": null, 
		"wiki": null
	};
	
	
	audioControlLastUpdated = null;
	sourceCheckTimeout = null;
	
	function processAudioControlStatus(overview) {
		if (overview.players && overview.last_updated) {
			//if (overview.last_updated != audioControlLastUdpated) {
				audioControlLastUpdated = overview.last_updated;
				for (var i = 0; i < overview.players.length; i++) {
					// Go through each source, see their status and update accordingly.
					extension = matchAudioControlSourceToExtension(overview.players[i].name);
					
					if (overview.players[i].state == "unknown") overview.players[i].state = "stopped";
					
					if (allSources[extension].playerState != overview.players[i].state) {
						allSources[extension].playerState = overview.players[i].state;
						
						if (overview.players[i].state != "stopped") {
							if (allSources[extension].active == false) sourceActivated(extension);
						} else {
							// If this source is no longer active, deactivate it.
							if (allSources[extension].active == true) sourceDeactivated(extension);
						}
						
						beoBus.emit("sources", {header: "playerStateChanged", content: {state: allSources[extension].playerState, extension: extension}});
					}
					if (overview.players[i].state != "paused" && extension != currentAudioControlSource) {
						// This is not the current AudioControl source but because it is paused, check again after 20 seconds to see if it has changed.
						clearTimeout(sourceCheckTimeout);
						sourceCheckTimeout = setTimeout(function() {
							audioControlGet("status");
						}, 20000);
					}
				}
			//}
		}
	}
	
	var currentAudioControlSource = null;
	
	function processAudioControlMetadata(metadata) {

		extension = matchAudioControlSourceToExtension(metadata.playerName);
		if (extension) {
			if (metadata.playerState == "unknown") metadata.playerState = "stopped";
			
			if (metadata.playerState != allSources[extension].playerState) {
				// Player state updated _for this source_.
				allSources[extension].playerState = metadata.playerState;

				if (metadata.playerState != "stopped") {
					if (allSources[extension].active == false) sourceActivated(extension);
				} else {
					if (allSources[extension].active == true) sourceDeactivated(extension);
				}
				
				beoBus.emit("sources", {header: "playerStateChanged", content: {state: allSources[extension].playerState, extension: extension}});
			}
			
			if (metadata.title != allSources[extension].metadata.title ||
				metadata.artist != allSources[extension].metadata.artist ||
				metadata.albumTitle != allSources[extension].metadata.album||
				metadata.artUrl != allSources[extension].metadata.picture) {
				// Metadata updated.
				allSources[extension].metadata.title = metadata.title;
				allSources[extension].metadata.artist = metadata.artist;
				allSources[extension].metadata.album = metadata.albumTitle;
				allSources[extension].metadata.loved = metadata.loved;
				allSources[extension].metadata.picture = metadata.artUrl;
				allSources[extension].metadata.picturePort = settings.port;
				beoBus.emit("sources", {header: "metadataChanged", content: {metadata: allSources[extension].metadata, extension: extension}});
				// "Love track" support.
				if (allSources[extension].canLove != metadata.loveSupported) {
					setSourceOptions(extension, {canLove: metadata.loveSupported});
				}
			}
			
			if (extension != currentAudioControlSource) {
				// If the active source indicated in AudioControl metadata changes, there won't be status updates for the previous source. Read it manually.
				currentAudioControlSource = extension;
				audioControlGet("status");
			}
		}
	}
	
	function matchAudioControlSourceToExtension(acSource) {
		// Determine which extension this belongs to.
		extension = null;
		if (acSource) {
			if (allSources[acSource.toLowerCase()]) {
				extension = acSource.toLowerCase();
			} else {
				for (source in allSources) {
					if (allSources[source].aka && allSources[source].aka.indexOf(acSource) != -1) {
						extension = source;
						break;
					}
				}
				if (!extension) extension = "bluetooth"; // Bluetooth sources can have various names.
			}
		}
		return extension;
	}
	
	
	// KEEP TRACK OF SOURCES
	
	
	function sourceActivated(extension, playerState) {
		if (allSources[extension] && allSources[extension].enabled && !allSources[extension].active) {
			activationIndex++;
			allSources[extension].active = true;
			allSources[extension].activationIndex = activationIndex;
			
			// Stop currently active sources, if the source demands it.
			if (allSources[extension].stopOthers) {
				audioControlStopped = false;
				for (source in allSources) {
					if (source != extension && 
						allSources[source].active) {
						if (allSources[source].usesHifiberryControl && 
							!audioControlStopped && 
							!allSources[extension].usesHifiberryControl) {
							// Only issue AudioControl pause command once, and only if the new source is not controlled by it (AudioControl will by itself take care of stopping the other source in other cases).
							audioControl("pause");
							audioControlStopped = true;
						} else {
							beoBus.emit(source, {header: "stop", content: {reason: "sourceActivated"}});
						}
					}
				}
			}
			
			if (debug) console.log("Source '"+extension+"' has activated (index "+activationIndex+").");
		
			determineCurrentSource();
			
			if (playerState) {
				allSources[extension].playerState = playerState;
				beoBus.emit("sources", {header: "playerStateChanged", content: {state: playerState, extension: extension}});
			}
		}
	}
	
	function sourceDeactivated(extension, playerState) {
		if (allSources[extension] && allSources[extension].active) {
			if (debug) console.log("Source '"+extension+"' has deactivated.");
			deactivatedSourceActivationIndex = allSources[extension].activationIndex;
			allSources[extension].activationIndex = 0;
			allSources[extension].active = false;
			activationIndex--;
			
			for (source in allSources) {
				if (allSources[source].activationIndex > deactivatedSourceActivationIndex) {
					allSources[source].activationIndex--;
				}
			}
			
			determineCurrentSource();
			
			if (playerState) {
				allSources[extension].playerState = playerState;
				beoBus.emit("sources", {header: "playerStateChanged", content: {state: playerState, extension: extension}});
			}
		}
	}
	
	function determineCurrentSource() {
		activeSourceCount = 0;
		latestSource = null;
		lastSource = null;
		highestActivationIndex = 0;
		playingSource = null;
		for (source in allSources) {
			if (allSources[source].active) {
				activeSourceCount++;
				if (allSources[source].activationIndex > highestActivationIndex) {
					highestActivationIndex = allSources[source].activationIndex;
					latestSource = source;
				}
			}
			if (allSources[source].playerState == "playing") {
				playingSource = source;
			}
		}
		if (activeSourceCount == 0) {
			if (currentSource != null) {
				lastSource = currentSource;
				currentSource = null;
				beoBus.emit("led", {header: "fadeTo", content: {options: {colour: "red"}}});
				
			}
		} else {
			newSource = null;
			if (playingSource && playingSource != currentSource) {
				newSource = playingSource;
			} else if (latestSource != currentSource) {
				newSource = latestSource;
			}
			if (newSource) {
				currentSource = newSource;
				beoBus.emit("led", {header: "fadeTo", content: {options: {colour: "green", speed: "fast"}, then: {action: "fadeOut", after: 10}}});
			}
		}
		
		beoBus.emit("sources", {header: "sourcesChanged", content: {sources: allSources, currentSource: currentSource, lastSource: lastSource}});
		beoBus.emit("ui", {target: "sources", header: "sources", content: {sources: allSources, currentSource: currentSource}});
	}
	
	
	function setSourceOptions(extension, options) {

		sourceAdded = false;
		allSourcesRegistered = true;
		
		if (!allSources[extension]) {
			sourceAdded = true;
			allSources[extension] = {
				active: false,
				enabled: false,
				playerState: "stopped",
				stopOthers: true,
				transportControls: false,
				usesHifiberryControl: false,
				canLove: false,
				startableSources: [],
				metadata: {}
			};
			if (debug) console.log("Registering source '"+extension+"'...");
			
			if (globals.extensionsList) {
				for (listedExtension in globals.extensionsList) {
					if (globals.extensionsList[listedExtension].isSource) {
						if (!allSources[listedExtension]) {
							allSourcesRegistered = false;
						}
					}
				}
			}
		}
		
		if (options.enabled != undefined) allSources[extension].enabled = (options.enabled) ? true : false;
		if (options.transportControls != undefined) allSources[extension].transportControls = (options.transportControls) ? true : false;
		if (options.stopOthers != undefined) allSources[extension].stopOthers = (options.stopOthers) ? true : false;
		if (options.usesHifiberryControl != undefined) allSources[extension].usesHifiberryControl = (options.usesHifiberryControl) ? true : false;
		if (options.aka) allSources[extension].aka = options.aka; // Other variations of the name the source might be called (by HiFiBerry Audiocontrol).
		if (options.canLove) allSources[extension].canLove = options.canLove; // Display or don't display the "love" button.
		if (options.startableSources) allSources[extension].startableSources = options.startableSources; // Add a list of startable sources under the main source (e.g. multiple AirPlay senders).
		if (options.playerState) allSources[extension].playerState = options.playerState;
		
		
		if (!sourceAdded) { 
			beoBus.emit("ui", {target: "sources", header: "sources", content: {sources: allSources, currentSource: currentSource, lastSource: lastSource}});
		} else {
			if (allSourcesRegistered) {
				console.log("All sources registered.");
				beoBus.emit("sources", {header: "sourcesChanged", content: {sources: allSources, currentSource: currentSource, lastSource: lastSource}});
				audioControlGet("status", function(result) {
					audioControlGet("metadata");
				});
			}
		}
	}
	
	
	
	
	return {
		version: version,
		setSourceOptions: setSourceOptions,
		sourceActivated: sourceActivated,
		sourceDeactivated: sourceDeactivated,
		allSources: allSources,
		settings: settings
	};
};




