/*
Copyright 2020 Modul 9 GmbH
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
SOFTWARE.
*/

// TTABLE (ALSA)

var execSync = require('child_process').execSync;
var version = require("./package.json").version;

var debug = beo.debug;

var defaultSettings = {
	"limit_db": -3,
	"min_slider": 0,
	"role": "mono"
};


function read_settings() {
	var child;

	try {
		stdout = execSync('/opt/hifiberry/bin/speaker-role');
		settings = JSON.parse(JSON.stringify(defaultSettings));
		var res = stdout.toString().split(' ');
		if ( res.length > 1 ) {
			settings.role=res[0]
			settings.limit_db=res[1]
		} else {
			console.error("Could not read ALSA-ttable settings via speaker-role.")
		}
		
		if (beo.extensions["sound"] && 
			beo.extensions["sound"].getVolumeControlRange != undefined) {
				settings.min_slider = beo.extensions["sound"].getVolumeControlRange()[0];
		} else {
			settings.min_slider = 0
		}
		
		beo.sendToUI("alsa-ttable", {header: "ttableSettings", content: {settings: settings}});
	} catch (error) {
		console.error("Exception reading settings via speaker-role:", error);
	}
}


function write_settings(settings) {
	var child;
	
	console.error("Write ttable settings");

	try {
		child = execSync('/opt/hifiberry/bin/speaker-role '+settings.role + " "+settings.limit_db, timeout=10000)
	} catch (error) {
		console.error("Exception calling speaker-role:", error);
	}
	


}

beo.bus.on('general', function(event) {
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == "alsa-ttable") {
			
			if (debug) console.log("Reading settings for ALSA-ttable...");
			read_settings();
			
		}
	}
	
});

beo.bus.on('alsa-ttable', function(event) {
	
	if (event.header == "saveSettings") {
		
		settings = event.content.settings
		if (settings.limit_db != undefined && settings.role != undefined) {
			write_settings(settings);
		} else {
			console.error("Settings for ALSA-ttable were incomplete, ignoring.");
		}
	}
	
	if (event.header == "setVolRange") {
		if (beo.extensions["sound"] && 
			beo.extensions["sound"].setVolumeControlRange != undefined) {
				settings = event.content.settings
				beo.extensions["sound"].setVolumeControlRange(min = settings.min_slider, max = 100);
		} else {
			console.error("sound.setVolumeControlRange not available")
		}
	}
	
});

	
module.exports = {
	version: version
};
