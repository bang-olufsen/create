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
	
	var defaultSettings = {
		useExternalArtwork: "auto"
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	var allSources = {};
	var currentSource = null;
	var focusedSource = null;
	
	var playerState = "stopped";
	
	var metadataCacheIndex = 1;
	
	var sources = null;
	
	beoBus.on('general', function(event) {
		// See documentation on how to use BeoBus.
		// GENERAL channel broadcasts events that concern the whole system.
		
		//console.dir(event);
		
		if (event.header == "startup") {
			
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "now-playing") {
				
			}
			
			if (event.content == "ui-settings") {
				beoBus.emit("ui", {target: "now-playing", header: "useExternalArtwork", content: {useExternalArtwork: settings.useExternalArtwork}});
			}
		}
	});
	
	beoBus.on("sources", function(event) {
		
		
		if (event.header == "sourcesChanged") {
			if (event.content.sources) {
				allSources = event.content.sources;
			}
			if (event.content.focusedSource) {
				if (event.content.focusedSource == focusedSource) {
					if (playerState != allSources[focusedSource].playerState) {
						playerState = allSources[focusedSource].playerState;
						send({target: "now-playing", header: "playerState", content: {state: playerState}});
					}
				} else {
					sendMetadata(event.content.focusedSource, true);
				}
				focusedSource = event.content.focusedSource;
			} else {
				focusedSource = null;
				playerState = "stopped";
				send({target: "now-playing", header: "playerState", content: {state: playerState}});
				sendMetadata();
			}
			if (event.content.currentSource) {
				currentSource = event.content.currentSource;
			} else {
				currentSource = null;
			}
		}
		
		if (event.header == "playerStateChanged") {
			if (event.content.extension && event.content.state) {
				allSources[event.content.extension].playerState = event.content.state;
				if (event.content.extension == focusedSource) {
					if (playerState != event.content.state) {
						playerState = event.content.state;
						send({target: "now-playing", header: "playerState", content: {state: playerState}});
					}
				}
			}
		}
		
		if (event.header == "metadataChanged") {
			if (event.content.extension && event.content.metadata) {
				allSources[event.content.extension].metadata = event.content.metadata;
				if (event.content.extension == focusedSource) sendMetadata(event.content.extension, true);
			}
		}

	});
	
	
	beoBus.on("now-playing", function(event) {
		
		if (event.header == "settings") {
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
		}
		
		if (event.header == "useExternalArtwork") {
			if (event.content && event.content.useExternalArtwork) {
				settings.useExternalArtwork = event.content.useExternalArtwork;
				beoBus.emit("settings", {header: "saveSettings", content: {extension: "now-playing", settings: settings}});
			}
			beoBus.emit("ui", {target: "now-playing", header: "useExternalArtwork", content: {useExternalArtwork: settings.useExternalArtwork}});
		}
		
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
				metadataCache[event.content.extension].picture = event.content.picture;
				sendMetadata.picture = event.content.picture;
				if (event.content.picturePort) {
					metadataCache[event.content.extension].picturePort = event.content.picturePort;
					sendMetadata.picturePort = event.content.picturePort;
				} else {
					metadataCache[event.content.extension].picturePort = null;
					sendMetadata.picturePort = null;
				}
			} else {
				metadataCache[event.content.extension].picturePort = null;
				metadataCache[event.content.extension].picture = false;
				sendMetadata.picture = false;
			}
			metadataCacheIndex++;
			if (metadataCacheIndex > 1000) metadataCacheIndex = 1;
			send({target: "now-playing", header: "metadata", content: {metadata: sendMetadata, cacheIndex: metadataCacheIndex, extension: event.content.extension}});
			
		}
		
		if (event.header == "playerState") {
			if (focusedSource && event.content.extension == focusedSource) {
				if (event.content.state != playerState || previousPlayedSource != focusedSource) {
					switch (event.content.state) {
						case "stopped":
						case "paused":
						case "playing":
							playerState = event.content.state;
							previousPlayedSource = focusedSource;
							send({target: "now-playing", header: "playerState", content: {state: event.content.state}});
							break;
					}
				}
			}
		}
		
		if (event.header == "getData") {
			send({target: "now-playing", header: "playerState", content: {state: playerState}});
			if (focusedSource) {
				if (event.content.cacheIndex != metadataCacheIndex) {
					sendMetadata(focusedSource);
				}
			} else {
				sendMetadata();
				//if (event.content.cacheIndex != metadataCacheIndex) sendMetadata(lastSource);
			}
		}
		
		if (event.header == "transport") {
			if (event.content.action) {
				beoBus.emit("sources", {header: "transport", content: {action: event.content.action}});
			}
		}
		
		if (event.header == "toggleLove") {
			beoBus.emit("sources", {header: "toggleLove"});
		}
	});
	
	
	beoBus.on("remote", function(event) {
		switch (event.content.command) {
			
			case "VOL UP":
				beoBus.emit("sound", {header: "setVolume", content: "+2"});
				break;
			case "VOL DOWN":
				beoBus.emit("sound", {header: "setVolume", content: "-2"});
				break;
			case "MUTE":
				beoBus.emit("sound", {header: "toggleMute"});
				break;
		}
	});
	
	
	function sendMetadata(forSource = null, increment) {
		if (increment) {
			metadataCacheIndex++;
			if (metadataCacheIndex > 1000) metadataCacheIndex = 1;
		}
		if (forSource && allSources[forSource] && allSources[forSource].metadata) {
			send({target: "now-playing", header: "metadata", content: {metadata: allSources[forSource].metadata, extension: forSource, cacheIndex: metadataCacheIndex}});
		} else {
			send({target: "now-playing", header: "metadata", content: {metadata: null, extension: forSource, cacheIndex: metadataCacheIndex}});
		}
	}
	
	
	return {
		version: version
	};
};




