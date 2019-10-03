var toslink = (function() {


var toslinkEnabled = true;
var toslinkStopsOtherSources = true;
var canReadToslinkStatus = false;
var toslinkStatus = false;

$(document).on("toslink", function(event, data) {
	if (data.header == "toslinkSettings") {
		if (data.content.settings != undefined) {
			toslinkEnabled = data.content.settings.toslinkEnabled;
			toslinkStopsOtherSources = data.content.settings.toslinkStopsOtherSources;
			showToslinkEnabled();
			showToslinkStopsOtherSources();
		}
		if (data.content.canControlToslink != undefined) {
			showCanControlToslink(data.content.canControlToslink);
		}
		if (data.content.canReadToslinkStatus != undefined) {
			canReadToslinkStatus = data.content.canReadToslinkStatus;
			showCanReadToslinkStatus();
		}
		
		if (data.content.toslinkStatus != undefined) {
			toslinkStatus = data.content.toslinkStatus;
			showToslinkStatus();
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
	send({target: "toslink", header: "toslinkEnabled", content: {enabled: enabled}});
}

function toggleStopsOtherSources(stopsOthers) {
	if (stopsOthers == undefined) {
		if (toslinkStopsOtherSources) {
			stopsOthers = false;
		} else {
			stopsOthers = true;
		}
	}
	send({target: "toslink", header: "toslinkStopsOtherSources", content: {stopsOtherSources: stopsOthers}});
}

function showCanControlToslink(canControl) {
	if (canControl) {
		$("#toslink-enabled-toggle").removeClass("disabled");
	} else {
		$("#toslink-enabled-toggle").addClass("disabled");
	}
}

function showToslinkEnabled() {
	if (toslinkEnabled) {
		$("#toslink-enabled-toggle").addClass("on");
	} else {
		$("#toslink-enabled-toggle").removeClass("on");
	}
	showToslinkStatus();
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
		$(".toslink-status").removeClass("fill").text(translatedString("Unknown", "unknown", "toslink"));
	} else {
		if (toslinkStatus) {
			if (toslinkEnabled) {
				$(".toslink-status").addClass("fill").text(translatedString("Active", "active", "toslink"));
			} else {
				$(".toslink-status").removeClass("fill").text(translatedString("Disabled, has signal", "disabledHasSignal", "toslink"));
			}
		} else {
			
			if (toslinkEnabled) {
				$(".toslink-status").removeClass("fill").text(translatedString("Inactive", "inactive", "toslink"));
			} else {
				$(".toslink-status").removeClass("fill").text(translatedString("Disabled", "disabled", "toslink"));
			}
		}
	}
}

return {
	toggleEnabled: toggleEnabled,
	toggleStopsOtherSources: toggleStopsOtherSources
}

})();