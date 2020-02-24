var sound = (function() {

var advancedSoundAdjustmentsEnabled = false;
var alwaysShowAdvancedAdjustments = false;
var systemVolume = null;
var adjustingSystemVolume = false;

$(document).on("ui", function(event, data) {
	if (data.header == "menusReady") {
		// Check which sound adjustments extensions have been placed into the menu, if any.
		basics = $("#sound .beo-dynamic-menu.basic").children().length;
		adjustments = $("#sound .beo-dynamic-menu.adjustments").children().length;
		advanced = $("#sound .beo-dynamic-menu.advanced").children().length;
		
		if (basics == 0) {
			$("#sound .basics-title, #sound .beo-dynamic-menu.basic").addClass("hidden");
		}
		if (adjustments == 0) {
			$("#sound .adjustments-title, #sound .beo-dynamic-menu.adjustments").addClass("hidden");
		}
		if (advanced == 0) {
			$("#sound .advanced-title, #sound .beo-dynamic-menu.advanced").addClass("hidden");
		}
		
		if (basics == 0 && adjustments == 0 && advanced != 0) {
			alwaysShowAdvancedAdjustments = true;
			$("#advanced-sound-adjustments-toggle, #advanced-sound-adjustments-separator").addClass("hidden");
		}
		
		if (basics == 0 && adjustments == 0 && advanced == 0) {
			$("#sound .no-sound-adjustments").removeClass("hidden");
			$("#sound .has-sound-adjustments").addClass("hidden");
		}
	}
});

advancedModeChecked = false;
$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			beo.send({target: "sound", header: "getVolume"});
		}
	}
	
	if (data.header == "activatedExtension") {
		if (extensions[data.content.extension].parentMenu == "sound" || data.content.extension == "sound") {
			if (!advancedModeChecked) beo.sendToProduct("sound", {header: "advancedSoundAdjustmentsEnabled"});
		}
	}
});

$(document).on("sound", function(event, data) {
	if (data.header == "advancedSoundAdjustmentsEnabled") {
		if (data.content.enabled != undefined) {
			showAdvancedSoundAdjustmentsEnabled(data.content.enabled);
		}
	}
	
	if (data.header == "systemVolume") {
		if (data.content.volume != undefined) {
			systemVolume = data.content.volume;
			updateSystemVolumeSliders();
		}
	}
});

function toggleAdvancedSoundAdjustments(enabled) {
	if (enabled == undefined) {
		if (advancedSoundAdjustmentsEnabled) {
			enabled = false;
		} else {
			enabled = true;
		}
	}
	
	beo.send({target: "sound", header: "advancedSoundAdjustmentsEnabled", content: {enabled: enabled}});
}

function showAdvancedSoundAdjustmentsEnabled(enabled) {
	
	if (!advancedModeChecked) {
		$("#sound .advanced-adjustment").addClass("no-animation");
		advancedModeChecked = true;
		setTimeout(function() {
			$("#sound .advanced-adjustment").removeClass("no-animation");
		}, 500);
	}
	if (enabled || alwaysShowAdvancedAdjustments) {
		advancedSoundAdjustmentsEnabled = true;
		$('section[data-top-level-menu-id="sound"]').addClass("advanced-sound-adjustments");
		$('#advanced-sound-adjustments-toggle').addClass("on");
	} else {
		advancedSoundAdjustmentsEnabled = false;
		$('section[data-top-level-menu-id="sound"]').removeClass("advanced-sound-adjustments");
		$('#advanced-sound-adjustments-toggle').removeClass("on");
	}
	
}

function updateSystemVolumeSliders() {
	if (adjustingSystemVolume == false) {
		$(".master-volume-slider").slider("value", systemVolume);
	}
}

function mute(fade = false) {
	beo.send({target: "sound", header: "mute", content: {fade: fade}});
}

function unmute(fade = false) {
	beo.send({target: "sound", header: "unmute", content: {fade: fade}});
}

var adjustingReleaseTimeout;
$(".master-volume-slider").slider({
	range: "min",
	min: 0,
	max: 100,
	value: 0,
	slide: function( event, ui ) {	
		beo.send({target: "sound", header: "setVolume", content: ui.value});
	},
	start: function(event, ui) {
		adjustingSystemVolume = true;
		clearTimeout(adjustingReleaseTimeout);
	},
	stop: function(event, ui) {
		adjustingReleaseTimeout = setTimeout(function() {
			adjustingSystemVolume = false;
			updateSystemVolumeSliders();
		}, 300);
		
	}
});

return {
	unmute: unmute,
	mute: mute,
	toggleAdvancedSoundAdjustments: toggleAdvancedSoundAdjustments
}

})();