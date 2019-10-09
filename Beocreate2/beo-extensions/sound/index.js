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

// BEOCREATE SYSTEM SOUND CORE

var exec = require('child_process').exec;
var beoDSP = require('../../beocreate_essentials/dsp');


module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var systemVolume = globals.volume;
	var debug = globals.debug;
	
	var version = require("./package.json").version;
	
	var settings = {"advancedSoundAdjustmentsEnabled": false};
	
	var volumeMixer = "DSPVolume";
	var metadata = {};
	
	beoBus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
			if (globals.systemConfiguration.cardType.indexOf("Beocreate") != -1) {
				beoDSP.connectDSP(function(success) {  
					if (success) {
						beoBus.emit("general", {header: "requestShutdownTime", content: {extension: "sound"}});
						beoBus.emit('dsp', {header: "connected", content: true});
					}
				}); // Opens a link with the SigmaDSP daemon.
			}
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "sound") {
				
				beoBus.emit("ui", {target: "sound", header: "advancedSoundAdjustmentsEnabled", content: {enabled: settings.advancedSoundAdjustmentsEnabled}});
				
			}
			
		}
		
		if (event.header == "shutdown") {
			beoDSP.disconnectDSP(function() {
				beoBus.emit("general", {header: "shutdownComplete", content: {extension: "sound"}});
				if (debug) console.log("Disconnected from DSP.");
			});
		}
	});
	
	beoBus.on('dsp', function(event) {
		
		
		if (event.header == "metadata") {
			
			if (event.content.metadata) {
				metadata = event.content.metadata;
				updateVolume(function(volume) {
					previousVolume = volume.percentage;
					beoBus.emit("sound", {header: "systemVolume", content: {volume: volume}});
					beoBus.emit("ui", {target: "sound", header: "systemVolume", content: {volume: systemVolume}});
				});
			}
		}
		
	});
	
	var previousVolume = 0;
	var sourceHandlesVolumeControl = false;
	var sourceVolumeControlTimeout = null;
	var sourceVolumeControlOverride = false;
	
	var volumeFadeInterval = null;
	var muted = false; // Store previous volume level here during mute.
	
	
	beoBus.on("sound", function(event) {
		// Global, high-level sound control events.
		switch (event.header) {
			
			case "settings":
				if (event.content.settings) {
					settings = event.content.settings;
					if (!settings.advancedSoundAdjustmentsEnabled) settings.advancedSoundAdjustmentsEnabled = false;
				}
				break;
			case "sourceHandlesVolumeControl":
				sourceHandlesVolumeControl = (event.content.sourceHandlesVolumeControl) ? true : false;
				break;
			case "setVolume":
				setVolume(event.content);
				break;
			case "mute":
				fade = false;
				if (event.content.fade) fade = true;
				mute(true, fade);
				break;
			case "unmute":
				fade = (event.content.fade) ? true : false;
				mute(false, fade);
				break;
			case "toggleMute":
				fade = (event.content.fade) ? true : false;
				mute(undefined, fade);
				break;
			case "updateVolume":
				updateVolume(function(volume) {
					beoBus.emit("sound", {header: "systemVolume", content: {volume: volume}});
					beoBus.emit("ui", {target: "sound", header: "systemVolume", content: {volume: volume}});
				});
				break;
			case "getVolume":
				updateVolume(function(volume) {
					beoBus.emit("ui", {target: "sound", header: "systemVolume", content: {volume: systemVolume}});
				});
				break;
			case "advancedSoundAdjustmentsEnabled":
				settings.advancedSoundAdjustmentsEnabled = (event.content.enabled) ? true : false;
				
				beoBus.emit("settings", {header: "saveSettings", content: {extension: "sound", settings: settings}});
				beoBus.emit("ui", {target: "sound", header: "advancedSoundAdjustmentsEnabled", content: {enabled: settings.advancedSoundAdjustmentsEnabled}});
				break;
		}
	});
	
	
	function setVolume(options, fromMuteFunction, callback) {
		if (!fromMuteFunction) {
			previousVolume = systemVolume.percentage;
			//adjustingVolume = true;
		}
		
		// Use amixer to control the DSPVolume mixer provided by SigmaTCPServer
		
		// Volume can be set either as a percentage (0-100 %), absolute value (0-255) or in steps (two steps up or down from current absolute value).
		volumeCommand = null;
		
		if (options.percentage != undefined) volumeCommand = options.percentage+"%";
		if (options.absolute != undefined) volumeCommand = options.absolute;
		if (options.step) {
			if (options.step == "up") volumeCommand = "2+";
			if (options.step == "down") volumeCommand = "2-";
			if (options.step == "+1") volumeCommand = "1+";
			if (options.step == "-1") volumeCommand = "1-";
			if (options.step == "+1%") volumeCommand = "1%+";
			if (options.step == "-1%") volumeCommand = "1%-";
			//adjustingVolume = false;
		}
		
		if (volumeCommand != null) {
			exec("amixer set "+volumeMixer+" "+volumeCommand, function(error, stdout, stderr) {
				if (error) {
					//callback(null, error);
				} else {
					percentage = parseFloat(stdout.match(/\[(.*?)\]/)[0].slice(1, -2));
					absolute = parseFloat(stdout.match(/\:(.*?)\[/)[0].slice(2, -2));
					//console.log(volume);
					systemVolume.absolute = absolute;
					systemVolume.percentage = percentage;
					beoBus.emit("sound", {header: "systemVolume", content: {volume: systemVolume}});
					beoBus.emit("ui", {target: "sound", header: "systemVolume", content: {volume: systemVolume}});
					if (callback) callback(systemVolume);
				}
			});
		}
			
		
		if (sourceHandlesVolumeControl) {
			// If the source has indicated it has volume control, send commands to it as well so that it can stay in sync.
			if (options.percentage) {
				beoBus.emit("sources", {header: "setSourceVolume", content: {percentage: options.percentage}});
			}
			
		}
	}
	
	var fadeStep = 0; // %, calculated dynamically so that the transition takes about 2,5 seconds.
	
	function mute(operation, fade) {
		
		if (volumeFadeInterval) {
			clearInterval(volumeFadeInterval);
		}
		if (operation == undefined) operation = (muted) ? false : true;
		
		if (operation == true && !muted) {
			// Mute.
			if (debug) console.log("Muting volume...");
			muted = systemVolume.percentage;
			fadeStep = Math.round(muted/20);
			if (fade) {
				volumeFadeInterval = setInterval(function() {
					newVolume = systemVolume.percentage - fadeStep;
					if (newVolume <= 0) {
						setVolume({percentage: 0}, true);
						clearInterval(volumeFadeInterval);
						volumeFadeInterval = null;
						if (debug) console.log("Muted.");
					} else {
						setVolume({percentage: newVolume}, true);
					}
				}, 100);
			} else {
				setVolume({percentage: 0}, true);
			}
		} else if (operation == false && muted) {
			// Unmute.
			if (debug) console.log("Unmuting volume...");
			if (fade) {
				volumeFadeInterval = setInterval(function() {
					fadeStep = Math.round(muted/20);
					newVolume = systemVolume.percentage + fadeStep;
					if (newVolume >= muted) {
						setVolume({percentage: muted}, true);
						clearInterval(volumeFadeInterval);
						volumeFadeInterval = null;
						muted = false;
						if (debug) console.log("Unmuted.");
					} else {
						setVolume({percentage: newVolume}, true);
					}
				}, 100);
			} else {
				setVolume({percentage: muted}, true);
				muted = false;
			}
		}
		
	}
	
	function updateVolume(callback) {
		exec("amixer get "+volumeMixer, function(error, stdout, stderr) {
			if (error) {
				//callback(null, error);
			} else {
				previousVolume = systemVolume.percentage;
				percentage = parseFloat(stdout.match(/\[(.*?)\]/)[0].slice(1, -2));
				absolute = parseFloat(stdout.match(/\:(.*?)\[/)[0].slice(2, -2));
				
				systemVolume.absolute = absolute;
				systemVolume.percentage = percentage;
				if (systemVolume.percentage != previousVolume) {
					// If volume has changed, notify globally.
					beoBus.emit("sound", {header: "systemVolume", content: {volume: systemVolume}});
					beoBus.emit("ui", {target: "sound", header: "systemVolume", content: {volume: systemVolume}});
				}
				if (callback != undefined) callback(systemVolume);
			}
		});
	}
	
	
	return {
		version: version,
		setVolume: setVolume,
		getVolume: updateVolume,
		mute: mute
	};
};




