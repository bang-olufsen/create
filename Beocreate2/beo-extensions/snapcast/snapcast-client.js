var snapcast = (function() {

var snapcastEnabled = false;
var serverAddress = null;
var autoJoin = false;


$(document).on("snapcast", function(event, data) {
	if (data.header == "snapcastSettings") {
		
		if (data.content.snapcastEnabled) {
			snapcastEnabled = true;
			$("#snapcast-enabled-toggle").addClass("on");
		} else {
			snapcastEnabled = false;
			$("#snapcast-enabled-toggle").removeClass("on");
		}
		
		if (data.content.autoJoin) {
			autoJoin = true;
			$("#snapcast-auto-join-toggle").addClass("on");
		} else {
			autoJoin = false;
			$("#snapcast-auto-join-toggle").removeClass("on");
		}
		
		if (data.content.serverAddress) {
			serverAddress = data.content.serverAddress
			$("#snapcast-server-address").text(serverAddress).removeClass("button");
		} else {
			serverAddress = null;
			$("#snapcast-server-address").text("Set...").addClass("button");
		}
		beo.notify(false, "snapcast");
	}
});


function toggleEnabled() {
	enabled = (!snapcastEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning Snapcast on...", icon: "attention", timeout: false});
	} else {
		beo.notify({title: "Turning Snapcast off...", icon: "attention", timeout: false});
	}
	beo.send({target: "snapcast", header: "snapcastEnabled", content: {enabled: enabled}});
}

function toggleAutoJoin() {
	enabled = (!autoJoin) ? true : false;
	if (snapcastEnabled) {
		beo.notify({title: "Updating settings...", icon: "attention", timeout: false});
	}
	beo.send({target: "snapcast", header: "autoJoin", content: {enabled: enabled}});
}

function setServerAddress() {
	beo.startTextInput(1, "Snapcast Server", "Enter Snapcast server address. Leave blank to discover automatically.", {text: serverAddress, placeholders: {text: "10.0..."}, optional: {text: true}}, function(input) {
		// Validate and store input.
		if (input) {
			if (input.text == "") {
				if (snapcastEnabled) {
					beo.notify({title: "Updating settings...", icon: "attention", timeout: false});
				}
				beo.send({target: "snapcast", header: "setServerAddress", content: {address: null}});
			} else {
				if (isValidIP(input.text)) {
					if (snapcastEnabled) {
						beo.notify({title: "Updating settings...", icon: "attention", timeout: false});
					}
					beo.send({target: "snapcast", header: "setServerAddress", content: {address: input.text}});
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
	setServerAddress: setServerAddress,
	toggleAutoJoin: toggleAutoJoin
};

})();