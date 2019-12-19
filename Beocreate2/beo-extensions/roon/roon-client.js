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
		beo.notify(false, "roon");
	}
});


function toggleEnabled() {
	enabled = (!roonEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning Roon on...", icon: "attention", timeout: false, id: "roon"});
	} else {
		beo.notify({title: "Turning Roon off...", icon: "attention", timeout: false, id: "roon"});
	}
	beo.send({target: "roon", header: "roonEnabled", content: {enabled: enabled}});
}


return {
	toggleEnabled: toggleEnabled
};

})();