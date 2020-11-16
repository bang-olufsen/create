var openhome = (function() {

var openhomeEnabled = false;
var room = null;


$(document).on("openhome", function(event, data) {
	if (data.header == "openhomeSettings") {
		
		if (data.content.openhomeEnabled) {
			openhomeEnabled = true;
			$("#openhome-enabled-toggle").addClass("on");
		} else {
			openhomeEnabled = false;
			$("#openhome-enabled-toggle").removeClass("on");
		}
		
		if (data.content.room) {
			room = data.content.room
			$("#openhome-room").text(room).removeClass("button");
		} else {
			room = null;
			$("#openhome-room").text("Set...").addClass("button");
		}
		
		beo.notify(false, "openhome");
	}
});


function toggleEnabled() {
	enabled = (!openhomeEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning OpenHome on...", icon: "attention", timeout: false, id: "openhome"});
	} else {
		beo.notify({title: "Turning OpenHome off...", icon: "attention", timeout: false, id: "openhome"});
	}
	beo.send({target: "openhome", header: "openhomeEnabled", content: {enabled: enabled}});
}


function setRoom() {
	beo.startTextInput(1, "Room name", "Enter the name of the room this system is located", {text: room, placeholders: {text: "Living room"}, optional: {text: true}}, function(input) {
		// Validate and store input.
		if (input) {
			if (input.text != "") {
					beo.send({target: "openhome", header: "setRoom", content: {room: input.text}});
			}
		}
	});
}


return {
	toggleEnabled: toggleEnabled,
	setRoom: setRoom
};

})();
