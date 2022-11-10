var shairport_sync = (function() {

var shairportSyncEnabled = false;
var shairportSyncUsesPassword = false;

$(document).on("shairport-sync", function(event, data) {
	if (data.header == "configuration") {
		if (data.content.usesPassword != undefined) {
			shairportSyncUsesPassword = (data.content.usesPassword) ? true : false;
			if (shairportSyncUsesPassword) {
				$("#shairport-sync-password-toggle").addClass("on");
				$("#shairport-sync-change-password").removeClass("disabled");
			} else {
				$("#shairport-sync-password-toggle").removeClass("on");
				$("#shairport-sync-change-password").addClass("disabled");
			}
		}
		if (data.content.version != undefined) {
			if (data.content.version) {
				$(".shairport-sync-version").text(data.content.version);
				$(".shairport-sync-version-container").removeClass("hidden");
			} else {
				$(".shairport-sync-version-container").addClass("hidden");
			}
		}
		if (data.content.shairportSyncEnabled != undefined) {
			if (data.content.shairportSyncEnabled) {
				shairportSyncEnabled = true;
				$("#shairport-sync-enabled-toggle").addClass("on");
			} else {
				shairportSyncEnabled = false;
				$("#shairport-sync-enabled-toggle").removeClass("on");
			}
			beo.notify(false, "shairport-sync");
		}
	}

	
	
});

function toggleEnabled() {
	enabled = (!shairportSyncEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning AirPlay on...", icon: "attention", timeout: false});
	} else {
		beo.notify({title: "Turning AirPlay off...", icon: "attention", timeout: false});
	}
	beo.send({target: "shairport-sync", header: "shairportSyncEnabled", content: {enabled: enabled}});
}

function toggleUsePasswordForShairportSync() {
	if (shairportSyncUsesPassword) {
		beo.ask("disable-shairport-sync-password-prompt");
	} else {
		setShairportSyncPassword();
	}
}

function setShairportSyncPassword() {
	beo.startTextInput(2, "Set AirPlay Password", "Changing this setting will disconnect active AirPlay sources to restart shairport-sync.", {placeholders: {password: "Password"}, minLength: {text: 3}}, function(input) {
		if (input && input.password) {
			beo.send({target: "shairport-sync", header: "setPassword", content: {password: input.password}});
		}
	});
}

function disableShairportSyncPassword() {
	beo.ask();
	beo.send({target: "shairport-sync", header: "setPassword", content: {password: false}});
}

return {
	toggleEnabled,
	setShairportSyncPassword: setShairportSyncPassword,
	disableShairportSyncPassword: disableShairportSyncPassword,
	toggleUsePasswordForShairportSync: toggleUsePasswordForShairportSync
}

})();
