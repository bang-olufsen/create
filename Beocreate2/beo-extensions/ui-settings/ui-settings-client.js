var settings = {
	screensaver_timeout: 1
}
let timer = null;
//current localbrowser user agent is 'Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15'
let screensaverEnabled = navigator.userAgent.indexOf('(X11; Linux armv7l)') >= 0 && navigator.userAgent.indexOf(' (KHTML, like Gecko) Version/13.0 Safari') >= 0;

var ui_settings = (function() {

var externalDisplayOn = false;
$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			beo.sendToProduct("ui-settings", "getScreensaverTimeout");
		}
	}
});

$(document).on("ui-settings", function(event, data) {
	if (data.header == "externalDisplay") {
		if (data.content.canUseExternalDisplay) {
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
	if (data.header == "setScreensaverTimeout") {
		settings.screensaver_timeout = data.content.screensaver_timeout;
		$(".screensaver-timeout-slider span").attr("data-content", settings.screensaver_timeout)
		$(".screensaver-timeout-slider").slider("value", settings.screensaver_timeout);
		resetScreensaverTimeout();
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

$(".screensaver-timeout-slider").slider({
	range: "min",
	min: 1,
	max: 10,
	value: 0,
	slide: function( event, ui ) {
		settings.screensaver_timeout = ui.value
		$(".screensaver-timeout-slider span").attr("data-content", ui.value+" min");
		beo.send({target: "ui-settings", header: "setScreensaverTimeout", content: {settings}});
		update_screensaver_timeout(ui.value);

	}
});

function update_screensaver_timeout(timeout) {
	settings.screensaver_timeout = timeout;
	resetScreensaverTimeout();
}

var screensaver = (function() {
	if (screensaverEnabled){
		//all click events will reset the screensaver timer (but slider drag etc will not)
		$(document).on("click", function() {
			resetScreensaverTimeout();
		});

		$(document).on("screensaver", function(event, data) {
			if (data.header == "deactivate") {
				resetScreensaverTimeout();
			}
		});
	}
})();



function timeoutValue(){
	return settings.screensaver_timeout * 60 * 1000; //convert minutes to milliseconds
}
function resetScreensaverTimeout(){
	if (screensaverEnabled) {
		hideScreenSaver();
		clearTimeout(timer);
		timer = setTimeout(showScreenSaver, timeoutValue())
	}
}
function showScreenSaver(){
	document.getElementById("myNav").style.width = "100%";

}
function hideScreenSaver(){
	document.getElementById("myNav").style.width = "0%";
}