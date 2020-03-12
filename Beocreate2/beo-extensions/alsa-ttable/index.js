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

var version = require("./package.json").version;

var debug = beo.debug;
var metadata = {};

var defaultSettings = {
	"limit_db": -3,
	"role": "mono"
};


function read_settings() {
	var execSync = require('child_process').execSync;
	var child;

	try {
		stdout = execSync('/opt/hifiberry/bin/speaker-role');
		settings = JSON.parse(JSON.stringify(defaultSettings));
		var res = stdout.toString().split(' ');
		if ( res.length > 1 ) {
			settings.role=res[0]
			settings.limit_db=res[1]
		} else {
			console.log("could not read settings via speaker-role")
		}
		
		beo.bus.emit("ui", {target: "alsa-ttable", header: "ttableSettings", content: {settings: settings}});
	} catch (error) {
		console.log("exception reading settings via speaker-role : "+error);
	}
}


function write_settings(settings) {
	var execSync = require('child_process').execSync;
	var child;

	try {
		child = execSync('/opt/hifiberry/bin/speaker-role '+settings.role + " "+settings.limit_db)
	} catch (error) {
		console.log("exception calling speaker-role : "+error);
	}
}

beo.bus.on('general', function(event) {
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == "alsa-ttable") {
			
			console.log("starting alsa-ttable")
			
			if (debug) console.log("reading ALSA settings...");
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
			console.log("incomplete settings, ignoring");
		}
	}
	
});

	
module.exports = {
	version: version
};
