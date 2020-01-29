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

// PAIRING FOR TWO BEOCREATE 4-CHANNEL AMPLIFIERS

var beoDSP = require(beo.systemDirectory+'/beocreate_essentials/dsp');
var version = require("./package.json").version;
var debug = beo.debug;

var defaultSettings = {
	"daisyChainEnabled": false,
	"daisyChainDisabledReason": null
};
var settings = JSON.parse(JSON.stringify(defaultSettings));
var soundAdjustmentsStored = false;
var skipStoringAdjustments = false;

var metadata = {};

beo.bus.on('general', function(event) {
	
	if (event.header == "startup") {
		
		
	}
	
	if (event.header == "activatedExtension") {
		if (event.content == "daisy-chain") {
			beo.sendToUI("daisy-chain", {header: "daisyChainSettings", content: settings});
		}
	}
});

beo.bus.on('dsp', function(event) {
	
	if (event.header == "connected" && event.content == true) {
		
		applyDaisyChainEnabledFromSettings(true);
		
	}
	
	if (event.header == "metadata") {
		
		if (event.content.metadata) {
			metadata = event.content.metadata;
			if (metadata.canBecomeDaisyChainSlaveRegister) {
				beoDSP.writeDSP(metadata.canBecomeDaisyChainSlaveRegister.value[0], 0, false);
				// Prevent this amplifier from being in slave mode when connected to the Pi.
			}
		} else {
			metadata = {};
		}
	}
});


beo.bus.on('daisy-chain', function(event) {
	
	if (event.header == "settings") {
		if (event.content.settings) {
			settings = Object.assign(settings, event.content.settings);
		}
	}
	
	if (event.header == "getSettings") {
		beo.sendToUI("daisy-chain", {header: "daisyChainSettings", content: settings});
	}
	
	if (event.header == "setDaisyChainEnabled") {
		if (event.content.enabled != undefined) {
			soundAdjustmentsStored = false;
			settings.daisyChainDisabledReason = null;
			settings.daisyChainEnabled = event.content.enabled;
			beo.sendToUI("daisy-chain", {header: "daisyChainSettings", content: settings});
			beo.saveSettings("daisy-chain", settings);
			applyDaisyChainEnabledFromSettings();
		}
	}
	
	if (event.header == "disableDaisyChaining") {
		// This may be called by other extensions when making changes to sound that can't be synchronised.
		if (settings.daisyChainEnabled) {
			settings.daisyChainEnabled = false;
			if (event.content.reason) {
				settings.daisyChainDisabledReason = event.content.reason;
			}
			beo.sendToUI("daisy-chain", {header: "daisyChainSettings", content: settings});
			beo.saveSettings("daisy-chain", settings);
			applyDaisyChainEnabledFromSettings();
		}
	}
	
	if (event.header == "assistantProgress") {
		if (event.content.skipStoringAdjustments != undefined) skipStoringAdjustments = event.content.skipStoringAdjustments;
		switch (event.content.step) {
			case 1:
				// Store sound adjustments.
				if (!skipStoringAdjustments && !soundAdjustmentsStored) {
					if (beo.extensions["dsp-programs"] && 
						beo.extensions["dsp-programs"].storeAdjustments) {
						beo.extensions["dsp-programs"].storeAdjustments(function(success) {
							if (success) soundAdjustmentsStored = true;
							if (beo.extensions["dsp-programs"].setAutoInstallProgram) beo.extensions["dsp-programs"].setAutoInstallProgram();
						});
					}
				}
				break;
			case 2:
				// Shut down, switch chaining on.
				if (!skipStoringAdjustments) {
					settings.daisyChainDisabledReason = null;
					settings.daisyChainEnabled = true;
					if (beo.extensions["dsp-programs"].setAutoInstallProgram) {
						beo.extensions["dsp-programs"].setAutoInstallProgram();
					}
					beo.saveSettings("daisy-chain", settings);
					beo.bus.emit("general", {header: "requestShutdown", content: {extension: "daisy-chain", overrideUIActions: true}});
				}
				break;
			case 4:
				if (skipStoringAdjustments) {
					settings.daisyChainDisabledReason = null;
					settings.daisyChainEnabled = true;
					beo.sendToUI("daisy-chain", {header: "daisyChainSettings", content: settings});
					beo.saveSettings("daisy-chain", settings);
					applyDaisyChainEnabledFromSettings();
				}
				break;
		}
	}
	
	if (event.header == "startAssistant") {
		skipStoringAdjustments = false;
		soundAdjustmentsStored = false;
	}
	
});


function applyDaisyChainEnabledFromSettings(startup) {
	// These registers are fixed, so no DSP metadata is required to do daisy-chaining.
	if (settings.daisyChainEnabled) {
		beoDSP.writeRegister(63168, 3);
		beoDSP.writeRegister(63169, 4);
		beoDSP.writeRegister(63184, 5);
		beoDSP.writeRegister(63185, 6);
		beoDSP.writeRegister(63135, 0); // SPDIF user data source
		beo.bus.emit("daisy-chain", {header: "daisyChainEnabled", content: {enabled: true}}); // Channels extension will listen to this event.
		if (debug) console.log("Daisy-chaining with another amplifier is on.");
	} else {
		beoDSP.writeRegister(63168, 0);
		beoDSP.writeRegister(63169, 0);
		beoDSP.writeRegister(63184, 0);
		beoDSP.writeRegister(63185, 0);
		beoDSP.writeRegister(63135, 1); // SPDIF user data source
		beo.bus.emit("daisy-chain", {header: "daisyChainEnabled", content: {enabled: false}});
		if (debug && !startup) console.log("Daisy-chaining with another amplifier is off.");
	}
}

function setChannelRole(channel, role, roleText) {
	// Sets channel roles of the connected slave amplifier over SPDIF.
	// Assumes that whoever (probably Channels extension) uses this function, knows what the different channel roles are.
	channelIndex = ("abcd").indexOf(channel.toLowerCase());
	if (channelIndex != -1 && !isNaN(role)) {
		start = 63170;
		if (debug) console.log("Setting channel "+channel.toUpperCase()+" of the chained amplifier to "+role+" ("+roleText+").");
		beoDSP.writeRegister(start+channelIndex, role);
	}
}


module.exports = {
	setChannelRole: setChannelRole,
	version: version
};
