var squeezelite = (function() {

var squeezeliteEnabled = false;


$(document).on("squeezelite", function(event, data) {
	if (data.header == "squeezeliteSettings") {
		
		if (data.content.squeezeliteEnabled) {
			squeezeliteEnabled = true;
			$("#squeezelite-enabled-toggle").addClass("on");
		} else {
			squeezeliteEnabled = false;
			$("#squeezelite-enabled-toggle").removeClass("on");
		}
		beo.notify(false, "squeezelite");
	}
});


function toggleEnabled() {
	enabled = (!squeezeliteEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning Squeezelite on...", icon: "attention", timeout: false, id: "squeezelite"});
	} else {
		beo.notify({title: "Turning Squeezelite off...", icon: "attention", timeout: false, id: "squeezelite"});
	}
	beo.send({target: "squeezelite", header: "squeezeliteEnabled", content: {enabled: enabled}});
}


return {
	toggleEnabled: toggleEnabled
};

})();