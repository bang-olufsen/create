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
		beo.notify(false, "spotifyd");
	}
	
	if (data.header == "logInError") {
		//beo.ask("spotifyd-login-error-prompt");
		beo.notify({title: "Error logging in", message: "The user name or password may be incorrect, or the account is not a Spotify Premium account.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
	}
});


function toggleEnabled() {
	enabled = (!spotifydEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning Spotify Connect on...", icon: "attention", timeout: false});
	} else {
		beo.notify({title: "Turning Spotify Connect off...", icon: "attention", timeout: false});
	}
	beo.send({target: "spotifyd", header: "spotifydEnabled", content: {enabled: enabled}});
}

function logIn() {
	
	beo.startTextInput(3, "Log In with Spotify", "Enter your Spotify user name and password.", {placeholders: {password: "Password", text: "User name"}, minLength: {text: 2, password: 3}}, function(input) {
		if (input) {
			beo.send({target: "spotifyd", header: "logIn", content: {username: input.text, password: input.password}});
			beo.notify({title: "Updating settings...", icon: "attention", timeout: false, id: "spotifyd"});
		}
	});
}

function logOut() {
	beo.send({target: "spotifyd", header: "logOut"});
	beo.notify({title: "Updating settings...", icon: "attention", timeout: false, id: "spotifyd"});
}


return {
	toggleEnabled: toggleEnabled,
	logIn: logIn,
	logOut: logOut
};

})();