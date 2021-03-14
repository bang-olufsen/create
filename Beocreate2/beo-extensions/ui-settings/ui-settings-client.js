
var screensaverNowPlaying = new Vue({
	el: "#screensaver",
	data: nowPlayingData
});


var ui_settings = (function() {

var settings = {
	screensaverTimeout: 5
}
let timer = null;
//current localbrowser user agent is 'Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15'
let screensaverEnabled = navigator.userAgent.indexOf('(X11; Linux armv7l)') >= 0 && navigator.userAgent.indexOf(' (KHTML, like Gecko) Version/13.0 Safari') >= 0;
//var screensaverEnabled = 1; // Screensaver on any platform (for testing purposes).

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
		settings.screensaverTimeout = data.content.screensaverTimeout;
		$(".screensaver-timeout-selector .menu-item").removeClass("checked");
		$("#screensaver-timeout-"+data.content.screensaverTimeout).addClass("checked");
		if (settings.screensaverTimeout == "never") {
			$("#screensaver-mode .menu-value").text("Never");
		} else {
			$("#screensaver-mode .menu-value").text("After "+settings.screensaverTimeout+" minute"+((settings.screensaverTimeout > 1) ? "s" : ""));
		}
		resetScreensaverTimeout();
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


function timeoutValue(){
	return settings.screensaverTimeout * 60 * 1000; //convert minutes to milliseconds
}
function resetScreensaverTimeout(){
	if (screensaverEnabled) {
		hideScreenSaver();
		clearTimeout(timer);
		if (settings.screensaverTimeout!=="never"){
			timer = setTimeout(showScreenSaver, timeoutValue());
		}
	}
}
var dotsTimer;
function showScreenSaver(){
	document.getElementById("screensaver").classList.remove("hidden");
	setTimeout(function() {
		// Allow time for the element to become "block" before fading it in.
		document.getElementById("screensaver").classList.add("visible");
	}, 100);
	redrawDots();
}
function hideScreenSaver(){
	clearTimeout(dotsTimer);
	document.getElementById("screensaver").classList.remove("visible");
	setTimeout(function() {
		// Allow time for the element to fade out before setting it to "display: none".
		document.getElementById("screensaver").classList.add("hidden");
		$("#screensaver .background").empty();
	}, 1000);
}
function redrawDots(){
	//generateDotBackground();
	cycleDots();
	clearTimeout(dotsTimer);
	dotsTimer = setTimeout(redrawDots, 2000); // Add a new dot every 2 seconds.
}

function setScreensaverTimeout(timeout) {
	beo.ask();
	beo.sendToProduct("ui-settings", "setScreensaverTimeout", {settings:{screensaverTimeout: timeout}});
}

var colours = ["red", "yellow", "green", "blue"];
function generateDotBackground() {
	// Regenerate a random background pattern.
	$("#screensaver .background").css("opacity", "0");

	//after the existing dots have faded, generate new ones
	setTimeout(function(){
		$("#screensaver .background").empty();
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

function cycleDots() {
	// Same as above, but gradually recycles the dots.
	var dots = $("#screensaver .background").children();
	if (dots.length > 15) {
		// Remove the oldest dot.
		$(dots[0]).remove();
	}
	randomColour = colours[Math.round(Math.random()*3)];
	//hRandom = 16*(Math.round(Math.random()*5)+1);
	hRandom = Math.round(Math.random()*80)+10;
	vRandom = Math.round(Math.random()*80)+10;
	$("#screensaver .background").append('<img class="create-dot" src="'+$("#screensaver").attr("data-asset-path")+'/create-dot-animate-'+randomColour+'.svg" style="top: '+vRandom+'%; left: '+hRandom+'%;">');
	// CSS animation takes care of fading dots in and out, no JS required.
}

return {
	toggleDisplay: toggleDisplay,
	setScreensaverTimeout: setScreensaverTimeout,
	startScreenSaver: showScreenSaver
}

})();