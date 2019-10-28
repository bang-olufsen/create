var mpd = (function() {

var mpdEnabled = false;


$(document).on("mpd", function(event, data) {
	if (data.header == "mpdSettings") {
		
		if (data.content.mpdEnabled) {
			mpdEnabled = true;
			$("#mpd-enabled-toggle").addClass("on");
			$("#mpd-link").attr("href", "http://"+window.location.host+":9000").removeClass("hidden");
		} else {
			mpdEnabled = false;
			$("#mpd-enabled-toggle").removeClass("on");
			$("#mpd-link").addClass("hidden");
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