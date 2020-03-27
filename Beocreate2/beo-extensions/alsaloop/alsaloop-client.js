var alsaloop = (function() {

var loopEnabled = false;
var sensitivity = 0;
var autoenabled = true;

$(document).on("alsaloop", function(event, data) {
	if (data.header == "alsaloopSettings") {
		
		if (data.content.loopEnabled) {
			loopEnabled = true;
			$("#alsaloop-enabled-toggle").addClass("on");
		} else {
			loopEnabled = false;
			$("#alsaloop-enabled-toggle").removeClass("on");
		}
		beo.notify(false, "alsaloop");
	}
	
	if (data.header == "alsaloopSensitivity") {
		
		if (data.content.sensitivity) {
			console.log("Sensitivity: "+data.content.sensitivity);
			if (data.content.sensitivity > 0) {
				autoenabled = true;
				updateAutoEnable();
				setSensitivity(data.content.sensitivity);
			} else {
				autoenabled = false;
				updateAutoEnable();
			}
		}
	}
});


function toggleEnabled() {
	enabled = (!loopEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning analogue input on...", icon: "attention", timeout: false});
	} else {
		beo.notify({title: "Turning analogue input off...", icon: "attention", timeout: false});
	}
	beo.send({target: "alsaloop", header: "loopEnabled", content: {enabled: enabled}});
}

function setSensitivity(sense, update_backend = true) {
	document.getElementById("alsaloop-sense-40").classList.remove("selected");
	document.getElementById("alsaloop-sense-60").classList.remove("selected");
	document.getElementById("alsaloop-sense-80").classList.remove("selected");
	
	if (sense >= 80) {
		document.getElementById("alsaloop-sense-80").classList.add("selected");
		sensitivity = 80
	} else if ( sense >= 60) {
		document.getElementById("alsaloop-sense-60").classList.add("selected");
		sensitivity = 60
	} else {
		document.getElementById("alsaloop-sense-40").classList.add("selected");
		sensitivity = 40
	}
		
	if (update_backend) {
		updateBackend();
	}
}

function toggleAutoEnable(update_backend = true) {
	autoenabled = ! autoenabled
	updateAutoEnable()
	
	if (update_backend) {
		updateBackend();
	}
}

function updateAutoEnable() {
	if (autoenabled) {
		document.getElementById("alsaloop-auto-enable").classList.add("on");
		document.getElementById("alsaloop-sense-40").classList.remove("disabled");
		document.getElementById("alsaloop-sense-60").classList.remove("disabled");
		document.getElementById("alsaloop-sense-80").classList.remove("disabled");
	} else {
		document.getElementById("alsaloop-auto-enable").classList.remove("on");
		document.getElementById("alsaloop-sense-40").classList.add("disabled");
		document.getElementById("alsaloop-sense-60").classList.add("disabled");
		document.getElementById("alsaloop-sense-80").classList.add("disabled");
	}
}	


function updateBackend() {
	if (autoenabled) {
		beo.send({target: "alsaloop", header: "sensitivity", content: {sensitivity: sensitivity}});
	} else {
		beo.send({target: "alsaloop", header: "sensitivity", content: {sensitivity: 0}});
	}
}

return {
	toggleEnabled: toggleEnabled,
	toggleAutoEnable: toggleAutoEnable,
	setSensitivity: setSensitivity
};

})();