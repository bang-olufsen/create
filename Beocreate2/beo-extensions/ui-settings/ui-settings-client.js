
var ui_settings = (function() {

var settings = {
	screensaver_timeout: 1
}
let timer = null;
//current localbrowser user agent is 'Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15'
let screensaverEnabled = navigator.userAgent.indexOf('(X11; Linux armv7l)') >= 0 && navigator.userAgent.indexOf(' (KHTML, like Gecko) Version/13.0 Safari') >= 0;

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
		$(".screensaver-timeout-selector .menu-item").removeClass("checked");
		$("#screensaver-timeout-"+data.content.screensaver_timeout).addClass("checked");
		resetScreensaverTimeout();
	}
});

$(document).on("sources", function(event, data) {
	if (data.header == "sources") {
		//show the now-playing component within the screensaver overlay for 30s on song changes
		$("#screensaver .mini-now-playing").css("opacity", "1");
		setTimeout(function() {
			$("#screensaver .mini-now-playing").css("opacity", "0");
		}, 30000);
	}
});

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

function toggleDisplay() {
	beo.sendToProduct("ui-settings", "externalDisplayOn", {enabled: (!externalDisplayOn) ? true : false});
	if (!externalDisplayOn) {
		beo.notify({title: "Turning external display on...", icon: "attention", timeout: false});
	} else {
		beo.notify({title: "Turning external display off...", icon: "attention", timeout: false});
	}
}

return {
	toggleDisplay: toggleDisplay,
	setScreensaverTimeout: setScreensaverTimeout
}

function timeoutValue(){
	return settings.screensaver_timeout * 60 * 1000; //convert minutes to milliseconds
}
function resetScreensaverTimeout(){
	if (screensaverEnabled) {
		hideScreenSaver();
		clearTimeout(timer);
		if (settings.screensaver_timeout!=="never"){
			timer = setTimeout(showScreenSaver, timeoutValue());
		}
	}
}
var dotsTimer;
function showScreenSaver(){
	document.getElementById("screensaver").style.width = "100%";
	redrawDots();
}
function hideScreenSaver(){
	clearTimeout(dotsTimer);
	document.getElementById("screensaver").style.width = "0%";
}
function redrawDots(){
	generateDotBackground();
	clearTimeout(dotsTimer);
	dotsTimer = setTimeout(redrawDots, 15000);//redraw dots every 15s
}

function setScreensaverTimeout(timeout) {
	beo.ask();
	beo.sendToProduct("ui-settings", {header: "setScreensaverTimeout", content: {settings:{screensaver_timeout: timeout}}});
}

})();

var screensaverNowPlaying = new Vue({
	el: "#screensaver",
	data: nowPlayingData
});

function generateDotBackground() {
	// Regenerate a random background pattern.
	$("#screensaver .background").css("opacity", "0");

	//after the existing dots have faded, generate new ones
	setTimeout(function(){
		$("#screensaver .background").empty();
		colours = ["red", "yellow", "green", "blue"];
		for (var i = 0; i < 20; i++) {
			randomColour = colours[Math.round(Math.random()*3)];
			//hRandom = 16*(Math.round(Math.random()*5)+1);
			hRandom = Math.round(Math.random()*80)+10;
			vRandom = Math.round(Math.random()*80)+10;
			$("#screensaver .background").append('<img class="create-dot" src="'+$("#screensaver").attr("data-asset-path")+'/create-dot-animate-'+randomColour+'.svg" style="top: '+vRandom+'%; left: '+hRandom+'%;">');
		}
		$("#screensaver .background").css("opacity", "1");
	}, 1000); //coordinate this timeout with the opacity transition duration css

}