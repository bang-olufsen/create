/*Copyright 2018-2020 Bang & Olufsen A/S
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

// BEOCREATE SPEAKER EQUALISER

var beoDSP = require(beo.systemDirectory+'/beocreate_essentials/dsp');
var _ = beo.underscore;

	var debug = beo.debug;
	var extensions = beo.extensions;
	
	var version = require("./package.json").version;
	
	var metadata = {};
	var Fs = null;
	var Pi = Math.PI;
	
	var defaultSettings = {
		"a": [],
		"b": [],
		"c": [],
		"d": [],
		"ui": {
			showAllChannels: true,
			dBScale: 20,
			displayQ: "Q",
			groupAB: false,
			groupCD: false
		}
	}; 
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	// Channels are empty, because the filter bank length is dynamic based on sound preset and the DSP program. It will just do the right thing.
	
	var canControlEqualiser = {
	  "a": 0,
	  "b": 0,
	  "c": 0,
	  "d": 0
	};
	// Store the amount of equaliser filter banks available in the DSP here.
	
	var filterResponses = {
		"a": {data: [], master: []},
		"b": {data: [], master: []},
		"c": {data: [], master: []},
		"d": {data: [], master: []}
	};
	
	var driverTypes = {a: {}, b: {}, c: {}, d: {}};
	
	beo.bus.on('general', function(event) {
		// See documentation on how to use beo.bus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "equaliser") {
				
				beo.sendToUI("equaliser", {header: "settings", content: {uiSettings: settings.ui, channels: {a: settings.a, b: settings.b, c: settings.c, d: settings.d}, canControl: canControlEqualiser, Fs: Fs}});
			}
		}
	});
	
	beo.bus.on('equaliser', function(event) {
		
		if (event.header == "settings") {
			
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
			
		}
		
		if (event.header == "setScale") {
			if (event.content.dBScale) {
				settings.ui.dBScale = event.content.dBScale;
				beo.saveSettings("equaliser", settings);
			}
		}
		
		if (event.header == "setQDisplay") {
			if (event.content.unit) {
				settings.ui.displayQ = event.content.unit;
				beo.saveSettings("equaliser", settings);
			}
		}
		
		if (event.header == "setShowAllChannels") {
			if (event.content.show != undefined) {
				settings.ui.showAllChannels = event.content.show;
				beo.sendToUI("equaliser", {header: "settings", content: {uiSettings:  settings.ui}});
				beo.saveSettings("equaliser", settings);
			}
		}
		
		if (event.header == "groupChannels" && event.content.channels) {
			sendChannels = {};
			if (event.content.channels == "AB") {
				if (event.content.grouped == true) {
					if (event.content.fromChannel == "a") {
						settings.b = _.clone(settings.a);
						sendChannels.b = settings.b;
						applyAllFiltersFromSettings("b");
					} else if (event.content.fromChannel == "b") {
						settings.a = _.clone(settings.b);
						sendChannels.a = settings.a;
						applyAllFiltersFromSettings("a");
					}
				}
				settings.ui.groupAB = event.content.grouped;
			}
			if (event.content.channels == "CD") {
				if (event.content.grouped == true) {
					if (event.content.fromChannel == "c") {
						settings.d = _.clone(settings.c);
						sendChannels.d = settings.d;
						applyAllFiltersFromSettings("d");
					} else if (event.content.fromChannel == "d") {
						settings.c = _.clone(settings.d);
						sendChannels.c = settings.c;
						applyAllFiltersFromSettings("c");
					}
				}
				settings.ui.groupCD = event.content.grouped;
			}
			beo.sendToUI("equaliser", {header: "settings", content: {uiSettings:  settings.ui, channels: sendChannels}});
			beo.saveSettings("equaliser", settings);
		}
		
		if (event.header == "addFilter" && event.content.channel && event.content.type) {
			addToChannel = getGroupedChannels(event.content.channel);
			sendChannels = {};
			newIndex = null;
			for (var c = 0; c < addToChannel.length; c++) {
				channel = addToChannel.charAt(c);
				canAdd = canControlEqualiser[channel] - settings[channel].length;
				if (canAdd >= 1) {
					if (debug) console.log("Adding filter of type '"+event.content.type+"' to channel "+channel.toUpperCase()+"...");
					switch (event.content.type) {
						case "peak":
						case "highShelf":
						case "lowShelf":
							newIndex = settings[channel].push({type: event.content.type, frequency: 1000, Q: 0.7071, gain: 0}) -1;
							break;
						case "coeffs":
							newIndex = settings[channel].push({a0: 1, a1: 0, a2: 0, b0: 1, b1: 0, b2: 0, samplingRate: Fs}) -1;
							break;
						case "highPass":
						case "lowPass":
							groupID = new Date().getTime();
							if (canAdd >= 2) {
								newIndex = settings[channel].push(
									{type: event.content.type, frequency: 2000, crossoverType: "LR4", groupID: groupID},
									{type: event.content.type, frequency: 2000, crossoverType: "LR4", groupID: groupID}) -1;
							} else {
								newIndex = settings[channel].push({type: event.content.type, frequency: 2000, crossoverType: "BW2", cossoverID: groupID}) -1;
							}
							break;
						
					}
					applyAllFiltersFromSettings(channel);
					sendChannels[channel] = settings[channel];
				} else {
					console.error("Can't add more filters to channel "+channel.toUpperCase()+", maximum supported amount exceeded.");
				}
			}
			beo.sendToUI("equaliser", {header: "settings", content: {channels: sendChannels, newFilterIndex: newIndex}});
			beo.saveSettings("equaliser", settings);
		}
		
		if (event.header == "deleteFilter" && event.content.channel && event.content.filter != undefined) {
			deleteFromChannel = getGroupedChannels(event.content.channel);
			
			sendChannels = {};
			for (var c = 0; c < deleteFromChannel.length; c++) {
				channel = deleteFromChannel.charAt(c);
				if (typeof event.content.filter == "number") {
					if (settings[channel][event.content.filter]) {
						settings[channel].splice(event.content.filter, 1);
					}
					if (debug) console.log("Deleted a filter from channel "+channel.toUpperCase()+".");
				} else {
					if (settings[channel][event.content.filter[0]]) {
						delete settings[channel][event.content.filter[0]];
					}
					if (settings[channel][event.content.filter[1]]) {
						delete settings[channel][event.content.filter[1]];
					}
					cleaned = settings[channel].filter(function (el) {
						return el != null;
					});
					settings[channel] = cleaned;
					if (debug) console.log("Deleted two filters from channel "+channel.toUpperCase()+".");
				}
				applyAllFiltersFromSettings(channel);
				sendChannels[channel] = settings[channel];
			}
			beo.sendToUI("equaliser", {header: "settings", content: {channels: sendChannels}});
			beo.saveSettings("equaliser", settings);
		}
		
		if (event.header == "deleteAllFilters" && event.content.channel) {
			deleteFromChannel = getGroupedChannels(event.content.channel);
			
			sendChannels = {};
			for (var c = 0; c < deleteFromChannel.length; c++) {
				channel = deleteFromChannel.charAt(c);
				settings[channel] = [];
				applyAllFiltersFromSettings(channel);
				sendChannels[channel] = settings[channel];
			}
			beo.sendToUI("equaliser", {header: "settings", content: {channels: sendChannels}});
			beo.saveSettings("equaliser", settings);
		}
		
		if (event.header == "setFilter" && event.content.items) {
			for (var i = 0; i < event.content.items.length; i++) {
				item = event.content.items[i];
				if (item.channel && 
					item.index != undefined &&
					item.filter) {
					setChannel = getGroupedChannels(item.channel);
					
					for (var c = 0; c < setChannel.length; c++) {
						channel = setChannel.charAt(c);
						if (debug >= 3) console.log("Setting filter "+item.index+" on channel "+channel.toUpperCase()+".");
						settings[channel][item.index] = item.filter;
						applyFilterFromSettings(channel, item.index);
					}
				}
			}
			beo.saveSettings("equaliser", settings);
		}
		
		if (event.header == "setFilterProto") {
			// An experimental method to key in filters from the web inspector command line.
			if (event.content.channel && event.content.index != undefined) {
				for (var c = 0; c < event.content.channel.length; c++) {
					if (event.content.filter) {
						// Apply filter.
						if (settings[event.content.channel.charAt(c)][event.content.index]) {
							settings[event.content.channel.charAt(c)][event.content.index] = event.content.filter;
							applyFilterFromSettings(event.content.channel.charAt(c), event.content.index);
							beo.bus.emit("ui", {target: "equaliser", header: "setFilterProto", content: {updated: event.content.index}});
						} else {
							newFilterIndex = settings[event.content.channel.charAt(c)].push(event.content.filter) - 1;
							applyFilterFromSettings(event.content.channel.charAt(c), newFilterIndex);
							beo.bus.emit("ui", {target: "equaliser", header: "setFilterProto", content: {added: newFilterIndex}});
						}
						beo.bus.emit("settings", {header: "saveSettings", content: {extension: "equaliser", settings: settings}});
						
					} else {
						// Remove filter.
						console.log("Removing filter ("+event.content.channel.charAt(c).toUpperCase()+" "+event.content.index+")...");
						settings[event.content.channel.charAt(c)].splice(event.content.index, 1);
						beo.bus.emit("settings", {header: "saveSettings", content: {extension: "equaliser", settings: settings}});
						applyAllFiltersFromSettings(event.content.channel.charAt(c));
					}
				}
				beo.sendToUI("equaliser", {header: "settings", content: {settings: settings, canControl: canControlEqualiser, Fs: Fs}});
			}
		}
	});
	
	beo.bus.on('dsp', function(event) {
		
		
		if (event.header == "metadata") {
			
			if (event.content.metadata) {
				metadata = event.content.metadata;
				if (metadata.sampleRate) {
					Fs = parseInt(metadata.sampleRate.value[0]);
					for (var c = 0; c < 4; c++) {
						channel = "abcd".charAt(c);
						applyAllFiltersFromSettings(channel, true);
					}
				} else {
					Fs = null;
					canControlEqualiser = {
					  "a": 0, "b": 0, "c": 0, "d": 0
					};
				}
				
			} else {
				metadata = {};
				Fs = null;
				canControlEqualiser = {
				  "a": 0, "b": 0, "c": 0, "d": 0
				};
			}
			
		}
	});
	
	/* 
	Checks that the supplied settings are valid and compatible with the current DSP program.
	1. Returns a compatibility report. Possible cases:
		0: No compatibility issues.
		1: The DSP program doesn't support the setting, and it will be ignored.
		2: The setting is supported, but the value was not recognised. Using the default value.
		3: The setting is supported and the value was upgraded.
		4: The setting is supported and the value was valid, but the filter bank isn't long enough.
	2. Returns validated settings. If everything checks out, it's a copy of the input. Any incompatibilities will be stripped out or adapted (use this to migrate old settings in case of an upgrade). 
	*/
	
	function checkSettings(theSettings, samplingRate) {
		validatedSettings = {};
		compatibilityIssues = {};
		
		for (var c = 0; c < 4; c++) {
			channel = "abcd".charAt(c);
			if (theSettings[channel] != undefined) {
				validatedSettings[channel] = [];
				compatibilityIssues[channel] = [];
				
				for (var f = 0; f < theSettings[channel].length; f++) {
					filter = theSettings[channel][f];
					
					if (filter.a1 != undefined &&
						filter.a2 != undefined &&
						filter.b0 != undefined &&
						filter.b1 != undefined &&
						filter.b2 != undefined) {
						// We have coefficients. Expects A0 to always be 1.
						if (filter.samplingRate) {
							compatibility = 0;
						} else if (samplingRate) {
							filter.samplingRate = samplingRate;
							compatibility = 0;
						} else {
							compatibility = 2;
						}
					} else if (filter.type != undefined) {
						switch (filter.type) {
							case "peak":
								if (filter.frequency != undefined &&
								 	filter.Q != undefined && 
								 	filter.gain != undefined) {
									compatibility = 0;
								} else {
									compatibility = 2;
								}
								break;
							case "lowShelf":
								if (filter.frequency != undefined &&
								 	filter.Q != undefined && 
								 	filter.gain != undefined) {
									compatibility = 0;
								} else {
									compatibility = 2;
								}
								break;
							case "highShelf":
								if (filter.frequency != undefined &&
								 	filter.Q != undefined && 
								 	filter.gain != undefined) {
									compatibility = 0;
								} else {
									compatibility = 2;
								}
								break;
							case "lowPass":
								if (filter.frequency != undefined) {
									compatibility = 0;
								} else {
									compatibility = 2;
								}
								break;
							case "highPass":
								if (filter.frequency != undefined) {
									compatibility = 0;
								} else {
									compatibility = 2;
								}
								break;
							default:
								compatibility = 2;
								break;
						}
					}
					
					if (compatibility == 0) {
						if (f+1 > canControlEqualiser[channel]) compatibility = 4;
						validatedSettings[channel].push(filter);
					} else if (compatibility == 2) {
						// Unsupported filters can be left out.
						//validatedSettings[channel].push(false);
					}
					
					compatibilityIssues[channel].push(compatibility);
				}
				if (canControlEqualiser[channel] == 0) {
					compatibilityIssues[channel] = 1;
				}
			}
		}
		
		return {compatibilityIssues: compatibilityIssues, validatedSettings: validatedSettings, previewProcessor: "equaliser.generateSettingsPreview"};
	}
	
	function applySoundPreset(theSettings, samplingRate) {
		settings = Object.assign(settings, checkSettings(theSettings, samplingRate).validatedSettings);
		for (var c = 0; c < 4; c++) {
			channel = "abcd".charAt(c);
			applyAllFiltersFromSettings(channel, true);
		}
		importChannelGroups();
		beo.saveSettings("equaliser", settings);
	}
	
	
	function applyAllFiltersFromSettings(channel, checkMetadata) {
		
		if (checkMetadata) {
			if (metadata["IIR_"+channel.toUpperCase()] && metadata["IIR_"+channel.toUpperCase()].value[0]) {
				canControlEqualiser[channel] = parseInt(metadata["IIR_"+channel.toUpperCase()].value[0].split("/")[1])/5; // Save how many filters are in this bank.
			} else {
				canControlEqualiser[channel] = 0; // Can't do anything
			}
			if (debug) console.log("Channel "+channel.toUpperCase()+" has "+canControlEqualiser[channel]+" biquad filters available.");
		}
		
		if (canControlEqualiser[channel]) {
			
			// Loop through the whole available DSP filter bank.
			// If the current settings have more filters, apply as many as possible. If there are fewer, the filter function will automatically apply a flat filter instead.
			if (debug) console.log("Applying biquad filters for channel "+channel.toUpperCase()+"...");
			crossoverTypesImported = false;
			for (var f = 0; f < canControlEqualiser[channel]; f++) {
				if (importCrossoverType(channel, f)) crossoverTypesImported = true;
				applyFilterFromSettings(channel, f);
			}
			if (crossoverTypesImported) beo.saveSettings("equaliser", settings);
		}
		
	}
	
	
	function applyFilterFromSettings(channel, filterIndex) {
		if (parseInt(metadata["IIR_"+channel.toUpperCase()].value[0].split("/")[1]) >= (canControlEqualiser[channel] * 5)) { // Check that this register exists, just in case.
			register = parseInt(metadata["IIR_"+channel.toUpperCase()].value[0].split("/")[0])+(filterIndex * 5); // This is the register (start register + 5 * filter index)
			
			if (settings[channel][filterIndex] != undefined) {
				filter = settings[channel][filterIndex];
				// There is a filter on the channel at this index. Find out its type and create coefficients, or if there are existing coefficients (for custom filters), prioritise those and use them directly.
				coeffs = [];
				if (filter.a1 != undefined &&
					filter.a2 != undefined &&
					filter.b0 != undefined &&
					filter.b1 != undefined &&
					filter.b2 != undefined) {
					// We have coefficients. Expects A0 to always be 1.
					if (debug == 2) console.log("Applying a filter from coefficients for channel "+channel.toUpperCase()+"...");
					coeffs = [1, filter.a1, filter.a2, filter.b0, filter.b1, filter.b2];
					if (!filter.samplingRate) {
						if (debug) console.log("Sampling rate of the filter is not indicated. It may not sound as expected.");
					} else if (filter.samplingRate != Fs) {
						if (debug) console.log("Indicated sampling rate of the filter coefficients doesn't match that of the current DSP program.");
					}
				} else if (filter.type != undefined) {
					// Parametric filter. Generate coefficients based on filter type.
					
					switch (filter.type) {
						case "peak":
							if (filter.frequency != undefined &&
							 	filter.Q != undefined && 
							 	filter.gain != undefined) {
								coeffs = beoDSP.peak(Fs, filter.frequency, filter.gain, filter.Q, 0);
							}
							break;
						case "lowShelf":
							if (filter.frequency != undefined &&
							 	filter.Q != undefined && 
							 	filter.gain != undefined) {
								coeffs = beoDSP.lowShelf(Fs, filter.frequency, filter.gain, filter.Q, 0);
							}
							break;
						case "highShelf":
							if (filter.frequency != undefined &&
							 	filter.Q != undefined && 
							 	filter.gain != undefined) {
								coeffs = beoDSP.highShelf(Fs, filter.frequency, filter.gain, filter.Q, 0);
							}
							break;
						case "lowPass":
							if (filter.frequency != undefined) {
								if (filter.Q != undefined) {
									coeffs = beoDSP.lowPass(Fs, filter.frequency, 0, filter.Q);
								} else { // If Q is not specified, default is Butterworth.
									coeffs = beoDSP.lowPass(Fs, filter.frequency, 0);
								}
							}
							break;
						case "highPass":
							if (filter.frequency != undefined) {
								if (filter.Q != undefined) {
									coeffs = beoDSP.highPass(Fs, filter.frequency, 0, filter.Q);
								} else { // If Q is not specified, default is Butterworth.
									coeffs = beoDSP.highPass(Fs, filter.frequency, 0);
								}
							}
							break;
					}
					if (coeffs.length == 6) {
						if (debug == 2) console.log("Applying '"+filter.type+"' filter at "+filter.frequency+" Hz for channel "+channel.toUpperCase()+"...");
					} else {
						if (debug) console.log("Filter parameters were invalid. Skipping.");
					}
				}
					
				if (filter.bypass) coeffs = [1,0,0,1,0,0];
				
				if (coeffs.length == 6) { 
					// Apply the filter.
					beoDSP.safeloadWrite(register, [coeffs[5], coeffs[4], coeffs[3], coeffs[2]*-1, coeffs[1]*-1], true);
					calculateFilterResponse(channel, filterIndex, coeffs);
				} else {
					// Settings were probably invalid.
					beoDSP.safeloadWrite(register, [0, 0, 1, 0, 0], true);
					filterResponses[channel].data[filterIndex] = null;
				}
				
			} else {
				// No settings for this filter, make it flat.
				beoDSP.safeloadWrite(register, [0, 0, 1, 0, 0], true);
				filterResponses[channel].data[filterIndex] = null;
			}
			sendCurrentSettingsToSoundPreset();
		}
	}
	
	
	
	groupIDs = [];
	groupIDIndex = {a: 0, b: 0, c: 0, d: 0};
	
	function importCrossoverType(channel, filterIndex) {
		if (settings[channel][filterIndex] &&
			settings[channel][filterIndex].type && 
			(settings[channel][filterIndex].type == "highPass" || settings[channel][filterIndex].type == "lowPass") && 
			!settings[channel][filterIndex].crossoverType) {
			// First determine the type of this filter.
			bypass0 = (settings[channel][filterIndex].bypass) ? true : false;
			if (!settings[channel][filterIndex].Q) {
				type0 = "BW2";
			} else {
				switch (settings[channel][filterIndex].Q) {
					case 0.54119610:
						type0 = "BW4A";
						break;
					case 1.3065630:
						type0 = "BW4B";
						break;
					case 0.51763809:
						type0 = "BW6A";
						break;
					case 1.9318517:
						type0 = "BW6C";
						break;
					default:
						type0 = "custom";
						break;
				}
			}
			
			// Then find its pair, if it exists (for 4th-order filters).
			type1 = null;
			bypass1 = null;
			for (var i = 0; i < settings[channel].length; i++) {
				if (i != filterIndex) {
					if (settings[channel][i].type && 
						settings[channel][i].type == settings[channel][filterIndex].type &&
						settings[channel][i].frequency == settings[channel][filterIndex].frequency) {
						bypass1 = (settings[channel][i].bypass) ? true : false;
						if (!settings[channel][i].Q) {
							type1 = "BW2";
						} else {
							switch (settings[channel][i].Q) {
								case 0.54119610:
									type1 = "BW4A";
									break;
								case 1.3065630:
									type1 = "BW4B";
									break;
								case 0.51763809:
									type1 = "BW6A";
									break;
								case 1.9318517:
									type1 = "BW6C";
									break;
								default:
									type1 = "custom";
									break;
							}
						}
						break;
					}
				}
			}
			
			// Finally, update the types for both filters.
			
			// Generated filter group IDs ensure that filters that are meant to be shown together stay together regardless of their position (the old way of grouping them).
			// There's a shared pool of group IDs that are used sequentially on each channel. This ensures that if channels have the same filters in the same positions, they will receive the same group IDs and the function that auto-groups channels will see the channels as identical as expected.
			if (groupIDs.length <= groupIDIndex[channel]) { // Create a new group ID if necessary.
				groupIDs.push(new Date().getTime());
			}
			groupID = groupIDs[groupIDIndex[channel]];
			groupIDIndex[channel]++;
			
			if (type1 == null) {
				if (type0 != "BW2") type0 = "custom2";
				settings[channel][filterIndex].crossoverType = type0;
				settings[channel][filterIndex].groupID = groupID;
				if (debug) console.log("Detected crossover of type '"+type0+"'.");
			} else {
				theType = null;
				if (type0 == "BW2" && type1 == "BW2") theType = "LR4";
				if (type0 == "BW2" && type1 == "BW2" && (!bypass0 && bypass1)) theType = "BW2";
				if (type0 == "BW2" && type1 == "BW2" && (bypass0 && !bypass1)) theType = "BW2";
				if (type0 == "BW4A" && type1 == "BW4B") theType = "BW4";
				if (type0 == "BW4B" && type1 == "BW4A") theType = "BW4";
				if (type0 == "custom" && type1 == "custom") theType = "custom4";
				if (type0 == "custom" && (!bypass0 && bypass1)) theType = "custom2";
				if (type1 == "custom" && (bypass0 && !bypass1)) theType = "custom2";
				
				settings[channel][filterIndex].crossoverType = theType;
				settings[channel][filterIndex].groupID = groupID;
				settings[channel][i].crossoverType = theType;
				settings[channel][i].groupID = groupID;
				if (debug) console.log("Detected crossover of type '"+theType+"'.");
			}
			return true;
		} else {
			return false;
		}
	}
	
function importChannelGroups() {
	settings.ui.groupAB = (_.isEqual(settings.a, settings.b)) ? true : false;
	settings.ui.groupCD = (_.isEqual(settings.c, settings.d)) ? true : false;
	if (settings.ui.groupAB && debug) console.log("Grouping equaliser settings for channels A+B.");
	if (settings.ui.groupCD && debug) console.log("Grouping equaliser settings for channels C+D.");
}

function getGroupedChannels(forChannel) {
	if (forChannel == "a" && settings.ui.groupAB) {
		forChannel += "b";
	}
	if (forChannel == "b" && settings.ui.groupAB) {
		forChannel += "a";
	}
	if (forChannel == "c" && settings.ui.groupCD) {
		forChannel += "d";
	}
	if (forChannel == "d" && settings.ui.groupCD) {
		forChannel += "c";
	}
	return forChannel;
}
	
var settingsSendTimeout;
function sendCurrentSettingsToSoundPreset() {
	clearTimeout(settingsSendTimeout);
	settingsSendTimeout = setTimeout(function() {
		for (var i = 0; i < 4; i++) {
			channel = ("abcd").charAt(i);
			calculateMasterGraphAndDrivers(channel);
		}
		
		beo.bus.emit('sound-preset', {header: "currentSettings", content: {extension: "equaliser", settings: {a: settings.a, b: settings.b, c: settings.c, d: settings.d}}});
	}, 1000);
}

function calculateFilterResponse(channel, filter, coeffs) {
	points = [];
	
	for (var i = 0; i < 128; i++) {
		freq = Math.pow(2, Math.log(0.5 / 0.0001) / Math.LN2 * (i / 128)) * 0.0001;
		z = freq*Fs;
		w = freq * 2 * Pi;
		fi = Math.pow(Math.sin(w/2), 2);
		y = Math.log(Math.pow(coeffs[3]+coeffs[4]+coeffs[5], 2) - 4 * (coeffs[3]*coeffs[4] + 4*coeffs[3]*coeffs[5] + coeffs[4]*coeffs[5]) * fi + 16*coeffs[3]*coeffs[5]*fi*fi) - Math.log(Math.pow(1+coeffs[1]+coeffs[2], 2) - 4 * (coeffs[1] + 4*coeffs[2] + coeffs[1]*coeffs[2])*fi + 16*coeffs[2]*fi*fi);
		y = y * 10 / Math.LN10;
		if (isNaN(y)) y = -200;
		points.push([z, y]);
	}
	filterResponses[channel].data[filter] = points;
}

function calculateMasterGraphAndDrivers(channel) {
	// Sum all subgraphs.
	filterResponses[channel].master = [];
	highestPoint = -35;
	for (var i = 0; i < 128; i++) {
		plotPoint = 0;
		plotPhasePoint = 0;
		plotFreq = null;
		for (var a = 0; a < filterResponses[channel].data.length; a++) {
			if (filterResponses[channel].data[a]) {
				plotFreq = filterResponses[channel].data[a][i][0];
				plotPoint += filterResponses[channel].data[a][i][1];
			}
		}
		filterResponses[channel].master.push([plotFreq, plotPoint]);
		if (plotPoint > highestPoint) highestPoint = plotPoint;
	}
	offset = (highestPoint < 0) ? highestPoint : 0;
	lowCutoff = null;
	highCutoff = null;
	for (var i = 0; i < 128; i++) {
		if (filterResponses[channel].master[i][1] > -6+offset) {
			// Above -6 dB.
			if (lowCutoff == null) lowCutoff = filterResponses[channel].master[i][0];
			highCutoff = null; // Reset high cutoff whenever output is above -6 dB.
		} else {
			// Below -6 dB.
			if (highCutoff == null) highCutoff = filterResponses[channel].master[i][0];
		}
	}
	driverTypes[channel] = {type: getDriverType(lowCutoff, highCutoff), low: lowCutoff, high: highCutoff};
}

// Determines the type of the loudspeaker driver based on the given frequency range.
function getDriverType(low, high) {
	// If nulls are provided (HP/LP off), replace with default values.
	if (low == null) low = 10;
	if (high == null) high = 20000;
	
	// Look at low-end extension first and then match that with high-end extension.
	
	if (low < 200) { // Woofer-like low-end
		if (high > 3000) {
			driverType = "full-range";
		} else if (high > 800) {
			driverType = "mid-woofer";
		} else {
			driverType = "woofer";
		}
	} else if (low < 1000) { // Midrange-like low-end
		if (high > 7000) {
			driverType = "mid-tweeter";
		} else {
			driverType = "midrange";
		}
	} else { // Unquestionably this is a tweeter.
		driverType = "tweeter";
	}
	return driverType;
}
		
	
module.exports = {
	checkSettings: checkSettings,
	getDriverTypes: function() {return driverTypes},
	applySoundPreset: applySoundPreset,
	version: version
};



