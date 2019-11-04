var roon = (function() {

var roonEnabled = false;


$(document).on("roon", function(event, data) {
	if (data.header == "roonSettings") {
		
		if (data.content.roonEnabled) {
			roonEnabled = true;
			$("#roon-enabled-toggle").addClass("on");
		} else {
			roonEnabled = false;
			$("#roon-enabled-toggle").removeClass("on");
		}
		notify(false, "roon");
	}
});


function toggleEnabled() {
	enabled = (!roonEnabled) ? true : false;
	if (enabled) {
		notify({title: "Turning Roon on...", icon: "attention", timeout: false, id: "roon"});
	} else {
		notify({title: "Turning Roon off...", icon: "attention", timeout: false, id: "roon"});
	}
	send({target: "roon", header: "roonEnabled", content: {enabled: enabled}});
}


return {
	toggleEnabled: toggleEnabled
};

})();