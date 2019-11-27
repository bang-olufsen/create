var channels = (function() {

$(document).on("channels", function(event, data) {
	if (data.header == "channelSettings") {
		
		if (data.content.settings != undefined) {
			showChannelSettings(data.content.settings);
		}
		
		if (data.content.canControlChannels != undefined) {
			showCanControlChannels(data.content.canControlChannels);
		}
		
		if (data.content.canDoSimpleStereoSetup != undefined) {
			showCanDoSimpleStereoSetup(data.content.canDoSimpleStereoSetup);
		} else {
			showCanDoSimpleStereoSetup(false);
		}
		
		if (data.content.simpleChannelSelection != undefined) {
			showSimpleChannelSelection(data.content.simpleChannelSelection);
		} else {
			showSimpleChannelSelection(null);
		}
	}
});


$(".master-balance-slider").slider({
	range: "min",
	min: -20,
	max: 20,
	value: 0,
	slide: function( event, ui ) {
		$(".master-balance-slider span").attr("data-content", balanceValueToText(ui.value));
		beo.send({target: "channels", header: "setBalance", content: {balance: ui.value}});
	}
});
$(".master-balance-slider .ui-slider-range").append("<div></div>");
$(".master-balance-slider span").attr("data-content", "Centre");

function balanceValueToText(value) {
	if (value < 0) {
		text = "Left "+(value)*-1;
	} else if (value > 0) {
		text = "Right "+value;
	} else {
		text = "Centre";
	}
	return text;
}

function selectChannelSimple(channel) {
	beo.send({target: "channels", header: "selectChannelSimple", content: {channel: channel}});
}


function showChannelSettings(settings) {
	
	if (settings.balance != undefined) {
		$(".master-balance-slider span").attr("data-content", balanceValueToText(settings.balance));
		$(".master-balance-slider").slider("value", settings.balance);
	}
}

function showCanControlChannels(canControl) {
	
	$("#simple-channel-select-control, #simple-stereo-control").removeClass("disabled");
	$("#simple-balance-control").removeClass("hidden");
	for (var c = 0; c < 4; c++) {
		channel = "abcd".charAt(c);
		
		if (canControl[channel].role == false) {
			$("#simple-channel-select-control, #simple-stereo-control").addClass("disabled");
		}
		
		if (canControl[channel].level == false) {
			$("#simple-balance-control").addClass("hidden");
		}
		
		if (canControl[channel].enabled == false) {
			
		}
	}
	if (product_information && product_information.cardType) {
		console.log(product_information.cardType());
		if (product_information.cardType() == "DAC+ DSP") {
				$("#simple-channel-select, #simple-stereo-control").addClass("hidden");
		}
	}
}

function showCanDoSimpleStereoSetup(canDo) {

	if (canDo) {
		$("#simple-stereo-control").removeClass("hidden");
	} else {
		$("#simple-stereo-control").addClass("hidden");
	}
}

function showSimpleChannelSelection(channelSelection) {
	$("#simple-channel-select-control > div").removeClass("selected");
	switch (channelSelection) {
		case "left":
		case "right":
		case "mono":
			$("#simple-channel-select-control > ."+channelSelection).addClass("selected");
			$("#simple-stereo-control .button").text("Stereo").removeClass("selected");
			break;
		case "stereo":
			$("#simple-stereo-control .button").html('L&nbsp;<div class="symbol" style="-webkit-mask-image: url('+$("#channels").attr("data-asset-path")+'/symbols-black/switch-arrows.svg); mask-image: url('+$("#channels").attr("data-asset-path")+'/symbols-black/switch-arrows.svg);"></div>&nbsp;R').addClass("selected");
			break;
		case "stereo-rev":
			$("#simple-stereo-control .button").html('R&nbsp;<div class="symbol" style="-webkit-mask-image: url('+$("#channels").attr("data-asset-path")+'/symbols-black/switch-arrows.svg); mask-image: url('+$("#channels").attr("data-asset-path")+'/symbols-black/switch-arrows.svg);"></div>&nbsp;L').addClass("selected");
			break;
		default:
			$("#simple-stereo-control .button").text("Stereo").removeClass("selected");
			break;
	}
}

function setLevelProto(channels, level) {
	beo.send({target: "channels", header: "setLevelProto", content: {channel: channels, level: level}});
}

function setInvertProto(channels, invert) {
	beo.send({target: "channels", header: "setInvertProto", content: {channel: channels, invert: invert}});
}




function generateSettingsPreview(settings) {
	// Possible settings: role, delay, level, enabled.
	compatibilityNote = "";
	
	level = [];
	delay = [];
	muted = [];
	role = [];
	
	levelIssues = [];
	delayIssues = [];
	roleIssues = [];
	
	for (channel in settings.validatedSettings) {
		if (settings.compatibilityIssues[channel] != undefined) {
			if (settings.compatibilityIssues[channel].role == 0) {
				role.push(channel.toUpperCase());
			} else if (settings.compatibilityIssues[channel].role == 1) {
				roleIssues.push(channel.toUpperCase());
			}
			if (settings.compatibilityIssues[channel].delay == 0) {
				delay.push(channel.toUpperCase());
			}
			if (settings.compatibilityIssues[channel].level == 0) {
				level.push(channel.toUpperCase());
			} else if (settings.compatibilityIssues[channel].level == 1) {
				levelIssues.push(channel.toUpperCase());
			}
			if (settings.compatibilityIssues[channel].enabled == 0) {
				if (settings.validatedSettings[channel].enabled == false) {
					muted.push(channel.toUpperCase());
				}
			}
		}
	}
	
	if (roleIssues.length == 4) {
		compatibilityNote += beo.translatedString("Setting speaker role is not supported. ", "roleNotSupportedAll", "channels");
	} else if (roleIssues.length > 1) {
		compatibilityNote += beo.translatedStringWithFormat("Channels %@ do not support setting speaker role. ", beo.commaAndList(roleIssues, "and", "and", "channels"), "roleNotSupportedPlural", "channels");
	} else if (roleIssues.length == 1) {
		compatibilityNote += beo.translatedStringWithFormat("Channel %@ does not support setting speaker role. ", roleIssues[0], "roleNotSupportedSingular", "channels");
	}
	
	if (levelIssues.length == 4) {
		compatibilityNote += beo.translatedString("Adjusting channel level is not supported. ", "levelNotSupportedAll", "channels");
	} else if (levelIssues.length > 1) {
		compatibilityNote += beo.translatedStringWithFormat("Channels %@ do not support adjusting level. ", beo.commaAndList(roleIssues, "and", "and", "channels"), "levelNotSupportedPlural", "channels");
	} else if (levelIssues.length == 1) {
		compatibilityNote += beo.translatedStringWithFormat("Channel %@ does not support adjusting level. ", roleIssues[0], "levelNotSupportedSingular", "channels");
	}
	
	previewString = "";
	
	// Check for what's common with all channels:
	forAllChannels = [];
	if (level.length == 4) forAllChannels.push(beo.translatedString("levels", "levels", "channels"));
	if (delay.length == 4) forAllChannels.push(beo.translatedString("delays", "delays", "channels"));
	if (role.length == 4) forAllChannels.push(beo.translatedString("roles", "roles", "channels"));
	
	if (forAllChannels.length == 1) {
		previewString += beo.capitaliseFirst(forAllChannels[0]) + " " + beo.translatedString("for all channels", "forAllChannels", "channels") + ". "
	} else if (forAllChannels.length > 1) {
		previewString += beo.capitaliseFirst(beo.commaAndList(forAllChannels, "and", "and", "channels")) + " " + beo.translatedString("for all channels", "forAllChannels", "channels") + ". ";
	}
	
	if (muted.length == 4) {
		previewString += beo.translatedString("All channels are muted.", "allChannelsMuted", "channels");
	} else if (muted.length > 1) {
		previewString += beo.translatedStringWithFormat("Channels %@ are muted.", beo.commaAndList(muted, "and", "and", "channels"), "channelsAreMuted", "channels");
	} else if (muted.length == 1) {
		previewString += beo.translatedStringWithFormat("Channel %@ is muted.", muted[0], "channelIsMuted", "channels");
	}
	
	/*
	
	*/
	return [beo.translatedString("Channels", "channelsTitle", "channels"), '<p>'+previewString+'</p>', compatibilityNote];
}

return {
	generateSettingsPreview: generateSettingsPreview,
	selectChannelSimple: selectChannelSimple,
	setLevelProto: setLevelProto,
	setInvertProto: setInvertProto
}

})();