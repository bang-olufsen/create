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


module.exports = function(beoBus, globals) {
	var debug = globals.debug;
	var send = globals.sendToUI;
	var beoBus = beoBus;
	
	var version = require("./package.json").version;
	
	var currentSource = null;
	var activeSources = {};
	var sourceDeactivated = false;
	
	var playerState = "stopped";
	
	var metadataCache = {};
	var metadataCacheIndex = 1;
	
	beoBus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "now-playing") {
				send({target: "now-playing", header: "metadata", content: {metadata: metadataCache[currentSource], cacheIndex: metadataCacheIndex}});
			}
		}
	});
	
	beoBus.on("sources", function(event) {
		
		if (event.header == "activeSources") {
			currentSource = event.content.currentSource;
			activeSources = event.content.activeSources;
			
			if (sourceDeactivated) {
				if (!currentSource) {
					playerState = "stopped";
					send({target: "now-playing", header: "metadata", content: {metadata: null}});
				} else {
					send({target: "now-playing", header: "metadata", content: {metadata: metadataCache[currentSource], cacheIndex: metadataCacheIndex}});
				}
				sourceDeactivated = false;
			} else {
				if (currentSource && !metadataCache[currentSource]) {
					metadataCache[currentSource] = null;
					metadataCacheIndex++;
					playerState = "playing";
					send({target: "now-playing", header: "metadata", content: {metadata: metadataCache[currentSource], cacheIndex: metadataCacheIndex}});
				}
			}
		}
		
		if (event.header == "sourceDeactivated") {
			delete metadataCache[event.content.extension];
			sourceDeactivated = true;
		}
	});
	
	
	beoBus.on("now-playing", function(event) {
		if (event.header == "metadata") {
			sendMetadata = {};
			if (!metadataCache[event.content.extension]) {
				metadataCache[event.content.extension] = {};
			}
			
			if (event.content.title != undefined) {
				sendMetadata.title = event.content.title;
				metadataCache[event.content.extension].title = event.content.title;
			}
			if (event.content.album != undefined) {
				sendMetadata.album = event.content.album;
				metadataCache[event.content.extension].album = event.content.album;
			}
			if (event.content.artist != undefined) {
				sendMetadata.artist = event.content.artist;
				metadataCache[event.content.extension].artist = event.content.artist;
			}
			if (event.content.picture != undefined) {
				if (event.content.picture == false) {
					metadataCache[event.content.extension] = false;
					sendMetadata.picture = false;
				} else if (metadataCache[event.content.extension].picture != event.content.picture) {
					sendMetadata.picture = event.content.picture;
					metadataCache[event.content.extension].picture = event.content.picture;
				} else {
					sendMetadata.picture = true;
				}
			}
			metadataCacheIndex++;
			if (metadataCacheIndex > 1000) metadataCacheIndex = 1;
			send({target: "now-playing", header: "metadata", content: {metadata: sendMetadata, cacheIndex: metadataCacheIndex}});
			
		}
		
		if (event.header == "playerState") {
			if (currentSource && event.content.extension == currentSource) {
				playerState = event.content.state;
				send({target: "now-playing", header: "playerState", content: {state: event.content.state}});
			}
		}
		
		if (event.header == "showingNowPlaying") {
			if (event.content.cacheIndex != metadataCacheIndex) {
				send({target: "now-playing", header: "metadata", content: {metadata: metadataCache[currentSource], cacheIndex: metadataCacheIndex}});
			}
			send({target: "now-playing", header: "playerState", content: {state: playerState}});
		}
		
		if (event.header == "transport") {
			
			if (currentSource && activeSources[currentSource].transportControls) {
				switch (event.content.action) {
					case "playPause":
					case "play":
					case "stop":
					case "next":
					case "previous":
						beoBus.emit(currentSource, {header: "transport", content: {action: event.content.action}});
						break;
				}
				
			
			}
		}
	});
	
	
	beoBus.on("remote", function(event) {
		switch (event.content.command) {
			
			case "VOL UP":
				beoBus.emit("sound", {header: "setVolume", content: {step: "up"}});
				break;
			case "VOL DOWN":
				beoBus.emit("sound", {header: "setVolume", content: {step: "down"}});
				break;
			case "MUTE":
				beoBus.emit("sound", {header: "setVolume", content: {mute: "toggle"}});
				break;
		}
	});
	
	
	return {
		version: version
	};
};




