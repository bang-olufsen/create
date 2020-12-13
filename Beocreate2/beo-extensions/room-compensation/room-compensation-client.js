var room_compensation = (function() {

var measurements = {};
var measurementGraph = null;

var presets = {};
var currentPreset = null;
var selectedPreset = null;
var compensationGraph = null;

var newMeasurementName = null;
var selectedMeasurement = null;

var measureStep = 0;

var Fs = null;
var capabilities = 0;

var recognisedCurves = {
	"room_only": {
		"name": "Bass only",
		"nameCaps": "Bass Only",
		"description": "Optimise only bass frequencies, which are most affected by the room"
	},
	"weighted_flat": {
		"name": "Weighted flat",
		"nameCaps": "Weighted Flat",
		"description": "Optimise all frequencies, emphasis on bass"
	},
	"falling_slope": {
		"name": "Reflective room",
		"nameCaps": "Reflective Room",
		"description": "Optimise all frequencies, emphasis on bass, reducing high frequencies"
	},
	"flat": {
		"name": "Flat",
		"nameCaps": "Flat",
		"description": "Optimise all frequencies equally"
	}
}

$(document).on("general", function(event, data) {
	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "room-compensation") {
			
		}
	}
});
	
$(document).on("room-compensation", function(event, data) {
	
	if (data.header == "measurementsAndPresets" ||
		data.header == "measurements" ||
		data.header == "presets") {
		
		
		if (data.content.capabilities != undefined) {
			capabilities = data.content.capabilities;
		}
		
		if (data.content.measurements) {
			measurements = data.content.measurements;
			$("#room-compensation-measurements").empty();
			if (Object.keys(measurements).length > 0) {
				$("#room-compensation-measurements-title").removeClass("hidden");
			} else {
				$("#room-compensation-measurements-title").addClass("hidden");
			}
				
			for (measurement in measurements) {
				menuOptions = {
					label: measurements[measurement],
					onclick: "room_compensation.showMeasurement('"+measurement+"');",
					classes: ["room-compensation-measurement-"+measurement],
					icon: extensions["room-compensation"].assetPath+"/symbols-black/microphone.svg"
				}
				$("#room-compensation-measurements").append(beo.createMenuItem(menuOptions));
			}
		}
		
		if (data.content.presets) {
			presets = data.content.presets;
			$("#room-compensation-presets").empty();
			if (Object.keys(presets).length > 0) {
				$("#room-compensation-off").removeClass("disabled");
				$("#room-compensation-presets").append("<hr>");
			} else {
				$("#room-compensation-off").addClass("disabled");
			}
				
			for (preset in presets) {
				menuOptions = {
					label: presets[preset].name,
					onclick: "room_compensation.showCompensation('"+preset+"');",
					classes: ["room-compensation-preset-item"],
					data: {"data-room-compensation-preset": preset},
					checkmark: "left",
					value: (recognisedCurves[presets[preset].type]) ? recognisedCurves[presets[preset].type].name : null,
					checked: (currentPreset == preset)
				}
				$("#room-compensation-presets").append(beo.createMenuItem(menuOptions));
			}
		}
	}
	
	if (data.header == "currentPreset") {
		$("#room-compensation-off, .room-compensation-preset-item").removeClass("checked");
		if (data.content.preset) {
			currentPreset = data.content.preset;
			$('.room-compensation-preset-item[data-room-compensation-preset="'+currentPreset+'"]').addClass("checked");
			if (data.content.applied) beo.notify({title: (presets[currentPreset].name+((recognisedCurves[presets[currentPreset].type]) ? " ("+recognisedCurves[presets[currentPreset].type].name.toLowerCase()+")" : "")), message: "Room compensation in use", icon: "common/symbols-black/checkmark-round.svg"}, "room-compensation");
		} else {
			$("#room-compensation-off").addClass("checked");
			currentPreset = null;
			if (data.content.applied) beo.notify({title: "Room compensation off", icon: "common/symbols-black/checkmark-round.svg"}, "room-compensation");
		}
	}
	
	if (data.header == "singleMeasurement") {
		beo.showPopupView("room-compensation-measurement-preview", null, function() {
			selectedMeasurement = null;
			beo.hidePopupView("room-compensation-measurement-preview");
		});
		selectedMeasurement = data.content.measurementID;
		if (!measurementGraph) {
			measurementGraph = new Beograph("room-measurement-graph", {colours: ["#000000"], coloursDark: ["#FFFFFF"], labels: {frequency: true, gain: true}});
		} else {
			//measurementGraph.setOptions({resolution: data.content.measurement.magData.length});
		}
		magData = [];
		for (var i = 0; i < data.content.measurement.magData.length; i++) {
			magData.push([data.content.measurement.magData[i][0], data.content.measurement.magData[i][1]+(-1*data.content.measurement.offset)]);
		}
		measurementGraph.store([0], {data: magData}, true);
		$(".room-measurement-information h1").text(data.content.measurement.name);
		$(".room-measurement-details").empty();
		if (data.content.measurement.samples) $(".room-measurement-details").append(beo.createMenuItem({label: "Averaged from", value: data.content.measurement.samples+" recordings", static: true}));
		if (data.content.measurement.recordingLevel) $(".room-measurement-details").append(beo.createMenuItem({label: "Recording level", value: Math.round(data.content.measurement.recordingLevel*10)/10+" dB", static: true}));
	}
	
	if (data.header == "measurementExists") {
		beo.ask("replace-room-measurement-prompt");
	}
	
	if (data.header == "detectingMicrophone") {
		beo.showPopupView("room-compensation-measurement-assistant", null, cancelMeasurement);
		beo.wizard("#room-measurement-wizard");
		$("#room-compensation-measurement-assistant-button").text("Microphone Positioned").addClass("disabled");
		measureStep = 0;
		ping(true);
	}
	
	if (data.header == "microphoneDetected") {
		beo.wizard("#room-measurement-wizard", "#room-measurement-position-microphone", "#room-compensation-measurement-assistant-button");
		$("#room-compensation-measurement-assistant-button").text("Microphone Positioned").removeClass("disabled");
		if (data.content && data.content.microphoneName) $(".connected-microphone").text(data.content.microphoneName);
		measureStep = 1;
	}
	
	if (data.header == "measuringLevel") {
		beo.wizard("#room-measurement-wizard", "#room-measurement-set-volume", "#room-compensation-measurement-assistant-button");
		$("#room-compensation-measurement-assistant-button").text("Start Room Measurement").removeClass("disabled");
		measureStep = 2;
	}
	
	if (data.header == "inputLevel" && data.content.level) {
		$("#room-measurement-current-level span").text(Math.round(data.content.level*10)/10);
		$("#room-measurement-current-level-fill").css("width", (data.content.level-50)*2 + "%");
	}
	
	if (data.header == "measuringRoom") {
		ping(false);
		measureStep = 3;
		notifyOptions = {title: "Measuring room...", timeout: false, icon: "attention"};
	
		switch (data.content.phase) {
			case "starting":
				notifyOptions.progress = 5;
				notifyOptions.message = "Don't move the microphone. Remain quiet for more accurate results.";
				break;
			case "recording":
				notifyOptions.progress = 10 + (data.content.sample / data.content.totalSamples)*70;
				notifyOptions.message = "Recording. Don't move the microphone. Remain quiet for more accurate results.";
				break;
			case "processing":
				notifyOptions.progress = 80;
				notifyOptions.message = "Recording has finished, processing results...";
				beo.hidePopupView("room-compensation-measurement-assistant");
				break;
			case "finish":
				$("#room-measurement-complete").removeClass("hidden");
				notifyOptions.title = "Measurement complete";
				notifyOptions.timeout = 3;
				notifyOptions.progress = 100;
				notifyOptions.icon = "common/symbols-black/checkmark-round.svg";
				break;
			case "error":
				notifyOptions.title = "Measurement error";
				notifyOptions.message = "Please try again. If the problem persists, contact HiFiBerry support.";
				notifyOptions.buttonAction = "close";
				notifyOptions.buttonTitle = "Dismiss";
				notifyOptions.icon = null;
				measureStep = 2;
				break;
		}
		beo.notify(notifyOptions, "room-compensation");
	}
	
	if (data.header == "compensationOptions") {
		$("#room-compensation-types").empty();
		if (data.content.curves) {
			for (c in recognisedCurves) {
				if (data.content.curves[c]) {
					menuOptions = {
						onclick: "room_compensation.newCompensation('"+data.content.fromMeasurement+"', '"+c+"');",
						label: recognisedCurves[c].nameCaps,
						description: recognisedCurves[c].description,
						value: (c == "room_only") ? "Default" : null
					};
					$("#room-compensation-types").append(beo.createMenuItem(menuOptions));
				}
			}
		}
		beo.ask("room-compensation-type-prompt");
		if (data.content.askForSpeakerModel) askForSpeakerModel = true;
	}
	
	if (data.header == "confirmApplyingCompensation") {
		beo.notify(null, "room-compensation");
		if (data.content.preset) {
			beo.ask("room-compensation-confirmation-prompt", null, [function() {
				beo.sendToProduct("room-compensation", {header: "applyCompensation", content: {preset: data.content.preset, confirm: true}});
			}]);
		}
	}
	
	if (data.header == "compensationData") {
		if (data.content.preset) {
			selectedPreset = data.content.preset;
			compensation = data.content.data;
			Fs = data.content.Fs;
			$(".room-compensation-information h1").text(compensation.name);
			$(".room-compensation-information p").text((recognisedCurves[compensation.type]) ? recognisedCurves[compensation.type].name : "");
			$(".room-compensation-details").empty();
			if (compensation.speakerModel) $(".room-compensation-details").append(beo.createMenuItem({label: "Speaker type", value: compensation.speakerModel, static: true}));
			if (compensation.compensationID) $(".room-compensation-details").append(beo.createMenuItem({label: "Compensation ID", value: compensation.compensationID, static: true}));
			if (!compensationGraph) {
				compensationGraph = new Beograph("room-compensation-graph", {resolution: 256, colours: ["#2CD5C4", "#FF3E46", "#000000"], coloursDark: ["#2CD5C4", "#FF3E46", "#FFFFFF"], labels: {frequency: true, gain: true}, scale: 20});
			}
			if (compensation.filters) {
				compensationGraph.store([0], {clearData: true});
				for (f in compensation.filters) {
					if (compensation.filters[f].frequency != undefined &&
					 	compensation.filters[f].Q != undefined && 
					 	compensation.filters[f].gain != undefined) {
						coeffs = beoDSP.peak(Fs, compensation.filters[f].frequency, compensation.filters[f].gain, compensation.filters[f].Q, 0);
						compensationGraph.store([[0, f]], {coefficients: coeffs, colour: 0, faded: true});
					}
				}
				
			}
			magData = [];
			resultData = [];
			for (var i = 0; i < data.content.measurementData.magData.length; i++) {
				magData.push([data.content.measurementData.magData[i][0], data.content.measurementData.magData[i][1]+(-1*data.content.measurementData.offset)]);
			}
			for (var i = 0; i < data.content.data.rawData.frequencies.length; i++) {
				resultData.push([data.content.data.rawData.frequencies[i], data.content.data.rawData.response_corrected[i]]);
			}
			compensationGraph.store([1], {data: magData, colour: 1, faded: true});
			compensationGraph.store([2], {data: resultData, colour: 2});
			beo.showPopupView("room-compensation-preview", null, function() {
				selectedPreset = null;
			});
			compensationGraph.draw();
		}
	}
	
	if (data.header == "creatingCompensation") {
		notifyOptions = {title: "Creating room compensation...", timeout: false, icon: "attention"};
	
		switch (data.content.phase) {
			case "waiting":
				notifyOptions.message = "Please wait.";
				beo.notify(notifyOptions, "room-compensation");
				break;
			case "finish":
				//beo.notify(null, "room-compensation");
				break;
			case "error":
				notifyOptions.title = "Room compensation error";
				if (data.content.reason == "serverError") {
					notifyOptions.message = "Failed to get data from room compensation server. Please try again. If the problem persists, contact HiFiBerry support.";
				} else {
					notifyOptions.message = "The selected measurement is missing data.";
				}
				notifyOptions.buttonAction = "close";
				notifyOptions.buttonTitle = "Dismiss";
				notifyOptions.icon = null;
				beo.notify(notifyOptions, "room-compensation");
				break;
		}
	}
});
	
function newMeasurement() {
	//beo.showPopupView("room-compensation-measurement-assistant");
	//beo.wizard("#room-measurement-wizard");
	beo.ask();
	beo.startTextInput(1, "New Measurement", "Enter a name for this measurement, such as the seat where it is performed.", {text: "", placeholders: {text: "Sofa centre, easy chair, ..."}, minLength: {text: 3}, autocorrect: true, autocapitalise: true}, function(input) {
		// Validate and store input.
		if (input && input.text) {
			newMeasurementName = input.text;
			beo.sendToProduct("room-compensation", {header: "newMeasurement", content: {name: newMeasurementName}});
		}
	});
	measureStep = 0;
}

function replaceExisting(confirmed) {
	beo.ask();
	if (confirmed) {
		beo.sendToProduct("room-compensation", {header: "newMeasurement", content: {name: newMeasurementName, override: true}});
	}
}

function nextStep() {
	if (measureStep == 1) { // Microphone positioned.
		beo.sendToProduct("room-compensation", {header: "measureLevel"});
	}
	if (measureStep == 2) { // Level set.
		beo.sendToProduct("room-compensation", {header: "measureRoom"});
	}
}

function cancelMeasurement() {
	beo.notify(false, "room-compensation");
	beo.hidePopupView("room-compensation-measurement-assistant");
	beo.sendToProduct("room-compensation", {header: "stopMeasurement"});
	ping(false);
}

var pingInterval;
function ping(start) { // Send ping to indicate that the UI is still active. In a case of fault, the product will cease interactive measurements automatically when ping is not received from the UI often enough.
	if (start) {
		beo.sendToProduct("room-compensation", {header: "ping", content: {stop: false}});
		pingInterval = setInterval(function() {
			if (selectedExtension == "room-compensation") {
				beo.sendToProduct("room-compensation", {header: "ping", content: {stop: false}});
			} else {
				clearInterval(pingInterval);
			}
		}, 2000);
	} else {
		beo.sendToProduct("room-compensation", {header: "ping", content: {stop: true}});
		clearInterval(pingInterval);
	}
}

function showMeasurement(measurementID) {
	if (measurementID) {
		$("#room-measurement-complete").addClass("hidden");
		beo.sendToProduct("room-compensation", {header: "getMeasurement", content: {measurementID: measurementID}});
	} else {
		beo.hidePopupView("room-compensation-measurement-preview");
		selectedMeasurement = null;
	}
}

function deleteMeasurement(confirmed) {
	if (selectedMeasurement) {
		if (!confirmed) {
			beo.ask("delete-room-measurement-prompt", [measurements[selectedMeasurement]]);
		} else {
			beo.send({target: "room-compensation", header: "deleteMeasurement", content: {measurementID: selectedMeasurement}});
			showMeasurement();
			beo.ask();
		}
	}
}

var askForSpeakerModel = false;

function newCompensation(measurement = selectedMeasurement, type = null) {
	if (type) {
		beo.ask();
		if (!askForSpeakerModel) {
			beo.sendToProduct("room-compensation", {header: "newCompensation", content: {compensationType: type, fromMeasurement: measurement, speakerModel: null}});
		} else {
			beo.startTextInput(1, "Speaker Model", "Enter the manufacturer and model of the speaker. This information can be used to further improve the room compensation feature.", {text: "", placeholders: {text: "Manufacturer and model"}, optional: {text: true}, autocorrect: true, autocapitalise: true}, function(input) {
				if (input && input.text) {
					beo.sendToProduct("room-compensation", {header: "newCompensation", content: {compensationType: type, fromMeasurement: measurement, speakerModel: input.text}});
				} else {
					beo.sendToProduct("room-compensation", {header: "newCompensation", content: {compensationType: type, fromMeasurement: measurement, speakerModel: null}});
				}
			});
		}
	} else {
		askForSpeakerModel = false;
		if (measurement) {
			switch (capabilities) {
				case 2:
					beo.sendToProduct("room-compensation", {header: "newCompensation", content: {fromMeasurement: measurement}});
					break;
				case 1:
					beo.ask("room-compensation-dsp-problem-prompt");
					break;
				case 0:
					beo.ask("room-compensation-dsp-required-prompt");
					break;
			}
			showMeasurement();
		} else {
			if (Object.keys(measurements).length > 0 && capabilities > 0) {
				$("#room-measurement-chooser").empty();
				for (measurement in measurements) {
				menuOptions = {
					label: measurements[measurement],
					onclick: "room_compensation.newCompensation('"+measurement+"');",
					classes: ["room-compensation-measurement-"+measurement],
					icon: extensions["room-compensation"].assetPath+"/symbols-black/microphone.svg"
				}
				$("#room-measurement-chooser").append(beo.createMenuItem(menuOptions));
			}
				beo.ask("select-measurements-prompt");
			} else {
				newMeasurement();
			}
		}
	}
}

function showCompensation(preset) {
	if (preset) {
		beo.sendToProduct("room-compensation", {header: "getCompensation", content: {preset: preset}});
	} else {
		beo.hidePopupView("room-compensation-preview");
		selectedPreset = null;
	}
}

function applyCompensation(disable = false) {
	if (disable && currentPreset != null) {
		beo.sendToProduct("room-compensation", {header: "disableCompensation"});
	} else if (selectedPreset) {
		switch (capabilities) {
			case 2:
				beo.sendToProduct("room-compensation", {header: "applyCompensation", content: {preset: selectedPreset, confirm: false}});
				break;
			case 1:
				beo.ask("room-compensation-dsp-problem-prompt");
				break;
			case 0:
				beo.ask("room-compensation-dsp-required-prompt");
				break;
		}
		showCompensation();
	}
}

function deleteCompensation(confirmed) {
	if (selectedPreset) {
		if (!confirmed) {
			if (selectedPreset == currentPreset) {
				beo.ask("delete-current-room-compensation-prompt", [presets[selectedPreset].name+((recognisedCurves[presets[selectedPreset].type]) ? " ("+recognisedCurves[presets[selectedPreset].type].name.toLowerCase()+")" : "")]);
			} else {
				beo.ask("delete-room-compensation-prompt", [presets[selectedPreset].name+((recognisedCurves[presets[selectedPreset].type]) ? " ("+recognisedCurves[presets[selectedPreset].type].name.toLowerCase()+")" : "")]);
			}
		} else {
			beo.send({target: "room-compensation", header: "deleteCompensation", content: {preset: selectedPreset}});
			showCompensation();
			beo.ask();
		}
	}
}

function goToDSPPrograms() {
	beo.ask();
	beo.showExtension("dsp-programs");
}

	
return {
	newMeasurement: newMeasurement,
	replaceExisting: replaceExisting,
	nextStep: nextStep,
	cancelMeasurement: cancelMeasurement,
	showMeasurement: showMeasurement,
	deleteMeasurement: deleteMeasurement,
	newCompensation: newCompensation,
	showCompensation: showCompensation,
	applyCompensation: applyCompensation,
	deleteCompensation: deleteCompensation,
	goToDSPPrograms: goToDSPPrograms,
	setCapabilities: function(level) {capabilities = level;}
}
	
})();