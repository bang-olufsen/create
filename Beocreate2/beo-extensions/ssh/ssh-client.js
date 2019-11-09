var ssh = (function() {

sshEnabled = false;
sshPasswordChanged = false;

$(document).on("ssh", function(event, data) {
	if (data.header == "sshSettings") {
		
		if (data.content.sshEnabled) {
			sshEnabled = true;
			$("#ssh-enabled-toggle").addClass("on");
		} else {
			sshEnabled = false;
			$("#ssh-enabled-toggle").removeClass("on");
		}
		
		if (data.content.sshPasswordChanged) {
			sshPasswordChanged = true;
			$("#ssh-password-change-notice").addClass("hidden");
		} else {
			sshPasswordChanged = false;
			$("#ssh-password-change-notice").removeClass("hidden");
		}
		
		notify(false, "ssh");
	}
});



function toggleEnabled() {
	enabled = (!sshEnabled) ? true : false;
	if (enabled) {
		notify({title: "Turning remote login on...", icon: "attention", timeout: false, id: "ssh"});
	} else {
		notify({title: "Turning remote login off...", icon: "attention", timeout: false, id: "ssh"});
	}
	send({target: "ssh", header: "sshEnabled", content: {enabled: enabled}});
}

function changePassword() {
	
}


return {
	toggleEnabled: toggleEnabled,
	changePassword: changePassword
};

})();