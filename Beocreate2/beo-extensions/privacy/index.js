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

// PRIVACY CONTROL FOR BEOCREATE

var exec = require("child_process").exec;
var fs = require("fs");

	var debug = beo.debug;
	var version = require("./package.json").version;
	
	var defaultSettings = {
		"privacyApprovedByUser": false
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var inferredSettings = {
		externalMetadata: false,
		usageData: false
	};
	var audioControl = null;
	
	var descriptions = {
		externalMetadata: null,
		usageData: null
	}
	
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (beo.extensions["hifiberry-audiocontrol"]) audioControl = beo.extensions["hifiberry-audiocontrol"];
			
			if (!settings.privacyApprovedByUser) {
				// If privacy settings have not been approved by the user, join setup flow.
				if (beo.extensions.setup && beo.extensions.setup.joinSetupFlow) {
					beo.extensions.setup.joinSetupFlow("privacy", {after: ["product-information"], allowAdvancing: true});
				}
			}
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "privacy") {
				for (d in descriptions) {
					if (descriptions[d] == null) {
						file = null;
						switch (d) {
							case "externalMetadata":
								file = "/opt/audiocontrol2/privacy.html";
								break;
							case "usageData":
								file = "/opt/hifiberry/etc/privacy-usagedata.html";
								break;
						}
						if (file != null) {
							if (fs.existsSync(file)) {
								descriptionItems = fs.readFileSync(file, "utf8").split("\n");
								if (descriptionItems[0] == d) {
									descriptionItems.shift();
									descriptions[d] = descriptionItems.join("\n");
								}
							}
						}
					}
				}

				getPrivacySetting("externalMetadata");
				getPrivacySetting("usageData").then(function() {
					beo.sendToUI("privacy", {header: "privacySettings", content: {settings: inferredSettings, descriptions: descriptions}});
				});
				
			}
		}
	});

	
	beo.bus.on('privacy', function(event) {
		
		if (event.header == "settings") {
			
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
			
		}

		if (event.header == "toggleSetting") {
			if (event.content.setting) {
				if (event.content.setting == "externalMetadata" && audioControl) {
					beo.sendToUI("privacy", {header: "updatingSettings"});
					inferredSettings.externalMetadata = (!inferredSettings.externalMetadata) ? true : false;
					enabled = (inferredSettings.externalMetadata) ? "1" : "0";
					audioControl.configure([{section: "privacy", option: "external_metadata", value: enabled}], true, function() {
						beo.sendToUI("privacy", {header: "privacySettings", content: {settings: inferredSettings}});
					});
				}
				
				if (event.content.setting == "usageData") {
					command = (!inferredSettings.usageData) ? "enable" : "disable";
					beo.sendToUI("privacy", {header: "updatingSettings"});
					exec("systemctl "+command+" --now pushdata.timer").on('exit', function(code) {
						if (code == 0) {
							inferredSettings.usageData = (!inferredSettings.usageData) ? true : false;
							if (debug) console.log("Sending anonymous statistics is now "+command+"d.");
							beo.sendToUI("privacy", {header: "privacySettings", content: {settings: inferredSettings}});
						}
					});
				}
			}
		}
	});
	
	beo.bus.on('setup', function(event) {
	
		if (event.header == "advancing" && event.content.fromExtension == "privacy") {
			settings.privacyApprovedByUser = true;
			beo.saveSettings("privacy", settings);
		}
				
	});
	
	
	
	function getPrivacySetting(setting) {
		switch (setting) {
			case "externalMetadata":
				if (audioControl) {
					configuration = audioControl.getSettings();
					if (configuration.privacy) {
						inferredSettings.externalMetadata = (!configuration.privacy.external_metadata ||
							(!configuration.privacy.external_metadata.comment &&
							configuration.privacy.external_metadata.value == "1")) ? true : false;
						return inferredSettings.externalMetadata;
					} else {
						inferredSettings.externalMetadata = true;
						return true;
					}
				} else {
					return false;
				}
				break;
			case "usageData":
				return new Promise(function(resolve, reject) {
					try {
						exec("systemctl is-active --quiet pushdata.timer").on('exit', function(code) {
							if (code == 0) {
								inferredSettings.usageData = true;
								resolve(true);
							} else {
								inferredSettings.usageData = false;
								resolve(false);
							}
						});
					} catch (error) {
						reject(false);
					}
				});
				break;
			default:
				return null;
				break;
		}
	}
	
	
	
	
module.exports = {
	version: version,
	getPrivacySetting: getPrivacySetting
};

