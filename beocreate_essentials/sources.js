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

// Music Source Manager

// Installs available sources to the Raspberry Pi. The actual installation scripts should be included with beocreate-installer in pi's home directory. *TO DO*: make more portable.
// Also changes the display name of Spotifyd and shairport-sync when the user renames the sound system.

var child_process = require('child_process');
var eventEmitter = require('events').EventEmitter;
var util = require('util');
var mdns = require('mdns');
var request = require('request'); // for sending HTTP requests to the DACP server
var fs = require('fs'); // for filesystem access

var sources = module.exports = {
	installSource: installSource,
	configureSource: configureSource,
	SourceManager: SourceManager
};

var airPlayAvailable = false;
var airPlayMetadataStream;

function installSource(source, callback) {
	switch (source) {
		case "shairport-sync":
		case "spotifyd":
		case "bluetooth":
			command = "/home/pi/beocreate-installer install-source "+source;
			child_process.exec(command, function(error, stdout, stderr) {
				if (error) {
					console.log(error);
					callback(null, error);
				} else {
					//console.log(stdout);
					if (stdout.indexOf(source+" installed.") != -1) {
						callback(true);
					}
				}
			});
			break;
		default:
			callback(-1);
			break;
	}
}

function configureSource(sources, options, callback) {
	if (typeof sources == "object" || typeof sources == "array") {
	
	} else {
		sources = [sources];
	}
	
	for (var s = 0; s < sources.length; s++) {
		source = sources[s];
		switch (source) {
			case "shairport-sync":
				if (options.productName) {
					ssconfig = fs.readFileSync("/etc/shairport-sync.conf", "utf8").split('\n');
					for (var i = 0; i < ssconfig.length; i++) {
						if (ssconfig[i].indexOf("\tname = \"") != -1) {
							console.log("Found name in shairport-sync config. Changing.");
							ssconfig[i] = "\t\tname = \""+options.productName+"\";";
						}
					}
					sstext = ssconfig.join("\n");
					fs.writeFileSync("/etc/shairport-sync.conf", sstext);
				}
				break;
			case "spotifyd":
				if (options.productName) {
					spotconfig = fs.readFileSync("/etc/spotifyd.conf", "utf8").split('\n');
					for (var i = 0; i < spotconfig.length; i++) {
						if (spotconfig[i].indexOf("device_name = \"") != -1) {
							console.log("Found name in spotifyd config. Changing.");
							spotconfig[i] = "device_name = \""+options.productName+"\"";
						}
					}
					spottext = spotconfig.join("\n");
					fs.writeFileSync("/etc/spotifyd.conf", spottext);
				}
				break;
		}
	}
	callback(true);
}

function SourceManager() {
if (! (this instanceof SourceManager)) return new SourceManager();
	this.sources = [];
	
	eventEmitter.call(this);
}

util.inherits(SourceManager, eventEmitter);

SourceManager.prototype.initialise = function initialise(options) {
	if (!options) options = {};
	
	var self = this;
	
	// Check if shairport-sync metadata is available (default location, unless otherwise specified).
	airPlayMetadataPath = "/tmp/shairport-sync-metadata";
	if (options.airPlayMetadataPath) airPlayMetadataPath = options.airPlayMetadataPath;
	if (fs.existsSync(airPlayMetadataPath)) {
    	airPlayAvailable = true;
	}
	if (airPlayAvailable) {
		airPlayMetadataStream = fs.createReadStream(airPlayMetadataPath); // read from shairport-sync metadata
		airPlayMetadataStream.setEncoding('utf8');
		airPlayMetadataStream.on('data', function(chunk) {
			processAirPlayMetadata(chunk);
		});
	}
	
	var dataBuffer = "";
	function processAirPlayMetadata(theData) {
		dataBuffer = dataBuffer + theData;
		if (theData.endsWith("</item>\n")) {
			dataItems = dataBuffer.replace(/(\r\n|\n|\r)/gm, "");
			dataItems = dataItems.split("</item>");
			for (i = 0; i < dataItems.length; i++) {
				if (dataItems[i].length == 0) {
					continue;
				}
				dataSubitems = dataItems[i].split("</code><length>");
				//console.log(thisDataItem+"--end--");
				typeAndCode = dataSubitems[0].split("</type><code>");
				theCode = new Buffer(typeAndCode[1], 'hex').toString("ascii");
				theType = new Buffer(typeAndCode[0].slice(12), 'hex').toString("ascii");
				decodedData = "";
				if (!dataSubitems[1].startsWith("0")) {
					encodedDataSubitems = dataSubitems[1].split("</length><data encoding=\"base64\">");
					data64 = encodedDataSubitems[1].slice(0, -7);
					if (theCode != "PICT") {
						decodedData = new Buffer(data64, 'base64').toString();
					}
				}
				if ("PICT pbeg pend pfls prsm pvol prgr mdst mden snam snua stal daid acre asal asar asgn minm clip".indexOf(theCode) != -1) {
					// TO DEBUG, UNCOMMENT FOLLOWING:
					//console.log(theType, theCode, ":", decodedData);
				}
				switch (theCode) {
					case "pend":
						self.emit('sleep', {sourceName: "AirPlay"});
						break;
					case "pbeg":
						self.emit('wake', {sourceName: "AirPlay"});
						break;
					case "PICT":
						self.emit('metadata', {picture: data64});
						break;
					case "minm":
						self.emit('metadata', {title: decodedData});
						break;
					case "asal":
						self.emit('metadata', {album: decodedData});
						break;
					case "asar":
						self.emit('metadata', {artist: decodedData});
						break;
					case "pvol":
						volumeValues = decodedData.split(",");
						if (volumeValues[0] == -144) {
							volumeIsMuted = true;
							self.emit('playback', {volume: -1});
						} else {
							volumeIsMuted = false;
							lastVolume = convertAirPlayVolume(volumeValues[0], 0);
							self.emit('playback', {volume: lastVolume});
						}
						break;
				}
			}
	
			//console.log(dataBuffer);
			dataBuffer = ""; // Empty data buffer for next batch.
		} else {
			//console.log("More incoming data...")
		}
	}
	
	// Check if string ends with string: string.endsWith(suffix);
	String.prototype.endsWith = function(suffix) {
		return this.match(suffix + "$") == suffix;
	};
}


function convertAirPlayVolume(value, conversionType) {
	if (conversionType == 0) { // Convert from dB (-30 to 0) to abstracted value (0-90).
		return (1 - (value / -30)) * 90;
	}

	if (conversionType == 1) { // Convert from abstracted value to dB (-30 to 0).
		return -30 + ((value / 90) * 30);
	}
}
