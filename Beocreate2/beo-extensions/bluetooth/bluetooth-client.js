var bluetooth = (function() {

var bluetoothEnabled = false;
var bluetoothDiscovery = false;


$(document).on("bluetooth", function(event, data) {
	if (data.header == "bluetoothSettings") {
		
		if (data.content.settings.bluetoothEnabled) {
			bluetoothEnabled = true;
			$("#bluetooth-toggle").addClass("on");
			$("#bluetooth-discovery-button, #bluetooth-pairing-mode").removeClass("disabled");
		} else {
			bluetoothEnabled = false;
			$("#bluetooth-toggle").removeClass("on");
			$("#bluetooth-discovery-button, #bluetooth-pairing-mode").addClass("disabled");
		}
		if (!data.content.settings.bluetoothDiscoverable) {
			bluetoothDiscovery = false;
			$("#bluetooth-discovery-button").text("Start Bluetooth Pairing").removeClass("grey").addClass("black");
		} else {			
			bluetoothDiscovery = true;
			$("#bluetooth-discovery-button").text("Stop Bluetooth Pairing").removeClass("black").addClass("grey");
		}
		
		if (data.content.settings.pairingMode) {
			$(".bluetooth-pairing-mode-selector .menu-item").removeClass("checked");
			$("#bluetooth-pairing-mode-"+data.content.settings.pairingMode).addClass("checked");
			text = "";
			switch (data.content.settings.pairingMode) {
				case 60:
					text = "For 1 minute";
					break;
				case 120:
					text = "For 2 minutes";
					break;
				case "always":
					text = "Until stopped";
					break;
			}
			$("#bluetooth-pairing-mode .menu-value").text(text);
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

function toggleDiscoverable() {
	enabled = (!bluetoothDiscovery) ? true : false;
	beo.sendToProduct("bluetooth", {header: "bluetoothDiscoverable", content: {enabled: enabled}});
}

function setPairingMode(mode) {
	beo.ask();
	beo.sendToProduct("bluetooth", {header: "setPairingMode", content: {mode: mode}});
}

function startBluetoothDiscovery() {
	if (bluetoothEnabled) {
		beo.notify({title: "Starting Bluetooth Discovery...", icon: "attention", timeout: false});
		beo.send({target: "bluetooth", header: "bluetoothDiscovery", content: {enabled: bluetoothEnabled}});
	}
}

interactDictionary = {
	actions: {
		startPairing: {
			name: "Start Bluetooth Pairing",
			icon: "extensions/bluetooth/symbols-black/bluetooth.svg"
		}
	}
}

return {
	toggleEnabled: toggleEnabled,
	toggleDiscoverable: toggleDiscoverable,
	setPairingMode: setPairingMode,
	startBluetoothDiscovery: startBluetoothDiscovery,
	interactDictionary: interactDictionary
};

})();