var lastFM = (function() {


$(document).on("last-fm", function(event, data) {
	if (data.header == "lastFMSettings") {
		
		
		if (data.content.loggedInAs) {
			$("#lastfm-logged-in-section").removeClass("hidden");
			$("#lastfm-logged-out-section").addClass("hidden");
			$(".lastfm-username").text(data.content.loggedInAs);
			$("#open-my-lastfm").attr("href", "https://last.fm/user/"+data.content.loggedInAs);
		} else {
			$("#lastfm-logged-in-section").addClass("hidden");
			$("#lastfm-logged-out-section").removeClass("hidden");
			$(".lastfm-username").text("");
		}
		notify(false, "last-fm");
	}
	
	if (data.header == "logInError") {
		//ask("spotifyd-login-error-prompt");
		notify({title: "Error logging in", message: "The user name or password may be incorrect.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
	}
});


function logIn(input) {
	if (!input) {
		startTextInput(3, "Log In with Last.fm", "Enter your Last.fm user name and password.", {placeholders: {password: "Password", text: "User name"}, minLength: {text: 2, password: 3}}, lastFM.logIn);
	} else {
		send({target: "last-fm", header: "logIn", content: {username: input.text, password: input.password}});
		notify({title: "Updating settings...", icon: "attention", timeout: false, id: "last-fm"});
	}
}

function logOut() {
	send({target: "last-fm", header: "logOut"});
	notify({title: "Updating settings...", icon: "attention", timeout: false, id: "last-fm"});
}


return {
	logIn: logIn,
	logOut: logOut
};

})();