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
var exec = require("child_process").exec;

	var debug = beo.debug;
	
	var version = require("./package.json").version;
	
	
	var allSources = {};
	var currentSource = null;
	var focusedSource = null;
	
	var enabledHifiberrySources = 0;
	
	var startableSources = {}; // Different sources may hold multiple "sub-sources" (connected devices, physical media) that can be started.
	
	var focusIndex = 0; // Increment and assign to each source, so that it's known which one activated latest.
	var defaultSettings = {
			"port": 81, // HiFiBerry API port.
			"aliases": {},
			"sourceOrder": []
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var defaultAliases = {
		cd: {name: "CD", icon: "cd.svg"},
		phono: {name: "Phono", icon: "beogram.svg"},
		tape: {name: "Tape", icon: "tape.svg"},
		tv: {name: "Television", icon: "tv.svg"},
		computer: {name: "Computer", icon: "computer.svg"}
	}
	
	
	
	beo.bus.on('general', function(event) {
		// See documentation on how to use beo.bus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
			
		}
		
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "sources") {
				if (!checkingEnabled) checkEnabled();
			}
		}
	});
	
	
	beo.bus.on("sources", function(event) {
		
		
		switch (event.header) {
			case "settings":
			
				if (event.content.settings) {
					settings = Object.assign(settings, event.content.settings);
				}
				break;
			case "getSources":
				beo.bus.emit("ui", {target: "sources", header: "sources", content: {sources: allSources, currentSource: currentSource, focusedSource: focusedSource, sourceOrder: settings.sourceOrder}});
				break;
			case "getDefaultAliases":
				beo.bus.emit("ui", {target: "sources", header: "defaultAliases", content: {aliases: defaultAliases}});
				break;
			case "arrangeSources":
				if (event.content.sourceOrder) {
					settings.sourceOrder = event.content.sourceOrder;
					if (debug) console.log("Source order is now: "+settings.sourceOrder.join(", ")+".");
					beo.saveSettings("sources", settings);
					beo.sendToUI("sources", {header: "sources", content: {sources: allSources, currentSource: currentSource, focusedSource: focusedSource, sourceOrder: settings.sourceOrder}});
				}
				break;
			case "setAlias":
				if (event.content.extension) {
					if (event.content.alias) {
						if (event.content.defaultAlias) {
							if (defaultAliases[event.content.alias]) {
								setSourceOptions(event.content.extension, {alias: defaultAliases[event.content.alias]});
							} else {
								setSourceOptions(event.content.extension, {alias: false});
							}
						} else {
							setSourceOptions(event.content.extension, {alias: {name: event.content.alias, icon: null}});
						}
					} else {
						setSourceOptions(event.content.extension, {alias: false});
					}
				}
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
					beo.bus.emit("ui", {target: "sources", header: "startableSources", content: startableSources});
				}
				break;
			case "startSource":
				if (event.content.sourceID) {
					extension = event.content.sourceID;
					if (allSources[extension].startable) {
						beo.sendToUI("sources", {header: "starting", content: {extension: extension}});
						if (allSources[extension].usesHifiberryControl) {
							if (allSources[extension].aka) {
								sourceName = allSources[extension].aka[0];
							} else {
								sourceName = extension;
							}
							audioControl("start", sourceName, function(success) {
								if (!success) {
									beo.bus.emit(extension, {header: "start"});
								}
							});
						} else {
							beo.bus.emit(extension, {header: "start"});
						}
					}
				}
				break;
			case "setSourceVolume":
				if (currentSource && event.content.percentage != undefined) {
					beo.bus.emit(currentSource, {header: "setVolume", content: {percentage: event.content.percentage}});
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
				if (focusedSource && allSources[focusedSource].transportControls) {
					action = event.content.action;
					if (allSources[focusedSource].usesHifiberryControl) {
						audioControl(action, null, function(success) {
							if (!success) {
								switch (action) {
									case "playPause":
									case "play":
									case "pause":
									case "stop":
									case "next":
									case "previous":
										beo.bus.emit(focusedSource, {header: "transport", content: {action: action}});
										break;
								}
							}
						});
					} else {
						switch (action) {
							case "playPause":
							case "play":
							case "pause":
							case "stop":
							case "next":
							case "previous":
								beo.bus.emit(focusedSource, {header: "transport", content: {action: action}});
								break;
						}
					}
				}
				break;
			case "toggleLove":
				if (focusedSource && allSources[focusedSource].canLove) {
					if (!allSources[focusedSource].metadata.loved) {
						love = true;
					} else {
						love = false;
					}
					if (allSources[focusedSource].usesHifiberryControl) {
						action = (love) ? "love" : "unlove";
						
						audioControl(action, null, function(success) {
							if (success) {
								allSources[focusedSource].metadata.loved = love;
								beo.bus.emit("sources", {header: "metadataChanged", content: {metadata: allSources[focusedSource].metadata, extension: focusedSource}});
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


	function audioControl(operation, extra, callback) {
		switch (operation) {
			case "playPause":
			case "play":
			case "pause":
			case "stop":
			case "next":
			case "previous":
				endpoint = "/api/player/"+operation.toLowerCase();
				break;
			case "start":
				endpoint = "/api/player/activate/"+extra;
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
						
						if (overview.players[i].state == "playing") {
							sourceActivated(extension);
						} else {
							if (allSources[extension].active) sourceDeactivated(extension, overview.players[i].state);
						}
						
						beo.bus.emit("sources", {header: "playerStateChanged", content: {state: allSources[extension].playerState, extension: extension}});
						
						
						if (overview.players[i].state != "paused" && extension != currentAudioControlSource) {
							// This is not the current AudioControl source but because it is paused, check again after 15 seconds to see if it has changed.
							clearTimeout(sourceCheckTimeout);
							sourceCheckTimeout = setTimeout(function() {
								audioControlGet("status");
							}, 15000);
						}
					}
					
					if (overview.players[i].supported_commands) {
						if (allSources[extension].allowChangingTransportControls) {
							allSources[extension].transportControls = overview.players[i].supported_commands;
						}
						if (overview.players[i].supported_commands.indexOf("play") != -1) {
							allSources[extension].startable = true;
						} else {
							allSources[extension].startable = false;
						}
					} else {
						allSources[extension].startable = false;
					}
					
					if (extension == "bluetooth") {
						allSources[extension].aliasInNowPlaying = overview.players[i].name;
					}
					
					if (!allSources[extension].metadata.title) {
						if (overview.players[i].title) allSources[extension].metadata.title = overview.players[i].title;
						if (overview.players[i].artist) allSources[extension].metadata.artist = overview.players[i].artist;
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
			
			if (!focusedSource) focusedSource = extension;
			if (extension == "bluetooth") {
				allSources[extension].aliasInNowPlaying = metadata.playerName;
			}
			
			metadataChanged = false;
			playerStateChanged = false;
			
			if (metadata.title != allSources[extension].metadata.title ||
				metadata.artist != allSources[extension].metadata.artist ||
				metadata.albumTitle != allSources[extension].metadata.album ||
				metadata.artUrl != allSources[extension].metadata.picture||
				metadata.externalArtUrl != allSources[extension].metadata.externalPicture) {
				// Metadata updated.
				allSources[extension].metadata.title = metadata.title;
				allSources[extension].metadata.artist = metadata.artist;
				allSources[extension].metadata.album = metadata.albumTitle;
				allSources[extension].metadata.loved = metadata.loved;
				allSources[extension].metadata.picture = metadata.artUrl;
				allSources[extension].metadata.externalPicture = metadata.externalArtUrl;
				allSources[extension].metadata.picturePort = settings.port;
				//beo.bus.emit("sources", {header: "metadataChanged", content: {metadata: allSources[extension].metadata, extension: extension}});
				metadataChanged = true;
				// "Love track" support.
				if (allSources[extension].canLove != metadata.loveSupported) {
					setSourceOptions(extension, {canLove: metadata.loveSupported});
				}
			}
			
			if (metadata.playerState != allSources[extension].playerState) {
				// Player state updated _for this source_.
				allSources[extension].playerState = metadata.playerState;

				if (metadata.playerState == "playing") {
					sourceActivated(extension);
				} else {
					sourceDeactivated(extension);
				}
				
				//beo.bus.emit("sources", {header: "playerStateChanged", content: {state: allSources[extension].playerState, extension: extension}});
				playerStateChanged = true;
			}
			
			if (metadataChanged && !playerStateChanged) { // If player state has changed, this info will be sent by the function that keeps track of active sources. If only metadata changes, send it here.
				beo.bus.emit("sources", {header: "sourcesChanged", content: {sources: allSources, currentSource: currentSource, focusedSource: focusedSource}});
				beo.sendToUI("sources", {header: "sources", content: {sources: allSources, currentSource: currentSource, focusedSource: focusedSource}});
			}
			
			if (extension != currentAudioControlSource) {
				// If the active source indicated in AudioControl metadata changes, there won't be status updates for the previous source. Read it manually.
				currentAudioControlSource = extension;
				setTimeout(function() {
					audioControlGet("status");
				}, 2000);
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
		if (allSources[extension] && allSources[extension].enabled) {
			if (allSources[extension].focusIndex)  {
				// Source reactivates, recalculate activation indexes.
				reactivatedSourceFocusIndex = allSources[extension].focusIndex;
				allSources[extension].focusIndex = 0;
				focusIndex--;
				
				for (source in allSources) {
					if (allSources[source].focusIndex > reactivatedSourceFocusIndex) {
						allSources[source].focusIndex--;
					}
				}
			}
			focusIndex++;
			allSources[extension].active = true;
			allSources[extension].focusIndex = focusIndex;
			
			// Stop currently active sources, if the source demands it.
			if (allSources[extension].stopOthers) {
				if (allSources[currentSource] && allSources[currentSource].usesHifiberryControl && !allSources[extension].usesHifiberryControl) {
					// If the new source isn't part of AudioControl, stop other AudioControl sources manually.
					if (debug) console.log("Pausing sources under HiFiBerry control...");
					audioControl("pause");
				}
				for (source in allSources) {
					if (source != extension && 
						allSources[source].active) {
						if (!allSources[source].usesHifiberryControl) {
							// Stop all other non-AudioControl sources.
							beo.bus.emit(source, {header: "stop", content: {reason: "sourceActivated"}});
						}
					}
				}
			}
			if (playerState) {
				allSources[extension].playerState = playerState;
				//beo.bus.emit("sources", {header: "playerStateChanged", content: {state: playerState, extension: extension}});
			}
			
			determineCurrentSource();
			if (debug) console.log("Source '"+extension+"' has activated (index "+focusIndex+").");
	
		}
	}
	
	function sourceDeactivated(extension, playerState) {
		if (allSources[extension] && allSources[extension].active) {
			allSources[extension].active = false;
			if (!allSources[extension].transportControls && Object.keys(allSources[extension].metadata).length == 0) {
				// Remove the focus index from the source if it has no metadata and transport controls.
				deactivatedSourceFocusIndex = allSources[extension].focusIndex;
				allSources[extension].focusIndex = 0;
				focusIndex--;
				
				for (source in allSources) {
					if (allSources[source].focusIndex > deactivatedSourceFocusIndex) {
						allSources[source].focusIndex--;
					}
				}
			}
			
			if (playerState) {
				allSources[extension].playerState = playerState;
				//beo.bus.emit("sources", {header: "playerStateChanged", content: {state: playerState, extension: extension}});
			}
			
			determineCurrentSource();
			if (debug) console.log("Source '"+extension+"' has deactivated.");
		
		}
	}
	
	function determineCurrentSource() {
		activeSourceCount = 0;
		latestSource = null;
		highestFocusIndex = 0;
		focusedSource = null;
		newSource = null;
		for (source in allSources) {
			if (allSources[source].focusIndex > highestFocusIndex) {
				highestFocusIndex = allSources[source].focusIndex;
				focusedSource = source;
				if (allSources[source].active) {
					newSource = source;
					activeSourceCount++;
				}
			}
		}
		if (activeSourceCount == 0) {
			if (currentSource != null) {
				currentSource = null;
				beo.bus.emit("led", {header: "fadeTo", content: {options: {colour: "red"}}});
			}
		} else {
			if (newSource != currentSource) {
				currentSource = newSource;
				beo.bus.emit("led", {header: "fadeTo", content: {options: {colour: "green", speed: "fast"}, then: {action: "fadeOut", after: 10}}});
			}
		}
		
		beo.bus.emit("sources", {header: "sourcesChanged", content: {sources: allSources, currentSource: currentSource, focusedSource: focusedSource}});
		beo.sendToUI("sources", {header: "sources", content: {sources: allSources, currentSource: currentSource, focusedSource: focusedSource}});
		logSourceStatus();
	}
	
	function logSourceStatus() {
		if (debug >= 2) {
			message = "Sources: [play: "+currentSource+"] [focus: "+focusedSource+"]\n";
			for (source in allSources) {
				message += "["+source+"] active: "+allSources[source].active;
				if (allSources[source].active) message += " ("+allSources[source].focusIndex+". to activate)";
				message += ", state: "+allSources[source].playerState;
				if (allSources[source].metadata.title && allSources[source].metadata.artist) message += ", track: "+allSources[source].metadata.title+" - "+allSources[source].metadata.artist;
				message += "\n";
			}
		}
	}
	
	
	function setMetadata(extension, metadata) {
		
	}
	
	var sourceRegistrationTimeout;
	var sourcesRegistered = false;
	function setSourceOptions(extension, options, noUpdate) {

		if (beo.extensions[extension]) {
			sourceAdded = false;
			if (!allSources[extension]) {
				sourceAdded = true;
				allSources[extension] = {
					active: false,
					enabled: false,
					playerState: "stopped",
					stopOthers: true,
					transportControls: false,
					allowChangingTransportControls: true,
					usesHifiberryControl: false,
					canLove: false,
					startable: false,
					metadata: {},
					alias: null,
					aliasInNowPlaying: null
				};
				if (debug) console.log("Registering source '"+extension+"'...");
			}
			
			if (options.enabled != undefined) allSources[extension].enabled = (options.enabled) ? true : false;
			if (options.transportControls != undefined) {
				if (options.transportControls == true) {
					allSources[extension].transportControls = ["play", "pause", "next", "previous"];
				} else if (options.transportControls == false) {
					allSources[extension].transportControls = false;
				} else {
					allSources[extension].transportControls = options.transportControls;
				}
			}
			if (options.stopOthers != undefined) allSources[extension].stopOthers = (options.stopOthers) ? true : false;
			if (options.usesHifiberryControl != undefined) allSources[extension].usesHifiberryControl = (options.usesHifiberryControl) ? true : false;
			if (options.allowChangingTransportControls != undefined) allSources[extension].allowChangingTransportControls = (options.allowChangingTransportControls) ? true : false;
			if (options.aka) allSources[extension].aka = options.aka; // Other variations of the name the source might be called (by HiFiBerry Audiocontrol).
			if (options.canLove) allSources[extension].canLove = options.canLove; // Display or don't display the "love" button.
			if (options.startable) allSources[extension].startable = options.startable; // Can this source be started from Beocreate 2?
			if (options.playerState) allSources[extension].playerState = options.playerState;
			if (options.alias != undefined) { // An alias is an alternate name and icon for the source in Sources and Now Playing. Within the source's own menu the original name is shown for clarity. Alias is read from settings further below.
				if (options.alias) {
					allSources[extension].alias = {name: options.alias.name, icon: options.alias.icon};
					settings.aliases[extension] = {name: options.alias.name, icon: options.alias.icon};
					if (debug) console.log("Alias for source '"+extension+"' is now "+options.alias.name+".");
				} else {
					allSources[extension].alias = null;
					settings.aliases[extension] = null;
					if (debug) console.log("Alias for source '"+extension+"' was removed.");
				}
				beo.saveSettings("sources", settings);
			}
			if (options.aliasInNowPlaying != undefined) allSources[extension].aliasInNowPlaying = options.aliasInNowPlaying;
			
			
			if (!sourceAdded) { 
				if (!noUpdate) beo.sendToUI("sources", {header: "sources", content: {sources: allSources, currentSource: currentSource, focusedSource: focusedSource}});
				count = 0;
				for (source in allSources) {
					if (allSources[source].usesHifiberryControl) {
						if (allSources[source].enabled) count++;
					}
				}
				if (count != enabledHifiberrySources) {
					if (debug) console.log(count+" HiFiBerry-controlled sources are now enabled.");
					enabledHifiberrySources = count;
				}
			} else {
				
				if (settings.aliases[extension]) {
					allSources[extension].alias = {name: settings.aliases[extension].name, icon: settings.aliases[extension].icon};
				}
			}
			
			if (!sourcesRegistered) {
				clearTimeout(sourceRegistrationTimeout)
				sourceRegistrationTimeout = setTimeout (function() {
					if (debug) console.log("All sources registered.");
					
					// Order sources:
					orderChanged = false;
					// Check if any sources have been removed from the system.
					for (o in settings.sourceOrder) {
						if (!allSources[settings.sourceOrder[o]]) {
							// Remove this source from source order.
							settings.sourceOrder.splice(o, 1);
							orderChanged = true;
						}
					}
					// Check if any new sources exist in the system.
					for (source in allSources) {
						if (settings.sourceOrder.indexOf(source) == -1) {
							// This source doesn't exist. Add it to the mix alphabetically (by display name), preserving user order.
							titles = [];
							for (o in settings.sourceOrder) {
								titles.push(beo.extensionsList[settings.sourceOrder[o]].menuTitle);
							}
							newTitle = beo.extensionsList[source].menuTitle;
							newIndex = 0;
							for (t in titles) {
								if ([newTitle, titles[t]].sort()[1] == newTitle) newIndex = t+1;
							}
							settings.sourceOrder.splice(newIndex, 0, source);
							orderChanged = true;
						}
					}
					if (orderChanged) {
						if (debug) console.log("Source order is now: "+settings.sourceOrder.join(", ")+".");
						beo.saveSettings("sources", settings);
					}
					
					beo.bus.emit("sources", {header: "sourcesChanged", content: {sources: allSources, currentSource: currentSource, focusedSource: focusedSource, sourceOrder: settings.sourceOrder}});
					audioControlGet("status", function(result) {
						audioControlGet("metadata");
					});
					enabledHifiberrySources = 0;
					for (source in allSources) {
						if (allSources[source].usesHifiberryControl) {
							if (allSources[source].enabled) enabledHifiberrySources++;
						}
					}
					sourcesRegistered = true;
					

					
					
				}, 1000);
			}
		}
	}
	
	var checkingEnabled = false;
	var enabledChanged = false;
	function checkEnabled(queue, callback) {
		checkingEnabled = true;
		if (!queue) {
			if (debug > 1) console.log("Checking enabled status for all sources...");
			queue = [];
			for (extension in allSources) {
				if (beo.extensions[extension].isEnabled) {
					queue.push(extension);
				}
			}
		}
		if (queue.length > 0) {
			source = queue.shift();
			beo.extensions[source].isEnabled(function(enabled) {
				if (allSources[source].enabled != enabled) {
					enabledChanged = true;
					if (debug) {
						readableStatus = (enabled) ? "enabled" : "disabled";
						if (debug) console.log("Source '"+source+"' is now "+readableStatus+".");
					}
					setSourceOptions(source, {enabled: enabled}, queue.length > 0); // Sends update to UI if this is the last extension to check.
				} else if (queue.length == 0 && enabledChanged) {
					// If the last source to check has not changed but another has, just send update.
					beo.sendToUI("sources", {header: "sources", content: {sources: allSources, currentSource: currentSource, focusedSource: focusedSource}});
				}
				if (queue.length > 0) {
					checkEnabled(queue, callback);
				} else {
					checkingEnabled = false;
					if (callback) callback();
				}
			});
		}
	}
	
	
	function stopAllSources() {
		// Stop currently active sources, if the source demands it.
		execSync = require("child_process").execSync;
		execSync("/opt/hifiberry/bin/pause-all");
		for (source in allSources) {
			if (allSources[source].active) {
				if (!allSources[source].usesHifiberryControl) {
					// Stop all other non-AudioControl sources.
					beo.bus.emit(source, {header: "stop", content: {reason: "stopAll"}});
				}
			}
		}
	}
	
	
module.exports = {
	version: version,
	setSourceOptions: setSourceOptions,
	setMetadata: setMetadata,
	sourceActivated: sourceActivated,
	sourceDeactivated: sourceDeactivated,
	allSources: allSources,
	settings: settings,
	stopAllSources: stopAllSources
};




