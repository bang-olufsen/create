var toslink = (function() {


var toslinkEnabled = true;
var toslinkSensitivity = "high";
var toslinkStopsOtherSources = true;
var canReadToslinkStatus = false;
var toslinkStatus = false;
var soundSyncLG = false;

$(document).on("toslink", function(event, data) {
	if (data.header == "toslinkSettings") {
		if (data.content.settings != undefined) {
			toslinkEnabled = data.content.settings.toslinkEnabled;
			if (toslinkEnabled) {
				$("#toslink-enabled-toggle").addClass("on");
			} else {
				$("#toslink-enabled-toggle").removeClass("on");
			}
			showToslinkStatus();
			
			toslinkStopsOtherSources = data.content.settings.toslinkStopsOtherSources;
			showToslinkStopsOtherSources();
			
			toslinkSensitivity = data.content.settings.sensitivity;
			$("#toslink-sensitivity-control div").removeClass("selected");
			$("#toslink-sensitivity-control div."+toslinkSensitivity).addClass("selected");
		}
		
		if (data.content.canControlToslink != undefined) {
			if (data.content.canControlToslink.enabled) {
				$("#toslink-enabled-toggle").removeClass("disabled");
			} else {
				$("#toslink-enabled-toggle").addClass("disabled");
			}
			if (data.content.canControlToslink.sensitivity) {
				$("#toslink-sensitivity-control").removeClass("disabled");
			} else {
				$("#toslink-sensitivity-control").addClass("disabled");
			}
		}
		
		if (data.content.canReadToslinkStatus != undefined) {
			canReadToslinkStatus = data.content.canReadToslinkStatus;
			showCanReadToslinkStatus();
		}
		
		if (data.content.toslinkStatus != undefined) {
			toslinkStatus = data.content.toslinkStatus;
			showToslinkStatus();
		}
		
		if (data.content.soundSyncLG != undefined) {
			soundSyncLG = data.content.soundSyncLG;
			if (soundSyncLG) {
				$("#toslink-soundsync-toggle").addClass("on");
			} else {
				$("#toslink-soundsync-toggle").removeClass("on");
			}
		}
	}
	
	if (data.header == "toslinkStatus") {
		if (data.content.status != undefined) {
			toslinkStatus = data.content.status;
			showToslinkStatus();
		}
	}
});

function toggleEnabled(enabled) {
	if (enabled == undefined) {
		if (toslinkEnabled) {
			enabled = false;
		} else {
			enabled = true;
		}
	}
	beo.send({target: "toslink", header: "toslinkEnabled", content: {enabled: enabled}});
}

function setTXEnabled(enabled = true) {
	beo.send({target: "toslink", header: "toslinkTXEnabled", content: {enabled: enabled}});
}

function setSensitivity(sensitivity) {
	switch (sensitivity) {
		case "high":
		case "medium":
		case "low":
			beo.send({target: "toslink", header: "setSensitivity", content: {sensitivity: sensitivity}});
			break;
	}
}

function toggleSoundSync(enabled) {
	if (enabled == undefined) {
		enabled = (soundSyncLG) ? false : true;
	}
	beo.sendToProduct("toslink", {header: "soundSyncEnabled", content: {enabled: enabled}});
}

function toggleStopsOtherSources(stopsOthers) {
	if (stopsOthers == undefined) {
		if (toslinkStopsOtherSources) {
			stopsOthers = false;
		} else {
			stopsOthers = true;
		}
	}
	beo.send({target: "toslink", header: "toslinkStopsOtherSources", content: {stopsOtherSources: stopsOthers}});
}


function showToslinkStopsOtherSources() {
	if (toslinkStopsOtherSources && canReadToslinkStatus) {
		$("#toslink-stops-other-sources-toggle").addClass("on");
	} else {
		$("#toslink-stops-other-sources-toggle").removeClass("on");
	}
}	

function showCanReadToslinkStatus() {
	if (canReadToslinkStatus) {
		$("#toslink-error-prompt").addClass("hidden");
		$("#toslink-stops-other-sources-toggle").removeClass("disabled");
		showToslinkStopsOtherSources();
	} else {
		$("#toslink-stops-other-sources-toggle").removeClass("on").addClass("disabled");
		$("#toslink-error-prompt").removeClass("hidden");
	}
}

function showToslinkStatus() {
	if (!canReadToslinkStatus) {
		$(".toslink-status").removeClass("fill").text(beo.localisedString("Unknown", "unknown", "toslink"));
	} else {
		if (toslinkStatus) {
			if (toslinkEnabled) {
				$(".toslink-status").addClass("fill").text(beo.localisedString("Playing", "active", "toslink"));
			} else {
				$(".toslink-status").removeClass("fill").text(beo.localisedString("Off, has signal", "disabledHasSignal", "toslink"));
			}
		} else {
			
			if (toslinkEnabled) {
				$(".toslink-status").removeClass("fill").text(beo.localisedString("Not active", "inactive", "toslink"));
			} else {
				$(".toslink-status").removeClass("fill").text(beo.localisedString("Off", "disabled", "toslink"));
			}
		}
	}
}

return {
	toggleEnabled: toggleEnabled,
	toggleStopsOtherSources: toggleStopsOtherSources,
	setSensitivity: setSensitivity,
	toggleSoundSync: toggleSoundSync,
	setTXEnabled: setTXEnabled
}

})();