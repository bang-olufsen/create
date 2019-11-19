var alsaloop = (function() {

var loopEnabled = false;


$(document).on("alsaloop", function(event, data) {
	if (data.header == "alsaloopSettings") {
		
		if (data.content.loopEnabled) {
			loopEnabled = true;
			$("#alsaloop-enabled-toggle").addClass("on");
		} else {
			loopEnabled = false;
			$("#alsaloop-enabled-toggle").removeClass("on");
		}
		notify(false, "alsaloop");
	}
});


function toggleEnabled() {
	enabled = (!loopEnabled) ? true : false;
	if (enabled) {
		notify({title: "Turning analogue input on...", icon: "attention", timeout: false});
	} else {
		notify({title: "Turning analogue input off...", icon: "attention", timeout: false});
	}
	send({target: "alsaloop", header: "loopEnabled", content: {enabled: enabled}});
}


return {
	toggleEnabled: toggleEnabled
};

})();