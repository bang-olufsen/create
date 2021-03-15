/*Copyright 2020 Bang & Olufsen A/S
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

// DISPLAY SETTINGS FOR BEOCREATE 2

var exec = require("child_process").exec;

var debug = beo.debug;

var version = require("./package.json").version;

var canUseExternalDisplay = false;
var externalDisplayOn = false;

var defaultSettings = {
	screensaverTimeout: 5
}
var settings = JSON.parse(JSON.stringify(defaultSettings));


beo.bus.on('general', function(event) {
	
	if (event.header == "startup") {
		
		if (beo.systemConfiguration.cardFeatures &&
			beo.systemConfiguration.cardFeatures.indexOf("localui") != -1) canUseExternalDisplay = true;
	}
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == "ui-settings") {
			if (canUseExternalDisplay) {
				getExternalDisplayStatus(function() {
					beo.sendToUI("ui-settings", "externalDisplay", {enabled: externalDisplayOn, canUseExternalDisplay: true});
					beo.sendToUI("ui-settings", "setScreensaverTimeout", settings);
				});
			} else {
				beo.sendToUI("ui-settings", "externalDisplay", {enabled: false, canUseExternalDisplay: false});
			}
		}
	}
});

beo.bus.on("ui-settings", function(event) {
	if (event.header == "settings") {
		if (event.content.settings) {
			settings = Object.assign(settings, event.content.settings);
			beo.sendToUI("ui-settings", "setScreensaverTimeout", settings);
		}
	}
	if (event.header == "externalDisplayOn") {
		setExternalDisplayStatus(event.content.enabled, function() {
			beo.sendToUI("ui-settings", "externalDisplay", {enabled: externalDisplayOn, canUseExternalDisplay: true});
		});
	}

	if (event.header == "setScreensaverTimeout") {
		settings.screensaverTimeout = event.content.settings.screensaverTimeout;
		beo.bus.emit("settings", {header: "saveSettings", content: {extension: "ui-settings", settings: settings}});
		beo.sendToUI("ui-settings", "setScreensaverTimeout", settings);
		if (debug) console.log("Screensaver timeout set to " + settings.screensaverTimeout + ((settings.screensaverTimeout > 1) ? " minute(s)." : "."));

	}
	if (event.header == "getScreensaverTimeout") {
		beo.sendToUI("ui-settings", "setScreensaverTimeout", settings);
	}

	hideScreenSaver();
});



function getExternalDisplayStatus(callback) {
	exec("systemctl is-active --quiet weston.service cog.service").on('exit', function(code) {
		if (code == 0) {
			externalDisplayOn = true;
			callback(true);
		} else {
			externalDisplayOn = false;
			callback(false);
		}
	});
}

function setExternalDisplayStatus(enabled, callback) {
	if (enabled) {
		exec("systemctl enable --now weston.service cog.service").on('exit', function(code) {
			if (code == 0) {
				externalDisplayOn = true;
				if (debug) console.log("External display on.");
				callback(true);
			} else {
				externalDisplayOn = false;
				callback(false, true);
			}
		});
	} else {
		exec("systemctl disable --now weston.service cog.service").on('exit', function(code) {
			externalDisplayOn = false;
			if (code == 0) {
				callback(false);
				if (debug) console.log("External display off.");
			} else {
				callback(false, true);
			}
		});
	}
}

/**
 * call this function to hide the screensaver
 */
function hideScreenSaver(){
	beo.sendToUI("screensaver", {header: "deactivate", content: {}});
}

module.exports = {
	version: version
};

