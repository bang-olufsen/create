var privacy = (function() {

descriptions = {};

$(document).on("privacy", function(event, data) {
	if (data.header == "privacySettings") {
		
		if (data.content.settings) {
			if (data.content.settings.externalMetadata) {
				$("#privacy-metadata-toggle").addClass("on");
			} else {
				$("#privacy-metadata-toggle").removeClass("on");
			}
			if (data.content.settings.usageData) {
				$("#privacy-stats-toggle").addClass("on");
			} else {
				$("#privacy-stats-toggle").removeClass("on");
			}
			beo.notify(false, "privacy");
		}
		
		if (data.content.descriptions) {
			descriptions = data.content.descriptions;
		}
	}
	
	if (data.header == "updatingSettings") {
		beo.notify({title: "Updating settings...", icon: "attention", timeout: false, id: "privacy"});
	}
});

function toggle(setting) {
	beo.sendToProduct("privacy", {header: "toggleSetting", content: {setting: setting}});
}

function showInfo(setting) {
	if (descriptions[setting]) {
		$("#privacy-info-prompt-content").html(descriptions[setting]);
		beo.ask("privacy-more-info-prompt");
	}
}


return {
	toggle: toggle,
	showInfo: showInfo
};

})();