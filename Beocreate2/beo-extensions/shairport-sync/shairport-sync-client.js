var shairport_sync = (function() {


shairportSyncUsesPassword = false;

$(document).on("shairport-sync", function(event, data) {
	if (data.header == "configuration") {
		shairportSyncUsesPassword = (data.content.usesPassword) ? true : false;
		if (shairportSyncUsesPassword) {
			$("#shairport-sync-password-toggle").addClass("on");
			$("#shairport-sync-change-password").removeClass("disabled");
		} else {
			$("#shairport-sync-password-toggle").removeClass("on");
			$("#shairport-sync-change-password").addClass("disabled");
		}
		
		if (data.content.version) {
			$(".shairport-sync-version").text(data.content.version);
			$(".shairport-sync-version-container").removeClass("hidden");
		} else {
			$(".shairport-sync-version-container").addClass("hidden");
		}
	}

	
	
});

function toggleUsePasswordForShairportSync() {
	if (shairportSyncUsesPassword) {
		ask("disable-shairport-sync-password-prompt");
	} else {
		setShairportSyncPassword();
	}
}

function setShairportSyncPassword(text) {
	if (!text) { // Show text input
		startTextInput(2, "Set AirPlay Password", "Changing this setting will disconnect active AirPlay sources to restart shairport-sync.", {placeholders: {password: "Password"}, minLength: {text: 3}}, function(text) {
			setShairportSyncPassword(text);
		});
	} else {
		send({target: "shairport-sync", header: "setPassword", content: {password: text.password}});
	}
}

function disableShairportSyncPassword() {
	ask();
	send({target: "shairport-sync", header: "setPassword", content: {password: false}});
}

return {
	setShairportSyncPassword: setShairportSyncPassword,
	disableShairportSyncPassword: disableShairportSyncPassword,
	toggleUsePasswordForShairportSync: toggleUsePasswordForShairportSync
}

})();