var ui_settings = (function() {

var externalDisplayOn = false;

$(document).on("ui-settings", function(event, data) {
	
	if (data.header == "externalDisplay") {
		if (canUseExternalDisplay) {
			document.querySelector(".external-display-settings").classList.remove("hidden");
			if (data.content.enabled) {
				externalDisplayOn = true;
				document.querySelector("#external-display-toggle").classList.add("on");
			} else {
				externalDisplayOn = false;
				document.querySelector("#external-display-toggle").classList.remove("on");
			}
		}
		beo.notify(false, "ui-settings");
	}
});

function toggleDisplay() {
	beo.sendToProduct("ui-settings", "externalDisplayOn", {enabled: (!externalDisplayOn) ? true : false});
	if (!externalDisplayOn) {
		beo.notify({title: "Turning external display on...", icon: "attention", timeout: false});
	} else {
		beo.notify({title: "Turning external display off...", icon: "attention", timeout: false});
	}
}

return {
	toggleDisplay: toggleDisplay
}

})();