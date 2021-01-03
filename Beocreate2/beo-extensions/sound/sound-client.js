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
		$('body').addClass("advanced-sound-adjustments");
		$('#advanced-sound-adjustments-toggle').addClass("on");
	} else {
		advancedSoundAdjustmentsEnabled = false;
		$('body').removeClass("advanced-sound-adjustments");
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
		beo.sendToProduct("sound", "setVolume", ui.value);
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


$(".interact-volume-slider").slider({
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
		interactSetup("setVolume", "set", ui.value);
	}
});


// INTERACT

volumeToSet = null;
volumeOption = null;
function interactSetup(type, stage, data = null) {
	switch (stage) {
		case "setup":
			if (data) {
				volumeOption = (data.option) ? data.option : null;
				volumeToSet = (data.volume) ? data.volume : systemVolume;
			} else {
				volumeOption = null;
				volumeToSet = systemVolume;
			}
			if (type == "setVolume") {
				$(".interact-volume-slider").slider("value", volumeToSet);
				interactSetup("setVolume", "option", volumeOption);
				$("#sound-set-volume-save").addClass("disabled");
				beo.ask("set-volume-setup");
			} else {
				interactSetup("volumeChanged", "option", volumeOption);
				$("#sound-volume-changed-save").addClass("disabled");
				beo.ask("volume-changed-setup");
			}
			break;
		case "option":
			if (type == "setVolume") {
				$("#interact-set-volume-options .menu-item").removeClass("checked");
				volumeOption = data;
				if (data) {
					$('#interact-set-volume-options .menu-item[data-option="'+data+'"]').addClass("checked");
					if (data == "slider") {
						$("#interact-volume-slider-wrap").removeClass("disabled");
					} else {
						$("#interact-volume-slider-wrap").addClass("disabled");
					}
					$("#sound-set-volume-save").removeClass("disabled");
				} else {
					$("#interact-volume-slider-wrap").addClass("disabled");
					$("#sound-set-volume-save").addClass("disabled");
				}
			} else {
				$("#interact-volume-changed-options .menu-item").removeClass("checked");
				volumeOption = data;
				if (data) {
					$('#interact-volume-changed-options .menu-item[data-option="'+data+'"]').addClass("checked");
					$("#sound-volume-changed-save").removeClass("disabled");
				} else {
					$("#sound-volume-changed-save").addClass("disabled");
				}
			}
			break;
		case "set":
			if (type == "setVolume") {
				volumeToSet = data;
				$("#sound-set-volume-save").removeClass("disabled");
			}
			break;
		case "save":
			beo.ask();
			if (type == "setVolume") {
				window.interact.saveAction("sound", "setVolume", {option: volumeOption, volume: volumeToSet});
			} else {
				window.interact.saveTrigger("sound", "volumeChanged", {option: volumeOption});
			}
			break;
		case "preview":
			if (type == "setVolume") {
				if (data.option == "up") return "Step volume up";
				if (data.option == "down") return "Step volume down";
				if (data.option == "result") return "Set to result value from trigger";
				if (data.option == "slider") return "Set to "+data.volume+" %";
			} else {
				if (data.option == "up") return "Volume increases";
				if (data.option == "down") return "Volume decreases";
				if (data.option == "any") return "Any change";
			}
			break;
	}
}

interactDictionary = {
	triggers: {
		volumeChanged: {
			name: "Volume Changed", 
			icon: "common/symbols-black/volume.svg", 
			setup: function(data) { interactSetup("volumeChanged", "setup", data) }, 
			preview: function(data) { return interactSetup("volumeChanged", "preview", data) },
			illegalWith: ["actions/sound/setVolume", "actions/sound/mute"]
		}
	},
	actions: {
		setVolume: {
			name: "Set Volume", 
			icon: "common/symbols-black/volume.svg", 
			setup: function(data) { interactSetup("setVolume", "setup", data) }, 
			preview: function(data) { return interactSetup("setVolume", "preview", data) },
			illegalWith: ["triggers/sound/volumeChanged"]
		},
		mute: {
			name: "Mute or Unmute", 
			icon: "common/symbols-black/volume-mute.svg", 
			illegalWith: ["triggers/sound/volumeChanged"]
		}
	}
}

return {
	unmute: unmute,
	mute: mute,
	toggleAdvancedSoundAdjustments: toggleAdvancedSoundAdjustments,
	interactDictionary: interactDictionary,
	interactSetup: interactSetup
}

})();