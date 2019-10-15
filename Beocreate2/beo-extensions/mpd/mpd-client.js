var mpd = (function() {

var mpdEnabled = false;


$(document).on("mpd", function(event, data) {
	if (data.header == "mpdSettings") {
		
		if (data.content.mpdEnabled) {
			mpdEnabled = true;
			$("#mpd-enabled-toggle").addClass("on");
		} else {
			mpdEnabled = false;
			$("#mpd-enabled-toggle").removeClass("on");
		}
		notify(false, "mpd");
	}
});


function toggleEnabled() {
	enabled = (!mpdEnabled) ? true : false;
	if (enabled) {
		notify({title: "Turning MPD on...", icon: "attention", timeout: false, id: "mpd"});
	} else {
		notify({title: "Turning MPD off...", icon: "attention", timeout: false, id: "mpd"});
	}
	send({target: "mpd", header: "mpdEnabled", content: {enabled: enabled}});
}


return {
	toggleEnabled: toggleEnabled
};

})();