alsa_ttable = (function() {
	
settings = {
	role: "stereo",
	limit_db: 0,
	min_slider: 0
}

$(document).on("alsa-ttable", function(event, data) {
	

	if (data.header == "ttableSettings") {
		
		if (data.content.settings) {
			settings = data.content.settings;
			
			if (settings.limit_db) {
				$(".alsa-volume-limit-slider span").attr("data-content", alsaVolumedBToSliderText(settings.limit_db))
				$(".alsa-volume-limit-slider").slider("value", settings.limit_db);
			}
			
			if (settings.min_slider) {
				console.log(settings.min_slider)
				$(".alsa-volume-min-slider span").attr("data-content", alsaVolumePercentToSliderText(settings.min_slider))
				$(".alsa-volume-min-slider").slider("value", settings.min_slider);
			}
			
			if (settings.role == "mono") {
				document.getElementById("ttable-alsa-mono").classList.add("selected");
				document.getElementById("ttable-alsa-stereo").classList.remove("selected");
			} else if (settings.role == "stereo") {
				document.getElementById("ttable-alsa-stereo").classList.add("selected");
				document.getElementById("ttable-alsa-mono").classList.remove("selected");
			}
		}	
	}
});


$(".alsa-volume-limit-slider").slider({
	range: "min",
	min: -30,
	max: 0,
	value: 0,
	slide: function( event, ui ) {
		settings.limit_db = ui.value
		$(".alsa-volume-limit-slider span").attr("data-content", alsaVolumedBToSliderText(ui.value));
			
	}
});

$(".alsa-volume-min-slider").slider({
	range: "min",
	min: 0,
	max: 70,
	value: 0,
	slide: function( event, ui ) {
		settings.min_slider = ui.value
		console.log("min slider1: "+ui.value);
		$(".alsa-volume-min-slider span").attr("data-content", alsaVolumePercentToSliderText(ui.value));
		console.log("min slider2: "+ui.value);
		update_volrange(ui.value);
			
	}
});

function alsaVolumedBToSliderText(value) {
	sliderText = value+" dB";
	return sliderText;
}

function alsaVolumePercentToSliderText(value) {
	sliderText = value+"%";
	return sliderText;
}

function selectRole(role) {
	console.log("Selecting role "+role)
	if (role == "mono") {
		document.getElementById("ttable-alsa-mono").classList.add("selected");
		document.getElementById("ttable-alsa-stereo").classList.remove("selected");
	} else {
		document.getElementById("ttable-alsa-stereo").classList.add("selected");
		document.getElementById("ttable-alsa-mono").classList.remove("selected");
	}
	settings.role=role
}

function save() {
	console.log("settings: "+settings.role+"/"+settings.limit_db);
	beo.send({target: "alsa-ttable", header: "saveSettings", content: {settings}});
}

function update_volrange(min) {
	console.log("updating volrange");
	settings.min_slider = min;
	beo.send({target: "alsa-ttable", header: "setVolRange", content: {settings}});
}

return {
	selectRole: selectRole,
	save: save
}

})();