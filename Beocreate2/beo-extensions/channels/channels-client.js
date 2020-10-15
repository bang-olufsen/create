var channels = (function() {

var channelSettings = {};
var canDoSimpleStereoSetup = false;
var driverTypes = {};
var canControl = {};
var Fs = 0;

var channelsUIPrepared = false;

channelColours = ["red", "yellow", "green", "blue"];



$(document).on("general", function(event, data) {
	if (data.header == "activatedExtension") {
		if (data.content.extension == "channels") {
			prepareChannelsUI();
			if (!$("#sound").parent().hasClass("advanced-sound-adjustments")) {
				beo.showMenuTab("channels-basics");
			}
		}
	}
	
});

$(document).on("channels", function(event, data) {
	if (data.header == "channelSettings") {
		prepareChannelsUI();
		
		if (data.content.driverTypes != undefined) {
			driverTypes = data.content.driverTypes;
		}
		
		if (data.content.canControlChannels != undefined) {
			canControl = data.content.canControlChannels;
			showCanControlChannels();
		}
		
		if (data.content.canDoSimpleStereoSetup != undefined) {
			showCanDoSimpleStereoSetup(data.content.canDoSimpleStereoSetup);
		}
		
		if (data.content.settings != undefined) {
			channelSettings = data.content.settings;
			showChannelSettings();
		}
		
		if (data.content.simpleRoleSelection != undefined) {
			showSimpleRoleSelection(data.content.simpleRoleSelection);
		} else {
			showSimpleRoleSelection(null);
		}
		
		if (data.content.Fs) Fs = data.content.Fs;
		
		/*if (data.content.daisyChainEnabled) {
			$(".channels-daisy-chained").removeClass("hidden");
		} else {
			$(".channels-daisy-chained").addClass("hidden");
		}*/ // Handled by the daisy-chain extension.
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

function selectRole(channel, role = null, isSlave = false) {
	$(".channels-channel-item, .channels-slave-channel-item").removeClass("expand-role-selector");
	if (role == null) { // Expand the selector.
		if (!isSlave) {
			$(".channel-item-"+channel).addClass("expand-role-selector");
		} else {
			$(".slave-channel-item-"+channel).addClass("expand-role-selector");
		}
	} else {
		beo.send({target: "channels", header: "selectRole", content: {channel: channel, role: role, daisyChainRole: isSlave}});
	}
}

function selectRoleSimple(role) {
	beo.send({target: "channels", header: "selectRoleSimple", content: {role: role}});
}


function showChannelSettings() {
	
	if (channelSettings.balance != undefined) {
		$(".master-balance-slider span").attr("data-content", balanceValueToText(channelSettings.balance));
		$(".master-balance-slider").slider("value", channelSettings.balance);
	}
	
	for (var c = 0; c < 4; c++) {
		channel = "abcd".charAt(c);
		if (channelSettings[channel]) {
			if (channelSettings[channel].role) {
				$(".channel-item-"+channel+" .selected-role").text(beo.capitaliseFirst(channelSettings[channel].role));
				$(".channel-item-"+channel+" .role-select-control > div").removeClass("selected");
				$(".channel-item-"+channel+" .role-select-control > div."+channelSettings[channel].role).addClass("selected");
			}
			if (channelSettings.daisyChainRoles[channel]) {
				$(".slave-channel-item-"+channel+" .selected-role").text(beo.capitaliseFirst(channelSettings.daisyChainRoles[channel]));
				$(".slave-channel-item-"+channel+" .role-select-control > div").removeClass("selected");
				$(".slave-channel-item-"+channel+" .role-select-control > div."+channelSettings.daisyChainRoles[channel]).addClass("selected");
			}
			
			if (driverTypes[channel] && driverTypes[channel].type) {
				types = getSpeakerTypeNameAndIcon(driverTypes[channel].type);
				$(".channel-item-"+channel+" .channel-type").text(types[0]);
				$(".channel-item-"+channel+" .driver-icon").attr("src", extensions.channels.assetPath+"/drivers/"+types[1]+".png").removeClass("disabled");
			} else {
				$(".channel-item-"+channel+" .channel-type").text("");
				$(".channel-item-"+channel+" .driver-icon").attr("src", extensions.channels.assetPath+"/drivers/mid-full.png").addClass("disabled");
			}
			
			if (channelSettings[channel].invert) {
				beo.setSymbol(".channel-item-"+channel+" .channel-invert", extensions.channels.assetPath+"/symbols-black/invert-inverted.svg");
			} else {
				beo.setSymbol(".channel-item-"+channel+" .channel-invert", extensions.channels.assetPath+"/symbols-black/invert.svg");
			}
			
			if (channelSettings[channel].enabled) {
				beo.setSymbol(".channel-item-"+channel+" .channel-mute", "common/symbols-black/volume.svg");
				if (canControl[channel].level) $(".channel-item-"+channel+" .channel-level-slider").removeClass("disabled");
			} else {
				beo.setSymbol(".channel-item-"+channel+" .channel-mute", "common/symbols-black/volume-mute.svg");
				$(".channel-item-"+channel+" .channel-level-slider").addClass("disabled");
			}
			
			if (channelSettings[channel].delay == undefined) channelSettings[channel].delay = 0;
			delay(channel);
			
			if (channelSettings[channel].level != undefined) {
				if (channelSettings[channel].level <= 0) {
					levelValue = channelSettings[channel].level;
				} else {
					levelValue = beoDSP.convertVolume("%", "dB", channelSettings[channel].level, 60);
				}
				$(".channel-level-"+channel+" span").attr("data-content", Math.round(levelValue*100)/100 + " dB");
				$(".channel-level-"+channel).slider("value", levelValue*4);
			}
		}
		
	}
	
	
}

function showCanControlChannels() {
	$("#simple-channel-select-control, #simple-stereo-control, .channels-channel-item .channel-level-slider, .channels-channel-item .channel-mute, .channels-channel-item .channel-invert").removeClass("disabled");
	$("#simple-balance-control, .channels-channel-item .selected-role, .channels-channel-item").removeClass("hidden");
	$(".channels-channel-item .role-select-control").empty();
	for (var c = 0; c < 4; c++) {
		settingsToControl = 0;
		channel = "abcd".charAt(c);
		if (canControl[channel].role == false) {
			$(".channel-item-"+channel+" .selected-role").addClass("hidden");
		} else {
			rearrangedRoles = [];
			for (var i = 0; i < canControl[channel].role.length; i++) {
				if (canControl[channel].role[i] == "left") {
					rearrangedRoles.splice(0, 0, "left");
				} else if (canControl[channel].role[i] == "right") {
					rearrangedRoles.splice(rearrangedRoles.length, 0, "right");
				} else {
					rightIndex = rearrangedRoles.indexOf("right");
					newIndex = (rightIndex != -1) ? rightIndex : rearrangedRoles.length;
					rearrangedRoles.splice(newIndex, 0, canControl[channel].role[i]);
				}
			}
			for (var i = 0; i < rearrangedRoles.length; i++) {
				$(".channel-item-"+channel+" .role-select-control").append("<div class=\""+rearrangedRoles[i]+"\" onclick=\"channels.selectRole('"+channel+"', '"+rearrangedRoles[i]+"');\">"+beo.capitaliseFirst(rearrangedRoles[i])+"</div>");
				$(".slave-channel-item-"+channel+" .role-select-control").append("<div class=\""+rearrangedRoles[i]+"\" onclick=\"channels.selectRole('"+channel+"', '"+rearrangedRoles[i]+"', true);\">"+beo.capitaliseFirst(rearrangedRoles[i])+"</div>");
			}
			$("#simple-channel-select-control").removeClass("disabled");
			settingsToControl++;
		}
		
		
		if (canControl[channel].level == false) {
			$(".channel-item-"+channel+" .channel-level-slider").addClass("disabled");
			$(".channel-item-"+channel+" .channel-mute").addClass("disabled");
		} else {
			settingsToControl++;
		}
		
		if (canControl[channel].invert == false) {
			$(".channel-item-"+channel+" .channel-invert").addClass("disabled");
		} else {
			settingsToControl++;
		}
		
		if (canControl[channel].delay == false) {
			$(".channel-item-"+channel+" .channel-delay .button").addClass("disabled");
		} else {
			settingsToControl++;
		}
		
		if (!settingsToControl) { // Hide the whole channel if there are no settings to control.
			$(".channel-item-"+channel).addClass("hidden");
		}
	}
	
	if (canControl.balance == false) {
		$("#simple-balance-control").addClass("hidden");
	}
	
	if (product_information && product_information.cardType) {
		if (product_information.cardType() == "DAC+ DSP") {
			$("#simple-channel-select, #simple-stereo-control").addClass("hidden");
		}
	}
}

function showCanDoSimpleStereoSetup(canDo) {
	canDoSimpleStereoSetup = canDo;
	if (canDo) {
		$("#simple-stereo-control").removeClass("hidden");
	} else {
		$("#simple-stereo-control").addClass("hidden");
	}
}

function showSimpleRoleSelection(roleSelection) {
	$("#simple-channel-select-control > div").removeClass("selected");
	switch (roleSelection) {
		case "left":
		case "right":
		case "mono":
			$("#simple-channel-select-control > ."+roleSelection).addClass("selected");
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
	if (!roleSelection || ((roleSelection == "stereo" || roleSelection == "stereo-rev") && !canDoSimpleStereoSetup)) {
		$("#channels-custom-roles-message").removeClass("hidden");
	} else {
		$("#channels-custom-roles-message").addClass("hidden");
	}
}

function showAdvancedSettings() {
	beo.sendToProduct("sound", {header: "advancedSoundAdjustmentsEnabled", content: {enabled: true}});
	beo.showMenuTab("channels-advanced");
}

function showAdvancedSettingsPopup(channels) {
	if (channels) {
		// Takes the relevant "channel strips" from the Advanced tab and puts them into a popup view that can be presented anywhere.
		prepareChannelsUI();
		$("#advanced-channel-settings-popup .menu-content").empty();
		for (var i = 0; i < channels.length; i++) {
			$(".channel-item-"+channels[i]).clone().appendTo("#advanced-channel-settings-popup .menu-content");
			$("#advanced-channel-settings-popup .channel-level-slider").empty();
		}
		beo.showPopupView("advanced-channel-settings-popup");
		attachChannelSliders("#advanced-channel-settings-popup");
		beo.sendToProduct("channels", {header: "getSettings"});
	} else {
		beo.hidePopupView("advanced-channel-settings-popup");
	}
}

function setLevelProto(channels, level) {
	beo.send({target: "channels", header: "setLevelProto", content: {channel: channels, level: level}});
}

function toggleInvert(channel) {
	beo.sendToProduct("channels", {header: "toggleInvert", content: {channel: channel}});
}

function toggleEnabled(channel) {
	beo.sendToProduct("channels", {header: "toggleEnabled", content: {channel: channel}});
}

adjustingDelayForChannel = null;
function showDelayAdjustment(channel) {
	adjustingDelayForChannel = channel;
	$("#channel-delay-adjustment .fine-adjust-value").text(Math.round(channelSettings[channel].delay*100)/100);
	delaySamples = Math.round(channelSettings[channel].delay / 1000 * Fs);
	$("#channel-delay-adjustment .fine-adjust-middle p").text(delaySamples+" samples");
	beo.ask("channel-delay-adjustment", [channel.toUpperCase()]);
}

function delayStep(step) {
	if (adjustingDelayForChannel != null) {
		value = channelSettings[adjustingDelayForChannel].delay + step;
		delay(adjustingDelayForChannel, value);
	}
}

function delay(channel, value) {
	if (value != undefined) {
		if (value < 0) value = 0;
		if (Math.round(value / 1000 * Fs) > canControl[channel].delay) value = canControl[channel].delay / Fs * 1000;
		channelSettings[channel].delay = value;
		beo.sendToProduct("channels", {header: "setDelay", content: {channel: channel, delay: value}});
	}
	$(".channel-item-"+channel+" .channel-delay .symbol-value").text((channelSettings[channel].delay == 0) ? "" : Math.round(channelSettings[channel].delay*100)/100);
	if (adjustingDelayForChannel != null) {
		$("#channel-delay-adjustment .fine-adjust-value").text(Math.round(channelSettings[channel].delay*100)/100);
		delaySamples = Math.round(channelSettings[channel].delay / 1000 * Fs);
		$("#channel-delay-adjustment .fine-adjust-middle p").text(delaySamples+" samples");
	}
}


function prepareChannelsUI() {
	if (!channelsUIPrepared) {
		channelsUIPrepared = true;
		// Duplicate the advanced channel controls for all channels.
		channelItem = $(".channels-channel-item");
		slaveItem = $(".channels-slave-channel-item");
		for (var i = 0; i < 4; i++) {
			channel = ("abcd").charAt(i);
			
			newItem = channelItem.clone();
			newItem.addClass("channel-item-"+channel+" "+channelColours[i]);
			newItem.find(".channel-dot").addClass(channelColours[i]);
			newItem.find(".channel-letter span").text(channel.toUpperCase());
			newItem.find(".channel-level-slider").addClass("channel-level-"+channel+" "+ channelColours[i]);
			newItem.find(".selected-role").attr("onclick", "channels.selectRole('"+channel+"');");
			newItem.find(".channel-mute").attr("onclick", "channels.toggleEnabled('"+channel+"');");
			newItem.find(".channel-delay .button").attr("onclick", "channels.showDelayAdjustment('"+channel+"');");
			newItem.find(".channel-invert").attr("onclick", "channels.toggleInvert('"+channel+"');");
			newItem.appendTo("#channels-advanced-container");
			
			newSlaveItem = slaveItem.clone();
			newSlaveItem.addClass("slave-channel-item-"+channel+" "+channelColours[i]);
			newSlaveItem.find(".channel-dot").addClass(channelColours[i]);
			newSlaveItem.find(".channel-letter span").text(channel.toUpperCase());
			newSlaveItem.find(".selected-role").attr("onclick", "channels.selectRole('"+channel+"', null, true);");
			newSlaveItem.appendTo("#channels-daisy-chained-container");
		}
		channelItem.remove();
		slaveItem.remove();
		
		attachChannelSliders();
		
	}
}


function attachChannelSliders(context = null) {
	context = (context == null) ? "" : context+" "; 
	$(context+".channel-level-slider").slider({
		range: "min",
		min: -80,
		max: 0,
		value: 0,
		slide: function( event, ui ) {
				if ($(event.target).hasClass("channel-level-a")) channel = "a";
				if ($(event.target).hasClass("channel-level-b")) channel = "b";
				if ($(event.target).hasClass("channel-level-c")) channel = "c";
				if ($(event.target).hasClass("channel-level-d")) channel = "d";
				
				levelValue = ui.value/4;
				
				$(".channel-level-"+channel+" span").attr("data-content", levelValue + " dB");
				beo.sendToProduct("channels", {header: "setLevel", content: {channel: channel, level: levelValue}});
				
			}
	});
}





function generateSettingsPreview(settings) {
	// Possible settings: role, delay, level, enabled.
	compatibilityNote = "";
	
	level = [];
	delays = [];
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
				delays.push(channel.toUpperCase());
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

function getSpeakerTypeNameAndIcon(type) {
	switch (type) {
		case "full-range":
			newTypeUI = "Full-range";
			newTypeIcon = "mid-full";
			hp = null;
			lp = null;
			break;
		case "tweeter":
			newTypeUI = "Tweeter";
			newTypeIcon = "tweet";
			hp = 2300;
			lp = null;
			break;
		case "mid-tweeter":
			newTypeUI = "Mid-tweeter";
			newTypeIcon = "mid-full";
			hp = 300;
			lp = null;
			break;
		case "midrange":
			newTypeUI = "Midrange";
			newTypeIcon = "mid-full";
			hp = 300;
			lp = 2300;
			break;
		case "mid-woofer":
			newTypeUI = "Mid-woofer";
			newTypeIcon = "woof";
			hp = null;
			lp = 2300;
			break;
		case "woofer":
			newTypeUI = "Woofer";
			newTypeIcon = "woof";
			hp = null;
			lp = 300;
			break;
	}
	return [newTypeUI, newTypeIcon, hp, lp];
}

function showingTab(tab) {
	if (tab == "advanced") {
		$("#show-channels-connection-guide-button").removeClass("hidden");
	} else {
		$("#show-channels-connection-guide-button").addClass("hidden");
	}
}

function getBeosonicPreview() {
	return {
		label: "Channels",
		description: "Balance, speaker roles and other settings"
	};
}

return {
	generateSettingsPreview: generateSettingsPreview,
	selectRole: selectRole,
	selectRoleSimple: selectRoleSimple,
	delay: delay,
	delayStep: delayStep,
	showDelayAdjustment: showDelayAdjustment,
	toggleEnabled: toggleEnabled,
	toggleInvert: toggleInvert,
	showAdvancedSettings: showAdvancedSettings,
	showAdvancedSettingsPopup: showAdvancedSettingsPopup,
	showingAdvancedTab: function() {showingTab('advanced')},
	showingBasicsTab: function() {showingTab('basics')},
	getBeosonicPreview: getBeosonicPreview
}

})();