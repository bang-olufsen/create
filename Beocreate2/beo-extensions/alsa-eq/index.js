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

// ALSAEQ

var exec = require('child_process').exec;
var execFile = require('child_process').execFile;
var version = require("./package.json").version;
var debug = beo.debug;
var lastUsed = Date.now();
var usagePrefix = "alsa-equalizer";

var settings = {
	"31": 66,
	"63": 66,
	"125": 66,
	"250": 66,
	"500": 66,
	"1000": 66,
	"2000": 66,
	"4000": 66,
	"8000": 66,
	"16000": 66,
};

var controls = {
	"31": '00. 31 Hz',
	"63": '01. 63 Hz',
	"125": '02. 125 Hz',
	"250": '03. 250 Hz',
	"500": '04. 500 Hz',
	"1000":	'05. 1 kHz',
	"2000":	'06. 2 kHz',
	"4000": '07. 4 kHz',
	"8000": '08. 8 kHz',
	"16000": '09. 16 kHz',
}	


function read_settings() {
	var child;
	
	for (var hz in settings) {
		readALSAEq(hz);
	}
	
	beo.sendToUI("alsa-eq", {header: "eqSettings", content: {settings: settings}});
	checkEnabled();
}

function setALSAEq(hz, percent) {
	control = controls[hz.toString()];
	
	execFile("amixer", ["set", "-D", "equal", control, percent], function(error, stdout, stderr) {
		if (error) {
			console.error("Error adjusting ALSA mixer control '"+control+"':", error);
		} else {
			percent = parseFloat(stdout.match(/\[(.*?)\]/)[0].slice(1, -2));
			if (debug >= 2) console.log("ALSA mixer control '"+control+"' set to "+percent+" %.");
		}
	});
	settings[hz.toString()]=percent;
	timeLastUsed = Date.now() - lastUsed;
	if (timeLastUsed > 10000) {
		try {
			beo.extensions["hifiberry-debug"].reportUsage(usagePrefix,1);
		} catch (error) {
			console.error("Exception reporting usage: ", error);
		}
		lastUsed = Date.now();
	}
} 

function readALSAEq(hz) {
	control = controls[hz.toString()];
	exec('amixer -D equal get "'+control+'"', function(error, stdout, stderr) {
		if (error) {
			console.log("error while reading eq for ",hz, error);
		} else {
			percent = parseFloat(stdout.match(/\[(.*?)\]/)[0].slice(1, -2));
			settings[hz.toString()]=percent;
			if (debug) console.log("caching ", hz, percent);
		}
	});
}

function checkEnabled() {
	exec('/opt/hifiberry/bin/alsa-mode', function(error, stdout, stderr) {
		if (error) {
			console.log("error checking ALSAEq status",error);
		} else {
			mode = stdout.trim();
			if (debug) console.log("ALSA mode", mode);
			if (mode == "EQUAL") {
				beo.sendToUI("alsa-eq", {header: "alsaEqEnabled", content: {eqEnabled: true}});
			} else {
				beo.sendToUI("alsa-eq", {header: "alsaEqEnabled", content: {eqEnabled: false}});
			}
		}
	});
}

function enableEq(enabled) {
	if (enabled) {
		mode = "EQUAL";
	} else {
		mode = "SOFTVOL";
	}
	
	exec('/opt/hifiberry/bin/alsa-mode '+mode, function(error, stdout, stderr) {
		if (error) {
			console.log("error enabling/disabling alsaeq",error);
			return false;
		}
	});
	try {
		beo.extensions["hifiberry-debug"].reportActivation(usagePrefix,enabled);
	} catch (error) {
		console.error("Exception reporting usage: ", error);
	}
	return true
}


beo.bus.on('general', function(event) {
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == "alsa-eq") {
			if (debug) console.log("Reading alsaeq settings...");
			read_settings();			
		}
	}
	
});

beo.bus.on('alsa-eq', function(event) {
	
	if (event.header == "setEq") {
		try {
			hz = event.content.hz;
			percent = event.content.percent;
			setALSAEq(hz, percent)
		} catch (error) {
			console.error("Exception setting eq: ", error);
		}
	}
	
	if (event.header == "alsaEqEnable") {
		try {
			eqEnable = event.content.eqEnable;
			if (eqEnable) {
				console.log("enabling ALSAEq");
			} else {
				console.log("disabling ALSAEq");
			}
			enableEq(eqEnable);
			beo.sendToUI("alsa-eq", {header: "alsaEqEnabled", content: {eqEnabled: eqEnable}});
			if (debug) console.log("sent update to UI");
		} catch (error) {
			console.error("Exception enabling/disabling eq: ", error);
		}
	}
	
	if (event.header == "resetEq") {
		try {
			for (var hz in settings) {
				setALSAEq(hz, 66)
				if (debug) console.log("reseting",hz);
			}
			beo.sendToUI("alsa-eq", {header: "eqSettings", content: {settings: settings}});
		} catch (error) {
			console.error("Exception reseting eq: ", error);
		}
	}
});


	
module.exports = {
	version: version
};
