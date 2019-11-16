var software_update = (function() {

var newVersion = null;


$(document).on("software-update", function(event, data) {
	
	if (data.header == "badge") {
		if (data.content && data.content.badge) {
			$(".software-update-badge").text("1").addClass("badge");
		} else {
			$(".software-update-badge").text("").removeClass("badge");
		}
	}
	
	if (data.header == "updateAvailable" && data.content.version) {
		newVersion = data.content.version;
		menuOptions = {
			value: newVersion,
			static: true
		}
		if ($("body").hasClass("hifiberry-os")) {
			menuOptions.label = "HiFiBerryOS";
			menuOptions.icon = extensions["product-information"].assetPath+"/symbols-black/hifiberry.svg"
		} else {
			menuOptions.label = "Beocreate 2";
			menuOptions.icon = extensions["product-information"].assetPath+"/symbols-black/create.svg"
		}
		
		$(".no-update-available").addClass("hidden");
		$(".software-update-available").removeClass("hidden");
		$("#update-available-container").empty();
		$("#update-available-container").append(createMenuItem(menuOptions));
		
		$("#update-release-notes").empty();
		if (data.content.releaseNotes) {
			releaseNotes = data.content.releaseNotes.split("\n");
			console.log(releaseNotes);
			openUL = "";
			notesHTML = ""
			for (var i = 0; i < releaseNotes.length; i++) {
		
				if (releaseNotes[i].trim().charAt(0) == "-") {
					// A dash is a list item.
					if (!openUL) {
						openUL += "\n<ul>";
					}
					openUL += "\n<li>"+releaseNotes[i].trim().substring(2)+"</li>"
				} else {
					// Normal lines make p elements.
					if (openUL) {
						openUL += "\n</ul>";
						notesHTML += openUL;
						openUL = "";
					}
					notesHTML += "<p>"+releaseNotes[i].trim()+"</p";
				}
			}
			if (openUL) {
				openUL += "\n</ul>";
				notesHTML += openUL;
			}
			$("#update-release-notes").append(notesHTML);
		} else {
			$("#update-release-notes").html("<p>No release notes included.</p>");
		}
	}
	
	if (data.header == "upToDate") {
		$(".no-update-available").removeClass("hidden");
		$(".software-update-available").addClass("hidden");
		newVersion = null;
	}
	
	if (data.header == "updating") {
		notifyOptions = {title: "Updating product...", timeout: false, icon: "attention"};
		if (data.content.progress != undefined) {
			notifyOptions.progress = data.content.progress;
		}
		switch (data.content.phase) {
			case "download":
				notifyOptions.message = "Downloading...";
				break;
			case "extractingFirmware":
			case "resizing":
			case "extractingKernel":
				notifyOptions.message = "Unpacking, this will take some time...";
				break;
			case "copyingFiles":
				notifyOptions.message = "Moving things over...";
				break;
			case "finalising":
				notifyOptions.message = "Finalising...";
				break;
			case "done":
				notifyOptions.title = "Product updated";
				notifyOptions.message = "The product has been updated and it will now restart to finish the process. This may take some time, please wait.";
				sendToProductView({header: "autoReconnect", content: {status: "updateComplete", systemID: product_information.systemID(), systemName: product_information.systemName()}});
				noConnectionNotifications = true;
				maxConnectionAttempts = 30;
				break;
			case "doneSimulation":
				notifyOptions.title = "Product updated";
				notifyOptions.message = "The product update simulation has finished. The product would now restart, in case of a real update. Start Beocreate 2 in non-developer mode to update.";
				notifyOptions.buttonTitle = "Done";
				notifyOptions.buttonAction = "close";
				notifyOptions.icon = null;
				break;
		}
		notify(notifyOptions, "software-update");
	}
	
	if (data.header == "updateError") {
		notifyOptions = {title: "Update unsuccessful", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"};
		if (data.content.reason) {
			switch (data.content.reason) {
				case "downloadError":
					notifyOptions.message = "The update could not be downloaded. Please try again later, or contact support if the problem persists.";
					break;
			}
		}
		notify(notifyOptions, "software-update");
	}
});


function install() {
	send({target: "software-update", header: "install"});
}


return {
	install: install
};

})();