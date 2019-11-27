var bluetooth = (function() {

var bluetoothEnabled = false;


$(document).on("bluetooth", function(event, data) {
	if (data.header == "bluetoothSettings") {
		
		if (data.content.bluetoothEnabled) {
			bluetoothEnabled = true;
			$("#bluetooth-toggle").addClass("on");
		} else {
			bluetoothEnabled = false;
			$("#bluetooth-toggle").removeClass("on");
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


return {
	toggleEnabled: toggleEnabled
};

})();