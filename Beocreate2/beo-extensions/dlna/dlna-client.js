var dlna = (function() {

var dlnaEnabled = false;


$(document).on("dlna", function(event, data) {
	if (data.header == "dlnaSettings") {
		
		if (data.content.dlnaEnabled) {
			dlnaEnabled = true;
			$("#dlna-enabled-toggle").addClass("on");
		} else {
			dlnaEnabled = false;
			$("#dlna-enabled-toggle").removeClass("on");
		}
		beo.notify(false, "dlna");
	}
});


function toggleEnabled() {
	enabled = (!dlnaEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning DLNA on...", icon: "attention", timeout: false, id: "dlna"});
	} else {
		beo.notify({title: "Turning DLNA off...", icon: "attention", timeout: false, id: "dlna"});
	}
	beo.send({target: "dlna", header: "dlnaEnabled", content: {enabled: enabled}});
}


return {
	toggleEnabled: toggleEnabled
};

})();
