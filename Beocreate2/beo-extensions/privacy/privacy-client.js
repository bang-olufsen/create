var privacy = (function() {


$(document).on("privacy", function(event, data) {
	if (data.header == "privacySettings") {
		
		if (data.content.externalMetadata) {
			$("#privacy-metadata-toggle").addClass("on");
		} else {
			$("#privacy-metadata-toggle").removeClass("on");
		}
		beo.notify(false, "privacy");
	}
	
	if (data.header == "updatingSettings") {
		beo.notify({title: "Updating settings...", icon: "attention", timeout: false, id: "privacy"});
	}
});

function toggle(setting) {
	beo.sendToProduct("privacy", {header: "toggleSetting", content: {setting: setting}});
}


return {
	toggle: toggle
};

})();