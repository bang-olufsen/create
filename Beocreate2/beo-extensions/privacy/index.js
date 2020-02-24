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
	
	
	var settings = {
		externalMetadata: false
	};
	var audioControl = null;
	
	var descriptions = {
		externalMetadata: null
	}
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (beo.extensions["hifiberry-audiocontrol"]) audioControl = beo.extensions["hifiberry-audiocontrol"];
			
			if (audioControl) {
				configuration = audioControl.getSettings();
				if (configuration.privacy) {
					settings.externalMetadata = (!configuration.privacy.external_metadata ||
						(!configuration.privacy.external_metadata.comment &&
						configuration.privacy.external_metadata.value == "1")) ? true : false;
				} else {
					settings.externalMetadata = true;
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
				beo.sendToUI("privacy", {header: "privacySettings", content: {settings: settings, descriptions: descriptions}});
			}
		}
	});

	
	beo.bus.on('privacy', function(event) {
		

		if (event.header == "toggleSetting") {
			if (event.content.setting) {
				if (event.content.setting == "externalMetadata" && audioControl) {
					beo.sendToUI("privacy", {header: "updatingSettings"});
					settings.externalMetadata = (!settings.externalMetadata) ? true : false;
					enabled = (settings.externalMetadata) ? "1" : "0";
					audioControl.configure([{section: "privacy", option: "external_metadata", value: enabled}], true, function() {
						beo.sendToUI("privacy", {header: "privacySettings", content: {settings: settings}});
					});
				}
			}
		}
	});
	
	
	
module.exports = {
	version: version
};

