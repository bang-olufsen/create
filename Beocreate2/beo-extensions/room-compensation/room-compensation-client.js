var room_compensation = (function() {

var measurements = {};
var measurementGraph = null;

var newMeasurementName = null;
var selectedMeasurement = null;

$(document).on("general", function(event, data) {
	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "room-compensation") {
			
		}
	}
});
	
$(document).on("room-compensation", function(event, data) {
	
	if (data.header == "measurements") {
		measurements = data.content.measurements;
		$("#room-compensation-measurements").empty();
			
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
	
	if (data.header == "singleMeasurement") {
		beo.showPopupView("room-compensation-measurement-preview");
		selectedMeasurement = data.content.measurementID;
		if (!measurementGraph) {
			measurementGraph = new Beograph("room-measurement-graph", {resolution: 64, colours: ["#000000"], darkColours: ["#FFFFFF"], labels: {frequency: true, gain: true}});
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
		measureStep = 1;
	}
	
	if (data.header == "measuringLevel") {
		beo.wizard("#room-measurement-wizard", "#room-measurement-set-volume", "#room-compensation-measurement-assistant-button");
		$("#room-compensation-measurement-assistant-button").text("Start Room Measurement").removeClass("disabled");
		measureStep = 2;
	}
	
	if (data.header == "inputLevel" && data.content.level) {
		$("#room-measurement-current-level span").text(Math.round(data.content.level*10)/10);
		$("#room-measurement-current-level-fill").css("width", ((data.content.level+50) * 100 / 50) + "%");
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
	
});
	
function newMeasurement() {
	//beo.showPopupView("room-compensation-measurement-assistant");
	//beo.wizard("#room-measurement-wizard");
	beo.startTextInput(1, "New Measurement", "Enter a name for this measurement, such as the seat where it is performed.", {text: "", placeholders: {text: "Sofa centre, easy chair, ..."}, minLength: {text: 3}}, function(input) {
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
	
return {
	newMeasurement: newMeasurement,
	replaceExisting: replaceExisting,
	nextStep: nextStep,
	cancelMeasurement: cancelMeasurement,
	showMeasurement: showMeasurement,
	deleteMeasurement: deleteMeasurement
}
	
})();