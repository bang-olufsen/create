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
		beo.notify(false, "last-fm");
	}
	
	if (data.header == "logInError") {
		//beo.ask("spotifyd-login-error-prompt");
		beo.notify({title: "Error logging in", message: "The user name or password may be incorrect.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
	}
});


function logIn() {
	beo.startTextInput(3, "Log In with Last.fm", "Enter your Last.fm user name and password.", {placeholders: {password: "Password", text: "User name"}, minLength: {text: 2, password: 3}}, function(input) {
		if (input) {
			beo.send({target: "last-fm", header: "logIn", content: {username: input.text, password: input.password}});
			beo.notify({title: "Updating settings...", icon: "attention", timeout: false, id: "last-fm"});
		}
	});
}

function logOut() {
	beo.send({target: "last-fm", header: "logOut"});
	beo.notify({title: "Updating settings...", icon: "attention", timeout: false, id: "last-fm"});
}


return {
	logIn: logIn,
	logOut: logOut
};

})();