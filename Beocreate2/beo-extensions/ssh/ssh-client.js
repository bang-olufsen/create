var ssh = (function() {

sshEnabled = false;
sshPasswordChanged = false;

$(document).on("general", function(event, data) {
	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "ssh") {
			$("#ssh-example-address").text(document.domain);
		}
	}
	
});

$(document).on("ssh", function(event, data) {
	if (data.header == "sshSettings") {
		
		if (data.content.sshEnabled) {
			sshEnabled = true;
			$("#ssh-enabled-toggle").addClass("on");
			$("#ssh-connect-instructions").removeClass("hidden");
		} else {
			sshEnabled = false;
			$("#ssh-enabled-toggle").removeClass("on");
			$("#ssh-connect-instructions").addClass("hidden");
		}
		
		if (data.content.sshPasswordChanged) {
			sshPasswordChanged = true;
			$("#ssh-change-password-button").addClass("grey").removeClass("black");
			$("#ssh-password-change-notice").addClass("hidden");
		} else {
			sshPasswordChanged = false;
			$("#ssh-change-password-button").addClass("black").removeClass("grey");
			$("#ssh-password-change-notice").removeClass("hidden");
		}
		
		beo.notify(false, "ssh");
	}
	
	if (data.header == "passwordCorrect") {
		if (data.content.correct) {
			changePassword(1);
		} else {
			currentPassword = null;
			changePassword(0.5);
		}
	}
	
	if (data.header == "passwordChanged") {
		beo.notify({title: "Password changed", icon: "common/symbols-black/checkmark-round.svg", id: "ssh"});
	}
});



function toggleEnabled() {
	enabled = (!sshEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning remote login on...", icon: "attention", timeout: false, id: "ssh"});
	} else {
		beo.notify({title: "Turning remote login off...", icon: "attention", timeout: false, id: "ssh"});
	}
	beo.send({target: "ssh", header: "sshEnabled", content: {enabled: enabled}});
}

currentPassword = null;
newPassword = null;
passwordChangeInProgress = false;

function changePassword(step, password) {
	if (!password) { // Start user interaction.
		switch (step) {
			case 0:
			case 0.5:
				if (step == 0 || passwordChangeInProgress) {
					passwordChangeInProgress = true;
					message = (step == 0) ? "Enter current system password." : "Incorrect current system password, please try again.";
					beo.startTextInput(2, "Change System Password", message, {placeholders: {password: "Password"}}, function(input) {
						if (input && input.password) {
							changePassword(0, input.password);
						} else {
							passwordChangeInProgress = false;
						}
					});
				}
				break;
			case 1:
			case 3:
				if (passwordChangeInProgress) {
					message = (step == 1) ? "Enter new system password." : "Passwords do not match, please enter new password again.";
					beo.startTextInput(2, "Change System Password", message, {placeholders: {password: "Password"}, minLength: {password: 6}}, function(input) {
						if (input && input.password) {
							changePassword(1, input.password);
						} else {
							currentPassword = null;
							newPassword = null;
							passwordChangeInProgress = false;
						}
					});
				}
				break;
			case 2:
				if (passwordChangeInProgress) {
					beo.startTextInput(2, "Change System Password", "Verify the new system password.", {placeholders: {password: "Password"}, minLength: {password: 6}}, function(input) {
						if (input && input.password) {
							changePassword(2, input.password);
						} else {
							newPassword = null;
							currentPassword = null;
							passwordChangeInProgress = false;
						}
					});
				}
				break;
		}
	} else { // Process entered password.
		switch (step) {
			case 0:
				currentPassword = password;
				beo.send({target: "ssh", header: "checkCurrentPassword", content: {currentPassword: password}});
				break;
			case 1:
				newPassword = password;
				changePassword(2);
				break;
			case 2:
				if (newPassword == password) { // Passwords match.
					beo.send({target: "ssh", header: "setNewPassword", content: {currentPassword: currentPassword, newPassword: password}});
				} else {
					changePassword(3);
				}
				newPassword = null;
				currentPassword = null;
				break;
		}
	}
}


return {
	toggleEnabled: toggleEnabled,
	changePassword: changePassword
};

})();