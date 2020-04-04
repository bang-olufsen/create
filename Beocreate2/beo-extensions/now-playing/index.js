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

// BEOCREATE NOW PLAYING


	var debug = beo.debug;
	
	var version = require("./package.json").version;
	
	var defaultSettings = {
		useExternalArtwork: "auto"
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));

	
	beo.bus.on('general', function(event) {
		// See documentation on how to use beo.bus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "now-playing") {
				
			}
			
			if (event.content == "ui-settings") {
				beo.bus.emit("ui", {target: "now-playing", header: "useExternalArtwork", content: {useExternalArtwork: settings.useExternalArtwork}});
			}
		}
	});
	
	
	
	beo.bus.on("now-playing", function(event) {
		
		if (event.header == "settings") {
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
		}
		
		if (event.header == "useExternalArtwork") {
			if (event.content && event.content.useExternalArtwork) {
				settings.useExternalArtwork = event.content.useExternalArtwork;
				beo.bus.emit("settings", {header: "saveSettings", content: {extension: "now-playing", settings: settings}});
			}
			beo.bus.emit("ui", {target: "now-playing", header: "useExternalArtwork", content: {useExternalArtwork: settings.useExternalArtwork}});
		}
		
		
		if (event.header == "transport") {
			transport(event.content.action);
		}
		
		if (event.header == "toggleLove") {
			beo.bus.emit("sources", {header: "toggleLove"});
		}
	});
	
function transport(action) {
	if (action &&
		beo.extensions.sources && 
		beo.extensions.sources.transport) {
		beo.extensions.sources.transport(action);
	}
}
	
interact = {
	actions: {
		playPause: function() {
			transport("playPause");
		},
		next: function() {
			transport("next");
		},
		previous: function() {
			transport("previous");
		},
		pause: function() {
			transport("pause");
		}
	}
}
	
	
module.exports = {
	version: version,
	interact: interact
};




