var spotifyd = (function() {

var spotifydEnabled = false;


$(document).on("spotifyd", function(event, data) {
	if (data.header == "spotifydSettings") {
		
		if (data.content.spotifydEnabled) {
			spotifydEnabled = true;
			$("#spotifyd-enabled-toggle").addClass("on");
		} else {
			spotifydEnabled = false;
			$("#spotifyd-enabled-toggle").removeClass("on");
		}
		
		if (data.content.loggedInAs) {
			$("#spotifyd-logged-in-section").removeClass("hidden");
			$("#spotifyd-logged-out-section").addClass("hidden");
			$(".spotifyd-username").text(data.content.loggedInAs);
		} else {
			$("#spotifyd-logged-in-section").addClass("hidden");
			$("#spotifyd-logged-out-section").removeClass("hidden");
			$(".spotifyd-username").text("");
		}
		notify(false, "spotifyd");
	}
	
	if (data.header == "logInError") {
		ask("spotifyd-login-error-prompt");
	}
});


function toggleEnabled() {
	enabled = (!spotifydEnabled) ? true : false;
	if (enabled) {
		notify({title: "Turning Spotify Connect on...", icon: "attention", timeout: false, id: "spotifyd"});
	} else {
		notify({title: "Turning Spotify Connect off...", icon: "attention", timeout: false, id: "spotifyd"});
	}
	send({target: "spotifyd", header: "spotifydEnabled", content: {enabled: enabled}});
}

function logIn(input) {
	if (!input) {
		startTextInput(3, "Log In with Spotify", "Enter your Spotify user name and password.", {placeholders: {password: "Password", text: "User name"}, minLength: {text: 2, password: 3}}, spotifyd.logIn);
	} else {
		send({target: "spotifyd", header: "logIn", content: {username: input.text, password: input.password}});
		notify({title: "Updating settings...", icon: "attention", timeout: false, id: "spotifyd"});
	}
}

function logOut() {
	send({target: "spotifyd", header: "logOut"});
	notify({title: "Updating settings...", icon: "attention", timeout: false, id: "spotifyd"});
}


return {
	toggleEnabled: toggleEnabled,
	logIn: logIn,
	logOut: logOut
};

})();