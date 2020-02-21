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

// LAST.FM CONTROL FOR BEOCREATE

var exec = require("child_process").exec;
var fs = require("fs");

	var debug = beo.debug;
	var version = require("./package.json").version;
	
	
	var settings = {
		loggedInAs: false
	};
	var audioControl = null;
	
	beo.bus.on('general', function(event) {
		
		if (event.header == "startup") {
			
			if (beo.extensions["hifiberry-audiocontrol"]) audioControl = beo.extensions["hifiberry-audiocontrol"];
			
			if (audioControl) {
				configuration = audioControl.getSettings();
				if (configuration.lastfm.username && !configuration.lastfm.username.comment && configuration.lastfm.password && !configuration.lastfm.password.comment) {
					settings.loggedInAs = configuration.lastfm.username.value;
				} else {
					settings.loggedInAs = false;
				}
			} 
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "last-fm") {
				beo.bus.emit("ui", {target: "last-fm", header: "lastFMSettings", content: settings});
			}
		}
	});

	
	beo.bus.on('last-fm', function(event) {
		

		if (event.header == "logIn" && audioControl) {
			if (event.content.username && event.content.password) {
				audioControl.configure([
					{section: "lastfm", option: "username", value: event.content.username},
					{section: "lastfm", option: "password", value: event.content.password}
				], true, function(success, error) {
					if (success) {
						settings.loggedInAs = event.content.username;
						beo.bus.emit("ui", {target: "last-fm", header: "lastFMSettings", content: settings});
					} else {
						beo.bus.emit("ui", {target: "last-fm", header: "logInError"});
						audioControl.configure([
							{section: "lastfm", option: "username", remove: true},
							{section: "lastfm", option: "password", remove: true}
						], true);
						settings.loggedInAs = false;
						beo.bus.emit("ui", {target: "last-fm", header: "lastFMSettings", content: settings});
					}
				});
			}
		}
		
		if (event.header == "logOut" && audioControl) {
			settings.loggedInAs = false;
			audioControl.configure([
				{section: "lastfm", option: "username", remove: true},
				{section: "lastfm", option: "password", remove: true}
			], true, function() {
				beo.bus.emit("ui", {target: "last-fm", header: "lastFMSettings", content: settings});
			});
		}
	});
	
	
	
module.exports = {
	version: version
};

