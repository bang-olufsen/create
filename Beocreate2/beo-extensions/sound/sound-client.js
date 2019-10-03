var sound = (function() {

var advancedSoundAdjustmentsEnabled = false;
var systemVolume = null;
var adjustingSystemVolume = false;

$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			send({target: "sound", header: "getVolume"});
		}
	}
});

$(document).on("sound", function(event, data) {
	if (data.header == "advancedSoundAdjustmentsEnabled") {
		if (data.content.enabled != undefined) {
			showAdvancedSoundAdjustmentsEnabled(data.content.enabled);
		}
	}
	
	/*if (data.header == "systemVolume") {
		if (data.content.volume != undefined) {
			systemVolume = data.content.volume;
			updateSystemVolumeSliders();
		}
	}*/
});

function toggleAdvancedSoundAdjustments(enabled) {
	if (enabled == undefined) {
		if (advancedSoundAdjustmentsEnabled) {
			enabled = false;
		} else {
			enabled = true;
		}
	}
	
	send({target: "sound", header: "advancedSoundAdjustmentsEnabled", content: {enabled: enabled}});
}

function showAdvancedSoundAdjustmentsEnabled(enabled) {
	
	if (enabled) {
		advancedSoundAdjustmentsEnabled = true;
		$('section[data-top-level-menu-id="sound"]').addClass("advanced-sound-adjustments");
		$('#advanced-sound-adjustments-toggle').addClass("on");
	} else {
		advancedSoundAdjustmentsEnabled = false;
		$('section[data-top-level-menu-id="sound"]').removeClass("advanced-sound-adjustments");
		$('#advanced-sound-adjustments-toggle').removeClass("on");
	}
	
}

/*function updateSystemVolumeSliders() {
	if (adjustingSystemVolume == false) {
		$(".master-volume-slider").slider("value", systemVolume.percentage);
	}
}

function mute(fade = false) {
	send({target: "sound", header: "mute", content: {fade: fade}});
}

function unmute(fade = false) {
	send({target: "sound", header: "unmute", content: {fade: fade}});
}


$(".master-volume-slider").slider({
	range: "min",
	min: 0,
	max: 100,
	value: 0,
	slide: function( event, ui ) {	
		send({target: "sound", header: "setVolume", content: {percentage: ui.value}});
	},
	start: function(event, ui) {
		adjustingSystemVolume = true;
	},
	stop: function(event, ui) {
		adjustingSystemVolume = false;
		updateSystemVolumeSliders();
	}
});*/

return {
	//unmute: unmute,
	//mute: mute,
	toggleAdvancedSoundAdjustments: toggleAdvancedSoundAdjustments
}

})();