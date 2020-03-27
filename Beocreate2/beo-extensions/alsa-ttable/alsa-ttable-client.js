alsa_ttable = (function() {
	
settings = {
	role: "stereo",
	limit_db: 0
}

$(document).on("alsa-ttable", function(event, data) {
	

	if (data.header == "ttableSettings") {
		
		if (data.content.settings) {
			settings = data.content.settings;
			
			if (settings.limit_db) {
				$(".alsa-volume-limit-slider span").attr("data-content", alsaVolumeLimitPercentageToSliderText(settings.limit_db))
				$(".alsa-volume-limit-slider").slider("value", settings.limit_db);
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
		$(".alsa-volume-limit-slider span").attr("data-content", alsaVolumeLimitPercentageToSliderText(ui.value));
			
	}
});


function alsaVolumeLimitPercentageToSliderText(value) {
	sliderText = value+" dB";
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
	console.log("ttable save")
	console.log("settings: "+settings.role+"/"+settings.limit_db);
	beo.send({target: "alsa-ttable", header: "saveSettings", content: {settings}});
}

return {
	selectRole: selectRole,
	save: save
}

})();