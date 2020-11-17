var spotify = (function() {

var spotifyEnabled = false;


$(document).on("spotify", function(event, data) {
	if (data.header == "spotifySettings") {
		
		if (data.content.spotifyEnabled) {
			spotifyEnabled = true;
			$("#spotify-enabled-toggle").addClass("on");
		} else {
			spotifyEnabled = false;
			$("#spotify-enabled-toggle").removeClass("on");
		}
		
		if (data.content.loggedInAs) {
			$("#spotify-logged-in-section").removeClass("hidden");
			$("#spotify-logged-out-section").addClass("hidden");
			$(".spotify-username").text(data.content.loggedInAs);
		} else {
			$("#spotify-logged-in-section").addClass("hidden");
			$("#spotify-logged-out-section").removeClass("hidden");
			$(".spotify-username").text("");
		}
		beo.notify(false, "spotify");
	}
	
	if (data.header == "logInError") {
		//beo.ask("spotify-login-error-prompt");
		beo.notify({title: "Error logging in", message: "The user name or password may be incorrect, or the account is not a Spotify Premium account.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
	}
});


function toggleEnabled() {
	enabled = (!spotifyEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning Spotify Connect on...", icon: "attention", timeout: false});
	} else {
		beo.notify({title: "Turning Spotify Connect off...", icon: "attention", timeout: false});
	}
	beo.send({target: "spotify", header: "spotifyEnabled", content: {enabled: enabled}});
}

function logIn() {
	
	beo.startTextInput(3, "Log In with Spotify", "Enter your Spotify user name and password.", {placeholders: {password: "Password", text: "User name"}, minLength: {text: 2, password: 3}}, function(input) {
		if (input) {
			beo.send({target: "spotify", header: "logIn", content: {username: input.text, password: input.password}});
			beo.notify({title: "Updating settings...", icon: "attention", timeout: false, id: "spotify"});
		}
	});
}

function logOut() {
	beo.send({target: "spotify", header: "logOut"});
	beo.notify({title: "Updating settings...", icon: "attention", timeout: false, id: "spotify"});
}


return {
	toggleEnabled: toggleEnabled,
	logIn: logIn,
	logOut: logOut
};

})();