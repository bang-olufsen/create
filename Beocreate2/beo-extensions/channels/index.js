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

// BEOCREATE CHANNEL SETUP

var _ = require('underscore');
var beoDSP = require('../../beocreate_essentials/dsp');

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var extensions = globals.extensions;
	
	var version = require("./package.json").version;
	
	var debug = false;
	
	var metadata = {};
	var Fs = null;
	
	var defaultSettings = {
	  "a": {
	    "role": "mono",
		"level": 100,
		"delay": 0,
		"enabled": true
	  },
	  "b": {
	    "role": "mono",
		"level": 100,
		"delay": 0,
		"enabled": true
	  },
	  "c": {
	    "role": "mono",
		"level": 100,
		"delay": 0,
		"enabled": true
	  },
	  "d": {
	    "role": "mono",
		"level": 100,
		"delay": 0,
		"enabled": true
	  },
	  "balance": 0
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var canControlChannels = {
	  "a": {
	    "role": false,
		"level": false,
		"delay": false
	  },
	  "b": {
	    "role": false,
		"level": false,
		"delay": false
	  },
	  "c": {
	    "role": false,
		"level": false,
		"delay": false
	  },
	  "d": {
	    "role": false,
		"level": false,
		"delay": false
	  },
	  "balance": false
	};
	
	var canDoSimpleStereoSetup = false;
	var simpleChannelSelection = null;
	
	
	beoBus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
			if (event.content.debug) debug = true;
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "channels") {
				
				beoBus.emit("ui", {target: "channels", header: "channelSettings", content: {settings: settings, simpleChannelSelection: simpleChannelSelection, canDoSimpleStereoSetup: canDoSimpleStereoSetup, canControlChannels: canControlChannels}});
				
			}
		}
	});
	
	beoBus.on('channels', function(event) {
		
		if (event.header == "settings") {
			
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
			
		}
		
		
		if (event.header == "settingsFromPreset") {
			if (event.content.settings) {
				for (var c = 0; c < 4; c++) {
					channel = "abcd".charAt(c);
					if (event.content.settings[channel] != undefined) {
						settings[channel] = event.content.settings[channel];
					} else {
						settings[channel] = JSON.parse(JSON.stringify(defaultSettings[channel]));
					}
				}
				
				for (var c = 0; c < 4; c++) {
					channel = "abcd".charAt(c);
					applyChannelRoleFromSettings(channel);
					applyChannelLevelFromSettings(channel);
				}
				simpleChannelRoleFromSettings();
			}
		}
		
		if (event.header == "setBalance") {
			
			if (event.content.balance != undefined) {
				settings.balance = event.content.balance;
				applyBalanceFromSettings();
				beoBus.emit("settings", {header: "saveSettings", content: {extension: "channels", settings: settings}});
			}
			
		}
		
		if (event.header == "selectChannelSimple") {
			
			if (event.content.channel) {
				
				roleChanged = false;
				switch (event.content.channel) {
					case "left":
						if (simpleChannelSelection != "left") {
							roleChanged = true;
							settings.a.role = "left";
							settings.b.role = "left";
							settings.c.role = "left";
							settings.d.role = "left";
						}
						break;
					case "right":
						if (simpleChannelSelection != "right") {
							roleChanged = true;
							settings.a.role = "right";
							settings.b.role = "right";
							settings.c.role = "right";
							settings.d.role = "right";
						}
						break;
					case "mono":
						if (simpleChannelSelection != "mono") {
							roleChanged = true;
							settings.a.role = "mono";
							settings.b.role = "mono";
							settings.c.role = "mono";
							settings.d.role = "mono";
						}
						break;
					case "stereo":
						if (simpleChannelSelection != "stereo" || simpleChannelSelection == "stereo-rev") {
							roleChanged = true;
							settings.a.role = "left";
							settings.b.role = "right";
							settings.c.role = "left";
							settings.d.role = "right";
						} else {
							roleChanged = true;
							settings.a.role = "right";
							settings.b.role = "left";
							settings.c.role = "right";
							settings.d.role = "left";
						}
						break;
				}
				if (roleChanged) {
					for (var c = 0; c < 4; c++) {
						channel = "abcd".charAt(c);
						applyChannelRoleFromSettings(channel);
						//applyChannelLevelFromSettings(channel);
					}
					simpleChannelRoleFromSettings();
					beoBus.emit("ui", {target: "channels", header: "channelSettings", content: {settings: settings, simpleChannelSelection: simpleChannelSelection, canDoSimpleStereoSetup: canDoSimpleStereoSetup}});
					beoBus.emit("settings", {header: "saveSettings", content: {extension: "channels", settings: settings}});
				}
			}
			
		}
	});
	
	beoBus.on('dsp', function(event) {
		
		
		if (event.header == "metadata") {
			
			if (event.content.metadata) {
				metadata = event.content.metadata;
				
				for (var c = 0; c < 4; c++) {
					channel = "abcd".charAt(c);
					
					if (metadata.sampleRate) {
						Fs = parseInt(metadata.sampleRate.value[0]);
					} else {
						Fs = null;
					}
					
					if (metadata["channelSelect"+channel.toUpperCase()+"Register"] && metadata["channelSelect"+channel.toUpperCase()+"Register"].value[0] != undefined && metadata["channelSelect"+channel.toUpperCase()+"Register"].channels) {
						canControlChannels[channel].role = metadata["channelSelect"+channel.toUpperCase()+"Register"].channels.split(",");
					} else {
						canControlChannels[channel].role = false;
					}
					
					if (metadata["levels"+channel.toUpperCase()+"Register"] && metadata["levels"+channel.toUpperCase()+"Register"].value[0] != undefined) {
						canControlChannels[channel].level = true;
					} else {
						canControlChannels[channel].level = false;
					}
					
					if (metadata["delay"+channel.toUpperCase()+"Register"] && metadata["delay"+channel.toUpperCase()+"Register"].value[0] != undefined && !isNaN(metadata["delay"+channel.toUpperCase()+"Register"].maxdelay)) {
						canControlChannels[channel].delay = metadata["delay"+channel.toUpperCase()+"Register"].maxdelay;
					} else {
						canControlChannels[channel].delay = false;
					}
					
					applyChannelRoleFromSettings(channel);
					applyChannelLevelFromSettings(channel);
					applyChannelDelayFromSettings(channel);
				}
				simpleChannelRoleFromSettings();
				
				if (metadata.balanceRegister && metadata.balanceRegister.value[0] != undefined) { // Balance controls.
					canControlChannels.balance = true;
				} else {
					canControlChannels.balance = false;
				}
				applyBalanceFromSettings();
			} else {
				metadata = {};
				for (var c = 0; c < 4; c++) {
					channel = "abcd".charAt(c);
					canControlChannels[channel].role = false;
					canControlChannels[channel].level = false;
					canControlChannels.balance = false;
				}
			}
		}
	});
	
	
	// Listen for "currentSettings" events from the equaliser extension, and use them to determine whether or not the current sound preset supports one-touch stereo.
	var equaliserPairs = [];
	beoBus.on('sound-preset', function(event) {
		
		if (event.header == "currentSettings") {
			
			
			if (event.content.extension == "equaliser") {
				
				equaliserPairs = [];
				if (event.content.settings) {
					// Compare equaliser settings for channels A-B and C-D
					// If there are two pairs (as you would have in a stereo 2-way setup), enable the one-touch stereo option.
					if (_.isEqual(event.content.settings.a, event.content.settings.b) && _.isEqual(event.content.settings.c, event.content.settings.d)) {
						canDoSimpleStereoSetup = true;
					} else {
						canDoSimpleStereoSetup = false;
					}
				} else {
					canDoSimpleStereoSetup = false;
				}
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
	2. Returns validated settings. If everything checks out, it's a copy of the input. Any incompatibilities will be stripped out or adapted (use this to migrate old settings in case of an upgrade). 
	*/
	function checkSettings(theSettings) {
		
		validatedSettings = {};
		compatibilityIssues = {};
		
		for (var c = 0; c < 4; c++) {
			channel = "abcd".charAt(c);
			if (theSettings[channel] != undefined) {
				validatedSettings[channel] = {};
				compatibilityIssues[channel] = {};
					
				if (theSettings[channel].role != undefined) {
					if (canControlChannels[channel].role != false) {
						channelIndex = canControlChannels[channel].role.indexOf(theSettings[channel].role);
						if (channelIndex != -1) {
							compatibilityIssues[channel].role = 0;
						} else {
							compatibilityIssues[channel].role = 2;
						}
					} else {
						compatibilityIssues[channel].role = 1;
					}
					switch (theSettings[channel].role) {
						case "mono":
						case "mid":
						case "left":
						case "right":
						case "side":
							validatedSettings[channel].role = theSettings[channel].role;
							break;
						default:
							validatedSettings[channel].role = "mono";
							compatibilityIssues[channel].role = 2;
							break;
					}
				}
				
				if (theSettings[channel].level != undefined) {
					if (canControlChannels[channel].level != false) {
						if (theSettings[channel].enabled != undefined) {
							if (theSettings[channel].enabled == true || theSettings[channel].enabled == false) {
								compatibilityIssues[channel].enabled = 0;
							} else {
								validatedSettings[channel].enabled = true;
								compatibilityIssues[channel].enabled = 2;
							}
						} else {
							validatedSettings[channel].enabled = true;
						}
						
						if (!isNaN(theSettings[channel].level) && theSettings[channel].level >= 0 && theSettings[channel].level <= 100) {
							compatibilityIssues[channel].level = 0;
						} else {
							validatedSettings[channel].level = 100;
							compatibilityIssues[channel].level = 2;
						}
					} else {
						compatibilityIssues[channel].level = 1;
					}
					if (!isNaN(theSettings[channel].level) && theSettings[channel].level >= 0 && theSettings[channel].level <= 100) {
						validatedSettings[channel].level = theSettings[channel].level;
					}
					if (theSettings[channel].enabled != undefined) {
						validatedSettings[channel].enabled = theSettings[channel].enabled;
					}
				}
				
				if (theSettings[channel].delay != undefined) {
					if (canControlChannels[channel].delay != false) {
						if (!isNaN(theSettings[channel].delay) && theSettings[channel].delay >= 0 && theSettings[channel].delay <= canControlChannels[channel].delay) {
							compatibilityIssues[channel].delay = 0;
						} else {
							validatedSettings[channel].delay = 0;
							compatibilityIssues[channel].delay = 2;
						}
					} else {
						compatibilityIssues[channel].delay = 1;
					}
					if (!isNaN(theSettings[channel].delay) && theSettings[channel].delay >= 0 && theSettings[channel].delay <= canControlChannels[channel].delay) {
						validatedSettings[channel].delay = theSettings[channel].delay;
					}
				}
			}
		}
		
		if (theSettings.balance != undefined) {
			if (canControlChannels.balance != undefined) {
				if (!isNaN(theSettings.balance) && theSettings.balance >= -20 && theSettings.balance <= 20) {
					compatibilityIssues.balance = 0;
				} else {
					validatedSettings.balance = 0;
					compatibilityIssues.balance = 2;
				}
			} else {
				compatibilityIssues.balance = 1;
			}
			if (!isNaN(theSettings.balance) && theSettings.balance >= -20 && theSettings.balance <= 20) {
				validatedSettings.balance = theSettings.balance;
			}
		}
		
		return {compatibilityIssues: compatibilityIssues, validatedSettings: validatedSettings, previewProcessor: "channels.generateSettingsPreview"};
	}
	
	
	function applySoundPreset(theSettings) {
		settings = Object.assign(settings, checkSettings(theSettings).validatedSettings);
		
		for (var c = 0; c < 4; c++) {
			channel = "abcd".charAt(c);
			applyChannelRoleFromSettings(channel);
			applyChannelLevelFromSettings(channel);
			applyChannelDelayFromSettings(channel);
		}
		simpleChannelRoleFromSettings();
		
		beoBus.emit("settings", {header: "saveSettings", content: {extension: "channels", settings: settings}});
	}
	
	
	function applyChannelRoleFromSettings(channel) {
		
		if (canControlChannels[channel].role != false) {
				
				channelSelectMetadata = metadata["channelSelect"+channel.toUpperCase()+"Register"];
				
				channelIndex = canControlChannels[channel].role.indexOf(settings[channel].role);
				if (channelIndex != -1) { // Matching channel index found.
					multiplier = 1;
					if (channelSelectMetadata.multiplier) multiplier = channelSelectMetadata.multiplier;
					dspChannelIndex = channelIndex * multiplier;
					beoDSP.writeDSP(channelSelectMetadata.value[0], dspChannelIndex, false);
				}
			
		}
		
	}
	
	
	function simpleChannelRoleFromSettings() {
		roleArray = [];
		for (var c = 0; c < 4; c++) {
			channel = "abcd".charAt(c);
			if (settings[channel] && settings[channel].role) {
				roleArray.push(settings[channel].role);
			}
		}
		if (roleArray.length == 4) {
			
			roles = roleArray.join("-");
			
			switch (roles) {
				case "left-right-left-right":
					simpleChannelSelection = "stereo";
					break;
				case "right-left-right-left":
					simpleChannelSelection = "stereo-rev";
					break;
				case "left-left-left-left":
					simpleChannelSelection = "left";
					break;
				case "right-right-right-right":
					simpleChannelSelection = "right";
					break;
				case "mono-mono-mono-mono":
					simpleChannelSelection = "mono";
					break;
				default:
					simpleChannelSelection = null;
			}
		
		} else {
			simpleChannelSelection = null;
		}
	}
	
	
	function applyChannelLevelFromSettings(channel) {
		
		if (settings[channel] && !isNaN(settings[channel].level)) {
			
			if (canControlChannels[channel].level) {
				channelLevelRegister = metadata["levels"+channel.toUpperCase()+"Register"].value[0];
				levelValue = settings[channel].level/100; // DSP gain value range 0-1.
				
				if (settings[channel].enabled != true) levelValue = 0; // Mute?
				beoDSP.writeDSP(channelLevelRegister, levelValue, true, true);
			}
		}
		
	}
	
	
	function applyBalanceFromSettings() {
		
		if (!isNaN(settings.balance) && canControlChannels.balance) {
			
			if (settings.balance > 0) {
				// Attenuate left channel when balance is towards right.
				balanceValue = 1+(settings.balance/20);
				if (debug) console.log("Balance: right "+settings.balance+" ("+balanceValue+").");
			} else if (settings.balance < 0) {
				// Attenuate right channel when balance is towards left.
				balanceValue = 1+(settings.balance/20);
				if (debug) console.log("Balance: left "+settings.balance+" ("+balanceValue+").");
			} else { // Centre, both channels at 1.
				balanceValue = 1;
				if (debug) console.log("Balance: centre (1).");
			}
			beoDSP.writeDSP(metadata.balanceRegister.value[0], balanceValue, true, true);
		}
	}
	
	
	function applyChannelDelayFromSettings(channel) {
		
		if (settings[channel] && !isNaN(settings[channel].delay)) {
			
			if (canControlChannels[channel].delay != 0) {
				delayRegister = metadata["delay"+channel.toUpperCase()+"Register"].value[0];
				if (settings[channel].delay <= canControlChannels[channel].delay) {
					beoDSP.writeDSP(delayRegister, settings[channel].delay, true, true);
				} else {
					beoDSP.writeDSP(delayRegister, canControlChannels[channel].delay, true, true);
					if (debug) console.log("Set delay for channel "+channel.toUpperCase()+" ("+settings[channel].delay+" samples) exceeds the indicated maximum ("+canControlChannels[channel].delay+" samples). Maximum delay applied.");
				}
			}
		}
		
	}
		
	
	return {
		checkSettings: checkSettings,
		applySoundPreset: applySoundPreset,
		version: version
	};
};




