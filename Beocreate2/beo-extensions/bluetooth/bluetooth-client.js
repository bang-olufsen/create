var bluetooth = (function() {

var bluetoothEnabled = false;
var bluetoothDiscovery = false;


$(document).on("bluetooth", function(event, data) {
	if (data.header == "bluetoothSettings") {
		
		if (data.content.settings.bluetoothEnabled) {
			bluetoothEnabled = true;
			$("#bluetooth-toggle").addClass("on");
		} else {
			bluetoothEnabled = false;
			$("#bluetooth-toggle").removeClass("on");
		}
		if (!data.content.settings.bluetoothDiscoverable || !bluetoothEnabled) {
			bluetoothDiscovery = false;
			$("#bluetooth-discovery-start")
				.removeClass("on")
				.removeClass("disabled");
		} else {			
			bluetoothDiscovery = true;
			$("#bluetooth-discovery-start")
				.addClass("on")
				.addClass("disabled");
		}
		beo.notify(false, "bluetooth");
	}
});


function toggleEnabled() {
	enabled = (!bluetoothEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning Bluetooth on...", icon: "attention", timeout: false});
	} else {
		beo.notify({title: "Turning Bluetooth off...", icon: "attention", timeout: false});
	}
	beo.send({target: "bluetooth", header: "bluetoothEnabled", content: {enabled: enabled}});
}

function startBluetoothDiscovery() {
	if (bluetoothEnabled) {
		beo.notify({title: "Starting Bluetooth Discovery...", icon: "attention", timeout: false});
		beo.send({target: "bluetooth", header: "bluetoothDiscovery", content: {enabled: bluetoothEnabled}});
	}
}

return {
	toggleEnabled: toggleEnabled,
	startBluetoothDiscovery: startBluetoothDiscovery
};

})();