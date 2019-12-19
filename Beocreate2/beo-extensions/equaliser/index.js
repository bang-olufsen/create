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

// BEOCREATE SPEAKER EQUALISER

var beoDSP = require('../../beocreate_essentials/dsp');

	var debug = beo.debug;
	var extensions = beo.extensions;
	
	var version = require("./package.json").version;
	
	var metadata = {};
	var Fs = null;
	
	var defaultSettings = {
		"a": [],
		"b": [],
		"c": [],
		"d": []
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
	
	
	beo.bus.on('general', function(event) {
		// See documentation on how to use beo.bus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "equaliser") {
				
				
			}
		}
	});
	
	beo.bus.on('equaliser', function(event) {
		
		if (event.header == "settings") {
			
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
			
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
		beo.bus.emit("settings", {header: "saveSettings", content: {extension: "equaliser", settings: settings}});
	}
	
	
	function applyAllFiltersFromSettings(channel, checkMetadata) {
		
		if (checkMetadata) {
			if (metadata["IIR_"+channel.toUpperCase()] && metadata["IIR_"+channel.toUpperCase()].value[0]) {
				canControlEqualiser[channel] = parseInt(metadata["IIR_"+channel.toUpperCase()].value[0].split("/")[1])/5; // Save how many filters are in this bank.
			} else {
				canControlEqualiser[channel] = 0; // Can't do anything
			}
		}
		
		if (debug) console.log("Channel "+channel.toUpperCase()+" has "+canControlEqualiser[channel]+" biquad filters available.");
		
		if (canControlEqualiser[channel]) {
			
			// Loop through the whole available DSP filter bank.
			// If the current settings have more filters, apply as many as possible. If there are fewer, the filter function will automatically apply a flat filter instead.
			for (var f = 0; f < canControlEqualiser[channel]; f++) {
				applyFilterFromSettings(channel, f);
			}
		}
		
	}
	
	
	function applyFilterFromSettings(channel, filterIndex) {
		if (parseInt(metadata["IIR_"+channel.toUpperCase()].value[0].split("/")[1]) >= (canControlEqualiser[channel] * 5)) { // Check that this register exists, just in case.
			register = parseInt(metadata["IIR_"+channel.toUpperCase()].value[0].split("/")[0])+(filterIndex * 5); // This is the register (start register + 5 * filter index)
			
			if (settings[channel][filterIndex] != undefined) {
				filter = settings[channel][filterIndex];
				// There is a filter on the channel at this index. Find out its type and create coefficients, or if there are existing coefficients (for custom filters), prioritise those and use them directly.
				coeffs = [];
				if (!filter.bypass) {
					if (filter.a1 != undefined &&
						filter.a2 != undefined &&
						filter.b0 != undefined &&
						filter.b1 != undefined &&
						filter.b2 != undefined) {
						// We have coefficients. Expects A0 to always be 1.
						if (filter.samplingRate && filter.samplingRate == Fs) {
							if (debug == 2) console.log("Applying a filter from coefficients for channel "+channel.toUpperCase()+"...");
							coeffs = [1, filter.a1, filter.a2, filter.b0, filter.b1, filter.b2];
						} else {
							if (debug == 2) console.log("Indicated sampling rate of the filter coefficients doesn't match that of the DSP program.");
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
				}
				
				if (coeffs.length == 6) { 
					// Apply the filter.
					beoDSP.safeloadWrite(register, [coeffs[5], coeffs[4], coeffs[3], coeffs[2]*-1, coeffs[1]*-1], true);
				} else {
					// Filter was probably bypassed, or settings were invalid.
					beoDSP.safeloadWrite(register, [0, 0, 1, 0, 0], true);
				}
				
			} else {
				// No settings for this filter, make it flat.
				beoDSP.safeloadWrite(register, [0, 0, 1, 0, 0], true);
			}
			sendCurrentSettingsToSoundPreset();
		}
	}
	
var settingsSendTimeout;
function sendCurrentSettingsToSoundPreset() {
	clearTimeout(settingsSendTimeout);
	settingsSendTimeout = setTimeout(function() {
		beo.bus.emit('sound-preset', {header: "currentSettings", content: {extension: "equaliser", settings: settings}});
	}, 1000);
}
		
	
module.exports = {
	checkSettings: checkSettings,
	applySoundPreset: applySoundPreset,
	version: version
};



