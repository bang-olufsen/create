var spotifyd = (function() {

var spotifydEnabled = false;


$(document).on("spotifyd", function(event, data) {
	if (data.header == "spotifydSettings") {
		
		if (data.content.spotifydEnabled) {
			spotifydEnabled = true;
			$("#spotifyd-enabled-toggle").addClass("on");
		} else {
			spotifydEnabled = false;
			$("#spotifyd-enabled-toggle").removeClass("on");
		}
		notify(false, "spotifyd");
	}
});


function toggleEnabled() {
	enabled = (!spotifydEnabled) ? true : false;
	if (enabled) {
		notify({title: "Turning Spotify Connect on...", icon: "attention", timeout: false, id: "spotifyd"});
	} else {
		notify({title: "Turning Spotify Connect off...", icon: "attention", timeout: false, id: "spotifyd"});
	}
	send({target: "spotifyd", header: "spotifydEnabled", content: {enabled: enabled}});
}


return {
	toggleEnabled: toggleEnabled
};

})();