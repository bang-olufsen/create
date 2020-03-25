/*Copyright 2020 Bang & Olufsen A/S
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

// HIFIBERRYOS ROOM COMPENSATION FOR BEOCREATE 2
const spawn = require("child_process").spawn;
const exec = require("child_process").exec;
const fs = require("fs");
const path = require("path");

var version = require("./package.json").version;
var arcDirectory = beo.dataDirectory+"/beo-room-compensation"; // Sound presets directory.

var newMeasurementName = null;
var debug = beo.debug;

var defaultSettings = {
	sampleCount: 4,
	noiseType: "white",
	measureWithSoundDesign: false
}
var settings = JSON.parse(JSON.stringify(defaultSettings));

var measurements = {};
var compactMeasurementList = {};
	
beo.bus.on('general', function(event) {
	
	if (event.header == "startup") {
		readMeasurements();
	}
	
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == "room-compensation") {
			
			beo.sendToUI("room-compensation", {header: "measurements", content: {measurements: compactMeasurementList}});
		}
	}
});

beo.bus.on('room-compensation', function(event) {
	
	if (event.header == "settings") {
		if (event.content.settings) {
			settings = Object.assign(settings, event.content.settings);
		}
	}
	
	if (event.header == "newMeasurement" && event.content.name) {
		if (!fs.existsSync(arcDirectory)) fs.mkdirSync(arcDirectory);
		newMeasurementName = event.content.name;
		if (!measurements[generateFilename(newMeasurementName)] || event.content.override) {
			detectMicrophone("start");
		} else {
			beo.sendToUI("room-compensation", {header: "measurementExists"});
		}
	}
	
	if (event.header == "measureLevel") {
		measureLevel("start");
	}
	
	if (event.header == "measureRoom") {
		measureLevel("stop");
		measureRoom("start");
	}
	
	if (event.header == "stopMeasurement") {
		measureLevel("stop");
		setOrRestoreVolume("restore");
		measureRoom("stop");
	}
	
	if (event.header == "ping") {
		ping(event.content.stop);
	}
	
	if (event.header == "getMeasurement") {
		if (event.content.measurementID && measurements[event.content.measurementID]) {
			beo.sendToUI("room-compensation", {header: "singleMeasurement", content: {measurement: measurements[event.content.measurementID], measurementID: event.content.measurementID}});
		}
	}
	
	if (event.header == "deleteMeasurement") {
		if (event.content.measurementID && measurements[event.content.measurementID]) {
			if (debug) console.log("Deleting room compensation measurement '"+measurements[event.content.measurementID].name+"'...");
			delete measurements[event.content.measurementID];
			delete compactMeasurementList[event.content.measurementID];
			if (fs.existsSync(arcDirectory+"/"+event.content.measurementID+".json")) fs.unlinkSync(arcDirectory+"/"+event.content.measurementID+".json");
			beo.sendToUI("room-compensation", {header: "measurements", content: {measurements: compactMeasurementList}});
		}
	}
});

function stopAllSources() {
	if (beo.extensions.sources && beo.extensions.sources.stopAllSources) {
		beo.extensions.sources.stopAllSources();
	}
}

var microphone = null;
var runMicrophoneDetection = false;
function detectMicrophone(stage) {
	if (stage == "start") {
		if (!runMicrophoneDetection) {
			beo.sendToUI("room-compensation", {header: "detectingMicrophone"});
			runMicrophoneDetection = true;
			microphone = null;
			if (debug) console.log("Looking for microphone for room measurements...");
		}
		setTimeout(function() {
			exec("/opt/hifiberry/bin/supported-mics", function(error, stdout, stderr) {
				if (!error) {
					if (stderr) {
						console.error("Microphone detection failed:", stderr);
					} else if (stdout.trim() != "") {
						micItems = stdout.trim().split(":");
						microphone = {index: parseInt(micItems[0]), name: micItems[1]};
						if (debug) console.log(microphone.name+" detected as audio input "+microphone.index+".");
						beo.sendToUI("room-compensation", {header: "microphoneDetected", content: {microphoneName: microphone.name}});
						runMicrophoneDetection = false;
					} else {
						if (runMicrophoneDetection) detectMicrophone("start");
					}
				} else {
					console.error("Microphone detection failed:", error);
					runMicrophoneDetection = false;
				}
			});
		}, 3000);
	}
	if (stage == "stop") {
		runMicrophoneDetection = false;
	}
}


var runLevelMeter = false;
var testTone;
var levelHistory = [];
var averageLevel = 0;

function measureLevel(stage) {
	if (stage == "start" && microphone != null) {
		if (!runLevelMeter) {
			stopAllSources();
			if (debug) console.log("Starting level measurement with "+settings.noiseType+" noise...");
			beo.sendToUI("room-compensation", {header: "measuringLevel"});
			setOrRestoreVolume("set");
			testTone = spawn("play", ["-q", "-n", "synth", settings.noiseType+"noise"]);
			runLevelMeter = true;
			levelHistory = [];
		}
		exec("/opt/hifiberry/bin/input-level --card=hw:"+microphone.index+",0", function(error, stdout, stderr) {
			if (!error) {
				if (stdout) {
					level = parseFloat(stdout);
					if (debug >= 2) console.log("Input level currently at: "+level+" dB.");
					beo.sendToUI("room-compensation", {header: "inputLevel", content: {level: level}});
					levelHistory.push(level);
					if (levelHistory.length == 4) levelHistory.shift();
					if (runLevelMeter) measureLevel("start");
				} else if (stderr) {
					console.error("Measuring level failed:", stderr);
					runLevelMeter = false;
				}
			} else {
				console.error("Measuring level failed:", error);
				runLevelMeter = false;
			}
		});
	}
	
	if (stage == "stop") {
		if (testTone) testTone.kill("SIGINT");
		averageLevel = levelHistory.reduce(function(a, b) { return a + b }, 0) / levelHistory.length;
		runLevelMeter = false;
	}
}

var pingTimeout;
function ping(stop = false) {
	clearTimeout(pingTimeout);
	if (!stop) {
		pingTimeout = setTimeout(function() {
			if (debug) console.log("User interface stopped pinging, cancelling room compensation features that require interaction.");
			detectMicrophone("stop");
			measureLevel("stop");
		}, 3000);
	}
}

var runRoomMeasurement = false;
var roomMeasurementProcess;
var totalSamples = 2;
var currentSample = -1;
var errors = 0;
function measureRoom(stage) {
	if (stage == "start" && microphone != null) {
		runRoomMeasurement = true;
		if (debug) console.log("Starting measurement...");
		errors = 0;
		beo.sendToUI("room-compensation", {header: "measuringRoom", content: {phase: "starting"}});
		if (!settings.measureWithSoundDesign) {
			// Temporarily disable sound design and tone controls.
			if (beo.extensions["beosonic"] && beo.extensions["beosonic"].tempDisable) beo.extensions["beosonic"].tempDisable(true);
			if (beo.extensions.equaliser && beo.extensions.equaliser.tempDisable) beo.extensions.equaliser.tempDisable(true, ['l','r']);
		}
		measurementPhase = 0;
		currentSample = -1;
		setTimeout(function() {
			roomMeasurementProcess = spawn("/opt/hifiberry/bin/room-measure", ["hw:"+microphone.index+",0", "both", settings.sampleCount.toString()], {cwd: arcDirectory, shell: true});
			
			roomMeasurementProcess.stdout.on('data', function (data) {
				data = data.toString();
				if (data.indexOf("aborting") != -1) {
					beo.sendToUI("room-compensation", {header: "measuringRoom", content: {phase: "error"}});
					console.error("Error in room measurement:", data);
					errors++;
				} else if (data.indexOf("Recording device: ") != -1) {
					currentSample++;
					if (debug) console.log("Recording sample "+(currentSample+1)+" of "+settings.sampleCount+"...");
					beo.sendToUI("room-compensation", {header: "measuringRoom", content: {phase: "recording", sample: currentSample, totalSamples: settings.sampleCount}});
				} else if (data.indexOf("Recording finished") != -1) {
					setOrRestoreVolume("restore");
					if (!settings.measureWithSoundDesign) {
						// Restore sound design and tone controls.
						if (beo.extensions["beosonic"] && beo.extensions["beosonic"].tempDisable) beo.extensions["beosonic"].tempDisable(false);
						if (beo.extensions.equaliser && beo.extensions.equaliser.tempDisable) beo.extensions.equaliser.tempDisable(false, ['l','r']);
					}
					if (debug) console.log("Recording finished, analysing samples...");
					if (!errors) beo.sendToUI("room-compensation", {header: "measuringRoom", content: {phase: "processing"}});
				}
			});
			
			roomMeasurementProcess.stderr.on('data', function (data) {
				data = data.toString();
				console.error("Error in room measurement:", data);
				errors++;
			});
			
			roomMeasurementProcess.on('exit', function (code) {
				runRoomMeasurement = false;
				if (debug) console.log("Room measurement has finished.");
				if (!errors) {
					beo.sendToUI("room-compensation", {header: "measuringRoom", content: {phase: "finish"}});
					convertAndSaveMeasurement("/tmp/fftdB_vbw.csv", newMeasurementName, {samples: settings.sampleCount, recordingLevel: averageLevel}, true);
				}
			});
		}, 2000);
	}
	
	if (stage == "stop") {
		if (roomMeasurementProcess) roomMeasurementProcess.kill("SIGINT");
		runRoomMeasurement = false;
	}
}

var volumeBeforeMeasurements = null;
function setOrRestoreVolume(stage) {
	if (beo.extensions.sound &&
		beo.extensions.sound.getVolume &&
		beo.extensions.sound.setVolume) {
		if (stage == "set") { // Lower before starting measurements, saving previous level.
			beo.extensions.sound.getVolume(function(volume) {
				volumeBeforeMeasurements = volume;
				if (debug) console.log("Saved current volume level ("+volumeBeforeMeasurements+" %).");
				if (volumeBeforeMeasurements > 30) {
					beo.extensions.sound.setVolume(30);
				}
			});
		}
		if (stage == "restore" && volumeBeforeMeasurements != null) { // Restore volume to the saved level.
			setTimeout(function() {
				if (debug) console.log("Restoring volume to "+volumeBeforeMeasurements+" %.");
				beo.extensions.sound.setVolume(volumeBeforeMeasurements);
				volumeBeforeMeasurements = null;
			}, 2000);
		}
	} else {
		volumeBeforeMeasurements = null;
	}
}

function convertAndSaveMeasurement(path, newName, details = null, send) {
	if (fs.existsSync(path)) {
		filename = generateFilename(newName);
		csvLines = fs.readFileSync(path, "utf8").split("\n");
		measurement = {name: newName, magData: [], phaseData: [], offset: 0};
		for (var i = 0; i < csvLines.length; i++) {
			items = csvLines[i].split(",");
			if (items.length == 3) { 
				F = parseFloat(items[0]);
				measurement.magData.push([F, parseFloat(items[1])]);
				measurement.phaseData.push([F, parseFloat(items[2])]);
				if (F > 950 && F < 1050) measurement.offset = parseFloat(items[1]);
			}
		}
		if (typeof details == "object") {
			if (details.samples) measurement.samples = details.samples;
			if (details.recordingLevel) measurement.recordingLevel = details.recordingLevel;
		}
		measurements[filename] = measurement;
		compactMeasurementList[filename] = newName;
		fs.writeFileSync(arcDirectory+"/"+filename+".json", JSON.stringify(measurement));
		if (debug) console.log("Room measurement saved as '"+newName+"' ("+filename+".json).");
		beo.sendToUI("room-compensation", {header: "measurements", content: {measurements: compactMeasurementList}});
		if (send) {
			beo.sendToUI("room-compensation", {header: "singleMeasurement", content: {measurement: measurements[filename], measurementID: filename}});
		}
	} else {
		console.error("CSV file containing measurement data ("+path+") was not found.");
	}
}

function generateFilename(name) {
	n = name.toLowerCase().replace(/ /g, "-"); // Replace spaces with hyphens
	n = n.replace(/\./g, "-"); // Replace periods with hyphens
	n = n.replace(/-+$/g, ""); // Remove hyphens from the end of the name.
	return n;
}

function readMeasurements() {
	if (fs.existsSync(arcDirectory)) {
		measurementFiles = fs.readdirSync(arcDirectory);
		for (var i = 0; i < measurementFiles.length; i++) {
			if (measurementFiles[i].substr(-4) == "json") {
				try {
					measurement = JSON.parse(fs.readFileSync(arcDirectory+"/"+measurementFiles[i], "utf8"));
					measurementID = path.basename(arcDirectory+"/"+measurementFiles[i], path.extname(arcDirectory+"/"+measurementFiles[i]));
					if (measurement.magData &&
					 	measurement.phaseData && 
					 	measurement.name) {
						measurements[measurementID] = measurement;
						compactMeasurementList[measurementID] = measurement.name;
						if (debug >= 2) console.log("Loaded room compensation measurement '"+measurement.name+"'.");
					} else {
						console.error("Data or name for room compensation measurement '"+measurementID+"' is missing. Skipping.");
					}
				} catch (error) {
					console.error("Error reading room compensation measurement:", error);
				}
				
			}
		}
	}
}
	
module.exports = {
	version: version
}

