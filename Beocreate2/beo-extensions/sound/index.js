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

// BEOCREATE SYSTEM SOUND EXTENSION
// Mainly handles volume control.

var exec = require('child_process').exec;
var beoDSP = require('../../beocreate_essentials/dsp');
var request = require('request');



module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	
	var version = require("./package.json").version;
	
	var defaultSettings = {
		"advancedSoundAdjustmentsEnabled": false
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var defaultSourcesSettings = {
		"port": 81
	};
	var sourcesSettings = JSON.parse(JSON.stringify(defaultSourcesSettings));
	
	
	
	var metadata = {};
	
	var systemVolume = 0; // Master Volume.
	var previousVolume = 0; // Previous volume level. Used to compare if volume has changed.
	
	// Determine which method to use for volume control.
	var volumeControl = false; // 0 = no volume control, 1 = ALSA, 2 = direct DSP control.
	var audioControlAvailable = false;
	var directDSPVolumeControlAvailable = false;
	var alsaDSPVolumeControlAvailable = false;
	var alsaMixer = null;
	
	beoBus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
			if (globals.systemConfiguration.cardType.indexOf("Beocreate") != -1) {
				
			}
			
			checkIfAudioControlAvailable(function() {
				getALSAMixers(function() {
					determineVolumeControl();
					getVolume();
				});
			});
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "sound") {
				
				beoBus.emit("ui", {target: "sound", header: "advancedSoundAdjustmentsEnabled", content: {enabled: settings.advancedSoundAdjustmentsEnabled}});
				
			}
			
		}
		
		
	});
	
	beoBus.on('dsp', function(event) {
		
		
		if (event.header == "metadata") {
			
			directDSPVolumeControlAvailable = false;
			alsaDSPVolumeControlAvailable = false;
			
			if (event.content.metadata) {
				metadata = event.content.metadata;
				if (metadata.volumeControlRegister) {
					/*beoDSP.readDSP(metadata.volumeControlRegister.value[0], function(response) {
						volumeValue = Math.round(beoDSP.convertVolume("amplification", "%", response.dec));
					});*/
					directDSPVolumeControlAvailable = true;
					if (event.content.fromDSP) {
						alsaDSPVolumeControlAvailable = true;
					}
				} 
			}
			//determineALSAMixer();
			//determineVolumeControl();
		}
		
	});
	
	
	
	beoBus.on("sound", function(event) {
		// Global, high-level sound control events.
		switch (event.header) {
			
			case "settings":
				if (event.content.settings) {
					settings = Object.assign(settings, event.content.settings);
				}
				break;
			case "volume":
				if (event.content.percent != undefined) {
					if (debug >= 2) console.log("Volume received from AudioControl: "+event.content.percent+" %.");
					reportVolume(event.content.percent);
				}
				break;
			case "setVolume":
				if (debug >= 2) console.log("Volume change event from UI: "+event.content+" %.");
				setVolume(event.content);
				break;
			case "setVolumeAudioControl":
				setVolumeViaAudioControl(event.content);
				break;
			case "getVolumeAudioControl":
				getVolumeViaAudioControl(console.log);
				break;
			case "mute":
				fade = false;
				if (event.content.fade) fade = true;
				//mute(true, fade);
				break;
			case "unmute":
				fade = (event.content.fade) ? true : false;
				//mute(false, fade);
				break;
			case "toggleMute":
				fade = (event.content.fade) ? true : false;
				//mute(undefined, fade);
				break;
			case "getVolume":
				getVolume(function(volume) {
					beoBus.emit("ui", {target: "sound", header: "systemVolume", content: {volume: systemVolume, volumeControl: volumeControl}});
				}, 1);
				break;
			case "advancedSoundAdjustmentsEnabled":
				settings.advancedSoundAdjustmentsEnabled = (event.content.enabled) ? true : false;
				
				beoBus.emit("settings", {header: "saveSettings", content: {extension: "sound", settings: settings}});
				beoBus.emit("ui", {target: "sound", header: "advancedSoundAdjustmentsEnabled", content: {enabled: settings.advancedSoundAdjustmentsEnabled}});
				break;
		}
	});
	
	beoBus.on("sources", function(event) {
		// Capture settings for "sources" extension, because they include the port for AudioControl.
		if (event.header == "settings" && event.content.settings) {
			sourcesSettings = Object.assign(sourcesSettings, event.content.settings);
		}
	});
	
	
	function determineVolumeControl() {
		// Based on what is currently known about the system, which volume control method should be used?
		volumeControl = false;
		if (directDSPVolumeControlAvailable) volumeControl = 2; // Direct DSP control.
		if (alsaMixer) volumeControl = 1; // ALSA control.
		
		if (debug) {
			if (volumeControl == 0) console.log("System has no volume control.");
			if (volumeControl == 1) console.log("Volume control is via ALSA ('"+alsaMixer+"').");
			if (volumeControl == 2) console.log("Volume control is via direct DSP control.");
		}
	}
	
	
	function setVolume(volume, callback, mute) {
		flag = 0;
		if (mute) flag = 2;
		switch (volumeControl) {
			case 0: // No volume control.
				callback(null);
				break;
			case 1: // Talk to ALSA.
				setVolumeViaALSA(volume, function(newVolume) {
					reportVolume(newVolume, callback, flag);
				});
				break;
			case 3: // Talk to the DSP directly.
				break;
		}
	}
	
	function getVolume(callback, noUIUpdate) {
		flag = 0;
		if (noUIUpdate) flag = 1;
		switch (volumeControl) {
			case 0: // No volume control.
				if (callback) callback(null);
				break;
			case 1: // Talk to ALSA.
				getVolumeViaALSA(function(newVolume) {
					reportVolume(newVolume, callback, flag);
				});
				break;
			case 2: // Talk to the DSP directly.
				break;
		}
	}
	
	function reportVolume(newVolume, callback, flag) {
		if (systemVolume != newVolume) {
			systemVolume = newVolume;
			beoBus.emit("sound", {header: "systemVolume", content: {volume: newVolume, volumeControl: volumeControl}});
			if (flag != 1) beoBus.emit("ui", {target: "sound", header: "systemVolume", content: {volume: newVolume, volumeControl: volumeControl}});
		}
		if (callback) callback(newVolume);
	}
	

	var volumeFadeInterval = null;
	var muted = false; // Store previous volume level here during mute.
	var fadeStep = 0; // %, calculated dynamically so that the transition takes about 2,5 seconds.
	
	function mute(operation, fade) {
		
		if (volumeFadeInterval) {
			clearInterval(volumeFadeInterval);
		}
		if (operation == undefined) operation = (muted) ? false : true;
		
		if (operation == true && !muted) {
			// Mute.
			if (debug) console.log("Muting volume...");
			muted = systemVolume;
			fadeStep = Math.round(muted/20);
			if (fade) {
				volumeFadeInterval = setInterval(function() {
					newVolume = systemVolume - fadeStep;
					if (newVolume <= 0) {
						setVolume(0);
						clearInterval(volumeFadeInterval);
						volumeFadeInterval = null;
						if (debug) console.log("Muted.");
					} else {
						setVolume(newVolume);
					}
				}, 100);
			} else {
				setVolume(0);
			}
		} else if (operation == false && muted) {
			// Unmute.
			if (debug) console.log("Unmuting volume...");
			if (fade) {
				volumeFadeInterval = setInterval(function() {
					fadeStep = Math.round(muted/20);
					newVolume = systemVolume + fadeStep;
					if (newVolume >= muted) {
						newVolume = muted;
						muted = false;
						setVolume(newVolume);
						clearInterval(volumeFadeInterval);
						volumeFadeInterval = null;
						if (debug) console.log("Unmuted.");
					} else {
						setVolume(newVolume);
					}
				}, 100);
			} else {
				newVolume = muted;
				muted = false;
				setVolume(newVolume);
			}
		}
		
	}	
	
	
	function checkIfAudioControlAvailable(callback) {
		// Try getting and setting volume via AudioControl:
		audioControlAvailable = false;
		getVolumeViaAudioControl(function(volume) {
			if (volume != null) {
				// Got a value. Write it back to AudioControl.
				audioControlAvailable = true;
				if (callback) callback();
			} else {
				if (callback) callback();
			}
		});
	}

	
	function getVolumeViaAudioControl(callback) {
		if (callback) {
			request.get({
				url: "http://127.0.1.1:"+sourcesSettings.port+"/api/volume",
				json: true
			}, function(err, res, body) {
				if (err) {
					if (debug) console.error("Could not retrieve volume: " + err);
					callback(null);
				} else {
					if (res.statusCode == 200) {
						try {
							if (body.percent != undefined) {
								callback(body.percent);
							} else {
								callback(null);
								if (debug) console.error("Volume value not returned.");
							}
						} catch (error) {
							callback(null);
							if (debug) console.error("Volume control not set up properly.");
						}
					} else {
						callback(null);
					}
				}
			});
		}
	}
	

	var allMixers = [];
	
	function getALSAMixers(callback) {
		exec("amixer scontrols", function(error, stdout, stderr) {
			if (error) {
				//callback(null, error);
			} else {
				allMixers = [];
				alsaMixer = null;
				mixers = stdout.match(/'(.*?)'/g);
				for (var i = 0; i < mixers.length; i++) {
					mixer = mixers[i].slice(1, -1);
					allMixers.push(mixer);
				}
				if (debug >= 2) console.log("Available ALSA mixer controls: "+ allMixers.join(", ") + ".");
				determineALSAMixer();
				if (callback) callback();
			}
		});
	}
	
	function determineALSAMixer(callback) {
		// Determines which ALSA mixer control is suitable to use.
		alsaMixer = null;
		
		if (settings.mixer) {
			if (!alsaMixer && allMixers.indexOf(settings.mixer) != -1) {
				if (debug >= 2) console.log("The ALSA mixer specified in settings ('"+settings.mixer+"') is available.");
				alsaMixer = settings.mixer;
			} else {
				if (debug >= 2) console.log("The ALSA mixer specified in settings ('"+settings.mixer+"') is not available.");
			}
		} else {
			if (debug) console.log("ALSA mixer was not specified in settings.");
			for (var i = 0; i < allMixers.length; i++) {
				if (alsaMixer == null) {
					switch (allMixers[i]) {
						case "DSPVolume":
							if (alsaDSPVolumeControlAvailable) {
								alsaMixer = "DSPVolume";
								if (debug >= 2) console.log("ALSA DSP volume control is available.");
							}
							break;
						case "Softvol":
							break;
					}
				}
			}
		}
		if (!alsaMixer) {
			if (debug >= 2) console.log("Falling back to software volume control.");
			if (allMixers.indexOf("Softvol") != -1) alsaMixer = "Softvol";
		}
		if (callback) callback(alsaMixer);
	}

	
	function setVolumeViaALSA(volume, callback) {
		if (isNaN(volume)) {
			if (volume.charAt(0) == "+") volume = volume.slice(1) + "%+";
			if (volume.charAt(0) == "-") volume = volume.slice(1) + "%-";
		} else {
			volume = volume + "%";
		}
		exec("amixer set "+alsaMixer+" "+volume, function(error, stdout, stderr) {
			if (error) {
				if (callback) callback(null, error);
			} else {
				newVolume = parseFloat(stdout.match(/\[(.*?)\]/)[0].slice(1, -2));
				if (debug >= 2) console.log("Volume set via ALSA: "+newVolume+" %.");
				if (callback) callback(newVolume);
			}
		});
	}
	
	function getVolumeViaALSA(callback) {
		exec("amixer get "+alsaMixer, function(error, stdout, stderr) {
			if (error) {
				if (callback) callback(null, error);
			} else {
				newVolume = parseFloat(stdout.match(/\[(.*?)\]/)[0].slice(1, -2));
				if (callback) callback(newVolume);
			}
		});
	}
	
	
	return {
		version: version,
		setVolume: setVolume,
		getVolume: getVolume,
		mute: mute
	};
};




