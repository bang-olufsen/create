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
		notify(false, "bluetooth");
	}
});


function toggleEnabled() {
	enabled = (!bluetoothEnabled) ? true : false;
	if (enabled) {
		notify({title: "Turning Bluetooth on...", icon: "attention", timeout: false, id: "bluetooth"});
	} else {
		notify({title: "Turning Bluetooth off...", icon: "attention", timeout: false, id: "bluetooth"});
	}
	send({target: "bluetooth", header: "bluetoothEnabled", content: {enabled: enabled}});
}


return {
	toggleEnabled: toggleEnabled
};

})();