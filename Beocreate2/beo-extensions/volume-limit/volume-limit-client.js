volume_limit = (function() {

canControlVolumeLimit = {};
volumeLimitdBRange = 60;


$(document).on("volume-limit", function(event, data) {
	if (data.header == "canControlVolumeLimit") {
		
		canControlVolumeLimit = data.content.canControlVolumeLimit;
		if (data.content.range) volumeLimitdBRange = data.content.range;
		
		hideUnsupportedMessage = false;
		
		if (canControlVolumeLimit.volumeLimitPi) {
			hideUnsupportedMessage = true;
			$("#volume-limit-pi-wrap").removeClass("hidden");
		} else {
			$("#volume-limit-pi-wrap").addClass("hidden");
		}
		
		if (canControlVolumeLimit.volumeLimitSPDIF) {
			hideUnsupportedMessage = true;
			$("#volume-limit-spdif-wrap").removeClass("hidden");
		} else {
			$("#volume-limit-spdif-wrap").addClass("hidden");
		}
		
		if (canControlVolumeLimit.volumeLimitI2S2) {
			hideUnsupportedMessage = true;
			$("#volume-limit-i2s2-wrap").removeClass("hidden");
		} else {
			$("#volume-limit-i2s2-wrap").addClass("hidden");
		}
		
		if (hideUnsupportedMessage) {
			$("#volume-limit-unsupported").addClass("hidden");
		} else {
			$("#volume-limit-unsupported").removeClass("hidden");
		}
	}
	
	if (data.header == "volumeLimitSettings") {
		
		if (data.content.settings) {
			settings = data.content.settings;
			
			if (settings.volumeLimitPi) {
				$(".volume-limit-slider.pi span").attr("data-content", volumeLimitPercentageToSliderText(settings.volumeLimitPi));
				$(".volume-limit-slider.pi").slider("value", settings.volumeLimitPi);
			}
			
			if (settings.volumeLimitSPDIF) {
				$(".volume-limit-slider.spdif span").attr("data-content", volumeLimitPercentageToSliderText(settings.volumeLimitSPDIF));
				$(".volume-limit-slider.spdif").slider("value", settings.volumeLimitSPDIF);
			}
			
			if (settings.volumeLimitI2S2) {
				$(".volume-limit-slider.i2s2 span").attr("data-content", volumeLimitPercentageToSliderText(settings.volumeLimitI2S2));
				$(".volume-limit-slider.i2s2").slider("value", settings.volumeLimitI2S2);
			}
		}
		
	}
	
	
});


$(".volume-limit-slider").slider({
	range: "min",
	min: 0,
	max: 100,
	value: 100,
	slide: function( event, ui ) {
			
			if ($(event.target).hasClass("pi")) {
				targetSlider = "pi";
				adjustment = "volumeLimitPi";
			}
			if ($(event.target).hasClass("spdif")) {
				targetSlider = "spdif";
				adjustment = "volumeLimitSPDIF";
			}
			if ($(event.target).hasClass("i2s2")) {
				targetSlider = "i2s2";
				adjustment = "volumeLimitI2S2";
			}
			
			beo.send({target: "volume-limit", header: "setVolumeLimit", content: {adjustment: adjustment, limit: ui.value}});
			
			$(".volume-limit-slider."+targetSlider+" span").attr("data-content", volumeLimitPercentageToSliderText(ui.value));
			
		}
});


function volumeLimitPercentageToSliderText(value) {
	if (value == 100) {
		sliderText = "0 dB";
	} else if (value > 0) {
		dB = (100 - value)/100 * volumeLimitdBRange;
		sliderText = "-" + (Math.round(dB*10)/10) + " dB";
	} else {
		sliderText = "Muted";
	}
	return sliderText;
}

})();