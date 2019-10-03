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

// BEOCREATE CROSSOVER

var _ = require('underscore'); // Mainly for object comparison

module.exports = function(beoBus, globals) {
	var module = {};
	var beoBus = beoBus;
	var beoDSP = globals.dsp;
	
	var metadata = {};
	var Fs = null;
	
	var defaultSettings = {
	  "a": {
	    "lowPass": {"frequency": null, "type": "LR24"},
	    "highPass": {"frequency": null, "type": "LR24"},
	    "invert": false
	  },
	  "b": {
	    "lowPass": {"frequency": null, "type": "LR24"},
	    "highPass": {"frequency": null, "type": "LR24"},
	    "invert": false
	  },
	  "c": {
	    "lowPass": {"frequency": null, "type": "LR24"},
	    "highPass": {"frequency": null, "type": "LR24"},
	    "invert": false
	  },
	  "d": {
	    "lowPass": {"frequency": null, "type": "LR24"},
	    "highPass": {"frequency": null, "type": "LR24"},
	    "invert": false
	  }
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var canControlCrossover = {
	  "a": {
	    "lowPass": 0,
	    "highPass": 0,
		"invert": false
	  },
	  "b": {
	    "lowPass": 0,
	    "highPass": 0,
	    "invert": false
	  },
	  "c": {
	    "lowPass": 0,
	    "highPass": 0,
	    "invert": false
	  },
	  "d": {
	    "lowPass": 0,
	    "highPass": 0,
	    "invert": false
	  }
	};
	
	beoBus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "crossover") {
				
			}
		}
	});
	
	beoBus.on('crossover', function(event) {
		
		if (event.header == "settings") {
			
			if (event.content.settings) {
				settings = event.content.settings;
			}
			
		}
	});
	
	beoBus.on('dsp', function(event) {
		
		
		if (event.header == "metadata") {
			
			if (event.content.metadata) {
				metadata = event.content.metadata;
				if (metadata.sampleRate.value) {
					Fs = parseInt(metadata.sampleRate.value[0]);
					for (var c = 0; c < 4; c++) {
						channel = "abcd".charAt(c);
						applyCrossoverFromSettings(channel, "lowPass", true);
						applyCrossoverFromSettings(channel, "highPass", true);
					}
				} else {
					Fs = null;
					for (var c = 0; c < 4; c++) {
						channel = "abcd".charAt(c);
						canControlCrossover[channel].lowPass = 0;
						canControlCrossover[channel].highPass = 0;
					}
				}
				for (var c = 0; c < 4; c++) { // Invert isn't dependent on sampling rate.
					channel = "abcd".charAt(c);
					applyInvertFromSettings(channel, true);
				}
				
				
			} else {
				metadata = {};
				Fs = null;
				for (var c = 0; c < 4; c++) {
					channel = "abcd".charAt(c);
					canControlCrossover[channel].lowPass = 0;
					canControlCrossover[channel].highPass = 0;
					canControlCrossover[channel].invert = false;
				}
			}
			
			beoBus.emit('sound-preset', {header: "currentSettings", content: {extension: "crossover", settings: settings}});
		}
	});
	
	
	function applyCrossoverFromSettings(channel, filter, checkMetadata) {
		if ((filter == "lowPass" || filter == "highPass") && Fs) {
			// Only apply a filter if the sampling frequency is known and the filter is one of the two types.
			
			if (checkMetadata) {
				// Check if the required registers exist in the metadata.
				if (metadata[filter+channel.toUpperCase()+"Registers"] && metadata[filter+channel.toUpperCase()+"Registers"].value) {
					registers = metadata[filter+channel.toUpperCase()+"Registers"].value;
					if (registers[0] != undefined) canControlCrossover[channel][filter] = 1; // Can do BW12
					if (registers[1] != undefined) canControlCrossover[channel][filter] = 2; // Can do LR24
				} else {
					canControlCrossover[channel][filter] = 0; // Can't do anything
				}
			}
				
			if (settings[channel] && settings[channel][filter]) { // Crossover settings exist for this channel.
				if (canControlCrossover[channel][filter] > 1) {
					if (settings[channel][filter].frequency && settings[channel][filter].type) {
	
						switch (settings[channel][filter].type) {
							case "LR4": // 4th-order Linkwitz-Riley filter.
							case "LR24": // Also accepts the older type identifier.
								if (filter == "lowPass") {
									coeffs = beoDSP.lowPass(Fs, settings[channel][filter].frequency, 0);
								} else if (filter == "highPass") {
									coeffs = beoDSP.highPass(Fs, settings[channel][filter].frequency, 0);
								}
								beoDSP.safeloadWrite(registers[0], [coeffs[5], coeffs[4], coeffs[3], coeffs[2]*-1, coeffs[1]*-1], true);
								beoDSP.safeloadWrite(registers[1], [coeffs[5], coeffs[4], coeffs[3], coeffs[2]*-1, coeffs[1]*-1], true);
								break;
							case "BW2": // 2nd-order Butterworth filter.
							case "BW12": // Also accepts the older type identifier.
								if (filter == "lowPass") {
									coeffs = beoDSP.lowPass(Fs, settings[channel][filter].frequency, 0);
								} else if (filter == "highPass") {
									coeffs = beoDSP.highPass(Fs, settings[channel][filter].frequency, 0);
								}
								beoDSP.safeloadWrite(registers[0], [coeffs[5], coeffs[4], coeffs[3], coeffs[2]*-1, coeffs[1]*-1], true);
								beoDSP.safeloadWrite(registers[1], [0, 0, 1, 0, 0], true);
								break;
							case "BW4": // 4th-order Butterworth filter.
							case "BW24":
								// The two filters will have different Q values. Source: http://www.earlevel.com/main/2016/09/29/cascading-filters/
								if (filter == "lowPass") {
									coeffs1 = beoDSP.lowPass(Fs, settings[channel][filter].frequency, 0, 0.54119610);
									coeffs2 = beoDSP.lowPass(Fs, settings[channel][filter].frequency, 0, 1.3065630);
								} else if (filter == "highPass") {
									coeffs1 = beoDSP.highPass(Fs, settings[channel][filter].frequency, 0, 0.54119610);
									coeffs2 = beoDSP.highPass(Fs, settings[channel][filter].frequency, 0, 1.3065630);
								}
								beoDSP.safeloadWrite(registers[0], [coeffs1[5], coeffs1[4], coeffs1[3], coeffs1[2]*-1, coeffs1[1]*-1], true);
								beoDSP.safeloadWrite(registers[1], [coeffs2[5], coeffs2[4], coeffs2[3], coeffs2[2]*-1, coeffs2[1]*-1], true);
								break;
						}
						
					} else {
						// No crossover frequency or filter type, apply a flat filter.
						beoDSP.safeloadWrite(registers[0], [0, 0, 1, 0, 0], true);
						if (canControlCrossover[channel][filter] == 2) { 
							beoDSP.safeloadWrite(registers[1], [0, 0, 1, 0, 0], true);
						}
					}
				}
			}
		}
	}
	
	
	function applyInvertFromSettings(channel, checkMetadata) {
		
		if (checkMetadata) {
			// Check if the required registers exist in the metadata.
			if (metadata["invert"+channel.toUpperCase()+"Register"] && metadata["invert"+channel.toUpperCase()+"Register"].value) {
				canControlCrossover[channel].invert = true;
			} else {
				canControlCrossover[channel].invert = false; // Can't do anything
			}
		}
		
		if (canControlCrossover[channel].invert) {
			inverted = settings[channel].invert ? 1 : 0;
			beoDSP.writeDSP(metadata["invert"+channel.toUpperCase()+"Register"].value, inverted, false);
		}
		
	}
	
	
	return module;
};




