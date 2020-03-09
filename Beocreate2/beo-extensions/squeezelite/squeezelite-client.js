var squeezelite = (function() {

var serverAddress = null;


$(document).on("squeezelite", function(event, data) {
	
	if (data.header == "squeezeliteSettings") {
		
		if (data.content.squeezeliteEnabled) {
			squeezeliteEnabled = true;
			$("#squeezelite-enabled-toggle").addClass("on");
		} else {
			squeezeliteEnabled = false;
			$("#squeezelite-enabled-toggle").removeClass("on");
		}
		
		if (data.content.serverAddress) {
			serverAddress = data.content.serverAddress
			$("#squeezelite-server-address").text(serverAddress).removeClass("button");
		} else {
			serverAddress = null;
			$("#squeezelite-server-address").text("Set...").addClass("button");
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

function setServerAddress() {
	beo.startTextInput(1, "LMS IP", "Enter logitech media server address. Leave blank to discover automatically.", {text: serverAddress, placeholders: {text: "10.0..."}, optional: {text: true}}, function(input) {
		// Validate and store input.
		if (input) {
			if (input.text == "") {
				if (squeezeliteEnabled) {
					beo.notify({title: "Updating settings...", icon: "attention", timeout: false});
				}
				beo.send({target: "squeezelite", header: "setServerAddress", content: {address: null}});
			} else {
				if (isValidIP(input.text)) {
					if (squeezeliteEnabled) {
						beo.notify({title: "Updating settings...", icon: "attention", timeout: 10});
					}
					beo.send({target: "squeezelite", header: "setServerAddress", content: {address: input.text}});
				} else {
					beo.notify({title: "IP address is not valid", message: "The address must contain four numbers separated by periods.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
				}
			}
		}
	});
}

function isValidIP(address) {
	ipItems = address.split(".");
	validIP = true;
	if (ipItems.length == 4 && address != "0.0.0.0") {
		// Length matches.
		for (var i = 0; i < ipItems.length; i++) {
			if (isNaN(ipItems[i])) validIP = false;
		}
	} else {
		validIP = false;
	}
	return validIP;
}



return {
	toggleEnabled: toggleEnabled,
	setServerAddress: setServerAddress
};

})();